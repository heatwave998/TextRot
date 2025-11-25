
import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect, useCallback } from 'react';
import { DesignState, Point } from '../types';
import { Upload, Maximize2, PenTool } from 'lucide-react';

interface CanvasProps {
  imageSrc: string | null;
  design: DesignState;
  enableZoom: boolean;
  className?: string;
  onImageUpload: (file: File) => void;
  onPathDrawn: (points: Point[]) => void;
}

export interface CanvasHandle {
  exportImage: () => Promise<string>;
  triggerFileUpload: () => void;
}

// Helper: Hex to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// Helper: Interpolate Colors
const interpolateColor = (c1: string, c2: string, t: number) => {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);
    return `rgb(${r},${g},${b})`;
};

// Helper: Iterative Weighted Moving Average for Smoothing
const getSmoothedPoints = (points: Point[], iterations: number): Point[] => {
    if (points.length < 3 || iterations <= 0) return points;
    
    let currentPoints = [...points];
    
    // Apply smoothing iterations
    for (let k = 0; k < iterations; k++) {
        const nextPoints = [...currentPoints];
        // Skip first and last point to anchor the ends
        for (let i = 1; i < currentPoints.length - 1; i++) {
            const prev = currentPoints[i - 1];
            const curr = currentPoints[i];
            const next = currentPoints[i + 1];

            // Weighted Average: 15% neighbors, 70% self
            // This is a simple low-pass filter to remove jitter
            nextPoints[i] = {
                x: prev.x * 0.15 + curr.x * 0.7 + next.x * 0.15,
                y: prev.y * 0.15 + curr.y * 0.7 + next.y * 0.15
            };
        }
        currentPoints = nextPoints;
    }
    return currentPoints;
};

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ imageSrc, design, enableZoom, className, onImageUpload, onPathDrawn }, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Interaction States
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawingPath, setIsDrawingPath] = useState(false);
  const [isMovingPath, setIsMovingPath] = useState(false);
  
  const dragStartRef = useRef({ x: 0, y: 0 });
  const currentPathRef = useRef<Point[]>([]);
  const movePathStartRef = useRef<{mouse: Point, points: Point[]} | null>(null);
  
  const [imgDims, setImgDims] = useState<{ w: number, h: number } | null>(null);

  // Reset zoom and get dims when the image changes
  useEffect(() => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
    
    // Critical Fix: Clear dimensions immediately. 
    // This prevents the canvas from rendering with stale dimensions (e.g. 1:1) 
    // while the new image (e.g. 9:16) is loading, which causes visual distortion.
    setImgDims(null);

    if (imageSrc) {
        const i = new Image();
        i.onload = () => {
            setImgDims({ w: i.naturalWidth, h: i.naturalHeight });
        };
        i.onerror = () => {
            console.error("Failed to load image dimensions");
            setImgDims(null); 
        };
        i.src = imageSrc;
    } else {
        setImgDims(null);
    }
  }, [imageSrc]);

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!enableZoom || !imageSrc) return;
    
    const scaleAmount = -e.deltaY * 0.001; 
    const newScale = Math.min(Math.max(0.1, zoomScale + scaleAmount), 5); 
    
    setZoomScale(newScale);
  };

  // Helper to map screen event coordinates to Intrinsic Image Coordinates
  const getIntrinsicCoordinates = (e: React.MouseEvent) => {
      const contentDiv = e.currentTarget.querySelector('.canvas-content') as HTMLElement;
      if (!contentDiv || !imgDims) return null;
      
      // getBoundingClientRect returns the dimensions *including* transform (scale)
      const rect = contentDiv.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0) return null;

      // 1. Calculate relative position within the visible box (0 to 1)
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;

      // 2. Map to intrinsic image dimensions
      return {
          x: relX * imgDims.w,
          y: relY * imgDims.h
      };
  };

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
      if (!imageSrc) return;

      const coords = getIntrinsicCoordinates(e);

      // Mode: Drawing Path
      if (design.isPathInputMode) {
          e.preventDefault();
          
          if (!coords) return;

          setIsDrawingPath(true);
          currentPathRef.current = [coords];
          return;
      }

      // Mode: Moving Path
      if (design.isPathMoveMode && design.pathPoints.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          
          if (!coords) return;

          setIsMovingPath(true);
          movePathStartRef.current = {
              mouse: coords,
              points: [...design.pathPoints]
          };
          return;
      }

      // Mode: Panning (Left Click)
      if (enableZoom && e.button === 0) {
          setIsPanning(true);
          dragStartRef.current = {
              x: e.clientX - pan.x,
              y: e.clientY - pan.y
          };
          e.preventDefault();
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const coords = getIntrinsicCoordinates(e);

      // Drawing
      if (isDrawingPath) {
          if (!coords) return;
          
          currentPathRef.current.push(coords);
          
          // Live render the path line
          renderToContext(textCanvasRef.current?.getContext('2d') || null, imgDims?.w || 0, imgDims?.h || 0, true);
          return;
      }

      // Moving Path
      if (isMovingPath && movePathStartRef.current) {
          e.preventDefault();
          if (!coords) return;

          const dx = coords.x - movePathStartRef.current.mouse.x;
          const dy = coords.y - movePathStartRef.current.mouse.y;

          const newPoints = movePathStartRef.current.points.map(p => ({
              x: p.x + dx,
              y: p.y + dy
          }));

          onPathDrawn(newPoints);
          return;
      }

      // Panning
      if (isPanning) {
          e.preventDefault();
          setPan({
              x: e.clientX - dragStartRef.current.x,
              y: e.clientY - dragStartRef.current.y
          });
      }
  };

  const handleMouseUp = () => {
      if (isDrawingPath) {
          setIsDrawingPath(false);
          // Simplify path slightly to reduce jitter?
          onPathDrawn(currentPathRef.current);
          currentPathRef.current = [];
      }
      if (isMovingPath) {
          setIsMovingPath(false);
          movePathStartRef.current = null;
      }
      setIsPanning(false);
  };

  const calculateAspectRatio = (width: number, height: number) => {
    const ratio = width / height;
    if (Math.abs(ratio - 1) < 0.01) return '1:1';
    if (Math.abs(ratio - 4/3) < 0.01) return '4:3';
    if (Math.abs(ratio - 3/4) < 0.01) return '3:4';
    if (Math.abs(ratio - 3/2) < 0.01) return '3:2';
    if (Math.abs(ratio - 2/3) < 0.01) return '2:3';
    if (Math.abs(ratio - 16/9) < 0.01) return '16:9';
    if (Math.abs(ratio - 9/16) < 0.01) return '9:16';
    if (Math.abs(ratio - 21/9) < 0.01) return '21:9';
    
    const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
    const divisor = gcd(width, height);
    if (divisor < 10) return ratio.toFixed(2);
    return `${width / divisor}:${height / divisor}`;
  };


  // --- Core Rendering Logic (Shared between Preview and Export) ---

  const renderToContext = useCallback((
      ctx: CanvasRenderingContext2D | null, 
      width: number, 
      height: number,
      isPreview: boolean = false
  ) => {
    if (!ctx) return;

    // Reset Context State
    ctx.clearRect(0, 0, width, height);
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    // DETERMINE BLENDING MODE
    // In Preview: We draw normally onto the transparent canvas, and use CSS 'mix-blend-mode' 
    // on the canvas element to blend with the underlying <img>. 
    // In Export: We draw the image onto the canvas first, so we use globalCompositeOperation to blend text onto it.
    // Also handling 'normal' which isn't a valid globalCompositeOperation (default is source-over).
    const effectiveBlendMode = isPreview ? 'source-over' : (design.blendMode === 'normal' ? 'source-over' : design.blendMode);

    // *** APPLY SMOOTHING ***
    // We only smooth the main design path. We do NOT smooth the "currently drawing" line 
    // because that feels laggy to the user.
    const activePointsRaw = isDrawingPath ? currentPathRef.current : design.pathPoints;
    const activePoints = isDrawingPath ? activePointsRaw : getSmoothedPoints(activePointsRaw, design.pathSmoothing);

    // Draw Path Line Helper (For Drawing OR Moving)
    // We show the line if:
    // 1. User is currently drawing a new path (isDrawingPath)
    // 2. User is in "Move Mode" and a path exists (isPathMoveMode)
    const showPathLine = isPreview && (
        (isDrawingPath && activePoints.length > 1) ||
        (design.isPathMoveMode && activePoints.length > 1)
    );

    if (showPathLine) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = '#ec4899'; // Pink-500
        ctx.lineWidth = Math.max(2, width * 0.003); 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Add visual distinction for Move Mode
        if (design.isPathMoveMode && !isDrawingPath) {
             ctx.setLineDash([15, 15]); 
             ctx.globalAlpha = 0.6;
        }
        
        ctx.moveTo(activePoints[0].x, activePoints[0].y);
        for(const p of activePoints) {
            ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.restore();
        
        // If drawing, we stop here (don't render text).
        // If moving, we continue to render text so user can see what they are moving.
        if (isDrawingPath) return; 
    }

    // Setup Font
    const fontSize = (design.textSize / 100) * width;
    const fontWeight = design.isBold ? 'bold' : 'normal';
    const fontStyle = design.isItalic ? 'italic' : 'normal';
    
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${design.fontFamily}"`;
    ctx.textAlign = design.textAlign;
    ctx.textBaseline = 'middle';

    // Helper for Letter Spacing
    const scaledLetterSpacing = design.letterSpacing * (fontSize / 50); 

    // Text & Content
    const rawText = design.isUppercase ? design.textOverlay.toUpperCase() : design.textOverlay;
    const lines = rawText.split('\n');
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;

    // Measure Max Width for Gradient Calculation (Updated for Kerning)
    let maxLineWidth = 0;
    lines.forEach(line => {
        const chars = line.split('');
        // Total width = sum of chars + total spacing
        const w = chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) + Math.max(0, (chars.length - 1) * scaledLetterSpacing);
        if (w > maxLineWidth) maxLineWidth = w;
    });

    // Colors & Gradients (Prepare for Normal Mode)
    let normalModeFillStyle: string | CanvasGradient = design.textColor;
    
    if (design.specialEffect === 'gradient' && !design.isHollow) {
        // Gradient relative to the text block center (0,0)
        const r = Math.sqrt((maxLineWidth/2)**2 + (totalHeight/2)**2);
        const angleRad = (design.effectAngle * Math.PI) / 180;
        
        // Calculate gradient vector centered at 0,0
        const x1 = -Math.cos(angleRad) * r;
        const y1 = -Math.sin(angleRad) * r;
        const x2 = Math.cos(angleRad) * r;
        const y2 = Math.sin(angleRad) * r;

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        const halfSpread = design.effectIntensity / 2; 
        const stop1 = Math.max(0, Math.min(1, (50 - halfSpread) / 100));
        const stop2 = Math.max(0, Math.min(1, (50 + halfSpread) / 100));

        grad.addColorStop(stop1, design.textColor);
        grad.addColorStop(stop2, design.effectColor);
        normalModeFillStyle = grad;
    }

    // --- DRAWING HELPER: Text-On-Path vs Normal ---
    
    const drawTextItem = (text: string, offsetX: number, offsetY: number, colorOverride?: string, forceHollow?: boolean) => {
        // Determine if we are drawing hollow or filled for this specific pass
        const isHollow = forceHollow !== undefined ? forceHollow : design.isHollow;
        
        ctx.save();

        // --- PATH MODE ---
        // Use activePoints (which might be smoothed)
        if (activePoints && activePoints.length > 1) {
            // Logic for drawing text along the activePoints
            const path = activePoints;
            const distances = [0];
            for (let i = 1; i < path.length; i++) {
                const dx = path[i].x - path[i-1].x;
                const dy = path[i].y - path[i-1].y;
                distances.push(distances[i-1] + Math.sqrt(dx*dx + dy*dy));
            }
            const totalPathLen = distances[distances.length - 1];

            // Measure Text
            let totalTextWidth = 0;
            for (const char of text) {
                totalTextWidth += ctx.measureText(char).width + scaledLetterSpacing;
            }

            // Start Position
            let currentDist = 0;
            if (design.textAlign === 'center') currentDist = (totalPathLen - totalTextWidth) / 2;
            if (design.textAlign === 'right') currentDist = totalPathLen - totalTextWidth;
            
            currentDist += offsetX;
            const normalOffset = offsetY;

            // Render Chars
            for (const char of text) {
                const charWidth = ctx.measureText(char).width;
                const charMidDist = currentDist + (charWidth / 2);

                if (charMidDist >= 0 && charMidDist <= totalPathLen) {
                    // Find segment
                    let idx = 0;
                    while (distances[idx + 1] < charMidDist && idx < distances.length - 2) {
                        idx++;
                    }
                    
                    // Interpolate Position
                    const p1 = path[idx];
                    const p2 = path[idx+1];
                    const segStart = distances[idx];
                    const segLen = distances[idx+1] - segStart;
                    const t = (charMidDist - segStart) / (segLen || 1); 

                    const xBase = p1.x + (p2.x - p1.x) * t;
                    const yBase = p1.y + (p2.y - p1.y) * t;
                    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

                    // Apply Normal Offset
                    const xFinal = xBase + Math.sin(angle) * normalOffset; 
                    const yFinal = yBase - Math.cos(angle) * normalOffset; 

                    ctx.translate(xFinal, yFinal);
                    ctx.rotate(angle);
                    
                    // Determine Color for Path Mode
                    let activeFill = colorOverride || design.textColor;
                    
                    // Path Mode Gradient Implementation (Interpolation)
                    if (!colorOverride && design.specialEffect === 'gradient' && !isHollow) {
                        const gradT = Math.max(0, Math.min(1, charMidDist / totalPathLen));
                        activeFill = interpolateColor(design.textColor, design.effectColor, gradT);
                    }

                    // Draw
                    if (isHollow) {
                         ctx.lineWidth = design.hasOutline ? design.outlineWidth : 2; 
                         ctx.strokeStyle = colorOverride || (design.hasOutline ? design.outlineColor : design.textColor);
                         ctx.strokeText(char, 0, 0);
                    } else {
                         ctx.fillStyle = activeFill;
                         ctx.fillText(char, 0, 0);
                         
                         if (design.hasOutline) {
                             ctx.lineWidth = design.outlineWidth;
                             ctx.strokeStyle = design.outlineColor;
                             ctx.strokeText(char, 0, 0);
                         }
                    }

                    ctx.rotate(-angle);
                    ctx.translate(-xFinal, -yFinal);
                }
                currentDist += charWidth + scaledLetterSpacing;
            }

        } 
        // --- NORMAL MODE (Updated for Kerning) ---
        else {
            const xPos = (design.overlayPosition.x / 100) * width;
            const yPos = (design.overlayPosition.y / 100) * height;
            
            ctx.translate(xPos, yPos);
            
            // Transforms
            if (design.rotation !== 0) ctx.rotate((design.rotation * Math.PI) / 180);
            const sX = design.flipX ? -1 : 1;
            const sY = design.flipY ? -1 : 1;
            if (sX !== 1 || sY !== 1) ctx.scale(sX, sY);

            // Alignment Offset
            const startY = -(totalHeight / 2) + (lineHeight / 2);

            lines.forEach((line, i) => {
                const lineY = startY + (i * lineHeight) + offsetY;
                
                // Manual Kerning / Placement Loop
                const chars = line.split('');
                // Calculate total line width (chars + spacing)
                const charWidths = chars.map(c => ctx.measureText(c).width);
                const totalLineWidth = charWidths.reduce((a, b) => a + b, 0) + (Math.max(0, chars.length - 1) * scaledLetterSpacing);
                
                let cursorX = offsetX;
                
                // Align the line relative to the insertion point (0,0 local)
                if (design.textAlign === 'center') {
                    cursorX -= totalLineWidth / 2;
                } else if (design.textAlign === 'right') {
                    cursorX -= totalLineWidth;
                }
                // Left align stays at 0

                // Important: Reset alignment to Left for character-by-character drawing
                ctx.textAlign = 'left';

                chars.forEach((char, idx) => {
                    if (isHollow) {
                        ctx.lineWidth = design.hasOutline ? design.outlineWidth : 2; 
                        ctx.strokeStyle = colorOverride || (design.hasOutline ? design.outlineColor : design.textColor);
                        ctx.strokeText(char, cursorX, lineY);
                    } else {
                        ctx.fillStyle = colorOverride || normalModeFillStyle;
                        ctx.fillText(char, cursorX, lineY);
                        
                        if (design.hasOutline) {
                            ctx.lineWidth = design.outlineWidth;
                            ctx.strokeStyle = design.outlineColor;
                            ctx.strokeText(char, cursorX, lineY);
                        }
                    }
                    cursorX += charWidths[idx] + scaledLetterSpacing;
                });
            });

            // Undo Transforms
            if (sX !== 1 || sY !== 1) ctx.scale(sX, sY);
            if (design.rotation !== 0) ctx.rotate(-(design.rotation * Math.PI) / 180);
            ctx.translate(-xPos, -yPos);
        }

        ctx.restore();
    };


    // --- EFFECTS PIPELINE ---

    // 1. Shadow Pass
    if (design.hasShadow) {
        ctx.save();
        ctx.globalAlpha = design.opacity; // Shadow should respect main opacity
        ctx.globalCompositeOperation = effectiveBlendMode as GlobalCompositeOperation;

        ctx.shadowColor = design.shadowColor;
        ctx.shadowBlur = (design.shadowBlur / 100) * (fontSize * 2);
        
        const shadowRad = (design.shadowAngle * Math.PI) / 180;
        const shadowDist = (design.shadowOffset / 100) * fontSize;
        const sx = Math.cos(shadowRad) * shadowDist;
        const sy = Math.sin(shadowRad) * shadowDist;
        
        const OFFSET_HACK = 20000; // Move off-screen
        ctx.translate(-OFFSET_HACK, 0);
        ctx.shadowOffsetX = sx + OFFSET_HACK;
        ctx.shadowOffsetY = sy;
        
        // Draw the "caster" offscreen
        drawTextItem(rawText, 0, 0, design.isHollow ? undefined : design.textColor, design.isHollow);
        ctx.restore();
    }

    // 2. Special Effects (Echo / Glitch)
    if (design.specialEffect === 'echo') {
        const echoCount = 5;
        const startOpacity = design.opacity;
        const angleRad = (design.effectAngle * Math.PI) / 180;
        const distanceStep = design.effectIntensity * (width * 0.0005); 

        ctx.globalCompositeOperation = effectiveBlendMode as GlobalCompositeOperation;
        
        for (let i = echoCount; i > 0; i--) {
             const dx = Math.cos(angleRad) * distanceStep * i;
             const dy = Math.sin(angleRad) * distanceStep * i;

             ctx.globalAlpha = startOpacity * (0.1 + (0.5 * (1 - i/echoCount))); 
             drawTextItem(rawText, dx, dy, undefined, design.isHollow);
        }
    }

    if (design.specialEffect === 'glitch') {
        const offset = (design.effectIntensity / 100) * (fontSize * 0.5);
        const angleRad = (design.effectAngle * Math.PI) / 180;

        if (design.isRainbowGlitch) {
             const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
             const spread = offset * 1.2; 
             
             ctx.globalAlpha = 1.0; 
             ctx.globalCompositeOperation = 'source-over';

             colors.forEach((c, i) => {
                 const mid = Math.floor(colors.length / 2); 
                 const dist = (i - mid) * spread;
                 const dx = Math.cos(angleRad) * dist;
                 const dy = Math.sin(angleRad) * dist;
                 drawTextItem(rawText, dx, dy, c, false);
             });

        } else {
            const c1 = design.effectColor;
            const c2 = design.effectColor2;
            
            // Layer 1 - Full Brightness & Glow
            ctx.save();
            ctx.globalAlpha = 1.0; 
            ctx.globalCompositeOperation = 'screen'; 
            ctx.shadowColor = c1;
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
            drawTextItem(rawText, -offset, 0, c1, false);
            ctx.restore();

            // Layer 2 - Full Brightness & Glow
            ctx.save();
            ctx.globalAlpha = 1.0; 
            ctx.globalCompositeOperation = 'screen';
            ctx.shadowColor = c2;
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
            drawTextItem(rawText, offset, 0, c2, false); 
            ctx.restore();
        }
    }

    // 3. Main Text Pass
    ctx.save(); // Save state before applying main text specific props
    
    ctx.globalAlpha = design.opacity;
    ctx.globalCompositeOperation = effectiveBlendMode as GlobalCompositeOperation;
    
    drawTextItem(rawText, 0, 0, undefined, undefined); // Use defaults
    
    ctx.restore(); // Restore cleanup

  }, [design, isDrawingPath]);

  // --- Live Preview Renderer ---
  useEffect(() => {
      if (textCanvasRef.current && imgDims) {
          const ctx = textCanvasRef.current.getContext('2d');
          // Sync canvas size to image size
          textCanvasRef.current.width = imgDims.w;
          textCanvasRef.current.height = imgDims.h;
          
          renderToContext(ctx, imgDims.w, imgDims.h, true);
      }
  }, [imgDims, design, renderToContext, isDrawingPath]);


  // --- Export Logic ---
  const generateExport = useCallback(async (): Promise<string> => {
    if (!imageSrc) throw new Error("No image to export");
    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get canvas context");

    const img = new Image();
    await new Promise((resolve, reject) => { 
        img.onload = resolve; 
        img.onerror = reject;
        img.src = imageSrc; 
    });

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // 1. Draw Background
    ctx.drawImage(img, 0, 0);

    // 2. Draw Visuals using shared logic
    // isPreview = false ensures correct globalCompositeOperation is used directly on the image
    renderToContext(ctx, canvas.width, canvas.height, false);

    return canvas.toDataURL('image/png');
  }, [imageSrc, renderToContext]);

  useImperativeHandle(ref, () => ({
    exportImage: generateExport,
    triggerFileUpload: () => fileInputRef.current?.click()
  }), [generateExport]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingFile(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingFile(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingFile(false);
    if (e.dataTransfer.files?.[0]?.type.startsWith('image/')) {
        onImageUpload(e.dataTransfer.files[0]);
    }
  };

  const getEmptyStateRatio = () => {
    const [w, h] = design.aspectRatio.split(':').map(Number);
    let ratio = w / h;
    if (design.orientation === 'portrait') {
        ratio = h / w;
    }
    return `${ratio}`;
  };
  
  // Cursor logic
  let cursorStyle = 'default';
  if (design.isPathInputMode) cursorStyle = 'crosshair';
  else if (design.isPathMoveMode) cursorStyle = 'move'; // New cursor for move mode
  else if (isPanning) cursorStyle = 'grabbing';
  else if (imageSrc) cursorStyle = 'grab';


  return (
    <>
    <input 
        type="file" 
        ref={fileInputRef}
        className="hidden" 
        accept="image/*"
        onChange={(e) => { if (e.target.files?.[0]) onImageUpload(e.target.files[0]); }}
    />
    <div 
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: cursorStyle }}
    >
      <div 
        style={{
           aspectRatio: imgDims ? `${imgDims.w}/${imgDims.h}` : getEmptyStateRatio(),
           transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
           transformOrigin: 'center center'
        }}
        className={`
          canvas-content
          relative overflow-hidden shadow-2xl rounded-[3px] bg-neutral-900 
          flex items-center justify-center select-none transition-all duration-0 ease-linear
          ${!imageSrc ? 'w-full max-w-md' : 'w-auto h-auto max-w-full max-h-full'}
          ${isDraggingFile ? 'ring-2 ring-pink-500 bg-neutral-800' : ''}
          ${className}
        `}
      >
        {imageSrc ? (
          <>
            {/* Background Image */}
            <img 
              key={imageSrc} // FORCE NEW ELEMENT
              src={imageSrc} 
              alt="Background" 
              className="max-w-full max-h-full object-contain pointer-events-none"
              width={imgDims?.w}
              height={imgDims?.h}
            />
            
            {/* Text / Visuals Layer - Replaces DOM Text */}
            <canvas 
                ref={textCanvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-150 ${imgDims ? 'opacity-100' : 'opacity-0'}`}
                style={{ 
                    // Apply mix-blend-mode via CSS for preview so the transparent canvas blends with the underlying <img>
                    // Temporarily disable blending when moving/drawing path so guidance lines remain visible
                    mixBlendMode: (design.isPathInputMode || design.isPathMoveMode) ? 'normal' : design.blendMode as any 
                }}
            />

            {/* Path Hint Overlay (if path exists but not drawing) */}
            {design.isPathInputMode && design.pathPoints.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/50 backdrop-blur px-4 py-2 rounded-full text-white text-xs flex items-center gap-2 border border-white/10 animate-pulse">
                        <PenTool size={12} />
                        <span>Draw path on image...</span>
                    </div>
                </div>
            )}
          </>
        ) : (
          <div 
              onClick={() => fileInputRef.current?.click()}
              className="text-neutral-600 flex flex-col items-center gap-4 cursor-pointer hover:text-neutral-400 transition-colors group p-8"
          >
            <div className="relative">
               <Upload className={`w-16 h-16 opacity-20 transition-transform duration-300 ${isDraggingFile ? 'scale-110 text-pink-500 opacity-50' : 'group-hover:-translate-y-1'}`} />
            </div>
            
            <div className="font-mono text-sm opacity-50 group-hover:opacity-80 transition-opacity text-center">
              {isDraggingFile ? 'Drop to Upload' : (
                  <div className="flex flex-col items-center gap-1">
                      <span>Drag and Drop Image here</span>
                      <span className="text-xs opacity-50 my-1">or</span>
                      <span>Click to Upload</span>
                  </div>
              )}
            </div>
          </div>
        )}
        
        {imageSrc && (
          <div className="absolute inset-0 pointer-events-none opacity-10 border-neutral-500">
             <div className="w-full h-1/2 border-b border-dashed border-white/30 absolute top-0"></div>
             <div className="h-full w-1/2 border-r border-dashed border-white/30 absolute left-0"></div>
          </div>
        )}
      </div>

      {/* Info Widget - Outside scale transform */}
      {imageSrc && imgDims && (
        <div className="absolute bottom-4 right-4 z-50 bg-black/80 backdrop-blur text-neutral-300 text-[10px] font-medium px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-3 shadow-xl select-none pointer-events-none">
            <span className="flex items-center gap-1">
                <Maximize2 size={10} className="text-neutral-400" />
                {imgDims.w} × {imgDims.h}
            </span>
            <span className="w-px h-3 bg-white/10"></span>
            <span>{calculateAspectRatio(imgDims.w, imgDims.h)}</span>
            <span className="w-px h-3 bg-white/10"></span>
            <span>{((imgDims.w * imgDims.h) / 1000000).toFixed(1)} MP</span>
        </div>
      )}
    </div>
    </>
  );
});

export default Canvas;

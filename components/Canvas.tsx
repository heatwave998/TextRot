
import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { DesignState } from '../types';
import { Upload } from 'lucide-react';

interface CanvasProps {
  imageSrc: string | null;
  design: DesignState;
  enableZoom: boolean;
  className?: string;
  onImageUpload: (file: File) => void;
}

export interface CanvasHandle {
  exportImage: () => Promise<string>;
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ imageSrc, design, enableZoom, className, onImageUpload }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  // Handle mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!enableZoom || !imageSrc) return;
    
    // e.deltaY is usually 100 or -100. We want smooth zoom.
    // -deltaY means zooming IN (up scroll), +deltaY means zooming OUT (down scroll)
    const scaleAmount = -e.deltaY * 0.001; 
    const newScale = Math.min(Math.max(0.5, zoomScale + scaleAmount), 5);
    
    setZoomScale(newScale);
  };

  // Function to perform the actual canvas drawing for export
  const generateExport = async (): Promise<string> => {
    if (!imageSrc) throw new Error("No image to export");

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get canvas context");

    // 1. Load Image to get natural dimensions
    const img = new Image();
    img.src = imageSrc;
    await new Promise((resolve) => { img.onload = resolve; });

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // 2. Draw Background
    ctx.drawImage(img, 0, 0);

    // 3. Configure Text Style
    const fontSize = (design.textSize / 100) * canvas.width;
    const fontWeight = design.isBold ? 'bold' : 'normal';
    const fontStyle = design.isItalic ? 'italic' : 'normal';
    
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${design.fontFamily}"`;
    ctx.textAlign = design.textAlign;
    ctx.textBaseline = 'middle';

    // 4. Calculate Text Lines & Metrics
    const rawText = design.isUppercase ? design.textOverlay.toUpperCase() : design.textOverlay;
    const lines = rawText.split('\n');
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    
    // Calculate max line width for accurate gradient box
    let maxLineWidth = 0;
    lines.forEach(line => {
        const metrics = ctx.measureText(line);
        if (metrics.width > maxLineWidth) maxLineWidth = metrics.width;
    });

    // 5. Prepare Styles (Fill/Gradient)
    let fillStyle: string | CanvasGradient = design.textColor;
    if (design.specialEffect === 'gradient' && !design.isHollow) {
        // Gradient Math
        const angleRad = (design.effectAngle * Math.PI) / 180;
        
        // Calculate radius to cover the text box fully
        const r = Math.sqrt((maxLineWidth/2)**2 + (totalHeight/2)**2);
        
        const x1 = -Math.cos(angleRad) * r;
        const y1 = -Math.sin(angleRad) * r;
        const x2 = Math.cos(angleRad) * r;
        const y2 = Math.sin(angleRad) * r;

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        
        // Map intensity (0-100) to spread from center
        // 0 intensity = 50% 50% (Hard edge in middle)
        // 100 intensity = 0% 100% (Full smooth gradient)
        const halfSpread = design.effectIntensity / 2; // 0 to 50
        const stop1 = Math.max(0, Math.min(1, (50 - halfSpread) / 100));
        const stop2 = Math.max(0, Math.min(1, (50 + halfSpread) / 100));

        grad.addColorStop(stop1, design.textColor);
        grad.addColorStop(stop2, design.effectColor);
        fillStyle = grad;
    }

    // 6. Position and Transformation
    const x = (design.overlayPosition.x / 100) * canvas.width;
    const y = (design.overlayPosition.y / 100) * canvas.height;

    ctx.save();
    
    // Move to the anchor point
    ctx.translate(x, y);
    
    // Rotate
    if (design.rotation !== 0) {
        ctx.rotate((design.rotation * Math.PI) / 180);
    }

    // Flip
    const scaleX = design.flipX ? -1 : 1;
    const scaleY = design.flipY ? -1 : 1;
    if (scaleX !== 1 || scaleY !== 1) {
        ctx.scale(scaleX, scaleY);
    }

    // Apply global blend mode and opacity
    ctx.globalCompositeOperation = design.blendMode as GlobalCompositeOperation;
    ctx.globalAlpha = design.opacity;

    // Apply Filters (Blur)
    if (design.textBlur > 0) {
        ctx.filter = `blur(${design.textBlur}px)`;
    }

    // --- RENDERING HELPERS ---
    
    const drawShadowPass = () => {
         if (!design.hasShadow) return;

         ctx.shadowColor = design.shadowColor;
         ctx.shadowBlur = (design.shadowBlur / 100) * (fontSize * 2); 
         
         // Calculate Shadow Offset based on distance/angle
         const shadowRad = (design.shadowAngle * Math.PI) / 180;
         const shadowDist = (design.shadowOffset / 100) * fontSize; // Scale relative to font

         ctx.shadowOffsetX = Math.cos(shadowRad) * shadowDist;
         ctx.shadowOffsetY = Math.sin(shadowRad) * shadowDist;
         
         const startY = -(totalHeight / 2) + (lineHeight / 2);
         
         lines.forEach((line, index) => {
            const lineY = startY + (index * lineHeight);
            if (design.isHollow || design.hasOutline) {
                ctx.lineWidth = design.hasOutline ? design.outlineWidth : 2;
                ctx.strokeStyle = design.hasOutline ? design.outlineColor : design.textColor;
                ctx.strokeText(line, 0, lineY);
            } else {
                ctx.fillStyle = design.textColor; 
                ctx.fillText(line, 0, lineY);
            }
         });
         
         // Clear shadow state immediately
         ctx.shadowColor = 'transparent';
         ctx.shadowBlur = 0;
         ctx.shadowOffsetX = 0;
         ctx.shadowOffsetY = 0;
    };

    const drawTextPass = (xOffset: number, yOffset: number, colorOverride?: string, isStroke?: boolean) => {
        const startY = -(totalHeight / 2) + (lineHeight / 2);
        lines.forEach((line, index) => {
            const lineY = startY + (index * lineHeight) + yOffset;
            
            if (isStroke || design.isHollow) {
                ctx.lineWidth = design.hasOutline ? design.outlineWidth : 2; 
                ctx.strokeStyle = colorOverride || (design.hasOutline ? design.outlineColor : design.textColor);
                ctx.strokeText(line, xOffset, lineY);
            } else {
                // Fill
                ctx.fillStyle = colorOverride || fillStyle;
                ctx.fillText(line, xOffset, lineY);
                
                // Outline on top of fill
                if (design.hasOutline) {
                    ctx.lineWidth = design.outlineWidth;
                    ctx.strokeStyle = design.outlineColor;
                    ctx.strokeText(line, xOffset, lineY);
                }
            }
        });
    };

    // --- LAYERING ORDER ---
    // 1. Background Effects (Echo, Glitch)
    // 2. Shadow Pass (Standard)
    // 3. Main Text (Foreground)

    // 1. Draw Echo Trails (Background)
    if (design.specialEffect === 'echo') {
        const echoCount = 5;
        const startOpacity = design.opacity;
        const angleRad = (design.effectAngle * Math.PI) / 180;
        const distanceStep = design.effectIntensity * (canvas.width * 0.0005); 

        for (let i = echoCount; i > 0; i--) {
             const dx = Math.cos(angleRad) * distanceStep * i;
             const dy = Math.sin(angleRad) * distanceStep * i;

             ctx.globalAlpha = startOpacity * (0.1 + (0.5 * (1 - i/echoCount))); 
             drawTextPass(dx, dy, undefined, design.isHollow);
        }
        ctx.globalAlpha = design.opacity;
    }

    // 2. Draw Glitch Channels (Background)
    if (design.specialEffect === 'glitch') {
        const offset = (design.effectIntensity / 100) * (fontSize * 1.5);
        ctx.save();
        
        if (design.isRainbowGlitch) {
             // Rainbow Mode: 7 Channels (ROYGBIV)
             const colors = [
                 '#FF0000', // Red
                 '#FF7F00', // Orange
                 '#FFFF00', // Yellow
                 '#00FF00', // Green
                 '#0000FF', // Blue
                 '#4B0082', // Indigo
                 '#9400D3'  // Violet
             ];
             // Increased spread multiplier for visibility
             const spread = offset * 1.2; 
             const angleRad = (design.effectAngle * Math.PI) / 180;
             
             ctx.globalAlpha = design.opacity * 0.5;
             ctx.globalCompositeOperation = 'screen';

             colors.forEach((c, i) => {
                 // Calculate offset: Centered distribution
                 const mid = Math.floor(colors.length / 2); // 3
                 const dist = (i - mid) * spread;
                 const dx = Math.cos(angleRad) * dist;
                 const dy = Math.sin(angleRad) * dist;
                 drawTextPass(dx, dy, c, design.isHollow);
             });

        } else {
            // Standard 2-Channel Glitch
            const c1 = design.effectColor;
            const c2 = design.effectColor2;
            
            // Channel 1 (Left)
            ctx.globalAlpha = design.opacity * 0.8;
            ctx.globalCompositeOperation = 'screen'; // Lighten/Screen usually looks best for glitch
            drawTextPass(-offset, 0, c1, design.isHollow);

            // Channel 2 (Right) 
            ctx.globalAlpha = design.opacity * 0.8;
            drawTextPass(offset, 0, c2, design.isHollow); 
        }
        
        ctx.restore();
    }

    // 3. Draw Standard Shadows (Unconditional Layer)
    drawShadowPass();

    // 4. Draw Main Text Layer (Foreground)
    drawTextPass(0, 0, undefined, design.isHollow);

    ctx.restore();
    
    // Reset context
    ctx.filter = 'none'; 
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    return canvas.toDataURL('image/png');
  };

  useImperativeHandle(ref, () => ({
    exportImage: generateExport
  }));

  // --- DOM STYLES FOR PREVIEW ---

  const getStrokeStyle = () => {
    if (design.isHollow) {
       const width = design.hasOutline ? design.outlineWidth : 1; 
       const color = design.hasOutline ? design.outlineColor : design.textColor;
       return `${width}px ${color}`;
    }
    if (design.hasOutline) {
       return `${design.outlineWidth}px ${design.outlineColor}`;
    }
    return '0';
  };

  const getFilterStyle = () => {
    let filters = [];
    
    // Use drop-shadow filter only if standard text-shadow is insufficient (e.g. hollow/stroke)
    if (design.hasShadow && (design.isHollow || design.hasOutline)) {
         const blurVal = (design.shadowBlur / 100) * 0.5; 
         
         // Calculate Offset
         const shadowRad = (design.shadowAngle * Math.PI) / 180;
         const shadowDist = design.shadowOffset * 0.005; // Scale for em
         const sx = Math.cos(shadowRad) * shadowDist;
         const sy = Math.sin(shadowRad) * shadowDist;
         
         filters.push(`drop-shadow(${sx}em ${sy}em ${blurVal}em ${design.shadowColor})`);
    }

    if (design.textBlur > 0) {
        filters.push(`blur(${design.textBlur}px)`);
    }

    return filters.join(' ');
  };

  const getSpecialEffectStyles = (): React.CSSProperties => {
      const styles: React.CSSProperties = {};

      // Gradient
      if (design.specialEffect === 'gradient' && !design.isHollow) {
          // Map intensity (0-100) to stops
          // Intensity 0 = 50%/50% (Hard)
          // Intensity 100 = 0%/100% (Soft)
          const halfSpread = design.effectIntensity / 2;
          const stop1 = 50 - halfSpread;
          const stop2 = 50 + halfSpread;
          
          styles.backgroundImage = `linear-gradient(${design.effectAngle}deg, ${design.textColor} ${stop1}%, ${design.effectColor} ${stop2}%)`;
          styles.backgroundClip = 'text';
          styles.WebkitBackgroundClip = 'text';
          styles.color = 'transparent'; 
      }

      // Build up Text Shadows (Layering: Top -> Bottom)
      const shadows: string[] = [];

      // 1. Standard Shadow (Top layer in CSS list = Closest to text? No, actually first shadow is on top of subsequent shadows)
      if (design.hasShadow && !design.isHollow && !design.hasOutline) {
          const blurVal = (design.shadowBlur / 100) * 0.5;
          
          // Calculate Offset
          const shadowRad = (design.shadowAngle * Math.PI) / 180;
          const shadowDist = design.shadowOffset * 0.005; // Scale for em
          const sx = Math.cos(shadowRad) * shadowDist;
          const sy = Math.sin(shadowRad) * shadowDist;
          
          shadows.push(`${sx}em ${sy}em ${blurVal}em ${design.shadowColor}`);
      }

      // 2. Glitch Shadows
      if (design.specialEffect === 'glitch') {
          const offset = design.effectIntensity * 0.02; // Use relative unit (em)
          
          if (design.isRainbowGlitch) {
               // Rainbow Spectrum ROYGBIV
               const spread = offset * 1.5; // Increased spread factor
               const colors = [
                 '#FF0000', // Red
                 '#FF7F00', // Orange
                 '#FFFF00', // Yellow
                 '#00FF00', // Green
                 '#0000FF', // Blue
                 '#4B0082', // Indigo
                 '#9400D3'  // Violet
               ];
               const mid = Math.floor(colors.length / 2); // 3
               const angleRad = (design.effectAngle * Math.PI) / 180;
               
               colors.forEach((c, i) => {
                   const dist = (i - mid) * spread;
                   const dx = Math.cos(angleRad) * dist;
                   const dy = Math.sin(angleRad) * dist;
                   shadows.push(`${dx}em ${dy}em 0px ${c}`);
               });
          } else {
               // Standard Dual
                const c1 = design.effectColor;
                const c2 = design.effectColor2;
                shadows.push(`${-offset}em 0px 0px ${c1}`);
                shadows.push(`${offset}em 0px 0px ${c2}`);
          }
      }

      // 3. Echo Trails
      if (design.specialEffect === 'echo') {
          const dist = design.effectIntensity * 0.2;
          const angleRad = (design.effectAngle * Math.PI) / 180;
          const dx = Math.cos(angleRad) * dist;
          const dy = Math.sin(angleRad) * dist;
          
          for(let i=1; i<=5; i++) {
             shadows.push(`${i*dx}px ${i*dy}px 0px ${design.textColor}60`); 
          }
      }

      if (shadows.length > 0) {
          styles.textShadow = shadows.join(', ');
      }

      return styles;
  };

  const specialStyles = getSpecialEffectStyles();

  // Drag and Drop Handlers (Unchanged)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]?.type.startsWith('image/')) {
        onImageUpload(e.dataTransfer.files[0]);
    }
  };

  // Empty State Ratio (Unchanged)
  const getEmptyStateRatio = () => {
    const [w, h] = design.aspectRatio.split(':').map(Number);
    let ratio = w / h;
    if (design.orientation === 'portrait' && design.aspectRatio !== '1:1') ratio = 1 / ratio;
    return { aspectRatio: `${ratio}` };
  };

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
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onWheel={handleWheel}
      style={{
         ...(!imageSrc ? getEmptyStateRatio() : {}),
         transform: `scale(${zoomScale})`,
         transformOrigin: 'center center'
      }}
      className={`
        relative overflow-hidden shadow-2xl rounded-[3px] bg-neutral-900 
        flex items-center justify-center select-none transition-all duration-100 ease-linear
        ${!imageSrc ? 'w-full max-w-md' : 'w-auto h-auto max-w-full max-h-full'}
        ${isDragging ? 'ring-2 ring-pink-500 bg-neutral-800' : ''}
        ${className}
      `}
    >
      {imageSrc ? (
        <>
          <img 
            src={imageSrc} 
            alt="Background" 
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
          
          <div
            className="absolute whitespace-pre-wrap leading-tight transition-all duration-200 ease-out origin-center"
            style={{
              left: `${design.overlayPosition.x}%`,
              top: `${design.overlayPosition.y}%`,
              transform: `
                translate(-50%, -50%) 
                rotate(${design.rotation}deg) 
                scale(${design.flipX ? -1 : 1}, ${design.flipY ? -1 : 1})
              `,
              fontFamily: design.fontFamily,
              fontSize: `${design.textSize * 0.8}vw`,
              color: design.isHollow ? 'transparent' : design.textColor,
              textAlign: design.textAlign,
              // textShadow removed here, applied via specialStyles
              filter: getFilterStyle(),
              mixBlendMode: design.blendMode as any,
              opacity: design.opacity,
              width: '100%', 
              pointerEvents: 'none',
              fontWeight: design.isBold ? 'bold' : 'normal',
              fontStyle: design.isItalic ? 'italic' : 'normal',
              textTransform: design.isUppercase ? 'uppercase' : 'none',
              WebkitTextStroke: getStrokeStyle(),
              ...specialStyles, // Apply special effect overrides + shadows
            }}
          >
            {design.textOverlay}
          </div>
        </>
      ) : (
        <div 
            onClick={() => fileInputRef.current?.click()}
            className="text-neutral-600 flex flex-col items-center gap-4 cursor-pointer hover:text-neutral-400 transition-colors group p-8"
        >
          <div className="relative">
             <Upload className={`w-16 h-16 opacity-20 transition-transform duration-300 ${isDragging ? 'scale-110 text-pink-500 opacity-50' : 'group-hover:-translate-y-1'}`} />
          </div>
          
          <div className="font-mono text-sm opacity-50 group-hover:opacity-80 transition-opacity text-center">
            {isDragging ? 'Drop to Upload' : (
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
    </>
  );
});

export default Canvas;

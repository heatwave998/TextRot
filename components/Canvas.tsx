
import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { DesignState } from '../types';
import { Upload, Maximize2 } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [imgDims, setImgDims] = useState<{ w: number, h: number } | null>(null);

  // Reset zoom and get dims when the image changes
  useEffect(() => {
    setZoomScale(1);
    setPan({ x: 0, y: 0 });
    if (imageSrc) {
        const i = new Image();
        i.onload = () => {
            setImgDims({ w: i.naturalWidth, h: i.naturalHeight });
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

  // Panning Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
      if (!imageSrc || !enableZoom) return;
      
      // Left click only
      if (e.button === 0) {
          setIsPanning(true);
          dragStartRef.current = {
              x: e.clientX - pan.x,
              y: e.clientY - pan.y
          };
          e.preventDefault();
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (isPanning) {
          e.preventDefault();
          setPan({
              x: e.clientX - dragStartRef.current.x,
              y: e.clientY - dragStartRef.current.y
          });
      }
  };

  const handleMouseUp = () => {
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

  // Function to perform the actual canvas drawing for export
  const generateExport = async (): Promise<string> => {
    if (!imageSrc) throw new Error("No image to export");

    // Wait for fonts to be ready to ensure correct rendering
    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get canvas context");

    const img = new Image();
    // Ensure correct loading sequence
    await new Promise((resolve, reject) => { 
        img.onload = resolve; 
        img.onerror = reject;
        img.src = imageSrc; 
    });

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.drawImage(img, 0, 0);

    const fontSize = (design.textSize / 100) * canvas.width;
    const fontWeight = design.isBold ? 'bold' : 'normal';
    const fontStyle = design.isItalic ? 'italic' : 'normal';
    
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${design.fontFamily}"`;
    ctx.textAlign = design.textAlign;
    ctx.textBaseline = 'middle';
    
    const scaledLetterSpacing = design.letterSpacing * (fontSize / 50); 
    if ('letterSpacing' in ctx) {
      // @ts-ignore
      ctx.letterSpacing = `${scaledLetterSpacing}px`;
    }

    const rawText = design.isUppercase ? design.textOverlay.toUpperCase() : design.textOverlay;
    const lines = rawText.split('\n');
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    
    let maxLineWidth = 0;
    lines.forEach(line => {
        const metrics = ctx.measureText(line);
        if (metrics.width > maxLineWidth) maxLineWidth = metrics.width;
    });

    let fillStyle: string | CanvasGradient = design.textColor;
    if (design.specialEffect === 'gradient' && !design.isHollow) {
        const angleRad = (design.effectAngle * Math.PI) / 180;
        const r = Math.sqrt((maxLineWidth/2)**2 + (totalHeight/2)**2);
        
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
        fillStyle = grad;
    }

    const x = (design.overlayPosition.x / 100) * canvas.width;
    const y = (design.overlayPosition.y / 100) * canvas.height;

    ctx.save();
    ctx.translate(x, y);
    
    if (design.rotation !== 0) {
        ctx.rotate((design.rotation * Math.PI) / 180);
    }

    const scaleX = design.flipX ? -1 : 1;
    const scaleY = design.flipY ? -1 : 1;
    if (scaleX !== 1 || scaleY !== 1) {
        ctx.scale(scaleX, scaleY);
    }

    ctx.globalCompositeOperation = design.blendMode as GlobalCompositeOperation;
    ctx.globalAlpha = design.opacity;

    if (design.textBlur > 0) {
        ctx.filter = `blur(${design.textBlur}px)`;
    }

    // Fix alignment logic: Adjust X position based on textAlign to match DOM Rendering
    // DOM uses a 100% width container centered on the point.
    let xAlignmentOffset = 0;
    if (design.textAlign === 'left') xAlignmentOffset = -canvas.width / 2;
    if (design.textAlign === 'right') xAlignmentOffset = canvas.width / 2;

    const drawShadowPass = () => {
         if (!design.hasShadow) return;

         ctx.shadowColor = design.shadowColor;
         ctx.shadowBlur = (design.shadowBlur / 100) * (fontSize * 2); 
         
         const shadowRad = (design.shadowAngle * Math.PI) / 180;
         const shadowDist = (design.shadowOffset / 100) * fontSize; 

         ctx.shadowOffsetX = Math.cos(shadowRad) * shadowDist;
         ctx.shadowOffsetY = Math.sin(shadowRad) * shadowDist;
         
         const startY = -(totalHeight / 2) + (lineHeight / 2);
         
         lines.forEach((line, index) => {
            const lineY = startY + (index * lineHeight);
            if (design.isHollow || design.hasOutline) {
                ctx.lineWidth = design.hasOutline ? design.outlineWidth : 2;
                ctx.strokeStyle = design.hasOutline ? design.outlineColor : design.textColor;
                ctx.strokeText(line, xAlignmentOffset, lineY);
            } else {
                ctx.fillStyle = design.textColor; 
                ctx.fillText(line, xAlignmentOffset, lineY);
            }
         });
         
         ctx.shadowColor = 'transparent';
         ctx.shadowBlur = 0;
         ctx.shadowOffsetX = 0;
         ctx.shadowOffsetY = 0;
    };

    const drawTextPass = (xOffset: number, yOffset: number, colorOverride?: string, isStroke?: boolean) => {
        const startY = -(totalHeight / 2) + (lineHeight / 2);
        lines.forEach((line, index) => {
            const lineY = startY + (index * lineHeight) + yOffset;
            const finalX = xOffset + xAlignmentOffset;

            if (isStroke || design.isHollow) {
                ctx.lineWidth = design.hasOutline ? design.outlineWidth : 2; 
                ctx.strokeStyle = colorOverride || (design.hasOutline ? design.outlineColor : design.textColor);
                ctx.strokeText(line, finalX, lineY);
            } else {
                ctx.fillStyle = colorOverride || fillStyle;
                ctx.fillText(line, finalX, lineY);
                
                if (design.hasOutline) {
                    ctx.lineWidth = design.outlineWidth;
                    ctx.strokeStyle = design.outlineColor;
                    ctx.strokeText(line, finalX, lineY);
                }
            }
        });
    };

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

    if (design.specialEffect === 'glitch') {
        const offset = (design.effectIntensity / 100) * (fontSize * 1.5);
        ctx.save();
        
        if (design.isRainbowGlitch) {
             const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
             const spread = offset * 1.2; 
             const angleRad = (design.effectAngle * Math.PI) / 180;
             
             ctx.globalAlpha = design.opacity * 0.5;
             ctx.globalCompositeOperation = 'screen';

             colors.forEach((c, i) => {
                 const mid = Math.floor(colors.length / 2); 
                 const dist = (i - mid) * spread;
                 const dx = Math.cos(angleRad) * dist;
                 const dy = Math.sin(angleRad) * dist;
                 drawTextPass(dx, dy, c, design.isHollow);
             });

        } else {
            const c1 = design.effectColor;
            const c2 = design.effectColor2;
            
            ctx.globalAlpha = design.opacity * 0.8;
            ctx.globalCompositeOperation = 'screen'; 
            drawTextPass(-offset, 0, c1, design.isHollow);

            ctx.globalAlpha = design.opacity * 0.8;
            drawTextPass(offset, 0, c2, design.isHollow); 
        }
        
        ctx.restore();
    }

    drawShadowPass();

    drawTextPass(0, 0, undefined, design.isHollow);

    ctx.restore();
    ctx.filter = 'none'; 
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    return canvas.toDataURL('image/png');
  };

  useImperativeHandle(ref, () => ({
    exportImage: generateExport
  }));

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
    if (design.hasShadow && (design.isHollow || design.hasOutline)) {
         const blurVal = (design.shadowBlur / 100) * 0.5; 
         const shadowRad = (design.shadowAngle * Math.PI) / 180;
         const shadowDist = design.shadowOffset * 0.005; 
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

      if (design.specialEffect === 'gradient' && !design.isHollow) {
          const halfSpread = design.effectIntensity / 2;
          const stop1 = 50 - halfSpread;
          const stop2 = 50 + halfSpread;
          
          styles.backgroundImage = `linear-gradient(${design.effectAngle}deg, ${design.textColor} ${stop1}%, ${design.effectColor} ${stop2}%)`;
          styles.backgroundClip = 'text';
          styles.WebkitBackgroundClip = 'text';
          styles.color = 'transparent'; 
      }

      const shadows: string[] = [];

      if (design.hasShadow && !design.isHollow && !design.hasOutline) {
          const blurVal = (design.shadowBlur / 100) * 0.5;
          const shadowRad = (design.shadowAngle * Math.PI) / 180;
          const shadowDist = design.shadowOffset * 0.005; 
          const sx = Math.cos(shadowRad) * shadowDist;
          const sy = Math.sin(shadowRad) * shadowDist;
          
          shadows.push(`${sx}em ${sy}em ${blurVal}em ${design.shadowColor}`);
      }

      if (design.specialEffect === 'glitch') {
          const offset = design.effectIntensity * 0.02; 
          
          if (design.isRainbowGlitch) {
               const spread = offset * 1.5; 
               const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
               const mid = Math.floor(colors.length / 2); 
               const angleRad = (design.effectAngle * Math.PI) / 180;
               
               colors.forEach((c, i) => {
                   const dist = (i - mid) * spread;
                   const dx = Math.cos(angleRad) * dist;
                   const dy = Math.sin(angleRad) * dist;
                   shadows.push(`${dx}em ${dy}em 0px ${c}`);
               });
          } else {
                const c1 = design.effectColor;
                const c2 = design.effectColor2;
                shadows.push(`${-offset}em 0px 0px ${c1}`);
                shadows.push(`${offset}em 0px 0px ${c2}`);
          }
      }

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
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsPanning(false)}
      style={{ cursor: isPanning ? 'grabbing' : (imageSrc ? 'grab' : 'default') }}
    >
      <div 
        style={{
           ...(!imageSrc ? getEmptyStateRatio() : {}),
           transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
           transformOrigin: 'center center'
        }}
        className={`
          relative overflow-hidden shadow-2xl rounded-[3px] bg-neutral-900 
          flex items-center justify-center select-none transition-all duration-0 ease-linear
          ${!imageSrc ? 'w-full max-w-md' : 'w-auto h-auto max-w-full max-h-full'}
          ${isDraggingFile ? 'ring-2 ring-pink-500 bg-neutral-800' : ''}
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
                letterSpacing: `${design.letterSpacing * 0.05}vw`, 
                color: design.isHollow ? 'transparent' : design.textColor,
                textAlign: design.textAlign,
                filter: getFilterStyle(),
                mixBlendMode: design.blendMode as any,
                opacity: design.opacity,
                width: '100%', 
                pointerEvents: 'none',
                fontWeight: design.isBold ? 'bold' : 'normal',
                fontStyle: design.isItalic ? 'italic' : 'normal',
                textTransform: design.isUppercase ? 'uppercase' : 'none',
                WebkitTextStroke: getStrokeStyle(),
                ...specialStyles, 
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

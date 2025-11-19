
import React, { useState, useRef } from 'react';
import Canvas, { CanvasHandle } from './components/Canvas';
import Controls from './components/Controls';
import SettingsModal from './components/SettingsModal';
import ConfirmationModal from './components/ConfirmationModal';
import CropModal from './components/CropModal';
import { DesignState, AppSettings, AspectRatio, Orientation } from './types';
import { generateBackgroundImage } from './services/geminiService';

// Initial State
const DEFAULT_DESIGN: DesignState = {
  prompt: '',
  aspectRatio: '1:1',
  orientation: 'landscape',
  textOverlay: 'EDIT ME',
  fontFamily: 'Inter',
  textColor: '#FFFFFF',
  shadowColor: '#000000',
  textSize: 5,
  textAlign: 'center',
  overlayPosition: { x: 50, y: 50 },
  blendMode: 'normal',
  opacity: 1,
  // Blurs
  textBlur: 0,
  shadowBlur: 20,
  hasShadow: true,
  shadowOffset: 10, // Default offset
  shadowAngle: 45,  // Default bottom-right
  // Modifiers
  isBold: false,
  isItalic: false,
  isUppercase: false,
  // Effects
  isHollow: false,
  hasOutline: false,
  outlineWidth: 2,
  outlineColor: '#000000',
  // Special FX
  specialEffect: 'none',
  effectIntensity: 50,
  effectColor: '#FF0000',
  effectColor2: '#00FFFF',
  isRainbowGlitch: false,
  effectAngle: 90,
  // Transforms
  rotation: 0,
  flipX: false,
  flipY: false
};

const DEFAULT_SETTINGS: AppSettings = {
  enableZoom: true // Zoom enabled by default
};

export default function App() {
  const [design, setDesign] = useState<DesignState>(DEFAULT_DESIGN);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBlankConfirmOpen, setIsBlankConfirmOpen] = useState(false);
  
  // Image State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  
  const canvasRef = useRef<CanvasHandle>(null);

  const handleGenerate = async () => {
    if (!design.prompt) return;
    
    setIsGenerating(true);

    try {
      const imagePromise = generateBackgroundImage(design.prompt, design.aspectRatio, design.orientation);
      const imgData = await imagePromise;

      setImageSrc(imgData);
      
      setDesign(prev => {
        const isDefaultText = prev.textOverlay === DEFAULT_DESIGN.textOverlay;
        return {
            ...prev,
            overlayPosition: { x: 50, y: 50 },
            rotation: 0,
            flipX: false,
            flipY: false,
            textOverlay: isDefaultText ? design.prompt.substring(0, 20).toUpperCase() : prev.textOverlay
        };
      });

    } catch (error) {
      alert("Something went wrong creating your masterpiece. Please check your API key.");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const executeBlankCanvas = () => {
    const canvas = document.createElement('canvas');
    const BASE_SIZE = 1024;
    
    // Parse the supported ratio string (e.g. "16:9")
    const [wStr, hStr] = design.aspectRatio.split(':');
    const ratioMultiplier = Number(wStr) / Number(hStr); // e.g. 1.77 for 16:9

    let width, height;

    if (design.orientation === 'landscape') {
        // Landscape: Height is Base, Width is scaled up
        height = BASE_SIZE;
        width = Math.round(BASE_SIZE * ratioMultiplier);
    } else {
        // Portrait: Width is Base, Height is scaled up
        width = BASE_SIZE;
        height = Math.round(BASE_SIZE * ratioMultiplier);
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, width, height);
    
    setImageSrc(canvas.toDataURL('image/png'));
    
    setDesign(prev => ({
        ...prev,
        textColor: '#FFFFFF',
        shadowColor: '#000000',
        isHollow: false,
        blendMode: 'normal',
        textOverlay: 'BLANK CANVAS'
    }));
    setIsBlankConfirmOpen(false);
  };

  const handleBlankClick = () => {
    if (imageSrc) {
        setIsBlankConfirmOpen(true);
    } else {
        executeBlankCanvas();
    }
  };

  const RATIO_MAP: Record<AspectRatio, number> = {
    '1:1': 1,
    '4:3': 4/3,
    '3:2': 3/2,
    '16:9': 16/9
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const result = e.target.result as string;
        
        const img = new Image();
        img.onload = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            
            const isPortrait = height > width;
            // Normalize ratio to be >= 1 for comparison against our Landscape keys
            const normalizedRatio = isPortrait ? height / width : width / height;
            
            let bestMatch: AspectRatio | null = null;
            let minDiff = 0.03; // Tolerance

            (Object.keys(RATIO_MAP) as AspectRatio[]).forEach(key => {
                const target = RATIO_MAP[key];
                const diff = Math.abs(normalizedRatio - target);
                if (diff < minDiff) {
                    minDiff = diff;
                    bestMatch = key;
                }
            });

            if (bestMatch) {
                // Perfect standard match found.
                setDesign(prev => ({
                    ...prev,
                    aspectRatio: bestMatch!,
                    orientation: isPortrait ? 'portrait' : 'landscape'
                }));
                setImageSrc(result);
            } else {
                // Non-standard ratio. Prompt user to crop.
                setPendingImageSrc(result);
                setIsCropModalOpen(true);
            }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (croppedDataUrl: string, ratio: AspectRatio, orientation: Orientation) => {
      setImageSrc(croppedDataUrl);
      setDesign(prev => ({
          ...prev,
          aspectRatio: ratio,
          orientation: orientation
      }));
  };

  const handleDownload = async () => {
    if (canvasRef.current) {
      try {
        const dataUrl = await canvasRef.current.exportImage();
        const link = document.createElement('a');
        link.download = `textrot-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      } catch (e) {
        console.error("Export failed", e);
        alert("Could not export image.");
      }
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-black text-white">
      {/* Left: Canvas Area */}
      <div className="flex-1 bg-neutral-950 flex items-center justify-center p-8 relative overflow-hidden">
        <Canvas 
            ref={canvasRef}
            imageSrc={imageSrc} 
            design={design} 
            enableZoom={settings.enableZoom}
            onImageUpload={handleImageUpload}
            className="shadow-2xl ring-1 ring-white/10"
        />
      </div>

      {/* Right: Controls */}
      <div className="w-full md:w-96 h-1/2 md:h-full z-20">
        <Controls 
          design={design} 
          setDesign={setDesign}
          onGenerate={handleGenerate}
          onBlank={handleBlankClick}
          onDownload={handleDownload}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isGenerating={isGenerating}
          vibeReasoning={null}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isBlankConfirmOpen}
        onClose={() => setIsBlankConfirmOpen(false)}
        onConfirm={executeBlankCanvas}
        title="Reset Canvas?"
        message="This will clear your current artwork and text styles. This action cannot be undone."
      />

      {/* Crop Modal */}
      <CropModal
        isOpen={isCropModalOpen}
        imageSrc={pendingImageSrc}
        onClose={() => setIsCropModalOpen(false)}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}

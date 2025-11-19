import React, { useState, useRef } from 'react';
import Canvas, { CanvasHandle } from './components/Canvas';
import Controls from './components/Controls';
import SettingsModal from './components/SettingsModal';
import ConfirmationModal from './components/ConfirmationModal';
import { DesignState, AppSettings, AspectRatio, Orientation } from './types';
import { generateBackgroundImage, editImage } from './services/geminiService';

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
  shadowOffset: 20,
  shadowAngle: 45,
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
  enableZoom: true
};

export default function App() {
  const [design, setDesign] = useState<DesignState>(DEFAULT_DESIGN);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBlankConfirmOpen, setIsBlankConfirmOpen] = useState(false);
  const [isGenerateConfirmOpen, setIsGenerateConfirmOpen] = useState(false);
  
  // Image State
  const [imageSrc, setImageSrc] = useState<string | null>(null);

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

  const handleGenerateClick = () => {
    if (imageSrc) {
      setIsGenerateConfirmOpen(true);
    } else {
      handleGenerate();
    }
  };

  const handleEdit = async () => {
      if (!imageSrc || !design.prompt) return;
      
      setIsGenerating(true);
      try {
          const editedImgData = await editImage(imageSrc, design.prompt);
          setImageSrc(editedImgData);
      } catch (error) {
          alert("Failed to edit image. Ensure your API key is valid and supports Imagen 4.0 editing.");
          console.error(error);
      } finally {
          setIsGenerating(false);
      }
  };

  const executeBlankCanvas = () => {
    const canvas = document.createElement('canvas');
    const BASE = 1024;
    
    // Explicit hardcoded lookups to guarantee correct aspect ratio dimensions
    const ratioKey = design.aspectRatio;
    const isPortrait = design.orientation === 'portrait';
    
    let width = 1024;
    let height = 1024;

    if (isPortrait) {
        // Portrait Mode: Width fixed at 1024, Height scales up
        width = 1024;
        switch (ratioKey) {
            case '1:1': height = 1024; break;
            case '4:3': height = 1365; break; // 4:3 inverted is 3:4 (1024 * 1.333)
            case '3:2': height = 1536; break; // 3:2 inverted is 2:3 (1024 * 1.5)
            case '16:9': height = 1820; break; // 16:9 inverted is 9:16 (1024 * 1.777)
        }
    } else {
        // Landscape Mode: Height fixed at 1024, Width scales up
        height = 1024;
        switch (ratioKey) {
            case '1:1': width = 1024; break;
            case '4:3': width = 1365; break; // 1.333
            case '3:2': width = 1536; break; // 1.5
            case '16:9': width = 1820; break; // 1.777
        }
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

  const handleImageUpload = (file: File) => {
    // 1. Size Limit Check (25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        alert("File is too large. Please upload an image smaller than 25MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const result = e.target.result as string;
        
        const img = new Image();
        img.onload = () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            const imgRatio = width / height;

            // Determine Orientation
            const newOrientation: Orientation = width >= height ? 'landscape' : 'portrait';

            // Standard Ratios (Landscape values)
            const standards: { key: AspectRatio, val: number }[] = [
                { key: '1:1', val: 1 },
                { key: '4:3', val: 4/3 }, // 1.333
                { key: '3:2', val: 3/2 }, // 1.5
                { key: '16:9', val: 16/9 } // 1.777
            ];

            // Normalize for comparison (always >= 1)
            const normRatio = imgRatio >= 1 ? imgRatio : 1/imgRatio;

            // Find closest standard ratio for UI display only
            let closestRatio: AspectRatio = '1:1';
            let minDiff = Infinity;
            
            standards.forEach(s => {
                const diff = Math.abs(normRatio - s.val);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestRatio = s.key;
                }
            });

            // Set State (No Cropping, Accept As Is)
            setDesign(prev => ({
                ...prev,
                aspectRatio: closestRatio,
                orientation: newOrientation
            }));
            setImageSrc(result);
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
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
          onGenerate={handleGenerateClick}
          onEdit={handleEdit}
          onBlank={handleBlankClick}
          onDownload={handleDownload}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isGenerating={isGenerating}
          vibeReasoning={null}
          hasImage={!!imageSrc}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />

      {/* Confirmation Modal for Blank Canvas */}
      <ConfirmationModal
        isOpen={isBlankConfirmOpen}
        onClose={() => setIsBlankConfirmOpen(false)}
        onConfirm={executeBlankCanvas}
        title="Reset Canvas?"
        message="This will clear your current artwork and text styles. This action cannot be undone."
      />

      {/* Confirmation Modal for Generate */}
      <ConfirmationModal
        isOpen={isGenerateConfirmOpen}
        onClose={() => setIsGenerateConfirmOpen(false)}
        onConfirm={handleGenerate}
        title="Generate New Image?"
        message="This will replace your current image. Any unsaved changes will be lost."
      />
    </div>
  );
}
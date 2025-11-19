
import React from 'react';
import { DesignState, FontFamily, AspectRatio, SpecialEffect } from '../types';
import { 
  Type, Palette, Layers, Move, Download, Sparkles, 
  Bold, Italic, CaseUpper, FlipHorizontal, FlipVertical, 
  RotateCw, CircleDashed, Square, Smartphone, Monitor, Settings, FilePlus,
  Ban, Compass, ToggleRight, ToggleLeft
} from 'lucide-react';

interface ControlsProps {
  design: DesignState;
  setDesign: React.Dispatch<React.SetStateAction<DesignState>>;
  onGenerate: () => void;
  onBlank: () => void;
  onDownload: () => void;
  onOpenSettings: () => void;
  isGenerating: boolean;
  vibeReasoning: string | null;
}

const FONTS: FontFamily[] = [
  'Abril Fatface',
  'Alfa Slab One',
  'Amatic SC',
  'Anton',
  'Bangers',
  'Bebas Neue',
  'Bodoni Moda',
  'Cinzel',
  'Cormorant Garamond',
  'Crimson Text',
  'DM Serif Display',
  'Dancing Script',
  'Eduardo Tunni',
  'Fira Code',
  'Gloria Hallelujah',
  'Great Vibes',
  'Inter',
  'Italiana',
  'Josefin Sans',
  'Lato',
  'League Gothic',
  'Libre Baskerville',
  'Lobster',
  'Lora',
  'Merriweather',
  'Monoton',
  'Montserrat',
  'Noto Sans',
  'Open Sans',
  'Orbitron',
  'Oswald',
  'PT Sans',
  'PT Serif',
  'Pacifico',
  'Permanent Marker',
  'Playfair Display',
  'Poppins',
  'Raleway',
  'Righteous',
  'Roboto',
  'Rubik Glitch',
  'Shadows Into Light',
  'Source Sans 3',
  'Space Grotesque',
  'Space Mono',
  'Syne',
  'Unbounded',
  'VT323'
];

const RATIOS: AspectRatio[] = ['1:1', '4:3', '3:2', '16:9'];

const Controls: React.FC<ControlsProps> = ({ 
  design, 
  setDesign, 
  onGenerate, 
  onBlank,
  onDownload,
  onOpenSettings,
  isGenerating,
  vibeReasoning
}) => {

  const update = (key: keyof DesignState, value: any) => {
    setDesign(prev => ({ ...prev, [key]: value }));
  };

  const toggle = (key: keyof DesignState) => {
    setDesign(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper to display ratio label based on orientation
  const getRatioLabel = (ratio: AspectRatio) => {
    if (design.orientation === 'portrait' && ratio !== '1:1') {
        const [w, h] = ratio.split(':');
        return `${h}:${w}`;
    }
    return ratio;
  };

  return (
    <div className="h-full flex flex-col bg-neutral-900 border-l border-neutral-800 overflow-hidden">
      
      {/* Header - Sticky / Fixed Top */}
      <div className="p-6 border-b border-neutral-800 flex items-start justify-between bg-neutral-900 shrink-0 z-10">
        <div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500 mb-1">
            ///Textrot Studio
            </h2>
            <p className="text-xs text-neutral-400">
            Visuals by Imagen 4.0.<br/>Typography by Gemini 2.5.
            </p>
        </div>
        <button 
            onClick={onOpenSettings}
            className="text-neutral-500 hover:text-white transition-colors p-1 rounded-[3px] hover:bg-neutral-800"
            title="Settings"
        >
            <Settings size={18} />
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* Generator */}
        <div className="p-6 border-b border-neutral-800 space-y-4">
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">Prompt</label>
          <textarea 
            className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-3 text-sm focus:outline-none focus:border-pink-500 transition-colors resize-none h-24"
            placeholder="e.g. A cyberpunk samurai in neon rain..."
            value={design.prompt}
            onChange={(e) => update('prompt', e.target.value)}
            title="Describe the image you want to generate"
          />
          
          {/* Aspect Ratio Controls */}
          <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">Aspect Ratio</label>
              <div className="flex gap-1">
                  {RATIOS.map((ratio) => (
                      <button
                          key={ratio}
                          onClick={() => update('aspectRatio', ratio)}
                          className={`flex-1 py-2 rounded-[3px] text-xs font-medium border ${
                              design.aspectRatio === ratio
                              ? 'bg-neutral-800 text-pink-500 border-pink-500/50'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:bg-neutral-900'
                          }`}
                          title={`Set aspect ratio to ${ratio}`}
                      >
                          {getRatioLabel(ratio)}
                      </button>
                  ))}
              </div>
          </div>

          {/* Orientation Toggle */}
          <div className="flex bg-neutral-950 p-1 rounded-[3px] border border-neutral-800">
              <button
                  onClick={() => update('orientation', 'landscape')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[3px] text-xs transition-all ${
                      design.orientation === 'landscape'
                      ? 'bg-neutral-800 text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                  title="Landscape Orientation"
              >
                  <Monitor size={14} />
                  Landscape
              </button>
              <button
                  onClick={() => update('orientation', 'portrait')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[3px] text-xs transition-all ${
                      design.orientation === 'portrait'
                      ? 'bg-neutral-800 text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                  title="Portrait Orientation"
              >
                  <Smartphone size={14} />
                  Portrait
              </button>
          </div>

          <div className="flex gap-2">
              <button 
                onClick={onGenerate}
                disabled={isGenerating || !design.prompt.trim()}
                className={`flex-1 py-3 rounded-[3px] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                  isGenerating || !design.prompt.trim()
                  ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-70' 
                  : 'bg-gradient-to-r from-pink-500 to-violet-600 text-white hover:brightness-110 hover:shadow-pink-500/20'
                }`}
                title={!design.prompt.trim() ? "Please enter a prompt" : "Generate new image and design styles"}
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></span>
                    Crafting...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate
                  </>
                )}
              </button>

              <button
                  onClick={onBlank}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 rounded-[3px] flex items-center justify-center"
                  title="Start with a blank transparent canvas"
              >
                  <FilePlus size={18} />
              </button>
          </div>

          {vibeReasoning && (
              <div className="bg-neutral-950/50 p-3 rounded-[3px] text-[10px] text-neutral-400 border border-neutral-800 italic">
                  <span className="text-pink-500 not-italic font-bold">AI Director:</span> "{vibeReasoning}"
              </div>
          )}
        </div>

        {/* Typography Controls */}
        <div className="p-6 space-y-8">
          
          {/* Text Content */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-neutral-300">
              <Type size={16} />
              <span className="text-sm font-medium">Text Content</span>
            </div>
            <textarea 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2 text-sm focus:border-pink-500 outline-none"
              rows={2}
              value={design.textOverlay}
              onChange={(e) => update('textOverlay', e.target.value)}
              title="Text to display"
            />
          </div>

          {/* Font & Styles */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-neutral-300">
              <Palette size={16} />
              <span className="text-sm font-medium">Style</span>
            </div>
            
            <select 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2 text-lg outline-none"
              value={design.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
              style={{ fontFamily: design.fontFamily }}
              title="Select font family"
            >
              {FONTS.map(f => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>

            {/* Modifiers Toolbar */}
            <div className="flex gap-1 bg-neutral-950 rounded-[3px] p-1 border border-neutral-800">
                <button 
                  onClick={() => toggle('isBold')}
                  className={`flex-1 p-2 rounded-[3px] hover:bg-neutral-800 flex justify-center ${design.isBold ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}
                  title="Toggle Bold"
                >
                  <Bold size={16} />
                </button>
                <button 
                  onClick={() => toggle('isItalic')}
                  className={`flex-1 p-2 rounded-[3px] hover:bg-neutral-800 flex justify-center ${design.isItalic ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}
                  title="Toggle Italic"
                >
                  <Italic size={16} />
                </button>
                <button 
                  onClick={() => toggle('isUppercase')}
                  className={`flex-1 p-2 rounded-[3px] hover:bg-neutral-800 flex justify-center ${design.isUppercase ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}
                  title="Toggle Uppercase"
                >
                  <CaseUpper size={16} />
                </button>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-2">
              {/* Text Color Column */}
              <div>
                  {/* Enforce fixed height for header row to match toggle button height */}
                  <div className="flex items-center mb-1 h-9">
                      <label className="text-[10px] text-neutral-500 block">Text Color</label>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-10">
                      <input 
                          type="color" 
                          value={design.textColor}
                          onChange={(e) => update('textColor', e.target.value)}
                          className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none"
                          title={design.specialEffect === 'gradient' ? "Start Color" : "Text Color"}
                      />
                      <span className="text-xs font-mono text-neutral-400">{design.textColor}</span>
                  </div>
              </div>
              
              {/* Shadow/Glow Column */}
              <div>
                  <div className="flex items-center justify-between mb-1 h-9">
                      <label className="text-[10px] text-neutral-500">Shadow/Glow</label>
                      <button 
                        onClick={() => toggle('hasShadow')} 
                        className="text-neutral-500 hover:text-pink-500 transition-colors focus:outline-none flex items-center justify-end"
                        title="Toggle Shadow"
                      >
                          {design.hasShadow ? <ToggleRight size={28} className="text-pink-500"/> : <ToggleLeft size={28}/>}
                      </button>
                  </div>
                  <div className={`flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-10 transition-opacity ${!design.hasShadow ? 'opacity-50 pointer-events-none' : ''}`}>
                      <input 
                          type="color" 
                          value={design.shadowColor}
                          onChange={(e) => update('shadowColor', e.target.value)}
                          className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none"
                          title="Choose shadow or glow color"
                      />
                      <span className="text-xs font-mono text-neutral-400">{design.shadowColor}</span>
                  </div>
              </div>
            </div>

            {/* Shadow Controls (Expanded) */}
            <div className={`space-y-2 pt-2 transition-opacity ${!design.hasShadow ? 'opacity-50 pointer-events-none' : ''}`}>
                  {/* Shadow Blur */}
                  <div>
                      <label className="flex justify-between text-[10px] text-neutral-500 mb-1">
                          <span>Shadow Blur</span>
                          <span>{design.shadowBlur}</span>
                      </label>
                      <input 
                          type="range" min="0" max="100" step="1"
                          value={design.shadowBlur}
                          onChange={(e) => update('shadowBlur', parseInt(e.target.value))}
                          className="w-full h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                      />
                  </div>

                   {/* Shadow Distance */}
                   <div>
                      <label className="flex justify-between text-[10px] text-neutral-500 mb-1">
                          <span>Shadow Distance</span>
                          <span>{design.shadowOffset}</span>
                      </label>
                      <input 
                          type="range" min="0" max="100" step="1"
                          value={design.shadowOffset}
                          onChange={(e) => update('shadowOffset', parseInt(e.target.value))}
                          className="w-full h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                      />
                  </div>

                   {/* Shadow Angle */}
                   <div className="flex items-center gap-2">
                        <Compass size={14} className="text-neutral-500" />
                        <input 
                            type="range" min="0" max="360"
                            value={design.shadowAngle}
                            onChange={(e) => update('shadowAngle', parseInt(e.target.value))}
                            className="flex-1 h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                            title="Shadow Angle"
                        />
                        <span className="text-xs font-mono text-neutral-500 w-8 text-right">{design.shadowAngle}°</span>
                   </div>
            </div>

            {/* Blurs & Opacity */}
            <div className="space-y-2 pt-2 border-t border-neutral-800">
                  {/* Text Opacity */}
                  <div>
                      <label className="flex justify-between text-[10px] text-neutral-500 mb-1">
                          <span>Opacity</span>
                          <span>{Math.round(design.opacity * 100)}%</span>
                      </label>
                      <input 
                          type="range" min="0" max="1" step="0.05"
                          value={design.opacity}
                          onChange={(e) => update('opacity', parseFloat(e.target.value))}
                          className="w-full h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                      />
                  </div>

                  {/* Text Blur */}
                  <div>
                      <label className="flex justify-between text-[10px] text-neutral-500 mb-1">
                          <span>Text Blur</span>
                          <span>{design.textBlur}px</span>
                      </label>
                      <input 
                          type="range" min="0" max="20" step="0.5"
                          value={design.textBlur}
                          onChange={(e) => update('textBlur', parseFloat(e.target.value))}
                          className="w-full h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                      />
                  </div>
            </div>
          </div>

          {/* Effects (Hollow / Outline / Special FX) */}
          <div className="space-y-3 pt-2 border-t border-neutral-800">
              <div className="flex items-center gap-2 text-neutral-300">
                  <CircleDashed size={16} />
                  <span className="text-sm font-medium">Effects</span>
              </div>

              <div className="flex gap-2">
                  <button
                      onClick={() => toggle('isHollow')}
                      className={`flex-1 p-3 rounded-[3px] border transition-all flex flex-col items-center justify-center gap-2 ${
                          design.isHollow 
                          ? 'bg-neutral-800 border-pink-500 text-pink-500' 
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:bg-neutral-900'
                      }`}
                      title="Toggle hollow style"
                  >
                      <CircleDashed size={20} strokeWidth={design.isHollow ? 2.5 : 1.5} />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Hollow</span>
                  </button>

                  <button
                      onClick={() => toggle('hasOutline')}
                      className={`flex-1 p-3 rounded-[3px] border transition-all flex flex-col items-center justify-center gap-2 ${
                          design.hasOutline 
                          ? 'bg-neutral-800 border-pink-500 text-pink-500' 
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:bg-neutral-900'
                      }`}
                      title="Toggle outline style"
                  >
                      <Square size={20} strokeWidth={design.hasOutline ? 3 : 1.5} />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Outline</span>
                  </button>
              </div>

              {/* Special FX Selector */}
              <div className="grid grid-cols-4 gap-1 bg-neutral-950 p-1 rounded-[3px] border border-neutral-800 mt-2">
                  {/* None */}
                  <button 
                    onClick={() => update('specialEffect', 'none')}
                    className={`p-2 rounded-[3px] flex justify-center items-center h-10 ${design.specialEffect === 'none' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'}`}
                    title="No Effect"
                  >
                    <Ban size={20} />
                  </button>
                  
                  {/* Glitch Icon: White A with Red/Blue Offset */}
                  <button 
                    onClick={() => update('specialEffect', 'glitch')}
                    className={`p-2 rounded-[3px] flex justify-center items-center h-10 overflow-hidden relative ${design.specialEffect === 'glitch' ? 'bg-neutral-800' : 'hover:bg-neutral-900'}`}
                    title="Glitch/Chromatic Aberration"
                  >
                    <div className="relative font-bold font-sans text-lg select-none">
                        <span className="absolute -left-[5px] text-red-500 opacity-70">A</span>
                        <span className="absolute -right-[5px] text-blue-500 opacity-70">A</span>
                        <span className="relative text-white">A</span>
                    </div>
                  </button>
                  
                  {/* Gradient Icon: Circle with Gradient */}
                  <button 
                    onClick={() => update('specialEffect', 'gradient')}
                    className={`p-2 rounded-[3px] flex justify-center items-center h-10 ${design.specialEffect === 'gradient' ? 'bg-neutral-800' : 'hover:bg-neutral-900'}`}
                    title="Gradient Fill"
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 ring-1 ring-white/20" />
                  </button>
                  
                  {/* Echo Icon: Stacked A's */}
                  <button 
                    onClick={() => update('specialEffect', 'echo')}
                    className={`p-2 rounded-[3px] flex justify-center items-center h-10 overflow-hidden ${design.specialEffect === 'echo' ? 'bg-neutral-800' : 'hover:bg-neutral-900'}`}
                    title="Echo / Motion Trail"
                  >
                     <div className="relative font-bold font-sans text-lg select-none">
                        <span className="absolute top-0 -left-2 text-white/20">A</span>
                        <span className="absolute top-0 -left-1 text-white/50">A</span>
                        <span className="relative text-white">A</span>
                    </div>
                  </button>
              </div>

              {/* Dynamic Controls based on Selection */}
              {design.specialEffect !== 'none' && (
                <div className="bg-neutral-950 p-3 rounded-[3px] border border-neutral-800 animate-in slide-in-from-top-2 fade-in space-y-3">
                    
                    {/* Rainbow Toggle for Glitch */}
                    {design.specialEffect === 'glitch' && (
                        <div className="flex items-center justify-between mb-2">
                             <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Rainbow Mode</label>
                             <button 
                                onClick={() => toggle('isRainbowGlitch')} 
                                className={`text-neutral-500 transition-colors focus:outline-none flex items-center ${design.isRainbowGlitch ? 'text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-blue-500' : ''}`}
                                title="Toggle Rainbow Glitch"
                             >
                                {design.isRainbowGlitch ? <ToggleRight size={28} className="text-pink-500" /> : <ToggleLeft size={28} />}
                             </button>
                        </div>
                    )}

                    {/* Intensity / Midpoint Slider */}
                    <div>
                        <label className="flex justify-between text-[10px] text-neutral-500 mb-1">
                            <span>
                              {design.specialEffect === 'glitch' ? 'Offset' : 
                              design.specialEffect === 'gradient' ? 'Spread' : 'Distance'}
                            </span>
                            <span>{design.effectIntensity}</span>
                        </label>
                        <input 
                            type="range" min="0" max="100" step="1"
                            value={design.effectIntensity}
                            onChange={(e) => update('effectIntensity', parseInt(e.target.value))}
                            className="w-full h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                        />
                    </div>
                    
                    {/* Angle/Direction Slider (Echo & Gradient & Rainbow Glitch) */}
                    {(design.specialEffect === 'echo' || design.specialEffect === 'gradient' || (design.specialEffect === 'glitch' && design.isRainbowGlitch)) && (
                        <div className="flex items-center gap-2">
                            <Compass size={14} className="text-neutral-500" />
                            <input 
                                type="range" min="0" max="360"
                                value={design.effectAngle}
                                onChange={(e) => update('effectAngle', parseInt(e.target.value))}
                                className="flex-1 h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                                title={design.specialEffect === 'gradient' ? "Gradient Angle" : "Direction"}
                            />
                            <span className="text-xs font-mono text-neutral-500 w-8 text-right">{design.effectAngle}°</span>
                        </div>
                    )}

                    {/* Color Pickers for Special Effects */}
                    {/* Gradient: End Color */}
                    {design.specialEffect === 'gradient' && (
                        <div>
                            <label className="text-[10px] text-neutral-500 block mb-1">End Color</label>
                            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1">
                                <input 
                                    type="color" 
                                    value={design.effectColor}
                                    onChange={(e) => update('effectColor', e.target.value)}
                                    className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none"
                                />
                                <span className="text-xs font-mono text-neutral-400">{design.effectColor}</span>
                            </div>
                        </div>
                    )}

                    {/* Glitch: Dual Colors (Only if not Rainbow) */}
                    {design.specialEffect === 'glitch' && !design.isRainbowGlitch && (
                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className="text-[10px] text-neutral-500 block mb-1">Left Color</label>
                                <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-[34px]">
                                    <input 
                                        type="color" 
                                        value={design.effectColor}
                                        onChange={(e) => update('effectColor', e.target.value)}
                                        className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none"
                                        title="Glitch Left Channel"
                                    />
                                    <span className="text-xs font-mono text-neutral-400">{design.effectColor}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-neutral-500 block mb-1">Right Color</label>
                                <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-[34px]">
                                    <input 
                                        type="color" 
                                        value={design.effectColor2}
                                        onChange={(e) => update('effectColor2', e.target.value)}
                                        className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none"
                                        title="Glitch Right Channel"
                                    />
                                    <span className="text-xs font-mono text-neutral-400">{design.effectColor2}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
              )}

              {/* Outline Config */}
              {design.hasOutline && (
                  <div className="bg-neutral-950 p-3 rounded-[3px] border border-neutral-800 animate-in slide-in-from-top-2 fade-in grid grid-cols-2 gap-2">
                      <div>
                          <label className="text-[10px] text-neutral-500 block mb-1">Width (px)</label>
                          <div className="bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-[34px] flex items-center">
                              <input 
                                  type="number" 
                                  min="1" max="10"
                                  value={design.outlineWidth}
                                  onChange={(e) => {
                                      const val = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
                                      update('outlineWidth', val);
                                  }}
                                  className="w-full bg-transparent text-xs text-center focus:outline-none"
                                  title="Outline thickness in pixels"
                              />
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] text-neutral-500 block mb-1">Outline Color</label>
                          <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-[3px] p-1 h-[34px]">
                              <input 
                                  type="color" 
                                  value={design.outlineColor}
                                  onChange={(e) => update('outlineColor', e.target.value)}
                                  className="w-6 h-6 rounded-[3px] cursor-pointer bg-transparent border-none"
                                  title="Outline color"
                              />
                              <span className="text-xs font-mono text-neutral-400">{design.outlineColor}</span>
                          </div>
                      </div>
                  </div>
              )}
          </div>

          {/* Layout & Transforms */}
          <div className="space-y-3 pt-2 border-t border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-300">
              <Move size={16} />
              <span className="text-sm font-medium">Layout & Transform</span>
            </div>

            {/* Size */}
            <div>
                  <label className="flex justify-between text-xs text-neutral-500 mb-1">
                      <span>Size</span>
                      <span>{design.textSize}%</span>
                  </label>
                  <input 
                      type="range" min="1" max="30" step="0.5"
                      value={design.textSize}
                      onChange={(e) => update('textSize', parseFloat(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                      title="Text scale"
                  />
            </div>

            {/* Position Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                      <label className="flex justify-between text-xs text-neutral-500 mb-1">
                          <span>X</span>
                          <span>{design.overlayPosition.x}%</span>
                      </label>
                      <input 
                          type="range" min="0" max="100"
                          value={design.overlayPosition.x}
                          onChange={(e) => update('overlayPosition', { ...design.overlayPosition, x: parseInt(e.target.value) })}
                          className="w-full h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                          title="Horizontal position"
                      />
                </div>
                <div>
                      <label className="flex justify-between text-xs text-neutral-500 mb-1">
                          <span>Y</span>
                          <span>{design.overlayPosition.y}%</span>
                      </label>
                      <input 
                          type="range" min="0" max="100"
                          value={100 - design.overlayPosition.y}
                          onChange={(e) => update('overlayPosition', { ...design.overlayPosition, y: 100 - parseInt(e.target.value) })}
                          className="w-full h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                          title="Vertical position"
                      />
                </div>
            </div>

            {/* Rotation */}
            <div className="flex items-center gap-2">
                  <RotateCw size={14} className="text-neutral-500" />
                  <input 
                      type="range" min="0" max="360"
                      value={design.rotation}
                      onChange={(e) => update('rotation', parseInt(e.target.value))}
                      className="flex-1 h-1 bg-neutral-800 rounded-[3px] appearance-none cursor-pointer accent-white"
                      title="Rotation angle"
                  />
                  <span className="text-xs font-mono text-neutral-500 w-8 text-right">{design.rotation}°</span>
            </div>

            {/* Alignment & Flips */}
            <div className="flex gap-2">
                  <div className="flex-1 flex gap-1 bg-neutral-950 rounded-[3px] p-1 border border-neutral-800">
                      {['left', 'center', 'right'].map((align) => (
                          <button
                              key={align}
                              onClick={() => update('textAlign', align)}
                              className={`flex-1 py-1 text-[10px] rounded-[3px] uppercase ${design.textAlign === align ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-white'}`}
                              title={`Align ${align}`}
                          >
                              {align.charAt(0)}
                          </button>
                      ))}
                  </div>
                  
                  <div className="flex gap-1 bg-neutral-950 rounded-[3px] p-1 border border-neutral-800">
                      <button 
                          onClick={() => toggle('flipX')}
                          className={`p-2 rounded-[3px] hover:bg-neutral-800 ${design.flipX ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}
                          title="Flip horizontal"
                      >
                          <FlipHorizontal size={14} />
                      </button>
                      <button 
                          onClick={() => toggle('flipY')}
                          className={`p-2 rounded-[3px] hover:bg-neutral-800 ${design.flipY ? 'bg-neutral-800 text-pink-500' : 'text-neutral-400'}`}
                          title="Flip vertical"
                      >
                          <FlipVertical size={14} />
                      </button>
                  </div>
            </div>
          </div>

          {/* Blend Mode */}
          <div className="space-y-3 pt-2 border-t border-neutral-800 pb-6">
            <div className="flex items-center gap-2 text-neutral-300">
              <Layers size={16} />
              <span className="text-sm font-medium">Blending</span>
            </div>
            <select 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-[3px] p-2 text-sm outline-none"
              value={design.blendMode}
              onChange={(e) => update('blendMode', e.target.value)}
              title="Select blend mode"
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply (Darken)</option>
              <option value="screen">Screen (Lighten)</option>
              <option value="overlay">Overlay (Contrast)</option>
              <option value="darken">Darken</option>
              <option value="lighten">Lighten</option>
              <option value="color-dodge">Color Dodge</option>
              <option value="color-burn">Color Burn</option>
              <option value="hard-light">Hard Light</option>
              <option value="soft-light">Soft Light</option>
              <option value="difference">Difference</option>
              <option value="exclusion">Exclusion</option>
              <option value="hue">Hue</option>
              <option value="saturation">Saturation</option>
              <option value="color">Color</option>
              <option value="luminosity">Luminosity</option>
            </select>
          </div>
        </div>

      </div>

      {/* Footer Actions - Sticky / Fixed Bottom */}
      <div className="p-6 border-t border-neutral-800 bg-neutral-900 shrink-0 z-10">
        <button 
            onClick={onDownload}
            className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-[3px] font-medium flex items-center justify-center gap-2 transition-colors"
            title="Download high-resolution image"
        >
            <Download size={16} />
            Export HD Image
        </button>
      </div>
    </div>
  );
};

export default Controls;

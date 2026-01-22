import React from 'react';
import { AppMode } from '../types';
import { Zap, Sparkles } from 'lucide-react';

interface ModeToggleProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  disabled?: boolean;
}

const ModeToggle: React.FC<ModeToggleProps> = ({ currentMode, onModeChange, disabled }) => {
  return (
    <div className="bg-white/10 p-1 rounded-full flex relative w-full sm:w-auto backdrop-blur-sm border border-white/20">
      <div 
        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/40 rounded-full shadow-sm transition-all duration-300 ease-out z-0 backdrop-blur-md`}
        style={{
          left: currentMode === AppMode.FAST ? '4px' : 'calc(50% + 0px)'
        }}
      />

      <button
        onClick={() => onModeChange(AppMode.FAST)}
        disabled={disabled}
        className={`relative z-10 flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-colors duration-200 w-full sm:w-40 ${
          currentMode === AppMode.FAST ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
        }`}
        type="button"
      >
        <Zap size={14} className={currentMode === AppMode.FAST ? 'fill-yellow-400 text-yellow-400' : ''} />
        快速生成
      </button>

      <button
        onClick={() => onModeChange(AppMode.CLARIFY)}
        disabled={disabled}
        className={`relative z-10 flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-colors duration-200 w-full sm:w-40 ${
          currentMode === AppMode.CLARIFY ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
        }`}
        type="button"
      >
        <Sparkles size={14} className={currentMode === AppMode.CLARIFY ? 'fill-purple-400 text-purple-400' : ''} />
        澄清生成
      </button>
    </div>
  );
};

export default ModeToggle;
import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, ShieldCheck, ChevronDown, ChevronUp, Settings } from 'lucide-react';

interface ApiKeyConfigProps {
  onApiKeyChange: (key: string) => void;
}

const ApiKeyConfig: React.FC<ApiKeyConfigProps> = ({ onApiKeyChange }) => {
  const [key, setKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('user_gemini_api_key');
    if (storedKey) {
      setKey(storedKey);
      onApiKeyChange(storedKey);
    }
  }, [onApiKeyChange]);

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.trim();
    setKey(newValue);
    localStorage.setItem('user_gemini_api_key', newValue);
    onApiKeyChange(newValue);
  };

  const hasKey = key.length > 0;

  return (
    <div className="w-full flex flex-col items-center animate-fade-in">
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300
          border backdrop-blur-md
          ${hasKey 
            ? 'bg-slate-200/30 text-slate-500 border-slate-200/50 hover:bg-slate-200/50 hover:text-slate-700' 
            : 'bg-amber-50/80 text-amber-600 border-amber-200/50 hover:bg-amber-100/80 shadow-sm'}
        `}
        type="button"
      >
        {hasKey ? <Settings size={12} /> : <Key size={12} />}
        <span>{hasKey ? 'API 设置' : '配置 Google API Key'}</span>
        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      <div 
        className={`
          w-full max-w-lg overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isOpen ? 'max-h-48 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}
        `}
      >
        <div 
          className={`
            relative rounded-2xl border transition-all duration-300
            ${isFocused ? 'bg-white/70 border-white/60 shadow-glass-hover' : 'bg-white/40 border-white/30 shadow-glass'}
            backdrop-blur-xl mx-1
          `}
        >
          <div className="flex items-center p-2 gap-3">
            
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Key size={14} />
              </div>
              <input
                type={isVisible ? "text" : "password"}
                value={key}
                onChange={handleKeyChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="在此粘贴你的 Google AI Studio API Key"
                className="w-full bg-transparent border-none text-sm text-slate-800 placeholder:text-slate-400/70 focus:ring-0 focus:outline-none py-2 pl-9 pr-8 font-mono tracking-tight"
                autoComplete="off"
                spellCheck="false"
              />
              <button 
                onClick={() => setIsVisible(!isVisible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                title={isVisible ? "隐藏" : "显示"}
                type="button"
              >
                {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="bg-white/20 border-t border-white/20 px-3 py-1.5 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
             <ShieldCheck size={10} className="text-slate-400" />
             <span>Key 仅存储于本地浏览器，直接请求 Google 接口</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyConfig;
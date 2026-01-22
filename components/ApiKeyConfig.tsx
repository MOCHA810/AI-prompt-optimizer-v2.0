import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

interface ApiKeyConfigProps {
  onApiKeyChange: (key: string) => void;
}

const ApiKeyConfig: React.FC<ApiKeyConfigProps> = ({ onApiKeyChange }) => {
  const [key, setKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);
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
    <div className="w-full mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
      <div 
        className={`
          relative overflow-hidden rounded-2xl transition-all duration-300 border
          ${isFocused ? 'bg-white/60 border-white/60 shadow-glass-hover' : 'bg-white/40 border-white/30 shadow-glass'}
          backdrop-blur-xl
        `}
      >
        <div className="flex flex-col sm:flex-row items-center p-1 sm:p-2 gap-2 sm:gap-4">
          
          {/* Icon & Label Section */}
          <div className="flex items-center gap-3 pl-3 w-full sm:w-auto">
            <div className={`p-2 rounded-xl transition-colors duration-300 ${hasKey ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-400/10 text-slate-400'}`}>
              <Key size={18} strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-800 tracking-wide">API 配置</span>
              <span className={`text-[10px] font-medium flex items-center gap-1 ${hasKey ? 'text-emerald-600' : 'text-slate-400'}`}>
                {hasKey ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block"></span>
                    API 已就绪
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block"></span>
                    未配置 API
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Divider (Hidden on mobile) */}
          <div className="hidden sm:block w-px h-8 bg-black/5 mx-1"></div>

          {/* Input Area */}
          <div className="flex-1 relative w-full px-2 sm:px-0 pb-2 sm:pb-0">
            <input
              type={isVisible ? "text" : "password"}
              value={key}
              onChange={handleKeyChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="请输入你的 Google AI Studio API Key"
              className="w-full bg-transparent border-none text-sm text-slate-800 placeholder:text-slate-400/70 focus:ring-0 focus:outline-none py-2 font-mono tracking-tight"
              autoComplete="off"
              spellCheck="false"
            />
            <button 
              onClick={() => setIsVisible(!isVisible)}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
              title={isVisible ? "隐藏" : "显示"}
            >
              {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Security Note Footer */}
        <div className="bg-white/20 border-t border-white/20 px-4 py-2 flex items-center justify-center gap-2 text-[10px] text-slate-500">
           <ShieldCheck size={10} className="text-slate-400" />
           <span>Key 仅保存在本地 LocalStorage，直接连接 Google 官方接口</span>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyConfig;

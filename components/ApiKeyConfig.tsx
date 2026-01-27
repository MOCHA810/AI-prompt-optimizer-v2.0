import React, { useState, useEffect } from 'react';
import { Key, Save, Trash2, CheckCircle2 } from 'lucide-react';
import GlassButton from './GlassButton';

const STORAGE_KEY = 'clarity_gemini_key';

const ApiKeyConfig: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem(STORAGE_KEY);
    if (storedKey) {
      setApiKey(storedKey);
      setSaved(true);
    } else {
      setShowInput(true);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem(STORAGE_KEY, apiKey.trim());
    setSaved(true);
    setShowInput(false);
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey('');
    setSaved(false);
    setShowInput(true);
  };

  if (!showInput && saved) {
    return (
      <div className="fixed top-4 right-4 z-50 animate-fade-in">
        <button 
          onClick={() => setShowInput(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white/40 hover:bg-white/60 backdrop-blur-md rounded-full text-slate-600 text-xs font-medium shadow-glass transition-all border border-white/30"
        >
          <Key size={14} />
          <span>API Key 已配置</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-lg mx-auto mb-8 animate-slide-up ${saved ? 'fixed top-0 left-0 right-0 h-screen bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4' : ''}`}>
      <div className="glass-panel p-6 rounded-3xl w-full shadow-glass bg-white/70">
        <div className="flex items-center gap-3 mb-4 text-slate-800">
          <div className="p-2 bg-blue-100/50 rounded-xl text-blue-600">
            <Key size={20} />
          </div>
          <h2 className="text-lg font-semibold">设置 Gemini API Key</h2>
        </div>
        
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          您的 Key 将仅存储在本地浏览器中，并通过加密通道发送至中转服务，不会被云端保存。
        </p>

        <div className="flex flex-col gap-3">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="粘贴您的 API Key (AI Studio)"
            className="glass-input w-full px-4 py-3 rounded-xl text-sm text-slate-700 placeholder:text-slate-400"
          />
          
          <div className="flex gap-3 mt-2">
            <GlassButton 
              onClick={handleSave} 
              disabled={!apiKey.trim()} 
              className="flex-1"
            >
              <Save size={16} /> 保存配置
            </GlassButton>
            
            {saved && (
              <GlassButton 
                variant="secondary" 
                onClick={handleClear}
                className="w-12 !px-0"
              >
                <Trash2 size={16} className="text-red-400" />
              </GlassButton>
            )}
            
             {saved && (
              <button 
                onClick={() => setShowInput(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-600"
              >
                取消
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyConfig;
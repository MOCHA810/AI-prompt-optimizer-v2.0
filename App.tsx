import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { AppMode, AppStatus, ClarificationQuestion } from './types';
import { generateFastPrompt, generateClarificationQuestions, generateFinalClarifiedPrompt } from './services/geminiService';
import GlassButton from './components/GlassButton';
import ModeToggle from './components/ModeToggle';

// --- Sub-Components ---

const ClarificationView: React.FC<{
  questions: ClarificationQuestion[];
  answers: Record<string, string>;
  onAnswer: (qId: string, val: string) => void;
  onSubmit: () => void;
}> = ({ questions, answers, onAnswer, onSubmit }) => {
  const isReady = questions.length > 0 && Object.keys(answers).length >= questions.length;

  return (
    <div className="mt-10 animate-fade-in">
      <div className="flex items-center gap-3 mb-6 px-1">
        <div className="h-px bg-slate-200/50 flex-1"></div>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">需要澄清</span>
        <div className="h-px bg-slate-200/50 flex-1"></div>
      </div>

      <p className="text-slate-600 text-center mb-8 px-4">
        我们已为你补全了大部分细节，请确认以下 {questions.length} 个关键点。
      </p>

      <div className="space-y-8">
        {questions.map((q) => (
          <div key={q.id} className="bg-white/10 rounded-3xl p-6 border border-white/20 backdrop-blur-sm">
            <h3 className="text-md font-medium text-slate-900 mb-4">{q.text}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {q.options.map((opt) => {
                const isSelected = answers[q.id] === opt.value;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onAnswer(q.id, opt.value)}
                    className={`
                      relative px-4 py-3 rounded-xl text-sm text-left transition-all duration-200 border
                      ${isSelected 
                        ? 'bg-white/60 border-slate-200/50 shadow-sm text-slate-900' 
                        : 'bg-transparent border-transparent hover:bg-white/20 text-slate-600'}
                    `}
                    type="button"
                  >
                    {opt.label}
                    {isSelected && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-800">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-8">
        <GlassButton onClick={onSubmit} disabled={!isReady}>
          生成最终指令 <ArrowRight size={16} />
        </GlassButton>
      </div>
    </div>
  );
};

const ResultView: React.FC<{
  result: string;
  copied: boolean;
  onCopy: () => void;
  onReset: () => void;
}> = ({ result, copied, onCopy, onReset }) => {
  return (
    <div className="mt-12 pt-10 border-t border-slate-200/40 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">优化后的指令</h3>
        <div className="flex gap-2">
          <button 
            onClick={onReset}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-white/30"
            title="重新开始"
            type="button"
          >
            <RefreshCw size={16} />
          </button>
          <button 
            onClick={onCopy}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${copied ? 'bg-emerald-100/80 text-emerald-700' : 'bg-slate-100/50 text-slate-600 hover:bg-slate-200/50'}`}
            type="button"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>
      
      <div className="bg-white/30 backdrop-blur-md rounded-2xl border border-white/30 p-6 shadow-sm overflow-hidden relative">
        <div className="prose prose-slate prose-sm max-w-none text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
          {result}
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  // State
  const [mode, setMode] = useState<AppMode>(AppMode.FAST);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  
  // Clarify Mode State
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  // Result
  const [result, setResult] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Refs for auto-scrolling
  const resultRef = useRef<HTMLDivElement>(null);
  const questionsRef = useRef<HTMLDivElement>(null);

  // Handlers
  const handleModeChange = (newMode: AppMode) => {
    if (status !== AppStatus.IDLE && status !== AppStatus.COMPLETED) return;
    setMode(newMode);
    setQuestions([]);
    setAnswers({});
    setError(null);
    if (status === AppStatus.COMPLETED) {
      setStatus(AppStatus.IDLE);
      setResult('');
    }
  };

  const handleGenerate = async () => {
    if (!input.trim()) return;

    setError(null);
    setResult('');
    setCopied(false);

    try {
      if (mode === AppMode.FAST) {
        setStatus(AppStatus.GENERATING_RESULT);
        const prompt = await generateFastPrompt(input);
        setResult(prompt);
        setStatus(AppStatus.COMPLETED);
      } else {
        setStatus(AppStatus.GENERATING_QUESTIONS);
        const generatedQuestions = await generateClarificationQuestions(input);
        setQuestions(generatedQuestions);
        setStatus(AppStatus.AWAITING_INPUT);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "服务器繁忙，请稍后重试。");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleClarificationSubmit = async () => {
    try {
      setStatus(AppStatus.GENERATING_RESULT);
      
      const qaPairs = questions.map(q => ({
        question: q.text,
        answer: answers[q.id] || q.options[0].value
      }));

      const finalPrompt = await generateFinalClarifiedPrompt(input, qaPairs);
      setResult(finalPrompt);
      setStatus(AppStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      setError(`优化失败: ${err.message || '请重试'}`);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleAnswer = (qId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setResult('');
    setQuestions([]);
    setAnswers({});
    setError(null);
    setInput('');
  };

  // Effects
  useEffect(() => {
    if (status === AppStatus.AWAITING_INPUT && questionsRef.current) {
      questionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (status === AppStatus.COMPLETED && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [status]);

  const isBusy = status === AppStatus.GENERATING_QUESTIONS || status === AppStatus.GENERATING_RESULT;

  // Render
  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-slate-200 text-slate-800">
      
      <main className="w-full max-w-3xl bg-glass-surface backdrop-blur-2xl border border-glass-border shadow-glass rounded-[40px] p-6 sm:p-10 transition-all duration-500 mb-8">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center relative z-10">
          <div className="w-12 h-12 bg-gradient-to-tr from-slate-100 to-white/40 rounded-2xl shadow-sm border border-white/30 flex items-center justify-center mb-6 backdrop-blur-md">
            <Sparkles className="text-slate-500" size={24} strokeWidth={1.5} />
          </div>
          
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-2">优化你的想法</h1>
          <p className="text-slate-500 font-normal">将零散的想法转化为精准的 AI 指令。</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center mb-8 relative z-0">
          <ModeToggle 
            currentMode={mode} 
            onModeChange={handleModeChange} 
            disabled={isBusy || (status !== AppStatus.IDLE && status !== AppStatus.COMPLETED)}
          />
        </div>

        {/* Input Section */}
        <div className="space-y-4">
          <div className="relative group">
            <textarea
              className="w-full h-40 bg-white/10 hover:bg-white/20 focus:bg-white/30 backdrop-blur-sm border border-white/20 rounded-3xl p-6 text-lg placeholder:text-slate-400/80 focus:outline-none focus:ring-0 transition-all resize-none shadow-inner text-slate-800"
              placeholder="在这里描述你的想法... 不必在意结构。"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isBusy || (status === AppStatus.AWAITING_INPUT)}
            />
          </div>

          <div className="flex justify-end pt-2 items-center gap-4">
            {status === AppStatus.IDLE || status === AppStatus.COMPLETED || status === AppStatus.ERROR ? (
              <GlassButton 
                onClick={handleGenerate} 
                disabled={!input.trim()}
                isLoading={isBusy}
              >
                {status === AppStatus.COMPLETED ? '再次优化' : '生成指令'}
                {status !== AppStatus.COMPLETED && <ArrowRight size={16} />}
              </GlassButton>
            ) : null}
          </div>
        </div>

        {/* Clarification Section */}
        {status === AppStatus.AWAITING_INPUT && (
          <div ref={questionsRef}>
            <ClarificationView 
              questions={questions}
              answers={answers}
              onAnswer={handleAnswer}
              onSubmit={handleClarificationSubmit}
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 rounded-2xl bg-red-50/20 border border-red-100/50 text-red-600 text-sm text-center backdrop-blur-md">
            {error}
          </div>
        )}

        {/* Result Section */}
        {status === AppStatus.COMPLETED && result && (
          <div ref={resultRef}>
            <ResultView 
              result={result}
              copied={copied}
              onCopy={copyToClipboard}
              onReset={handleReset}
            />
          </div>
        )}

      </main>

      <footer className="text-center text-slate-400 text-xs pb-12">
        <p>由 Gemini 驱动。为清晰而设计。</p>
      </footer>
    </div>
  );
};

export default App;
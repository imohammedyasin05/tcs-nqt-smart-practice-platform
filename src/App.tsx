/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Settings, 
  Timer, 
  Calculator as CalcIcon, 
  CheckCircle2, 
  ChevronRight, 
  AlertCircle, 
  History,
  Trophy,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Subject, Difficulty, AptitudeQuestion, CodingQuestion, ExamSession } from './types';
import Calculator from './components/calculator';

// TCS NQT Topic Tree
const TOPICS: Record<Subject, string[]> = {
  Quant: ['Percentages', 'Profit & Loss', 'Ratios', 'Time & Work', 'Speed & Distance', 'Averages', 'Number Systems'],
  Logical: ['Syllogisms', 'Data Interpretation', 'Blood Relations', 'coding-Decoding', 'Series', 'Venn Diagrams'],
  Verbal: ['Reading Comprehension', 'Sentence Correction', 'Synonyms & Antonyms', 'Error Spotting'],
  Coding: ['Arrays', 'Strings', 'Dynamic Programming', 'Searching/Sorting', 'Recursion']
};

export default function App() {
  const [view, setView] = useState<'HOME' | 'EXAM' | 'RESULT'>('HOME');
  const [session, setSession] = useState<ExamSession>(() => {
    const saved = localStorage.getItem('tcs_nqt_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved session", e);
      }
    }
    return {
      subject: 'Quant',
      topic: 'Percentages',
      difficulty: 'Medium',
      examMode: false,
      timerEnabled: true,
      calculatorEnabled: true,
      timeRemaining: 1800,
      questions: [],
      answers: {},
      status: 'IDLE',
      provider: 'auto'
    };
  });
  const [currentQIndex, setCurrentQIndex] = useState(() => {
    const saved = localStorage.getItem('tcs_nqt_qindex');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Re-sync view if session is active
  useEffect(() => {
    if (session.status === 'STARTED') setView('EXAM');
    if (session.status === 'COMPLETED') setView('RESULT');
  }, []);

  const [isGenerating, setIsGenerating] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('tcs_nqt_session', JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    localStorage.setItem('tcs_nqt_qindex', currentQIndex.toString());
  }, [currentQIndex]);

  // Prevent Navigation in Exam Mode
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (view === 'EXAM' && session.status === 'STARTED') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    if (view === 'EXAM') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      // Push a dummy state to try and trap back button
      window.history.pushState(null, '', window.location.href);
      const handlePopState = () => {
        if (view === 'EXAM' && session.status === 'STARTED') {
          if (confirm("Leaving the exam will lose unsaved progress. Continue?")) {
             setView('HOME');
          } else {
             window.history.pushState(null, '', window.location.href);
          }
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [view, session.status]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (view === 'EXAM' && session.timerEnabled && session.status === 'STARTED' && session.timeRemaining > 0) {
      interval = setInterval(() => {
        setSession(prev => ({ ...prev, timeRemaining: prev.timeRemaining - 1 }));
      }, 1000);
    } else if (session.timeRemaining === 0 && view === 'EXAM') {
      setView('RESULT');
      setSession(prev => ({ ...prev, status: 'COMPLETED' }));
    }
    return () => clearInterval(interval);
  }, [view, session.timerEnabled, session.status, session.timeRemaining]);

  const normalizeQuestions = (questions: any[]) => {
    return questions.map((q: any) => {
      let optionsArray: string[] = [];
      if (Array.isArray(q.options)) {
        optionsArray = q.options;
      } else if (typeof q.options === 'string') {
        optionsArray = q.options.split(/,|\n/).map((opt: string) => opt.trim());
      } else if (typeof q.options === 'object' && q.options !== null) {
        optionsArray = Object.values(q.options);
      }
      
      let answerIndex = 0;
      if (typeof q.answer === 'number') {
        answerIndex = q.answer;
      } else if (typeof q.correctAnswer === 'number') {
        answerIndex = q.correctAnswer;
      } else if (typeof q.answer === 'string') {
        const str = q.answer.trim().toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(str)) {
          answerIndex = str.charCodeAt(0) - 65;
        } else {
          answerIndex = optionsArray.findIndex(opt => String(opt).trim().toUpperCase() === str);
        }
      } else if (typeof q.correctAnswer === 'string') {
        const str = q.correctAnswer.trim().toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(str)) {
          answerIndex = str.charCodeAt(0) - 65;
        } else {
          answerIndex = optionsArray.findIndex(opt => String(opt).trim().toUpperCase() === str);
        }
      }
      if (answerIndex === -1) answerIndex = 0; // Fallback

      return {
        ...q,
        question: q.question || q.question_text || q.questionText || q.text || q.title || "Question not available",
        options: optionsArray,
        answer: answerIndex,
        explanation: q.explanation || "No explanation provided"
      };
    });
  };

  const startSession = async (batchCount: number = 0) => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch('https://tcs-nqt-smart-practice-platform.onrender.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: session.subject,
          topics: batchCount > 0 ? TOPICS[session.subject] : [session.topic],
          difficulty: session.difficulty,
          count: batchCount > 0 ? batchCount : 1,
          provider: session.provider
        })
      });

      if (!response.ok) throw new Error('Generation failed');
      const data = await response.json();
      const questions = normalizeQuestions(data.questions);
      
      setSession(prev => ({
        ...prev,
        questions,
        status: 'STARTED',
        timeRemaining: prev.examMode ? 1800 : prev.timeRemaining
      }));
      setCurrentQIndex(0);
      setView('EXAM');

      // Pre-fetch next question in background if not batch mode
      if (batchCount === 0) {
        fetchNextQuestionInBackground(session.subject, session.topic, session.difficulty);
      }
    } catch (err) {
      setError("Failed to generate questions. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchNextQuestionInBackground = async (subject: string, topic: string, difficulty: string) => {
    try {
      const response = await fetch('https://tcs-nqt-smart-practice-platform.onrender.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, topics: [topic], difficulty, count: 1, provider: session.provider })
      });
      if (response.ok) {
        const data = await response.json();
        const normalized = normalizeQuestions(data.questions);
        setSession(prev => ({
          ...prev,
          questions: [...prev.questions, normalized[0]]
        }));
      }
    } catch (err) {
      console.error('Background fetch failed', err);
    }
  };

  const nextQuestion = async () => {
    if (currentQIndex < session.questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
      
      // If we are one away from the end, fetch the next one in background
      if (currentQIndex === session.questions.length - 2 && !session.examMode) {
        fetchNextQuestionInBackground(session.subject, session.topic, session.difficulty);
      }
    } else {
      // If we reached the end but didn't pre-fetch (e.g. background fetch failed)
      setIsGenerating(true);
      try {
        const response = await fetch('https://tcs-nqt-smart-practice-platform.onrender.com/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: session.subject,
            topics: [session.topic],
            difficulty: session.difficulty,
            count: 1,
            provider: session.provider
          })
        });
        if (!response.ok) throw new Error('Generation failed');
        const data = await response.json();
        const normalized = normalizeQuestions(data.questions);
        setSession(prev => ({
          ...prev,
          questions: [...prev.questions, normalized[0]]
        }));
        setCurrentQIndex(prev => prev + 1);
      } catch (err) {
        setError("AI was unable to generate the next question.");
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const submitAnswer = (ans: any) => {
    setSession(prev => ({
      ...prev,
      answers: { ...prev.answers, [session.questions[currentQIndex].id]: ans }
    }));
  };

  const finishExam = () => {
    console.log("[DEBUG] finishExam called. Initializing wrap-up sequence.");

    // 1. Confirm termination
    let confirmed = false;
    try {
      confirmed = window.confirm("AUTHENTICATION REQUIRED: Are you sure you want to end the session? Your progress will be saved and evaluated.");
    } catch (e) {
      console.warn("window.confirm unavailable, auto-confirming termination");
      confirmed = true;
    }

    if (!confirmed) {
      console.log("[DEBUG] finishExam aborted by user.");
      return;
    }

    console.log("[DEBUG] Proceeding with exam completion.");

    // 2. State Update: Mark as completed
    // This stops the timer automatically because of the useEffect condition: session.status === 'STARTED'
    setSession(prev => {
      // Calculate final stats on the fly to fulfill "calculate score" requirement
      const aptitudeQs = prev.questions.filter(q => q.subject !== 'Coding') as AptitudeQuestion[];
      const correct = aptitudeQs.reduce((acc, q) => {
        console.log("Selected:", prev.answers[q.id]);
        console.log("Correct:", q.answer);
        return acc + (prev.answers[q.id] === q.answer ? 1 : 0);
      }, 0);
      const finalScore = aptitudeQs.length > 0 ? Math.round((correct / aptitudeQs.length) * 100) : 100;
      
      console.log(`[DEBUG] Final Calculations -> Correct: ${correct}, Score: ${finalScore}%`);
      
      return {
        ...prev,
        status: 'COMPLETED'
      };
    });

    // 3. Navigation: Switch to Result View
    // This is the SPA equivalent of redirecting to result.html
    console.log("[DEBUG] Switching view to RESULT page.");
    setView('RESULT');

    // 4. Persistence Bridge
    localStorage.setItem('tcs_nqt_status_final', 'COMPLETED');
    console.log("[DEBUG] finishExam sequence complete. Redirect initiated.");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Views
  const LandingView = () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-mono mb-6 uppercase tracking-widest">
          <Brain size={14} />
          AI Powered Platform
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
          TCS NQT <span className="text-indigo-500">Smart Practice</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Prepare for your TCS National Qualifier Test with real-world simulator and Gemini AI-generated questions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="bg-brand-surface border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6 shadow-xl shadow-black/20">
          <div>
            <label className="block text-slate-500 text-[10px] lg:text-[11px] font-mono uppercase mb-3 tracking-[0.2em] font-bold">Select Subject</label>
            <div className="grid grid-cols-2 gap-3">
              {(['Quant', 'Logical', 'Verbal', 'Coding'] as Subject[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSession(prev => ({ ...prev, subject: s, topic: TOPICS[s][0] }))}
                  className={`p-3 lg:p-4 rounded-xl border text-left transition-all text-sm lg:text-base ${
                    session.subject === s 
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-lg shadow-indigo-500/10' 
                    : 'border-slate-800 bg-brand-bg text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-500 text-[10px] lg:text-[11px] font-mono uppercase mb-3 tracking-[0.2em] font-bold">Select Topic</label>
            <select
              value={session.topic}
              onChange={e => setSession(prev => ({ ...prev, topic: e.target.value }))}
              className="w-full bg-brand-bg border border-slate-800 text-white p-3 lg:p-4 rounded-xl outline-none focus:border-indigo-500 transition-colors capitalize text-sm lg:text-base appearance-none"
            >
              {TOPICS[session.subject].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 text-[10px] lg:text-[11px] font-mono uppercase mb-3 tracking-[0.2em] font-bold">Difficulty</label>
            <div className="flex gap-2">
              {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setSession(prev => ({ ...prev, difficulty: d }))}
                  className={`flex-1 p-2.5 lg:p-3 rounded-lg border text-xs lg:text-sm transition-all ${
                    session.difficulty === d 
                    ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                    : 'border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-brand-surface border border-slate-800 rounded-2xl p-6 lg:p-8 space-y-6 shadow-xl shadow-black/20">
          <label className="block text-slate-500 text-[10px] lg:text-[11px] font-mono uppercase tracking-[0.2em] font-bold">Simulator Settings</label>
          
          <div>
            <label className="block text-slate-500 text-[9px] lg:text-[10px] font-mono uppercase mb-2 tracking-[0.1em]">AI Provider</label>
            <select
              value={session.provider}
              onChange={e => setSession(prev => ({ ...prev, provider: e.target.value as any }))}
              className="w-full bg-brand-bg border border-slate-800 text-slate-300 p-2.5 rounded-lg outline-none focus:border-indigo-500 transition-colors text-xs lg:text-sm appearance-none mb-2"
            >
              <option value="auto">Auto (Gemini &rarr; Groq)</option>
              <option value="gemini">Gemini (Primary)</option>
              <option value="groq">Groq (Llama-3.3)</option>
            </select>
          </div>

          <div className="space-y-3 lg:space-y-4">
            {[
              { label: 'Exam Mode', key: 'examMode', icon: <Settings size={18} /> },
              { label: 'Timer Enabled', key: 'timerEnabled', icon: <Timer size={18} /> },
              { label: 'Calculator Toggle', key: 'calculatorEnabled', icon: <CalcIcon size={18} /> },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setSession(prev => ({ ...prev, [opt.key]: !prev[opt.key as keyof ExamSession] }))}
                className="w-full flex items-center justify-between p-3 lg:p-4 bg-brand-bg rounded-xl border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3 text-white text-sm lg:text-base">
                  <span className="text-slate-500">{opt.icon}</span>
                  {opt.label}
                </div>
                <div className={`w-10 lg:w-12 h-5 lg:h-6 rounded-full relative transition-colors ${session[opt.key as keyof ExamSession] ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                  <div className={`absolute top-0.5 lg:top-1 w-4 h-4 bg-white rounded-full transition-all ${session[opt.key as keyof ExamSession] ? 'left-5 lg:left-7' : 'left-1'}`} />
                </div>
              </button>
            ))}
          </div>

          <div className="pt-4 space-y-3 lg:space-y-4">
            <button
              onClick={() => startSession(0)}
              disabled={isGenerating}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 lg:py-5 rounded-2xl font-bold text-base lg:text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play size={18} className="lg:w-[20px]" />
                  Quick Practice
                </>
              )}
            </button>
            <button
              onClick={() => startSession(10)}
              disabled={isGenerating}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 lg:py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-slate-700 disabled:opacity-50 active:scale-[0.98]"
            >
              <Trophy size={16} className="text-amber-500 lg:w-[18px]" />
              Full Mock Test (10 Qs)
            </button>
            {error && <p className="mt-4 text-red-500 text-center text-xs lg:text-sm flex items-center justify-center gap-1"><AlertCircle size={14} />{error}</p>}
          </div>
        </div>
      </div>
      
      {/* Footer Info removed in favor of GlobalFooter */}
    </div>
  );

  const ExamView = () => {
    const q = session.questions[currentQIndex];
    if (!q) return null;

    const isCoding = q.subject === 'Coding';
    const aptitudeQ = q as AptitudeQuestion;
    const codingQ = q as CodingQuestion;

    return (
      <div className="h-full flex flex-col bg-brand-bg relative selection:bg-indigo-500/30">
        {/* Compact Responsive Header */}
        <header className="h-14 lg:h-16 border-b border-slate-700 bg-brand-surface flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-3 lg:gap-6">
            <div className="flex items-center gap-2 lg:gap-4 group cursor-pointer transition-transform duration-300 hover:scale-105" onClick={() => setView('HOME')}>
              <img src="/logo.png" alt="TCS NQT Logo" className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg shadow-lg shadow-indigo-500/20 object-contain bg-slate-900/50 p-1 border border-slate-700/50" />
              <h1 className="text-xs lg:text-lg font-bold tracking-tight text-white hidden sm:block">TCS NQT Smart Practice Platform</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-8">
            {session.timerEnabled && (
              <div className="flex flex-col items-end">
                <span className="text-[8px] lg:text-[10px] uppercase tracking-widest text-slate-500 font-bold hidden xs:block">Time Remaining</span>
                <span className={`text-sm lg:text-2xl font-mono leading-none ${session.timeRemaining < 300 ? 'text-red-500 animate-pulse' : 'text-indigo-400'}`}>
                  {formatTime(session.timeRemaining)}
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-1.5 lg:gap-3">
              {session.calculatorEnabled && (
                <button 
                  onClick={() => setShowCalculator(!showCalculator)}
                  className={`p-2 lg:p-2.5 rounded border transition-all ${showCalculator ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'}`}
                >
                  <CalcIcon size={16} className="lg:w-[18px]" />
                </button>
              )}

              <button 
                type="button"
                id="end-exam-header-btn"
                onClick={(e) => {
                  e.preventDefault();
                  console.log("Header End Exam button clicked");
                  finishExam();
                }}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3 lg:px-5 py-1.5 lg:py-2.5 rounded text-[10px] lg:text-sm font-bold transition-all shadow-lg shadow-red-500/10 active:scale-95"
              >
                End Exam
              </button>
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
          {/* Question Palette - Horizontal Scroll on Mobile */}
          <aside className="w-full lg:w-64 bg-brand-bg border-b lg:border-r border-slate-800 p-4 lg:p-6 flex flex-row lg:flex-col gap-4 lg:gap-8 shrink-0 overflow-x-auto lg:overflow-y-auto no-scrollbar">
            <section className="hidden lg:block shrink-0">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-4 px-1 font-bold">Subject Status</h3>
              <div className="space-y-2">
                {(['Quant', 'Logical', 'Verbal', 'Coding'] as Subject[]).map(s => (
                  <div key={s} className={`p-3 px-4 text-sm font-medium rounded transition-colors ${session.subject === s ? 'bg-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800/50 cursor-pointer'}`}>
                    {s} Ability
                  </div>
                ))}
              </div>
            </section>

            <section className="flex-1 w-full min-w-0">
              <h3 className="hidden lg:block text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-4 px-1 font-bold">Question Palette</h3>
              <div className="flex lg:grid lg:grid-cols-5 gap-2 pb-1 lg:pb-0">
                {session.questions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentQIndex(idx)}
                    className={`min-w-[36px] h-9 rounded flex items-center justify-center text-xs font-bold transition-all border shrink-0 ${
                      idx === currentQIndex 
                      ? 'border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-500/10' 
                      : session.answers[session.questions[idx].id]
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-500'
                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </section>

            <div className="hidden lg:block bg-brand-surface p-5 rounded-xl border border-slate-800 text-[11px] text-slate-500 shadow-inner">
               <p className="flex justify-between mb-2"><span>Answered</span><span className="text-emerald-500 font-bold">{Object.keys(session.answers).length}</span></p>
               <p className="flex justify-between mb-2"><span>Time Total</span><span className="text-slate-300 font-mono">30:00</span></p>
               <p className="flex justify-between"><span>Status</span><span className="text-indigo-400 font-bold">Live</span></p>
            </div>
          </aside>

          {/* Main Question Area */}
          <main className="flex-1 flex flex-col bg-brand-bg overflow-y-auto pb-24 lg:pb-0">
            <div className="max-w-4xl mx-auto w-full p-6 lg:p-10 flex-1">
              <div className="flex items-center justify-between mb-6 lg:mb-10">
                 <span className="bg-indigo-500/10 text-indigo-400 text-[10px] lg:text-xs px-3 lg:px-4 py-1 rounded-full border border-indigo-500/20 font-bold uppercase tracking-wider">
                   Q.{(currentQIndex + 1).toString().padStart(2, '0')}
                 </span>
                 <div className="flex items-center gap-3 lg:gap-4 text-slate-500 text-[9px] lg:text-[11px] font-mono uppercase tracking-[0.1em]">
                    <span>Marks: <span className="text-emerald-500">+1.0</span></span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span>Diff: <span className="text-slate-300">{q.difficulty}</span></span>
                 </div>
              </div>

              <div className="space-y-8 lg:space-y-10">
                {console.log("Full question object:", q)}
                {q && (
                  <h2 className="question text-lg lg:text-xl font-semibold text-white">
                    {q.question || "Loading question..."}
                  </h2>
                )}

                {isCoding && (
                  <div className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="bg-brand-surface p-6 lg:p-8 rounded-2xl border border-slate-800 shadow-xl shadow-black/20">
                       <h4 className="text-indigo-400 text-[10px] font-mono uppercase tracking-[0.2em] mb-4 font-bold">Problem Statement</h4>
                       <p className="text-slate-300 leading-relaxed text-sm lg:text-base">{codingQ.problemStatement}</p>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                       <div className="bg-slate-900/50 p-4 lg:p-6 rounded-xl border border-slate-800">
                         <h4 className="text-slate-500 text-[9px] font-mono uppercase mb-3 tracking-widest">Sample Input</h4>
                         <pre className="text-emerald-500 font-mono text-xs lg:text-sm overflow-x-auto">{codingQ.sampleInput}</pre>
                       </div>
                       <div className="bg-slate-900/50 p-4 lg:p-6 rounded-xl border border-slate-800">
                         <h4 className="text-slate-500 text-[9px] font-mono uppercase mb-3 tracking-widest">Sample Output</h4>
                         <pre className="text-emerald-500 font-mono text-sm lg:text-sm overflow-x-auto">{codingQ.sampleOutput}</pre>
                       </div>
                     </div>
                     <div className="bg-brand-surface/40 p-4 lg:p-6 rounded-xl border border-slate-800/50">
                       <h4 className="text-amber-500/80 text-[9px] font-mono uppercase tracking-widest mb-3">Constraints</h4>
                       <p className="text-slate-400 font-mono text-sm leading-relaxed">{codingQ.constraints}</p>
                     </div>

                     <div className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                           <h4 className="text-emerald-500 text-[10px] font-mono uppercase tracking-[0.2em] font-bold">Solution Editor</h4>
                           <div className="flex gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                           </div>
                        </div>
                        <textarea
                          placeholder="// Write your code here..."
                          value={session.answers[q.id] || ''}
                          onChange={(e) => submitAnswer(e.target.value)}
                          className="w-full h-48 lg:h-64 bg-slate-900 border border-slate-800 rounded-xl p-4 lg:p-6 font-mono text-emerald-500/90 text-sm focus:border-indigo-500 transition-colors outline-none resize-none shadow-inner"
                        />
                        <div className="mt-4 flex flex-col xs:flex-row justify-between items-start xs:items-center text-[9px] lg:text-[10px] font-mono text-slate-500 uppercase tracking-widest gap-2">
                           <span>Language: Auto-Detect</span>
                           <span>Press 'Save & Next' to record effort</span>
                        </div>
                     </div>
                  </div>
                )}

                {!isCoding && Array.isArray(aptitudeQ.options) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                    {aptitudeQ.options.map((optionValue, index) => (
                      <button
                        key={index}
                        onClick={() => submitAnswer(index)}
                        className={`group flex items-center p-4 lg:p-5 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                          session.answers[q.id] === index
                            ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/10'
                            : 'bg-brand-surface border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-8 h-8 lg:w-9 lg:h-9 rounded flex items-center justify-center text-xs font-bold mr-4 lg:mr-5 transition-all outline-none ${
                          session.answers[q.id] === index
                            ? 'bg-white text-indigo-600'
                            : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700 border border-slate-700'
                        }`}>
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span className={`text-sm lg:text-[15px] font-medium transition-colors ${session.answers[q.id] === index ? 'text-white' : 'group-hover:text-slate-200 text-left'}`}>
                          {optionValue}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {session.answers[q.id] !== undefined && !isCoding && !session.examMode && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 lg:p-8 bg-slate-900/40 border border-dashed border-slate-700 rounded-2xl lg:rounded-3xl mt-8 lg:mt-12 mb-10"
                >
                  <div className="flex items-center gap-4 mb-4 lg:mb-6">
                     <div className={`px-2 lg:px-3 py-1 rounded inline-block text-[8px] lg:text-[10px] font-bold uppercase tracking-widest ${session.answers[q.id] === aptitudeQ.answer ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                       {session.answers[q.id] === aptitudeQ.answer ? 'Correct' : 'Incorrect'}
                     </div>
                     <div className="h-px flex-1 bg-slate-800" />
                     <h4 className="text-slate-500 font-mono text-[9px] lg:text-[10px] uppercase tracking-widest px-2 hidden xs:block">Solution Analysis</h4>
                  </div>
                  <p className="text-slate-400 leading-relaxed italic text-xs lg:text-sm">{aptitudeQ.explanation}</p>
                </motion.div>
              )}
            </div>

            {/* Bottom Footer Actions - Adjusted for Mobile Floating Panel feel */}
            <footer className="h-20 lg:h-24 bg-brand-surface border-t border-slate-800 px-4 lg:px-10 flex items-center justify-between shrink-0 fixed lg:static bottom-0 left-0 right-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
              <div className="hidden xs:flex gap-2 lg:gap-4">
                <button 
                  onClick={() => setSession(prev => ({ ...prev, answers: { ...prev.answers, [q.id]: undefined as any } }))}
                  className="px-3 lg:px-6 py-2 rounded border border-slate-700 text-slate-400 text-[10px] lg:text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="flex gap-2 lg:gap-4 w-full xs:w-auto">
                <button 
                  disabled={currentQIndex === 0 || session.examMode}
                  onClick={() => setCurrentQIndex(i => i - 1)}
                  className="flex-1 xs:flex-none px-4 lg:px-6 py-2.5 lg:py-2.5 rounded border border-slate-700 text-slate-400 text-[10px] lg:text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-0"
                >
                  Prev
                </button>
                <button 
                  type="button"
                  id="save-next-finish-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    console.log("Footer Action button clicked", currentQIndex === session.questions.length - 1 ? "FINISH" : "NEXT");
                    if (currentQIndex === session.questions.length - 1) {
                      finishExam();
                    } else {
                      nextQuestion();
                    }
                  }}
                  disabled={isGenerating}
                  className="flex-[2] xs:flex-none px-6 lg:px-10 py-2.5 lg:py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs lg:text-sm font-bold shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 lg:gap-3 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isGenerating ? 'Wait...' : (currentQIndex === session.questions.length - 1 ? 'Finish Exam' : 'Save & Next')}
                  {!isGenerating && <ChevronRight size={16} />}
                </button>
              </div>
            </footer>
          </main>

          {/* Desktop Only Instructions */}
          <aside className="hidden lg:flex w-72 bg-brand-bg border-l border-slate-800 p-6 flex flex-col gap-8 shrink-0">
             <div className="flex-1 bg-brand-surface/30 rounded-xl border border-dashed border-slate-800 p-6 flex flex-col">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-6">Guidelines</h4>
                <ul className="text-[11px] text-slate-500 space-y-4 leading-relaxed">
                   <li className="flex gap-3">
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-700 shrink-0 mt-1" />
                     <span>Simulation Mode active.</span>
                   </li>
                   <li className="flex gap-3">
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-700 shrink-0 mt-1" />
                     <span>Time limit is absolute.</span>
                   </li>
                </ul>
                
                <div className="mt-auto pt-6 border-t border-slate-800">
                   <div className="p-4 bg-amber-500/5 text-amber-500/80 text-[10px] rounded-lg border border-amber-500/10 flex gap-3">
                     <AlertCircle size={14} className="shrink-0" />
                     Avoid refreshing.
                   </div>
                </div>
             </div>
          </aside>
        </div>

        <AnimatePresence>
          {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}
        </AnimatePresence>
      </div>
    );
  };

  const ResultView = () => {
    const aptitudeQs = session.questions.filter(q => q.subject !== 'Coding') as AptitudeQuestion[];
    const codingQs = session.questions.filter(q => q.subject === 'Coding') as CodingQuestion[];
    
    const correctCount = aptitudeQs.reduce((acc, q) => {
      console.log("Selected:", session.answers[q.id]);
      console.log("Correct:", q.answer);
      return acc + (session.answers[q.id] === q.answer ? 1 : 0);
    }, 0);
    
    const codingAttemptedCount = codingQs.reduce((acc, q) => {
      return acc + (session.answers[q.id] ? 1 : 0);
    }, 0);

    const score = aptitudeQs.length > 0 ? Math.round((correctCount / aptitudeQs.length) * 100) : 100;

    return (
      <div className="max-w-4xl mx-auto px-4 lg:px-6 py-10 lg:py-20 text-center animate-in fade-in zoom-in duration-500">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-brand-surface border border-slate-800 rounded-2xl lg:rounded-3xl p-6 lg:p-16 overflow-hidden relative shadow-2xl"
        >
          {/* Background Highlight */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-indigo-600/5 blur-[150px] pointer-events-none" />

          <div className="relative z-10">
            <div className="w-16 h-16 lg:w-24 lg:h-24 bg-indigo-600/20 rounded-2xl lg:rounded-3xl flex items-center justify-center mx-auto mb-6 lg:mb-8 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
              <Trophy size={32} className="text-indigo-400 lg:w-[48px]" />
            </div>
            
            <h2 className="text-3xl lg:text-5xl font-bold text-white mb-2 tracking-tight">Session Complete</h2>
            <p className="text-slate-500 font-mono uppercase tracking-[0.3em] text-[9px] lg:text-[11px] mb-8 lg:mb-12 font-bold">Analytics Verified</p>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-10 lg:mb-16 px-0 lg:px-4">
              <div className="bg-brand-bg/60 p-5 lg:p-8 rounded-xl lg:rounded-2xl border border-slate-800 backdrop-blur-sm shadow-inner">
                 <div className="text-2xl lg:text-4xl font-bold text-white mb-1 tracking-tighter">{score}<span className="text-sm text-indigo-500 ml-1">%</span></div>
                 <div className="text-slate-500 text-[8px] lg:text-[9px] uppercase tracking-widest font-mono font-bold">Accuracy</div>
              </div>
              <div className="bg-brand-bg/60 p-5 lg:p-8 rounded-xl lg:rounded-2xl border border-slate-800 backdrop-blur-sm shadow-inner">
                 <div className="text-2xl lg:text-3xl font-bold text-white mb-1 tracking-tighter">{correctCount} <span className="text-sm lg:text-lg text-slate-600">/</span> {aptitudeQs.length}</div>
                 <div className="text-slate-500 text-[8px] lg:text-[9px] uppercase tracking-widest font-mono font-bold">Aptitude</div>
              </div>
              <div className="bg-brand-bg/60 p-5 lg:p-8 rounded-xl lg:rounded-2xl border border-slate-800 backdrop-blur-sm shadow-inner">
                 <div className="text-2xl lg:text-3xl font-bold text-white mb-1 tracking-tighter">{codingAttemptedCount} <span className="text-sm lg:text-lg text-slate-600">/</span> {codingQs.length}</div>
                 <div className="text-slate-500 text-[8px] lg:text-[9px] uppercase tracking-widest font-mono font-bold">Coding</div>
              </div>
              <div className="bg-brand-bg/60 p-5 lg:p-8 rounded-xl lg:rounded-2xl border border-slate-800 backdrop-blur-sm shadow-inner">
                 <div className="text-2xl lg:text-3xl font-bold text-white mb-1 tracking-tighter font-mono">
                   {formatTime(1800 - session.timeRemaining)}
                 </div>
                 <div className="text-slate-500 text-[8px] lg:text-[9px] uppercase tracking-widest font-mono font-bold">Time</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 max-w-lg mx-auto">
              <button 
                onClick={() => {
                   localStorage.removeItem('tcs_nqt_session');
                   localStorage.removeItem('tcs_nqt_qindex');
                   window.location.reload();
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 lg:py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
              >
                <RotateCcw size={18} />
                New Session
              </button>
              <button 
                onClick={() => setView('HOME')}
                className="flex-1 bg-slate-800/50 hover:bg-slate-800 text-slate-300 py-4 lg:py-5 rounded-2xl font-bold border border-slate-700/50 transition-colors"
              >
                Return to Core
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const GlobalFooter = () => (
    <footer className="w-full py-6 bg-brand-surface border-t border-slate-800 shrink-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center">
        <p className="text-slate-400 text-[10px] md:text-sm font-bold tracking-[0.1em] text-center uppercase">
          © 2026 YASIN | <span className="text-indigo-500">TCS NQT</span> Practice Platform
        </p>
      </div>
    </footer>
  );

  return (
    <div className="h-screen flex flex-col bg-black text-zinc-100 selection:bg-blue-500/30 overflow-hidden">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          {view === 'HOME' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {LandingView()}
            </motion.div>
          )}
          {view === 'EXAM' && (
            <motion.div key="exam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              {ExamView()}
            </motion.div>
          )}
          {view === 'RESULT' && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {ResultView()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Only show global footer on non-exam views or adjust for exam view */}
      {view !== 'EXAM' && <GlobalFooter />}
    </div>
  );
}

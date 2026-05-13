import { useState } from 'react';
import { X, Delete, Eraser } from 'lucide-react';
import { motion } from 'motion/react';

interface CalculatorProps {
  onClose: () => void;
}

export default function Calculator({ onClose }: CalculatorProps) {
  const [display, setDisplay] = useState('0');

  const append = (val: string) => {
    setDisplay((prev) => (prev === '0' ? val : prev + val));
  };

  const calculate = () => {
    try {
      const result = new Function(`return ${display.replace(/×/g, '*').replace(/÷/g, '/')}`)();
      setDisplay(String(Number(result.toFixed(4))));
    } catch {
      setDisplay('Error');
    }
  };

  const clear = () => setDisplay('0');
  const del = () => setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));

  const buttons = [
    '7', '8', '9', '÷',
    '4', '5', '6', '×',
    '1', '2', '3', '-',
    '0', '.', '=', '+',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed bottom-24 right-8 w-64 bg-brand-surface border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden select-none"
    >
      <div className="bg-slate-900/50 p-3 border-b border-slate-800 flex justify-between items-center text-slate-500">
        <span className="text-[10px] font-bold tracking-[0.2em] font-mono uppercase">Calculator 1.0</span>
        <button onClick={onClose} className="hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="p-5 bg-black/40 flex flex-col items-end">
        <div className="text-[10px] font-mono text-slate-600 mb-1">RAD DEG</div>
        <div className="text-2xl font-mono text-indigo-400 tracking-tighter truncate w-full text-right leading-none">
          {display}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 p-2 bg-brand-surface">
        <button onClick={clear} className="h-10 flex items-center justify-center bg-slate-800 rounded text-[10px] text-slate-400 hover:bg-slate-700 cursor-pointer transition-colors">AC</button>
        <button onClick={del} className="h-10 flex items-center justify-center bg-slate-800 rounded text-[10px] text-slate-400 hover:bg-slate-700 cursor-pointer transition-colors">
           <Delete size={14} />
        </button>
        <button className="h-10 flex items-center justify-center bg-slate-800 rounded text-[10px] text-slate-400 hover:bg-slate-700 cursor-pointer transition-colors">%</button>
        <button onClick={() => append('÷')} className="h-10 flex items-center justify-center bg-indigo-600/20 rounded text-[10px] text-indigo-400 hover:bg-indigo-600/30 transition-colors">÷</button>
        
        {buttons.map((btn) => (
          <button
            key={btn}
            onClick={() => {
              if (btn === '=') calculate();
              else if (btn === '×') append('×');
              else if (btn === '÷') append('÷');
              else append(btn);
            }}
            className={`h-10 rounded text-[10px] font-bold transition-all flex items-center justify-center ${
              btn === '=' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700' 
                : isNaN(Number(btn)) && btn !== '.'
                ? 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30'
                : 'bg-slate-800/40 text-slate-300 hover:bg-slate-700 border border-slate-700/20'
            }`}
          >
            {btn}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

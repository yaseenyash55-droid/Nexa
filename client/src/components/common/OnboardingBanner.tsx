import React, { useState, useEffect } from 'react';
import { BookOpen, Sparkles, X, ArrowRight, ShieldCheck, Smartphone, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const OnboardingBanner: React.FC = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const isDismissed = localStorage.getItem('nexa_manual_banner_dismissed') === 'true';
    if (isDismissed) {
      setIsVisible(false);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('nexa_manual_banner_dismissed', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/70 border border-brand-500/30 rounded-2xl p-4 sm:p-5 relative shadow-xl space-y-3 animate-fade-in my-4">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
        title="Dismiss guide banner"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-brand-400" />
        <h2 className="text-sm font-bold text-white tracking-tight">First time here? Check out the Nexa User Manual</h2>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
        Learn how to navigate the feed, send 256-bit AES-GCM end-to-end encrypted direct messages, manage group chats, dispatch broadcasts, and install the Android app.
      </p>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => navigate('/user-manual')}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-glow-brand transition-all flex items-center gap-1.5"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Open Full User Manual</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleDismiss}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

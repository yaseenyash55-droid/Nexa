import React from 'react';
import { Sparkles, MessageSquarePlus, PenTool, CheckCircle2, Languages, HelpCircle, FileText } from 'lucide-react';

interface AiWelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void;
}

export const AiWelcomeScreen: React.FC<AiWelcomeScreenProps> = ({ onSelectPrompt }) => {
  const starterActions = [
    {
      title: 'Write a caption',
      desc: 'Craft engaging captions with trending hashtags for your post or reel',
      prompt: 'Write an engaging and creative caption with relevant hashtags for a photo of a sunny weekend in the city.',
      icon: <PenTool className="w-5 h-5 text-indigo-400" />
    },
    {
      title: 'Improve my writing',
      desc: 'Polish grammar, clarity, and tone for your messages or bio',
      prompt: 'Can you help improve the tone and grammar of this draft to make it more professional yet approachable?\n\nDraft: ',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />
    },
    {
      title: 'Translate text',
      desc: 'Translate text into natural, fluent multilingual phrases',
      prompt: 'Translate the following message into Spanish, French, and Japanese:\n\n"Welcome to our new community on NEXA!"',
      icon: <Languages className="w-5 h-5 text-cyan-400" />
    },
    {
      title: 'Summarize something',
      desc: 'Condense long articles, posts, or notes into key bullet points',
      prompt: 'Please provide a concise 3-bullet summary with main takeaways for the following text:\n\n',
      icon: <FileText className="w-5 h-5 text-amber-400" />
    },
    {
      title: 'Ask a question',
      desc: 'Get helpful answers and explanations on any topic',
      prompt: 'What are some great tips to grow a loyal audience on a social media platform like NEXA?',
      icon: <HelpCircle className="w-5 h-5 text-purple-400" />
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto my-auto animate-fade-in">
      {/* Orb Logo Badge */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-aurora-cyan p-0.5 shadow-glow-brand ring-4 ring-brand-500/20 mb-4 flex items-center justify-center">
        <div className="w-full h-full bg-background-card/90 rounded-2xl flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-aurora-cyan animate-pulse-slow" />
        </div>
      </div>

      <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mb-2">
        How can <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-indigo-300 to-aurora-cyan">NEXA AI</span> help you?
      </h1>
      <p className="text-xs sm:text-sm text-slate-400 mb-8 max-w-md">
        Your intelligent assistant for writing creative captions, translations, summarization, and community insights.
      </p>

      {/* Starter Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
        {starterActions.map((action, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(action.prompt)}
            className="p-3.5 rounded-xl bg-background-card/60 hover:bg-background-card border border-slate-800/80 hover:border-brand-500/40 transition-all duration-200 group flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-1.5 rounded-lg bg-slate-800/80 group-hover:bg-brand-600/20 transition-colors">
                {action.icon}
              </div>
              <h2 className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-aurora-cyan transition-colors">
                {action.title}
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
              {action.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

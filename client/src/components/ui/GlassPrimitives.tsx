import React from 'react';

interface GlassProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const GlassPanel: React.FC<GlassProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 sm:p-5 shadow-aurora-glass ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const GlassCard: React.FC<GlassProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`aurora-glass aurora-glass-hover rounded-2xl p-4 sm:p-5 cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const GlassHeader: React.FC<GlassProps> = ({ children, className = '', ...props }) => {
  return (
    <header
      className={`sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 ${className}`}
      {...props}
    >
      {children}
    </header>
  );
};

export const GlassNavigation: React.FC<GlassProps> = ({ children, className = '', ...props }) => {
  return (
    <nav
      className={`bg-slate-900/70 backdrop-blur-xl border-r border-slate-800/80 p-4 ${className}`}
      {...props}
    >
      {children}
    </nav>
  );
};

export const GlassDialog: React.FC<GlassProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-slate-900/95 backdrop-blur-2xl border border-brand-500/40 rounded-3xl p-6 shadow-2xl max-w-lg w-full ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

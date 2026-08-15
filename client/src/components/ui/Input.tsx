import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightElement, className = '', ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full bg-background-card border ${
              error ? 'border-rose-500/80 focus:ring-rose-500' : 'border-slate-800 focus:border-brand-500 focus:ring-brand-500'
            } ${leftIcon ? 'pl-10' : 'px-4'} ${rightElement ? 'pr-10' : 'pr-4'} py-2.5 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 transition-all ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3.5 flex items-center text-slate-400">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-400 font-medium mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

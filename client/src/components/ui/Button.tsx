import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-xl active:scale-[0.98] min-h-[44px]';

    const variants = {
      primary: 'bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-600/25 border border-brand-500/30',
      secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/80',
      outline: 'bg-transparent hover:bg-slate-800/80 text-slate-300 border border-slate-700',
      danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20',
      ghost: 'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white border border-transparent'
    };

    const sizes = {
      sm: 'text-xs px-3 py-2 min-w-[44px]',
      md: 'text-sm px-4 py-2.5 min-w-[44px]',
      lg: 'text-base px-6 py-3.5 min-w-[44px]'
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : leftIcon ? (
          <span className="mr-2 inline-flex items-center">{leftIcon}</span>
        ) : null}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="ml-2 inline-flex items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

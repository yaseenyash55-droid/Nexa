import React from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '' }) => {
  const getInitials = (n: string) => {
    if (!n) return 'U';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-24 h-24 text-2xl font-bold'
  }[size];

  const LIVE_BACKEND_URL = 'https://pick-sims-regions-plaza.trycloudflare.com';
  const resolvedSrc = src && src.startsWith('/uploads') && window.location.origin.includes('surge.sh')
    ? `${LIVE_BACKEND_URL}${src}`
    : src;

  if (resolvedSrc) {
    return (
      <img
        src={resolvedSrc}
        alt={name}
        className={`${sizeClasses} rounded-full object-cover ring-2 ring-brand-500/20 ${className}`}
        onError={(e) => {
          // Fallback if image fails to load
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className={`${sizeClasses} rounded-full bg-brand-600/30 text-brand-100 ring-2 ring-brand-500/30 flex items-center justify-center font-medium ${className}`}>
      {getInitials(name)}
    </div>
  );
};

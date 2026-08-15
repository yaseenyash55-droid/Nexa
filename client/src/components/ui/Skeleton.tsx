import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-slate-800/60 animate-pulse rounded-xl ${className}`} />
);

export const PostSkeleton: React.FC = () => (
  <div className="p-4 border border-slate-800/80 rounded-2xl bg-background-card space-y-4 mb-4">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="w-32 h-4" />
        <Skeleton className="w-20 h-3" />
      </div>
    </div>
    <Skeleton className="w-full h-16" />
    <div className="flex justify-between pt-2">
      <Skeleton className="w-16 h-4" />
      <Skeleton className="w-16 h-4" />
      <Skeleton className="w-16 h-4" />
    </div>
  </div>
);

import React from 'react';
import { MessageSquareOff } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No items found',
  description = 'There is nothing to display here yet.',
  icon = <MessageSquareOff className="w-10 h-10 text-slate-500" />,
  action
}) => (
  <div className="flex flex-col items-center justify-center p-8 text-center bg-background-card/50 border border-slate-800/80 rounded-2xl my-4 space-y-3">
    <div className="p-3 bg-slate-800/40 rounded-full">{icon}</div>
    <h4 className="text-base font-semibold text-slate-200">{title}</h4>
    <p className="text-sm text-slate-400 max-w-sm">{description}</p>
    {action && <div className="pt-2">{action}</div>}
  </div>
);

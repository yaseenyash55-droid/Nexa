import React from 'react';
import { MessageSquare, Plus, Trash2, Clock, Sparkles } from 'lucide-react';
import { AiConversation } from '../../api/ai.api.js';
import { formatDistanceToNow } from 'date-fns';

interface AiSidebarProps {
  conversations: AiConversation[];
  activeConversationId?: number | null;
  onSelectConversation: (id: number) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: number) => void;
  isLoading?: boolean;
}

export const AiSidebar: React.FC<AiSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isLoading = false
}) => {
  return (
    <aside aria-label="AI Conversations" className="w-full md:w-72 flex-shrink-0 border-r border-slate-800/80 bg-background-card/40 flex flex-col h-full overflow-hidden">
      {/* Header & New Chat Button */}
      <div className="p-3 border-b border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-aurora-cyan" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Conversations
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onNewConversation}
          className="w-full py-2 px-3 bg-gradient-to-r from-brand-600/30 to-aurora-cyan/30 hover:from-brand-600/40 hover:to-aurora-cyan/40 border border-brand-500/30 text-slate-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"
        >
          <Plus className="w-4 h-4 text-aurora-cyan" />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-slate-500">
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40 text-slate-400" />
            No previous conversations yet. Start a new one!
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = activeConversationId === conv.conversationId;
            const timeAgo = conv.updatedAt
              ? formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })
              : '';

            return (
              <div
                key={conv.conversationId}
                className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-brand-600/20 text-slate-100 border-brand-500/40 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-transparent'
                }`}
                onClick={() => onSelectConversation(conv.conversationId)}
              >
                <div className="flex items-center gap-2.5 overflow-hidden min-w-0 pr-2">
                  <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-aurora-cyan' : 'text-slate-500'}`} />
                  <div className="truncate">
                    <p className="truncate text-xs">{conv.title || 'Conversation'}</p>
                    {timeAgo && (
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {timeAgo}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Delete this conversation?')) {
                      onDeleteConversation(conv.conversationId);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-all flex-shrink-0"
                  title="Delete conversation"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

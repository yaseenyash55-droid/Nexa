import React, { useState, useEffect, useRef } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, AiConversation, AiMessage } from '../api/ai.api.js';
import { AiMessageBubble } from '../components/chat/AiMessageBubble.js';
import { AiComposer } from '../components/chat/AiComposer.js';
import { AiWelcomeScreen } from '../components/chat/AiWelcomeScreen.js';
import { AiSidebar } from '../components/chat/AiSidebar.js';
import { AiSettingsModal } from '../components/chat/AiSettingsModal.js';
import { Bot, Sparkles, AlertCircle, Menu, X, Plus, Sliders, Brain } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const NexaAiPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeParamId = searchParams.get('c') ? Number(searchParams.get('c')) : null;

  const [activeConversationId, setActiveConversationId] = useState<number | null>(activeParamId);
  const [localMessages, setLocalMessages] = useState<Array<{
    messageId?: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt?: string;
    isStreaming?: boolean;
  }>>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, isStreaming]);

  // Fetch list of conversations
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery({
    queryKey: ['aiConversations'],
    queryFn: () => aiApi.getConversations()
  });

  // Fetch active conversation messages
  const { data: conversationData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['aiConversation', activeConversationId],
    queryFn: () => (activeConversationId ? aiApi.getConversation(activeConversationId) : null),
    enabled: !!activeConversationId
  });

  // Sync loaded messages into local state
  useEffect(() => {
    if (conversationData?.messages) {
      setLocalMessages(conversationData.messages);
    } else if (!activeConversationId) {
      setLocalMessages([]);
    }
  }, [conversationData, activeConversationId]);

  // Handle deleting conversation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => aiApi.deleteConversation(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
      if (activeConversationId === deletedId) {
        handleNewConversation();
      }
    }
  });

  const handleSelectConversation = (id: number) => {
    if (isStreaming) {
      handleStopGeneration();
    }
    setActiveConversationId(id);
    setSearchParams({ c: String(id) });
    setIsSidebarOpenMobile(false);
  };

  const handleNewConversation = () => {
    if (isStreaming) {
      handleStopGeneration();
    }
    setActiveConversationId(null);
    setSearchParams({});
    setLocalMessages([]);
    setErrorBanner(null);
    setIsSidebarOpenMobile(false);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setLocalMessages((prev) => {
      const updated = [...prev];
      if (updated.length > 0 && updated[updated.length - 1].isStreaming) {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          isStreaming: false
        };
      }
      return updated;
    });
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || isStreaming) return;

    setErrorBanner(null);
    if (!customPrompt) setInput('');

    // Append optimistic user message
    const userMsg = {
      role: 'user' as const,
      content: textToSend,
      createdAt: new Date().toISOString()
    };

    // Prepare placeholder streaming assistant message
    const assistantMsg = {
      role: 'assistant' as const,
      content: '',
      createdAt: new Date().toISOString(),
      isStreaming: true
    };

    setLocalMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    try {
      await aiApi.streamChat(
        textToSend,
        {
          onChunk: (chunk: string) => {
            setLocalMessages((prev) => {
              const next = [...prev];
              const lastIdx = next.length - 1;
              if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
                next[lastIdx] = {
                  ...next[lastIdx],
                  content: next[lastIdx].content + chunk,
                  isStreaming: true
                };
              }
              return next;
            });
          },
          onComplete: (fullText: string, convId: number) => {
            setIsStreaming(false);
            setLocalMessages((prev) => {
              const next = [...prev];
              const lastIdx = next.length - 1;
              if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
                next[lastIdx] = {
                  ...next[lastIdx],
                  content: fullText || next[lastIdx].content,
                  isStreaming: false
                };
              }
              return next;
            });

            if (convId && convId !== activeConversationId) {
              setActiveConversationId(convId);
              setSearchParams({ c: String(convId) });
              queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
            }
          },
          onError: (err: Error) => {
            setIsStreaming(false);
            setErrorBanner(err.message || 'Failed to generate response. Please try again.');
            setLocalMessages((prev) => {
              const next = [...prev];
              const lastIdx = next.length - 1;
              if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
                if (!next[lastIdx].content) {
                  // remove empty assistant placeholder if no chunk arrived
                  return next.slice(0, -1);
                } else {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    isStreaming: false
                  };
                }
              }
              return next;
            });
          }
        },
        activeConversationId || undefined,
        abortCtrl.signal
      );
    } catch (err: any) {
      setIsStreaming(false);
      setErrorBanner(err.message || 'An unexpected error occurred.');
    }
  };

  return (
    <AppShell showRightPanel={false}>
      <div className="flex h-[calc(100vh-4rem)] md:h-screen w-full overflow-hidden bg-background">
        {/* Desktop / Collapsible Mobile Sidebar */}
        <div className={`fixed inset-0 z-50 md:relative md:z-auto md:flex ${isSidebarOpenMobile ? 'block' : 'hidden md:flex'}`}>
          {/* Mobile Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsSidebarOpenMobile(false)}
          />
          <div className="relative z-10 w-4/5 max-w-xs md:w-72 h-full bg-background-card">
            <AiSidebar
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
              onDeleteConversation={(id) => deleteMutation.mutate(id)}
              isLoading={isLoadingConversations}
            />
          </div>
        </div>

        {/* Main AI Chat Area */}
        <section aria-label="NEXA AI Chat" className="flex-1 flex flex-col h-full min-w-0 bg-background/50">
          {/* Header */}
          <header className="px-4 py-3 border-b border-slate-800/80 bg-background/80 backdrop-blur-md flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpenMobile(true)}
                className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                title="Open conversations"
                aria-label="Open conversation drawer"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-aurora-cyan p-0.5 shadow-glow-brand flex items-center justify-center">
                <div className="w-full h-full bg-background-card/90 rounded-xl flex items-center justify-center">
                  <Bot className="w-4 h-4 text-aurora-cyan" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-bold text-slate-100">NEXA AI</h1>
                  <span className="px-1.5 py-0.2 bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[10px] font-semibold rounded-full">
                    Beta
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {isStreaming ? 'Streaming response...' : 'Always active & ready to assist'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                title="AI Personalization & Memory Settings"
                aria-label="AI Settings and Personalization"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-850 text-aurora-cyan text-xs font-medium border border-slate-700/50 hover:border-aurora-cyan/40 transition-all active:scale-95 shadow-sm"
              >
                <Brain className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Memory & Preferences</span>
              </button>

              <button
                type="button"
                onClick={handleNewConversation}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/50 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            </div>
          </header>

          {/* Error Banner */}
          {errorBanner && (
            <div className="bg-rose-950/40 border-b border-rose-500/40 px-4 py-2 flex items-center justify-between text-xs text-rose-300 animate-slide-down">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{errorBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="p-1 hover:bg-rose-900/40 rounded text-rose-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Conversation Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                Loading conversation messages...
              </div>
            ) : localMessages.length === 0 ? (
              <AiWelcomeScreen onSelectPrompt={(p) => handleSendMessage(p)} />
            ) : (
              localMessages.map((msg, idx) => (
                <AiMessageBubble key={msg.messageId || idx} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer Footer */}
          <footer className="flex-shrink-0">
            <AiComposer
              input={input}
              setInput={setInput}
              onSend={() => handleSendMessage()}
              onStop={handleStopGeneration}
              isLoading={isStreaming}
            />
          </footer>
        </section>
      </div>

      {/* AI Personalization & Memory Modal */}
      <AiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </AppShell>
  );
};
export default NexaAiPage;

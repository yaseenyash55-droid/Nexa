import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, AiPreference, AiMemory } from '../../api/ai.api.js';
import {
  Brain,
  Sliders,
  Trash2,
  Plus,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  AlertTriangle,
  X,
  Check,
  Globe,
  MessageSquare,
  Flame
} from 'lucide-react';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('interests');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Fetch Preferences
  const { data: preferences, isLoading: isLoadingPrefs } = useQuery({
    queryKey: ['aiPreferences'],
    queryFn: () => aiApi.getPreferences(),
    enabled: isOpen
  });

  // Fetch Memories
  const { data: memories = [], isLoading: isLoadingMemories } = useQuery({
    queryKey: ['aiMemories'],
    queryFn: () => aiApi.getMemories(),
    enabled: isOpen
  });

  // Update Preferences Mutation
  const updatePrefsMutation = useMutation({
    mutationFn: (updates: Partial<AiPreference>) => aiApi.updatePreferences(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiPreferences'] });
    }
  });

  // Add Memory Mutation
  const addMemoryMutation = useMutation({
    mutationFn: (data: { keyName: string; content: string; category?: string }) =>
      aiApi.createMemory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiMemories'] });
      setNewKeyName('');
      setNewContent('');
      setIsAddingMemory(false);
    }
  });

  // Delete Individual Memory Mutation
  const deleteMemoryMutation = useMutation({
    mutationFn: (id: number) => aiApi.deleteMemory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiMemories'] });
    }
  });

  // Clear All Memories Mutation
  const clearAllMutation = useMutation({
    mutationFn: () => aiApi.clearAllMemories(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiMemories'] });
      setConfirmClearAll(false);
    }
  });

  if (!isOpen) return null;

  const handleTogglePersonalization = () => {
    if (!preferences) return;
    updatePrefsMutation.mutate({
      personalizationEnabled: !preferences.personalizationEnabled
    });
  };

  const handleAddMemorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !newContent.trim()) return;
    addMemoryMutation.mutate({
      keyName: newKeyName.trim(),
      content: newContent.trim(),
      category: newCategory
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-xl bg-background-card border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600/30 to-aurora-cyan/20 border border-brand-500/30 text-aurora-cyan">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 id="ai-settings-modal-title" className="text-base font-bold text-slate-100 flex items-center gap-2">
                NEXA AI Personalization & Memory
              </h2>
              <p className="text-xs text-slate-400">
                Control what NEXA AI remembers and how it customizes responses for you.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 1. Master Personalization Toggle */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-aurora-cyan" />
                <span>Personalization</span>
              </div>
              <p className="text-xs text-slate-400">
                Allow NEXA AI to tailor responses based on your saved memory and preferences.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTogglePersonalization}
              disabled={isLoadingPrefs || updatePrefsMutation.isPending}
              aria-label="Toggle Personalization"
              className="p-1 text-aurora-cyan hover:opacity-80 transition-opacity"
            >
              {preferences?.personalizationEnabled ? (
                <ToggleRight className="w-8 h-8 text-brand-400" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-600" />
              )}
            </button>
          </div>

          {/* 2. Response Preferences */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              Response Preferences
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Preferred Language */}
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-1">
                <label className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Preferred Language
                </label>
                <select
                  value={preferences?.preferredLanguage || 'English'}
                  onChange={(e) => updatePrefsMutation.mutate({ preferredLanguage: e.target.value })}
                  disabled={!preferences?.personalizationEnabled}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Arabic">Arabic</option>
                  <option value="Japanese">Japanese</option>
                </select>
              </div>

              {/* Response Length */}
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-1">
                <label className="text-xs text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  Response Length
                </label>
                <select
                  value={preferences?.responseLength || 'balanced'}
                  onChange={(e) => updatePrefsMutation.mutate({ responseLength: e.target.value as any })}
                  disabled={!preferences?.personalizationEnabled}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                >
                  <option value="concise">Concise (Short & direct)</option>
                  <option value="balanced">Balanced (Standard)</option>
                  <option value="detailed">Detailed (In-depth)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Stored Memories */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-slate-400" />
                Saved Memories ({memories.length})
              </h3>
              <div className="flex items-center gap-2">
                {memories.length > 0 && !confirmClearAll && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="text-[11px] text-red-400/80 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                )}
                {confirmClearAll && (
                  <div className="flex items-center gap-1.5 bg-red-950/50 border border-red-800/60 px-2 py-0.5 rounded-lg">
                    <span className="text-[10px] text-red-300">Confirm clear?</span>
                    <button
                      type="button"
                      onClick={() => clearAllMutation.mutate()}
                      className="text-[10px] text-red-200 font-bold hover:underline"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-200 ml-1"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsAddingMemory(!isAddingMemory)}
                  className="text-xs bg-brand-600/30 hover:bg-brand-600/40 text-brand-300 border border-brand-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Memory</span>
                </button>
              </div>
            </div>

            {/* Add Memory Form */}
            {isAddingMemory && (
              <form onSubmit={handleAddMemorySubmit} className="p-3 bg-slate-900/60 border border-brand-500/30 rounded-xl space-y-2.5 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Preference name (e.g., Code Style, Pet)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    maxLength={80}
                    required
                    className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="interests">Interests & Hobbies</option>
                    <option value="writing_style">Writing & Tone</option>
                    <option value="technical">Technical / Coding</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <textarea
                  placeholder="Details (e.g., I prefer TypeScript and functional programming with strict typing)"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingMemory(false)}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addMemoryMutation.isPending || !newKeyName.trim() || !newContent.trim()}
                    className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </form>
            )}

            {/* Memory List */}
            {isLoadingMemories ? (
              <div className="p-4 text-center text-xs text-slate-500">Loading memories...</div>
            ) : memories.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/20 border border-slate-800/40 rounded-xl">
                No memories saved yet. Add a preference above or let NEXA AI learn your style.
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map((mem) => (
                  <div
                    key={mem.memoryId}
                    className="p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 rounded-xl flex items-start justify-between gap-3 group transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{mem.keyName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                          {mem.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{mem.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteMemoryMutation.mutate(mem.memoryId)}
                      disabled={deleteMemoryMutation.isPending}
                      aria-label={`Delete memory ${mem.keyName}`}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

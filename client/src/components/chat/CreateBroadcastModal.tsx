import React, { useState } from 'react';
import { User } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { X, Radio, Search, Check, Send } from 'lucide-react';
import { broadcastsApi, Broadcast } from '../../api/broadcasts.api.js';

interface CreateBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: User[];
  onBroadcastSent: (result: { broadcast: Broadcast; messagesCount: number }) => void;
}

export const CreateBroadcastModal: React.FC<CreateBroadcastModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onBroadcastSent
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === contacts.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(contacts.map((c) => c.userId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      setError('Please select at least one recipient');
      return;
    }
    if (!message.trim()) {
      setError('Broadcast message cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const result = await broadcastsApi.createBroadcast({
        title: title.trim() || undefined,
        recipientIds: selectedUserIds,
        message: message.trim()
      });

      onBroadcastSent(result);
      onClose();
      setTitle('');
      setMessage('');
      setSelectedUserIds([]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to dispatch broadcast');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredContacts = contacts.filter((c) =>
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">New Broadcast List</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Broadcast Title (Optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Project Update / Event Invitation"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Select Recipients ({selectedUserIds.length} selected)
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-cyan-400 font-bold hover:underline"
              >
                {selectedUserIds.length === contacts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800 rounded-xl bg-slate-950">
              {filteredContacts.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">No contacts found</div>
              ) : (
                filteredContacts.map((contact) => {
                  const isSelected = selectedUserIds.includes(contact.userId);
                  return (
                    <div
                      key={contact.userId}
                      onClick={() => toggleUser(contact.userId)}
                      className={`p-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-cyan-500/15' : 'hover:bg-slate-900'
                      }`}
                    >
                      <Avatar src={contact.profileImageUrl} name={contact.displayName} size="sm" />
                      <div className="flex-1 truncate">
                        <p className="text-xs font-bold text-white truncate">{contact.displayName}</p>
                        <p className="text-[10px] text-slate-400 truncate">@{contact.username}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-cyan-600 border-cyan-500 text-white'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Message Content *</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message... (Recipients will receive this as an individual 1-on-1 direct message)"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedUserIds.length === 0 || !message.trim()}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-glow-cyan transition-colors flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Dispatching...' : `Send to ${selectedUserIds.length} users`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Loader2 } from 'lucide-react';
import { mediaApi } from '../../api/media.api.js';
import { MusicPickerModal } from './MusicPickerModal.js';
import { NexaMusicTrack } from '../../types/music.types.js';
import { AttachmentMenu, AttachmentType } from './AttachmentMenu.js';
import { AttachmentPreview } from './AttachmentPreview.js';

export type ChatTarget =
  | { type: 'direct'; userId: number }
  | { type: 'group'; groupId: number }
  | { type: 'broadcast'; broadcastId: number };

export type ComposerAttachment =
  | { type: 'music'; track: NexaMusicTrack }
  | { type: 'image' | 'video' | 'file'; file?: File; mediaId?: number; url?: string; progress?: number; error?: string };

export interface ChatComposerProps {
  target: ChatTarget;
  initialText?: string;
  disabled?: boolean;
  onSend: (payload: { text?: string; attachments?: ComposerAttachment[] }) => Promise<void>;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  target,
  initialText = '',
  disabled = false,
  onSend
}) => {
  const [text, setText] = useState(initialText);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [uploadType, setUploadType] = useState<AttachmentType>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSend = async () => {
    if ((!text.trim() && attachments.length === 0) || isSending || disabled) {
      return;
    }

    setIsSending(true);
    try {
      await onSend({
        text: text.trim() ? text.trim() : undefined,
        attachments: attachments.length > 0 ? attachments : undefined
      });
      setText('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Let parent handle toast/error
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMusicSelect = (track: NexaMusicTrack) => {
    // Replace any existing music attachment, or append if we support multiple
    // For now, let's just append
    setAttachments((prev) => [...prev, { type: 'music', track }]);
    setShowMusicPicker(false);
  };

  const handleAttachmentSelect = (type: AttachmentType) => {
    if (type === 'music') {
      setShowMusicPicker(true);
    } else {
      setUploadType(type);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Add to attachments with progress 0
    const newAtt = { type: uploadType as 'image' | 'video' | 'file', file, progress: 0 };
    setAttachments(prev => [...prev, newAtt]);
    const index = attachments.length;

    try {
      const url = await mediaApi.uploadFile(file, 'chat', (percent) => {
        setAttachments(prev => prev.map((a, i) => i === prev.length - 1 ? { ...a, progress: percent } : a));
      });
      setAttachments(prev => prev.map((a, i) => i === prev.length - 1 ? { ...a, url, progress: 100, mediaId: undefined /* TODO if returned */ } : a));
    } catch (error: any) {
      setAttachments(prev => prev.map((a, i) => i === prev.length - 1 ? { ...a, error: error.message || 'Upload failed' } : a));
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-slate-900 border-t border-slate-800 p-3 sm:p-4 w-full">
      
      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((att, i) => (
            <AttachmentPreview key={i} attachment={att} onRemove={() => removeAttachment(i)} />
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 max-w-5xl mx-auto relative">
        {/* Attachment Menu Button */}
        <button
          type="button"
          onClick={() => setShowAttachmentMenu(true)}
          disabled={disabled || isSending}
          className="p-2.5 sm:p-3 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 rounded-2xl transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          title="Attach"
        >
          <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <AttachmentMenu 
          isOpen={showAttachmentMenu} 
          onClose={() => setShowAttachmentMenu(false)} 
          onSelect={handleAttachmentSelect} 
        />

        {/* Input Area */}
        <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-3xl flex items-end min-h-[44px] sm:min-h-[48px] relative transition-all focus-within:border-brand-500/50 focus-within:bg-slate-800">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            disabled={disabled || isSending}
            className="w-full max-h-[120px] bg-transparent text-white text-sm sm:text-base px-4 py-3 sm:py-3.5 resize-none outline-none scrollbar-thin placeholder-slate-500"
            rows={1}
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || isSending || (!text.trim() && attachments.length === 0)}
          className={`p-2.5 sm:p-3 rounded-2xl transition-all shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${
            text.trim() || attachments.length > 0
              ? 'bg-brand-600 text-white shadow-glow-brand hover:bg-brand-500'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
          ) : (
            <Send className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept={
          uploadType === 'image'
            ? 'image/jpeg,image/png,image/gif,image/webp'
            : uploadType === 'video'
            ? 'video/mp4,video/webm'
            : '.pdf,.doc,.docx,.txt'
        }
      />
      <MusicPickerModal
        isOpen={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        onSelect={handleMusicSelect}
      />
    </div>
  );
};

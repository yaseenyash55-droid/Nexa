import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Smileys & Emotion',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
      '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
      '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦',
      '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
      '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀',
      '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'
    ]
  },
  {
    name: 'Gestures & Body',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
      '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂',
      '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅'
    ]
  },
  {
    name: 'Hearts & Love',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌',
      '💋', '💍', '💐', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '✨'
    ]
  },
  {
    name: 'Animals & Nature',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆',
      '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋',
      '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎',
      '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟',
      '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧'
    ]
  },
  {
    name: 'Food & Drink',
    icon: '🍔',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
      '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🥦',
      '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆',
      '🍜', '🍝', '🍣', '🍱', '🍛', '🍙', '🍚', '🥟', '🍤', '🎂',
      '🍰', '🧁', '🍦', '🍨', '🍩', '🍪', '🍫', '🍬', '🍭', '☕',
      '🍵', '🧃', '🥤', '🧋', '🍺', '🍻', '🥂', '🍷', '🍸', '🍹'
    ]
  },
  {
    name: 'Activities & Sports',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺'
    ]
  },
  {
    name: 'Objects & Tech',
    icon: '💡',
    emojis: [
      '💡', '🔦', '🕯️', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️',
      '🕹️', '💽', '💾', '💿', '📀', '📷', '📸', '📹', '🎥', '📽️',
      '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏱️',
      '⏰', '⏳', '📡', '🔋', '🔌', '💎', '🔑', '🗝️', '🔒', '🔓',
      '📦', '🏷️', '🔖', '✉️', '📩', '📨', '📤', '📥', '📫', '📪'
    ]
  },
  {
    name: 'Symbols & Hype',
    icon: '🔥',
    emojis: [
      '🔥', '💥', '⚡', '🌟', '⭐', '🌈', '☀️', '🌙', '🪐', '🌌',
      '🚀', '🛸', '🛰️', '🌠', '💯', '✅', '✔️', '❌', '⭕', '🛑',
      '⛔', '⚠️', '🚨', '🚩', '🏁', '🎉', '🎊', '🎈', '🏆', '👑'
    ]
  }
];

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  position?: 'top' | 'bottom';
}

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  position = 'top'
}) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const allEmojis = EMOJI_CATEGORIES.flatMap((cat) => cat.emojis);
  const filteredEmojis = searchQuery.trim()
    ? allEmojis
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <div
      ref={popoverRef}
      className={`absolute ${
        position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
      } left-0 z-50 w-72 sm:w-80 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-fade-in flex flex-col`}
      style={{ maxHeight: '340px' }}
    >
      {/* Header & Search */}
      <div className="p-2.5 border-b border-slate-800 bg-slate-950/60 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emoji..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Icons Nav */}
      {!searchQuery && (
        <div className="flex items-center justify-between px-2 py-1.5 bg-slate-950/40 border-b border-slate-800/80 text-sm">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(idx)}
              title={cat.name}
              className={`p-1.5 rounded-lg transition ${
                activeCategory === idx
                  ? 'bg-brand-500/20 text-brand-300 scale-110'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="p-2 overflow-y-auto max-h-52 grid grid-cols-8 gap-1 scrollbar-thin scrollbar-thumb-slate-700">
        {filteredEmojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            onClick={() => {
              onSelectEmoji(emoji);
            }}
            className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-slate-800/80 active:scale-90 transition transform"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Footer Category Name */}
      {!searchQuery && (
        <div className="px-3 py-1 bg-slate-950/80 border-t border-slate-800 text-[10px] font-medium text-slate-400">
          {EMOJI_CATEGORIES[activeCategory].name}
        </div>
      )}
    </div>
  );
};

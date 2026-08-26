import React, { useState, useEffect } from 'react';
import { Search, Sparkles, X, Loader2 } from 'lucide-react';
import { Modal } from './Modal.js';

interface GifItem {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  category: string;
}

const CURATED_GIFS: GifItem[] = [
  // Reactions & Laugh
  {
    id: 'laugh-1',
    title: 'Laughing Out Loud',
    url: 'https://media.giphy.com/media/26n6Gx9moCgs1qxxt/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/26n6Gx9moCgs1qxxt/200w.gif',
    category: 'Reactions'
  },
  {
    id: 'mind-blown-1',
    title: 'Mind Blown',
    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif',
    category: 'Reactions'
  },
  {
    id: 'applause-1',
    title: 'Standing Ovation Applause',
    url: 'https://media.giphy.com/media/13GKP7xGjce5oI/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/13GKP7xGjce5oI/200w.gif',
    category: 'Reactions'
  },
  {
    id: 'shrug-1',
    title: 'Shrug Confused',
    url: 'https://media.giphy.com/media/JRhS6WoswN8Fa/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/JRhS6WoswN8Fa/200w.gif',
    category: 'Reactions'
  },
  // Celebration & Hype
  {
    id: 'party-1',
    title: 'Party Time Confetti',
    url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/200w.gif',
    category: 'Celebration'
  },
  {
    id: 'dance-1',
    title: 'Celebration Dance',
    url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/blSTtZehjAZ8I/200w.gif',
    category: 'Celebration'
  },
  {
    id: 'rocket-1',
    title: 'Rocket To The Moon',
    url: 'https://media.giphy.com/media/mi6subQjyIS52/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/mi6subQjyIS52/200w.gif',
    category: 'Hype'
  },
  {
    id: 'fire-1',
    title: 'Fire Flame Hype',
    url: 'https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/nrXif9YExO9EI/200w.gif',
    category: 'Hype'
  },
  // Love & Friendly
  {
    id: 'love-1',
    title: 'Heart Floating Love',
    url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/200w.gif',
    category: 'Love'
  },
  {
    id: 'hug-1',
    title: 'Warm Hug',
    url: 'https://media.giphy.com/media/3bqtLDeiDtwhq/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3bqtLDeiDtwhq/200w.gif',
    category: 'Love'
  },
  // Memes & Gaming
  {
    id: 'deal-with-it-1',
    title: 'Deal With It Glasses',
    url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/200w.gif',
    category: 'Memes'
  },
  {
    id: 'popcorn-1',
    title: 'Eating Popcorn Watching Drama',
    url: 'https://media.giphy.com/media/t3dLl0TGHCxTG/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/t3dLl0TGHCxTG/200w.gif',
    category: 'Memes'
  },
  {
    id: 'gaming-win-1',
    title: 'Victory Royale Gaming',
    url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/200w.gif',
    category: 'Gaming'
  },
  {
    id: 'cat-vibing-1',
    title: 'Cat Vibing to Beat',
    url: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/200w.gif',
    category: 'Memes'
  }
];

const CATEGORIES = ['All', 'Trending', 'Reactions', 'Celebration', 'Hype', 'Love', 'Memes', 'Gaming'];
const DEFAULT_GIPHY_API_KEY = 'ydmYhvBQuhhugZWiAJhxItuZZ4PxbvA3';

interface GifPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string, title: string) => void;
}

export const GifPickerModal: React.FC<GifPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectGif
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [gifs, setGifs] = useState<GifItem[]>(CURATED_GIFS);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function fetchGifs() {
      setIsLoading(true);
      try {
        const giphyApiKey = (import.meta as any).env?.VITE_GIPHY_API_KEY || DEFAULT_GIPHY_API_KEY;

        if (giphyApiKey) {
          const isSearching = searchQuery.trim().length > 0;
          const queryTerm = isSearching
            ? searchQuery.trim()
            : selectedCategory !== 'All' && selectedCategory !== 'Trending'
            ? selectedCategory
            : '';

          const endpoint = queryTerm
            ? `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(queryTerm)}&limit=25&rating=g`
            : `https://api.giphy.com/v1/gifs/trending?api_key=${giphyApiKey}&limit=25&rating=g`;

          const res = await fetch(endpoint);
          if (res.ok) {
            const data = await res.json();
            if (!isCancelled && data.data && data.data.length > 0) {
              const parsedGifs: GifItem[] = data.data.map((item: any) => ({
                id: item.id,
                title: item.title || 'GIPHY Animation',
                url: item.images?.original?.url || item.images?.downsized?.url || item.images?.fixed_width?.url,
                previewUrl: item.images?.fixed_width?.url || item.images?.fixed_height?.url || item.images?.original?.url,
                category: isSearching ? 'Search' : selectedCategory
              }));
              setGifs(parsedGifs);
              setIsLoading(false);
              return;
            }
          }
        }

        // Curated filter fallback
        let results = CURATED_GIFS;
        if (selectedCategory !== 'All' && selectedCategory !== 'Trending') {
          results = results.filter((g) => g.category === selectedCategory);
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          results = results.filter(
            (g) =>
              g.title.toLowerCase().includes(q) ||
              g.category.toLowerCase().includes(q)
          );
        }
        if (!isCancelled) {
          setGifs(results);
        }
      } catch (_e) {
        if (!isCancelled) {
          setGifs(CURATED_GIFS);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    const timer = setTimeout(fetchGifs, searchQuery ? 300 : 0);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedCategory]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search & Send GIFs 🎬">
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all GIFs (e.g. happy, mind blown, dance)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 shadow-inner"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded-full font-medium transition whitespace-nowrap ${
                selectedCategory === cat && !searchQuery
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-glow-brand font-semibold'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* GIFs Grid */}
        <div className="min-h-[260px] max-h-[360px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
              <span className="text-xs">Searching animated GIFs...</span>
            </div>
          ) : gifs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center p-4">
              <Sparkles className="w-8 h-8 text-slate-500" />
              <p className="text-sm font-semibold text-slate-300">No GIFs Found</p>
              <p className="text-xs text-slate-500 max-w-xs">
                Try searching for popular reactions like &quot;hype&quot;, &quot;clap&quot;, or &quot;party&quot;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {gifs.map((gif) => (
                <div
                  key={gif.id}
                  onClick={() => {
                    onSelectGif(gif.url, gif.title);
                    onClose();
                  }}
                  className="group relative aspect-video bg-slate-950 rounded-xl overflow-hidden cursor-pointer border border-slate-800/80 hover:border-brand-500 hover:scale-[1.03] transition-all duration-200 shadow-md"
                >
                  <img
                    src={gif.previewUrl || gif.url}
                    alt={gif.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <span className="text-[11px] font-bold text-white truncate shadow-sm">
                      {gif.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/80 pt-2.5 px-1">
          <span>Powered by Nexa GIF Engine</span>
          <span>Click any GIF to insert</span>
        </div>
      </div>
    </Modal>
  );
};

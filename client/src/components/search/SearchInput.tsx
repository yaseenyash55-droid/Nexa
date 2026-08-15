import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SearchInput: React.FC<{ initialQuery?: string }> = ({ initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative">
      <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
      <input
        type="text"
        placeholder="Search users or handle..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 bg-background-card border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
      />
    </form>
  );
};

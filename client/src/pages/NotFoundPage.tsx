import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import { Compass } from 'lucide-react';

export const NotFoundPage: React.FC = () => (
  <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
    <div className="p-4 bg-slate-800/40 rounded-full text-brand-400">
      <Compass className="w-12 h-12" />
    </div>
    <h1 className="text-4xl font-extrabold text-white">404</h1>
    <h2 className="text-xl font-semibold text-slate-200">Page Not Found</h2>
    <p className="text-sm text-slate-400 max-w-sm">
      The page or post you are looking for doesn't exist or has been moved.
    </p>
    <Link to="/">
      <Button variant="primary">Return Home</Button>
    </Link>
  </main>
);

import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="w-full bg-amber-950/90 border-b border-amber-500/40 text-amber-200 px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 backdrop-blur-md sticky top-0 z-50"
    >
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>You are currently offline. Actions will synchronize upon reconnection.</span>
    </div>
  );
};

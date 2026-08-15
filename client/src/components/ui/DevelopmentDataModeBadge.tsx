import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';

export const DevelopmentDataModeBadge: React.FC = () => {
  const [dataMode, setDataMode] = useState<string>('oracle');

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await api.get('/health');
        if (res.data?.data?.mode) {
          setDataMode(res.data.data.mode);
        }
      } catch {
        // ignore
      }
    }
    fetchHealth();
  }, []);

  return (
    <div className="fixed bottom-3 left-3 z-50 flex items-center gap-2 px-3 py-1 bg-slate-900/90 border border-slate-700/80 rounded-full text-xs font-medium text-slate-300 shadow-xl backdrop-blur-md">
      <span className={`w-2 h-2 rounded-full ${dataMode === 'oracle' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <span>DATA_SOURCE: <strong className="uppercase text-white">{dataMode}</strong></span>
    </div>
  );
};

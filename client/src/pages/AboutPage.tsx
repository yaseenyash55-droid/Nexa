import React from 'react';
import { AppShell } from '../components/layout/AppShell.js';

export const AboutPage: React.FC = () => {
  return (
    <AppShell>
      <main className="p-6 md:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="space-y-3 pb-6 border-b border-slate-800/80">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">About Nexa</h1>
          <p className="text-lg text-slate-400">Connecting friends, empowering communities.</p>
        </header>
        
        <section className="space-y-4 text-slate-300 leading-relaxed text-base md:text-lg">
          <p>
            Nexa is a state-of-the-art social media application designed to empower communities, connect friends, and facilitate real-time engagement across the globe. Built on top of a robust Oracle Database backend, Nexa ensures high-fidelity media sharing, lightning-fast instant messaging, and unparalleled platform stability. Our mission is to create a digital space where users can authentically express themselves without compromising on performance or security.
          </p>
          <p>
            Currently, Nexa is operated by <strong>[NEEDS REAL COMPANY INFO] Nexa Social Inc.</strong>, a technology company dedicated to advancing modern communication standards. Our engineering team prioritizes accessibility, agentic readiness, and seamless integrations. We believe in an open web, which is why we offer comprehensive API access and adhere strictly to RFC standards for web services.
          </p>
        </section>

        <section className="bg-slate-800/30 border border-slate-700/50 p-6 rounded-2xl space-y-2 mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Corporate Information</h2>
          <p className="text-slate-400"><strong className="text-slate-300">Company Legal Name:</strong> [NEEDS REAL COMPANY INFO] Nexa Social Inc.</p>
          <p className="text-slate-400"><strong className="text-slate-300">Headquarters:</strong> [NEEDS REAL COMPANY INFO] 123 Social Avenue, San Francisco, CA 94107, US</p>
        </section>
      </main>
    </AppShell>
  );
};

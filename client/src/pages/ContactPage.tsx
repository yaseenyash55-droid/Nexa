import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { Mail, Phone, MapPin, Send } from 'lucide-react';

export const ContactPage: React.FC = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate submission for UI purposes
    setIsSubmitted(true);
  };

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="space-y-3 pb-6 border-b border-slate-800/80">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Contact Support</h1>
          <p className="text-lg text-slate-400">We're here to help you get the most out of Nexa.</p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-6">
            <p className="text-slate-300 leading-relaxed">
              Whether you are experiencing technical difficulties, have a question about your account, or want to report inappropriate behavior, our dedicated support team is available to assist you.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="p-3 bg-brand-500/20 text-brand-400 rounded-lg"><Mail className="w-5 h-5" /></div>
                <div>
                  <p className="text-sm text-slate-400">Email Support</p>
                  <p className="font-medium text-slate-200">[NEEDS REAL COMPANY INFO] support@nexa.example.com</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="p-3 bg-brand-500/20 text-brand-400 rounded-lg"><Phone className="w-5 h-5" /></div>
                <div>
                  <p className="text-sm text-slate-400">Phone Support</p>
                  <p className="font-medium text-slate-200">[NEEDS REAL COMPANY INFO] +1-800-555-0199</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="p-3 bg-brand-500/20 text-brand-400 rounded-lg"><MapPin className="w-5 h-5" /></div>
                <div>
                  <p className="text-sm text-slate-400">Mailing Address</p>
                  <p className="font-medium text-slate-200 text-sm">[NEEDS REAL COMPANY INFO] 123 Social Avenue, San Francisco, CA 94107, US</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[#0b101e] border border-slate-800 p-6 rounded-2xl shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-4">Send a Message</h2>
            {isSubmitted ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <Send className="w-6 h-6" />
                </div>
                <p className="text-emerald-300 font-medium">Message Sent</p>
                <p className="text-slate-400 text-sm">We'll get back to you within 24 hours.</p>
                <button onClick={() => setIsSubmitted(false)} className="text-brand-400 hover:text-brand-300 text-sm underline mt-2 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded px-2">Send another</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="block text-sm font-medium text-slate-300">Name</label>
                  <input type="text" id="name" required className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" placeholder="Your name" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300">Email Address</label>
                  <input type="email" id="email" required className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" placeholder="you@example.com" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="message" className="block text-sm font-medium text-slate-300">Message</label>
                  <textarea id="message" required rows={4} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none" placeholder="How can we help?"></textarea>
                </div>
                <button type="submit" className="w-full bg-brand-600 hover:bg-brand-500 text-white font-medium py-2.5 rounded-xl transition-colors shadow-glow-brand focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-background">
                  Submit Request
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
};

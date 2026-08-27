import React from 'react';
import { AppShell } from '../components/layout/AppShell.js';

export const PrivacyPage: React.FC = () => {
  return (
    <AppShell>
      <main className="p-6 md:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="space-y-3 pb-6 border-b border-slate-800/80">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Privacy Policy</h1>
          <p className="text-lg text-slate-400">Your privacy and data security are our top priorities.</p>
        </header>
        
        <section className="space-y-6 text-slate-300 leading-relaxed text-base">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">Information Collection</h2>
            <p>
              We collect information you provide directly to us, such as when you create an account, update your profile, or post content. This includes your username, email address, profile image, and the text or media you share. We also automatically collect certain technical data, such as your IP address and browser type, to ensure platform security and optimize performance.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">Information Usage</h2>
            <p>
              The data we collect is used to provide, maintain, and improve the Nexa service. We use your information to personalize your feed, deliver notifications, and enforce our community guidelines. Nexa does not sell your personal data to third parties.
            </p>
            <div className="bg-brand-500/10 border border-brand-500/20 p-4 rounded-xl text-brand-300/90 italic mt-2">
              [NEEDS REAL COMPANY INFO] (Actual data sharing practices and third-party vendor integrations must be legally reviewed and inserted here).
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">Data Retention and Rights</h2>
            <p>
              You retain ownership of your content. You have the right to access, modify, or delete your personal information at any time through your account settings. If you choose to delete your account, your data will be permanently removed from our active Oracle databases in accordance with our retention policies.
            </p>
            <p>
              If you have privacy-related questions, please contact us at <strong>[NEEDS REAL COMPANY INFO] privacy@nexa.example.com</strong>.
            </p>
          </div>
        </section>
      </main>
    </AppShell>
  );
};

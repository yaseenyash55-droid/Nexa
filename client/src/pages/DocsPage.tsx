import React from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { Terminal, Code, Server, ArrowRight } from 'lucide-react';

export const DocsPage: React.FC = () => {
  return (
    <AppShell>
      <main className="p-6 md:p-8 max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-sm font-medium mb-2 border border-brand-500/20">
            <Terminal className="w-4 h-4" />
            <span>Developer Center</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            API Documentation
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Integrate Nexa's real-time social graph, high-fidelity media, and user profiles directly into your applications. Built on Oracle Database.
          </p>
        </header>

        <section className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Server className="w-24 h-24 text-brand-400" />
          </div>
          <div className="relative z-10 space-y-4">
            <h2 className="text-xl font-semibold text-white">Full OpenAPI Specification</h2>
            <p className="text-slate-300">
              For a complete list of endpoints, schemas, and interactive Swagger UI testing, visit our dedicated API explorer.
            </p>
            <a 
              href="/api-docs" 
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-glow-brand hover:scale-[1.02]"
            >
              <Code className="w-4 h-4" />
              Open Interactive Swagger UI
              <ArrowRight className="w-4 h-4 ml-1" />
            </a>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-b border-slate-800 pb-2">Quick Start</h2>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-200">1. Fetch Global Feed</h3>
              <p className="text-sm text-slate-400">Retrieve the most recent public posts across the entire platform.</p>
              <div className="bg-[#0b101e] border border-slate-800 rounded-xl p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-slate-300">
                  <code className="language-bash">
                    <span className="text-brand-400">curl</span> -X GET https://nexa-social-app.surge.sh/api/posts/feed \\<br />
                    &nbsp;&nbsp;-H <span className="text-emerald-400">"Accept: application/json"</span>
                  </code>
                </pre>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-200">2. Look up a User Profile</h3>
              <p className="text-sm text-slate-400">Resolve a username to their internal ID, follower counts, and public data.</p>
              <div className="bg-[#0b101e] border border-slate-800 rounded-xl p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-slate-300">
                  <code className="language-bash">
                    <span className="text-brand-400">curl</span> -X GET https://nexa-social-app.surge.sh/api/users/username/elon \\<br />
                    &nbsp;&nbsp;-H <span className="text-emerald-400">"Accept: application/json"</span>
                  </code>
                </pre>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-200">3. Error Handling</h3>
              <p className="text-sm text-slate-400">All errors return standard RFC 7807 problem+json structure.</p>
              <div className="bg-[#0b101e] border border-slate-800 rounded-xl p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-slate-300">
                  <code className="language-json">
&#123;
  <span className="text-brand-300">"type"</span>: <span className="text-emerald-400">"https://nexa-social-app.surge.sh/docs/errors/unauthorized"</span>,
  <span className="text-brand-300">"title"</span>: <span className="text-emerald-400">"UNAUTHORIZED"</span>,
  <span className="text-brand-300">"status"</span>: <span className="text-amber-400">401</span>,
  <span className="text-brand-300">"detail"</span>: <span className="text-emerald-400">"Authentication token is missing or invalid."</span>
&#125;
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
};

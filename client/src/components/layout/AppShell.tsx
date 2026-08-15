import React, { useState } from 'react';
import { SidebarNavigation } from './SidebarNavigation.js';
import { TopBar } from './TopBar.js';
import { MobileBottomNavigation } from './MobileBottomNavigation.js';
import { SearchInput } from '../search/SearchInput.js';
import { SuggestedUsers } from '../search/SuggestedUsers.js';
import { Modal } from '../ui/Modal.js';
import { PostComposer } from '../feed/PostComposer.js';
import { DevelopmentDataModeBadge } from '../ui/DevelopmentDataModeBadge.js';

interface AppShellProps {
  children: React.ReactNode;
  showRightPanel?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({ children, showRightPanel = true }) => {
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col md:flex-row justify-center">
      {/* Top Header (Mobile) */}
      <TopBar />

      {/* Sidebar Navigation (Desktop/Tablet) */}
      <div className="hidden md:block">
        <SidebarNavigation onOpenComposer={() => setIsComposerOpen(true)} />
      </div>

      {/* Main Content Stream Column */}
      <main className="flex-1 max-w-2xl w-full border-x border-slate-800/80 min-h-screen pb-20 md:pb-8">
        {children}
      </main>

      {/* Right Sidebar Panel (Desktop only) */}
      {showRightPanel && (
        <aside className="hidden lg:block w-80 p-4 space-y-6 sticky top-0 h-screen overflow-y-auto">
          <SearchInput />
          <SuggestedUsers />
          <footer className="px-4 text-xs text-slate-500 space-y-1">
            <p>© 2026 Nexa Social Network Inc.</p>
            <p>Powered by Oracle Database & React</p>
          </footer>
        </aside>
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation onOpenComposer={() => setIsComposerOpen(true)} />

      {/* Create Post Modal */}
      <Modal isOpen={isComposerOpen} onClose={() => setIsComposerOpen(false)} title="Create New Post">
        <PostComposer onPostCreated={() => setIsComposerOpen(false)} />
      </Modal>

      {/* Development Mode Badge */}
      <DevelopmentDataModeBadge />
    </div>
  );
};

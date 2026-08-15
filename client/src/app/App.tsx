import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../contexts/AuthContext.js';
import { ThemeProvider } from '../contexts/ThemeContext.js';

import { HomePage } from '../pages/HomePage.js';
import { ExplorePage } from '../pages/ExplorePage.js';
import { SearchPage } from '../pages/SearchPage.js';
import { ProfilePage } from '../pages/ProfilePage.js';
import { NotificationsPage } from '../pages/NotificationsPage.js';
import { BookmarksPage } from '../pages/BookmarksPage.js';
import { SettingsPage } from '../pages/SettingsPage.js';
import { ProtectionCenterPage } from '../pages/ProtectionCenterPage.js';
import { AppearanceSettingsPage } from '../pages/AppearanceSettingsPage.js';
import { CreatorInsightsPage } from '../pages/CreatorInsightsPage.js';
import { ModerationQueuePage } from '../pages/ModerationQueuePage.js';
import { ReelsPage } from '../pages/ReelsPage.js';
import { MessagesPage } from '../pages/MessagesPage.js';
import { UserManualPage } from '../pages/UserManualPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { RegisterPage } from '../pages/RegisterPage.js';
import { NotFoundPage } from '../pages/NotFoundPage.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-slate-400 text-sm font-medium">
        Loading session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/reels" element={<ReelsPage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/user-manual" element={<UserManualPage />} />
            <Route path="/help" element={<UserManualPage />} />
            <Route path="/tutorial" element={<UserManualPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/bookmarks" element={<ProtectedRoute><Navigate to="/settings?tab=bookmarks" replace /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/settings/appearance" element={<ProtectedRoute><Navigate to="/settings?tab=appearance" replace /></ProtectedRoute>} />
            <Route path="/settings/protection" element={<ProtectedRoute><Navigate to="/settings?tab=protection" replace /></ProtectedRoute>} />
            <Route path="/settings/protection/*" element={<ProtectedRoute><Navigate to="/settings?tab=protection" replace /></ProtectedRoute>} />
            <Route path="/protection" element={<ProtectedRoute><Navigate to="/settings?tab=protection" replace /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><Navigate to="/settings?tab=insights" replace /></ProtectedRoute>} />
            <Route path="/moderation" element={<ProtectedRoute><Navigate to="/settings?tab=moderation" replace /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

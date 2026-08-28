import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../contexts/AuthContext.js';
import { ThemeProvider } from '../contexts/ThemeContext.js';
import { ToastProvider } from '../contexts/ToastContext.js';

import { HomePage } from '../pages/HomePage.js';
import { ExplorePage } from '../pages/ExplorePage.js';
import { SearchPage } from '../pages/SearchPage.js';
import { ProfilePage } from '../pages/ProfilePage.js';
import { NotificationsPage } from '../pages/NotificationsPage.js';
import { SettingsPage } from '../pages/SettingsPage.js';
import { ReelsPage } from '../pages/ReelsPage.js';
import { MessagesPage } from '../pages/MessagesPage.js';
import { MusicPage } from '../pages/MusicPage.js';
import { UserManualPage } from '../pages/UserManualPage.js';
import { DownloadPage } from '../pages/DownloadPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { RegisterPage } from '../pages/RegisterPage.js';
import { ResetPasswordPage } from '../pages/ResetPasswordPage.js';
import { NotFoundPage } from '../pages/NotFoundPage.js';
import { AboutPage } from '../pages/AboutPage.js';
import { ContactPage } from '../pages/ContactPage.js';
import { PrivacyPage } from '../pages/PrivacyPage.js';
import { NexaAiPage } from '../pages/NexaAiPage.js';
import { initializeLiveUpdates } from '../utils/capacitorLiveUpdates.js';
import { webFcmService } from '../services/fcm.service.js';
import { MusicProvider } from '../contexts/MusicContext.js';
import { GlobalMusicPlayer } from '../components/music/GlobalMusicPlayer.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

const AppNotificationInitializer: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    // Register background service worker immediately
    void webFcmService.registerServiceWorker();

    // If authenticated, request permission and sync web push token
    if (user) {
      void webFcmService.requestPermissionAndSyncToken();
    }
  }, [user]);

  return null;
};

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
  useEffect(() => {
    initializeLiveUpdates();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MusicProvider>
              <AppNotificationInitializer />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/music" element={<MusicPage />} />
                <Route path="/reels" element={<ReelsPage />} />
                <Route path="/profile/:username" element={<ProfilePage />} />
                <Route path="/user-manual" element={<UserManualPage />} />
                <Route path="/help" element={<UserManualPage />} />
                <Route path="/tutorial" element={<UserManualPage />} />
                <Route path="/download" element={<DownloadPage />} />
                <Route path="/apk" element={<DownloadPage />} />
                <Route path="/get-app" element={<DownloadPage />} />
                <Route path="/install" element={<DownloadPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />


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
                <Route path="/ai" element={<ProtectedRoute><NexaAiPage /></ProtectedRoute>} />
                <Route path="/nexa-ai" element={<ProtectedRoute><Navigate to="/ai" replace /></ProtectedRoute>} />

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              <GlobalMusicPlayer />
            </BrowserRouter>
          </MusicProvider>
        </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

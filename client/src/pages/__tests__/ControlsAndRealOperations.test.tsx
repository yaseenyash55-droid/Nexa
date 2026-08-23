import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ModerationQueuePage } from '../ModerationQueuePage.js';
import { BookmarksPage } from '../BookmarksPage.js';
import { ReportModal } from '../../components/ui/ReportModal.js';
import { CallModal } from '../../components/chat/CallModal.js';
import { API_BASE_URL } from '../../api/client.js';
import { privacyApi } from '../../api/privacy.api.js';
import { postsApi } from '../../api/posts.api.js';

// Mock user context
let mockCurrentUser: any = {
  userId: 1,
  username: 'testuser',
  displayName: 'Test User',
  email: 'test@example.com',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

vi.mock('../../contexts/AuthContext.js', async () => {
  const actual = await vi.importActual<any>('../../contexts/AuthContext.js');
  return {
    ...actual,
    useAuth: () => ({
      user: mockCurrentUser,
      isLoading: false,
      logout: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      setUser: vi.fn(),
      requireAuth: (fn: () => void) => { fn(); return true; }
    })
  };
});

describe('Phase 5: Real Controls, APIs & Oracle Verification Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = {
      userId: 1,
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@example.com',
      role: 'USER',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
  });

  describe('ReportModal Real API Integration', () => {
    it('submits report to /api/privacy/reports and displays success state', async () => {
      const submitSpy = vi.spyOn(privacyApi, 'submitReport').mockResolvedValue({
        success: true,
        data: { reportId: 99 }
      } as any);

      const handleClose = vi.fn();

      render(
        <ReportModal
          isOpen={true}
          onClose={handleClose}
          targetType="post"
          targetId={102}
        />
      );

      expect(screen.getByText(/Report POST/i)).toBeDefined();

      const textarea = screen.getByPlaceholderText(/Describe the issue in detail/i);
      fireEvent.change(textarea, { target: { value: 'Spam link in post description' } });

      const submitBtn = screen.getByRole('button', { name: /Submit Confidential Report/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(submitSpy).toHaveBeenCalledWith({
          targetType: 'post',
          targetId: 102,
          reason: 'spam',
          details: 'Spam link in post description'
        });
      });

      expect(screen.getByText(/Report Submitted/i)).toBeDefined();
      expect(screen.getByText(/Your report has been recorded in our moderation queue/i)).toBeDefined();

      const doneBtn = screen.getByRole('button', { name: /Done/i });
      fireEvent.click(doneBtn);
      expect(handleClose).toHaveBeenCalled();
    });

    it('handles API error when reporting fails', async () => {
      vi.spyOn(privacyApi, 'submitReport').mockRejectedValue({
        response: { data: { error: { message: 'Cannot report your own post' } } }
      });

      render(
        <ReportModal
          isOpen={true}
          onClose={vi.fn()}
          targetType="post"
          targetId={102}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Submit Confidential Report/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Cannot report your own post/i)).toBeDefined();
      });
    });
  });

  describe('ModerationQueuePage Role Enforcement & Real Operations', () => {
    it('restricts moderation dashboard for regular non-moderator members', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ModerationQueuePage />
          </BrowserRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText(/Restricted Dashboard/i)).toBeDefined();
      expect(screen.getByText(/Moderator or Administrator role/i)).toBeDefined();
    });

    it('loads real Oracle reports and actions them when user is ADMIN', async () => {
      mockCurrentUser.role = 'ADMIN';

      const mockReports = [
        {
          reportId: 55,
          reporterUserId: 10,
          reporterUsername: 'alice',
          targetType: 'post',
          targetId: 301,
          reason: 'Harassment',
          details: 'Inappropriate language in comments',
          status: 'PENDING' as const,
          createdAt: new Date().toISOString()
        }
      ];

      vi.spyOn(privacyApi, 'getModerationReports').mockResolvedValue({
        success: true,
        data: mockReports
      });

      const actionSpy = vi.spyOn(privacyApi, 'actionModerationReport').mockResolvedValue({
        success: true,
        data: { reportId: 55, status: 'RESOLVED' }
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ModerationQueuePage />
          </BrowserRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/POST Report #55/i)).toBeDefined();
        expect(screen.getByText(/Reason: Harassment/i)).toBeDefined();
        expect(screen.getByText(/ADMIN Active/i)).toBeDefined();
      });

      const actionBtn = screen.getByRole('button', { name: /Action & Resolve/i });
      fireEvent.click(actionBtn);

      await waitFor(() => {
        expect(actionSpy).toHaveBeenCalledWith(55, 'REMOVE_CONTENT', 'Actioned by testuser');
      });
    });
  });

  describe('BookmarksPage Oracle Integration', () => {
    it('displays bookmarks from Oracle repository and disables custom folders', async () => {
      vi.spyOn(postsApi, 'getBookmarks').mockResolvedValue({
        data: [
          {
            postId: 101,
            userId: 2,
            content: 'Oracle Database 23ai native JSON features',
            likesCount: 5,
            commentsCount: 2,
            isLiked: false,
            isBookmarked: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            author: {
              userId: 2,
              username: 'oracle_dev',
              displayName: 'Oracle Dev',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }
        ],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 }
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <BookmarksPage />
          </BrowserRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Saved Bookmarks/i)).toBeDefined();
        expect(screen.getByText(/Oracle Database 23ai native JSON features/i)).toBeDefined();
        expect(screen.getByRole('button', { name: /Custom Folders \(Unavailable\)/i })).toBeDefined();
      });
    });
  });

  describe('CallModal & Realtime Environment', () => {
    it('verifies Socket.IO host resolves to API host instead of Surge origin', () => {
      const socketHost = API_BASE_URL.replace(/\/api$/, '');
      expect(socketHost).not.toContain('surge.sh');
      expect(socketHost === 'http://localhost:4000' || socketHost === 'https://nexa-backend-in6s.onrender.com').toBe(true);
    });

    it('fails closed when realtime signaling is not connected', () => {
      const handleClose = vi.fn();
      const targetUser = {
        userId: 2,
        username: 'sarah',
        displayName: 'Sarah Connor',
        email: 'sarah@example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      };

      render(
        <CallModal
          isOpen={true}
          onClose={handleClose}
          targetUser={targetUser}
          callType="video"
        />
      );

      expect(screen.getAllByText(/Realtime connection is not ready/i).length).toBeGreaterThan(0);

      const closeButton = screen.getByRole('button', { name: /Close call/i });
      fireEvent.click(closeButton);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});

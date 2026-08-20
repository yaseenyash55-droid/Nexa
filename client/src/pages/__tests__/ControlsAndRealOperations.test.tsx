import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ModerationQueuePage } from '../ModerationQueuePage.js';
import { CallModal } from '../../components/chat/CallModal.js';
import { API_BASE_URL } from '../../api/client.js';

// Mock user context
vi.mock('../../contexts/AuthContext.js', async () => {
  const actual = await vi.importActual<any>('../../contexts/AuthContext.js');
  return {
    ...actual,
    useAuth: () => ({
      user: {
        userId: 1,
        username: 'testuser',
        displayName: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      isLoading: false,
      logout: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      setUser: vi.fn(),
      requireAuth: (fn: () => void) => { fn(); return true; }
    })
  };
});

describe('Phase 4: Real Controls & Security Suite', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
  });

  it('verifies Socket.IO host resolves to API host instead of Surge origin', () => {
    const socketHost = API_BASE_URL.replace(/\/api$/, '');
    expect(socketHost).not.toContain('surge.sh');
    expect(socketHost === 'http://localhost:4000' || socketHost === 'https://nexa-backend-in6s.onrender.com').toBe(true);
  });

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

  it('renders CallModal with clear notice explaining unconfigured WebRTC signaling', () => {
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

    expect(screen.getByText(/Video Calling Unavailable/i)).toBeDefined();
    expect(screen.getByText(/Real-time peer-to-peer calling requires dedicated STUN\/TURN/i)).toBeDefined();

    const understandBtn = screen.getByRole('button', { name: /Understood/i });
    fireEvent.click(understandBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

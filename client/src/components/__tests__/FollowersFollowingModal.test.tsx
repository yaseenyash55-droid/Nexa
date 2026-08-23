import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FollowersFollowingModal } from '../profile/FollowersFollowingModal.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { usersApi } from '../../api/users.api.js';

vi.mock('../../api/users.api.js', () => ({
  usersApi: {
    getFollowers: vi.fn(),
    getFollowing: vi.fn(),
    follow: vi.fn(),
    unfollow: vi.fn()
  }
}));

vi.mock('../../contexts/AuthContext.js', () => ({
  useAuth: () => ({
    user: { userId: 1, username: 'tester', displayName: 'Tester' },
    requireAuth: (fn: () => void) => fn()
  })
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('FollowersFollowingModal Component Suite', () => {
  const mockFollowers = [
    {
      userId: 2,
      username: 'alice',
      displayName: 'Alice Walker',
      profileImageUrl: null,
      isFollowing: false
    },
    {
      userId: 3,
      username: 'bob',
      displayName: 'Bob Dylan',
      profileImageUrl: null,
      isFollowing: true
    }
  ];

  const mockFollowing = [
    {
      userId: 4,
      username: 'charlie',
      displayName: 'Charlie Puth',
      profileImageUrl: null,
      isFollowing: true
    }
  ];

  it('renders modal with follower list and tab switching', async () => {
    vi.mocked(usersApi.getFollowers).mockResolvedValueOnce(mockFollowers as any);
    vi.mocked(usersApi.getFollowing).mockResolvedValueOnce(mockFollowing as any);

    const handleClose = vi.fn();

    renderWithProviders(
      <FollowersFollowingModal
        isOpen={true}
        onClose={handleClose}
        userId={10}
        username="nexa_star"
        initialTab="followers"
      />
    );

    expect(screen.getByText('@nexa_star')).toBeDefined();
    expect(screen.getByRole('dialog')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Alice Walker')).toBeDefined();
      expect(screen.getByText('Bob Dylan')).toBeDefined();
    });

    // Switch to following tab
    const followingTab = screen.getByText(/Following \(/i);
    fireEvent.click(followingTab);

    await waitFor(() => {
      expect(screen.getByText('Charlie Puth')).toBeDefined();
    });
  });

  it('filters users based on live search query', async () => {
    vi.mocked(usersApi.getFollowers).mockResolvedValueOnce(mockFollowers as any);

    renderWithProviders(
      <FollowersFollowingModal
        isOpen={true}
        onClose={vi.fn()}
        userId={10}
        username="nexa_star"
        initialTab="followers"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Walker')).toBeDefined();
      expect(screen.getByText('Bob Dylan')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText('Search people...');
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    expect(screen.getByText('Alice Walker')).toBeDefined();
    expect(screen.queryByText('Bob Dylan')).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage.js';
import { RegisterPage } from '../RegisterPage.js';
import { ResetPasswordPage } from '../ResetPasswordPage.js';
import { AuthProvider } from '../../contexts/AuthContext.js';
import { setAccessToken, getAccessToken, clearAuthSession } from '../../api/client.js';

// Mock authApi
vi.mock('../../api/auth.api.js', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    forgotPassword: vi.fn().mockResolvedValue({ message: 'Password reset link sent' }),
    resetPassword: vi.fn().mockResolvedValue({ message: 'Password reset successful' })
  }
}));

describe('Web Authentication and Accessibility Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthSession();
  });

  describe('Token & Storage Security', () => {
    it('manages access tokens strictly in-memory without localStorage leakage', () => {
      setAccessToken('test-memory-access-token');
      expect(getAccessToken()).toBe('test-memory-access-token');

      // Verify no refresh token is stored in localStorage
      expect(localStorage.getItem('nexa_refresh_token')).toBeNull();
      expect(localStorage.getItem('nexa_access_token')).toBeNull();

      clearAuthSession();
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('LoginPage Accessibility & Interaction', () => {
    it('links the website download control to the cache-busted Android APK', () => {
      render(
        <AuthProvider>
          <BrowserRouter>
            <LoginPage />
          </BrowserRouter>
        </AuthProvider>
      );

      const downloadLink = screen.getByRole('link', { name: /Download Android App/i });
      expect(downloadLink.getAttribute('href')).toBe('/nexa-social-app.apk?v=latest');
      expect(downloadLink.getAttribute('download')).toBe('nexa-social-app.apk');
    });

    it('associates form labels with input elements via id and htmlFor', () => {
      render(
        <AuthProvider>
          <BrowserRouter>
            <LoginPage />
          </BrowserRouter>
        </AuthProvider>
      );

      const emailInput = screen.getByLabelText(/Email or Username/i, { selector: 'input' });
      expect(emailInput).toBeDefined();
      expect(emailInput.getAttribute('id')).toBe('login-emailOrUsername');

      const passwordInput = screen.getByLabelText(/^Password$/i, { selector: 'input' });
      expect(passwordInput).toBeDefined();
      expect(passwordInput.getAttribute('id')).toBe('login-password');
    });

    it('toggles password visibility with accessible aria-label on button', () => {
      render(
        <AuthProvider>
          <BrowserRouter>
            <LoginPage />
          </BrowserRouter>
        </AuthProvider>
      );

      const toggleBtn = screen.getByRole('button', { name: /Show password/i });
      expect(toggleBtn).toBeDefined();

      fireEvent.click(toggleBtn);
      expect(screen.getByRole('button', { name: /Hide password/i })).toBeDefined();

      const passwordInput = screen.getByLabelText(/^Password$/i, { selector: 'input' });
      expect(passwordInput.getAttribute('type')).toBe('text');
    });

    it('displays accessible validation errors with aria-describedby and role=alert', async () => {
      render(
        <AuthProvider>
          <BrowserRouter>
            <LoginPage />
          </BrowserRouter>
        </AuthProvider>
      );

      const submitBtn = screen.getByRole('button', { name: /Sign In/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        const errorMsg = screen.getByText(/Username or email is required/i);
        expect(errorMsg).toBeDefined();
        expect(errorMsg.getAttribute('role')).toBe('alert');
      });

      const emailInput = screen.getByLabelText(/Email or Username/i, { selector: 'input' });
      expect(emailInput.getAttribute('aria-invalid')).toBe('true');
      expect(emailInput.getAttribute('aria-describedby')).toContain('login-emailOrUsername-error');
    });

    it('opens and submits accessible Forgot Password dialog', async () => {
      render(
        <AuthProvider>
          <BrowserRouter>
            <LoginPage />
          </BrowserRouter>
        </AuthProvider>
      );

      const forgotBtn = screen.getByRole('button', { name: /Forgot password\?/i });
      fireEvent.click(forgotBtn);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();

      const forgotEmailInput = screen.getByLabelText(/Registered Email Address/i, { selector: 'input' });
      fireEvent.change(forgotEmailInput, { target: { value: 'user@nexa.app' } });

      const sendLinkBtn = screen.getByRole('button', { name: /Send Link/i });
      fireEvent.click(sendLinkBtn);

      await waitFor(() => {
        expect(screen.getByText(/Password reset link sent/i)).toBeDefined();
      });
    });
  });

  describe('ResetPasswordPage', () => {
    it('submits a matching strong password from a valid email link', async () => {
      render(
        <MemoryRouter initialEntries={['/reset-password?token=test-reset-token']}>
          <ResetPasswordPage />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/^New Password$/i), {
        target: { value: 'NewPassword1' }
      });
      fireEvent.change(screen.getByLabelText(/^Confirm Password$/i), {
        target: { value: 'NewPassword1' }
      });
      fireEvent.click(screen.getByRole('button', { name: /Save New Password/i }));

      await waitFor(() => {
        expect(screen.getByText(/Password changed successfully/i)).toBeDefined();
      });
    });
  });

  describe('RegisterPage Accessibility & Validation', () => {
    it('associates all registration labels and inputs properly', () => {
      render(
        <AuthProvider>
          <BrowserRouter>
            <RegisterPage />
          </BrowserRouter>
        </AuthProvider>
      );

      expect(screen.getByLabelText(/Display Name/i, { selector: 'input' })).toBeDefined();
      expect(screen.getByLabelText(/Username/i, { selector: 'input' })).toBeDefined();
      expect(screen.getByLabelText(/Email Address/i, { selector: 'input' })).toBeDefined();
      expect(screen.getByLabelText(/^Password$/i, { selector: 'input' })).toBeDefined();
    });

    it('enforces password complexity and format validation matching server rules', async () => {
      render(
        <AuthProvider>
          <BrowserRouter>
            <RegisterPage />
          </BrowserRouter>
        </AuthProvider>
      );

      const displayNameInput = screen.getByLabelText(/Display Name/i, { selector: 'input' });
      const usernameInput = screen.getByLabelText(/Username/i, { selector: 'input' });
      const emailInput = screen.getByLabelText(/Email Address/i, { selector: 'input' });
      const passwordInput = screen.getByLabelText(/^Password$/i, { selector: 'input' });
      const submitBtn = screen.getByRole('button', { name: /Create Account/i });

      // Enter invalid data
      fireEvent.change(displayNameInput, { target: { value: 'A' } });
      fireEvent.change(usernameInput, { target: { value: 'invalid user!' } });
      fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
      fireEvent.change(passwordInput, { target: { value: 'simple' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Display name must be at least 2 characters/i)).toBeDefined();
        expect(screen.getByText(/Username can only contain letters, numbers, and underscores/i)).toBeDefined();
        expect(screen.getByText(/Please enter a valid email address/i)).toBeDefined();
        expect(screen.getByText(/Password must be at least 8 characters long/i)).toBeDefined();
      });
    });
  });

  describe('Session Hydration & Auth State Recovery', () => {
    it('hydrates user on page load when silent refresh succeeds', async () => {
      const { authApi } = await import('../../api/auth.api.js');
      vi.mocked(authApi.refresh).mockResolvedValueOnce('new-access-token');
      vi.mocked(authApi.me).mockResolvedValueOnce({
        userId: 1,
        username: 'hydrateduser',
        email: 'hydrated@nexa.app',
        displayName: 'Hydrated User',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      render(
        <AuthProvider>
          <BrowserRouter>
            <LoginPage />
          </BrowserRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authApi.refresh).toHaveBeenCalled();
        expect(authApi.me).toHaveBeenCalled();
      });
    });

    it('clears session when silent refresh fails', async () => {
      const { authApi } = await import('../../api/auth.api.js');
      vi.mocked(authApi.refresh).mockRejectedValueOnce(new Error('No refresh cookie'));

      render(
        <AuthProvider>
          <BrowserRouter>
            <LoginPage />
          </BrowserRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authApi.refresh).toHaveBeenCalled();
        expect(getAccessToken()).toBeNull();
      });
    });
  });
});

import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, Lock } from 'lucide-react';
import { authApi } from '../api/auth.api.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('This password reset link is missing its token. Request a new link.');
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password must be at least 8 characters and include an uppercase letter and a number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.resetPassword({ token, newPassword });
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.error?.message ||
          'The reset link is invalid or expired. Request a new link.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-background-card border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-gradient-to-tr from-brand-600 to-indigo-400 rounded-2xl text-white">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Reset your password</h1>
          <p className="text-xs text-slate-400">Choose a new password for your Nexa account.</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div role="status" className="flex gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Password changed successfully. You can now sign in.</span>
            </div>
            <Link to="/login" className="block text-center text-brand-400 hover:underline font-semibold">
              Return to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}
            <Input
              id="new-password"
              label="New Password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
            />
            <Input
              id="confirm-password"
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
            />
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Save New Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

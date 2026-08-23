import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext.js';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Sparkles, Lock, Mail, User as UserIcon, Smile, Eye, EyeOff } from 'lucide-react';
import { ANDROID_RELEASE } from '../config/androidRelease.js';

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Please enter a valid email address'),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(60, 'Display name cannot exceed 60 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { register: registerAuth } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      setErrorMsg(null);
      await registerAuth(values);
      navigate('/');
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Registration failed';
      setErrorMsg(msg);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-background-card border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-gradient-to-tr from-brand-600 to-indigo-400 rounded-2xl text-white shadow-lg shadow-brand-600/30 mb-2">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Create your Nexa Account</h1>
          <p className="text-xs text-slate-400">Join the next-generation social platform</p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium text-center"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            id="register-displayName"
            label="Display Name"
            placeholder="Alex Rivera"
            autoComplete="name"
            leftIcon={<Smile className="w-4 h-4" />}
            error={errors.displayName?.message}
            {...register('displayName')}
          />

          <Input
            id="register-username"
            label="Username"
            placeholder="alex_dev"
            autoComplete="username"
            leftIcon={<UserIcon className="w-4 h-4" />}
            error={errors.username?.message}
            {...register('username')}
          />

          <Input
            id="register-email"
            label="Email Address"
            type="email"
            placeholder="alex@example.com"
            autoComplete="email"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            id="register-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Must include 1 uppercase & 1 number"
            autoComplete="new-password"
            leftIcon={<Lock className="w-4 h-4" />}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="hover:text-slate-200 transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            Create Account
          </Button>
        </form>

        <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800 space-y-2">
          <div>
            Already registered?{' '}
            <Link
              to="/login"
              className="text-brand-400 hover:underline font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 rounded px-1"
            >
              Sign in
            </Link>
          </div>
          <div>
            <a
              href={ANDROID_RELEASE.downloadUrl}
              download={ANDROID_RELEASE.fileName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-semibold transition-all focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5516 0 .9997.4482.9997.9993s-.4481.9997-.9997.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5516 0 .9997.4482.9997.9993s-.4481.9997-.9997.9997m11.4045-6.02l1.9973-3.4592c.1251-.2167.0506-.4928-.1661-.6178-.2161-.125-.4922-.0506-.6178.1661l-2.0224 3.5029c-1.5707-.7167-3.3444-1.1166-5.2285-1.1166s-3.6578.4-5.2285 1.1166l-2.0224-3.5029c-.1256-.2167-.4017-.2911-.6178-.1661-.2167.125-.2912.4011-.1661.6178l1.9973 3.4592c-3.149 1.7161-5.328 4.9082-5.7486 8.6534h22.9515c-.4206-3.7452-2.5996-6.9373-5.7486-8.6534" />
              </svg>
              <span>Download Android App ({ANDROID_RELEASE.versionLabel})</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

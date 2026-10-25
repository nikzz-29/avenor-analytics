'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
const schema = z.object({
  name: z.string().optional(),
  email: z.email('Enter a valid email address.'),
  password: z.string().min(10, 'Use at least 10 characters.').max(128),
});
type Values = z.infer<typeof schema>;
export function DemoButton({
  className,
  children = 'Try the live demo',
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const client = useQueryClient();
  return (
    <>
      <Button
        className={className}
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await api('/auth/demo', { method: 'POST' });
            client.clear();
            localStorage.removeItem('avenor_workspace');
            router.push('/workspace/overview');
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? 'Preparing your workspace…' : children}
        <ArrowUpRight size={16} />
      </Button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const client = useQueryClient();
  const [error, setError] = useState('');
  const signup = mode === 'sign-up';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Link className="brand" href="/">
          <span className="brand-mark">a</span>
          <span className="brand-name">avenor.</span>
        </Link>
        <div>
          <p className="eyebrow">A LITTLE LESS NOISE.</p>
          <h2>
            A whole new
            <br />
            perspective.
          </h2>
          <p>
            Make space for the numbers that matter.
            <br />
            And the decisions that come next.
          </p>
          <div className="auth-line-chart" aria-hidden="true">
            <svg viewBox="0 0 400 130">
              <path
                d="M0 120 C40 120 40 90 80 95 S140 120 170 70 S210 85 245 48 S290 68 320 25 S370 50 400 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
        <span className="auth-story-foot">CLARITY IN EVERY NUMBER.</span>
      </div>
      <main className="auth-main">
        <Link className="auth-home" href="/">
          ← Back to Avenor
        </Link>
        <div className="auth-form-wrap">
          <p className="eyebrow">YOUR ANALYTICS WORKSPACE</p>
          <h1>{signup ? 'A clearer way forward.' : 'Welcome back.'}</h1>
          <p className="muted">
            {signup ? 'Start making sense of your data.' : 'Your next perspective is waiting.'}
          </p>
          <form
            className="form-stack"
            onSubmit={handleSubmit(async (values) => {
              setError('');
              try {
                await api(`/auth/${signup ? 'register' : 'login'}`, {
                  method: 'POST',
                  body: JSON.stringify(values),
                });
                client.clear();
                localStorage.removeItem('avenor_workspace');
                router.push('/workspace/overview');
              } catch (e) {
                setError((e as Error).message);
              }
            })}
          >
            {signup && (
              <label>
                Full name
                <input autoComplete="name" required maxLength={100} {...register('name')} />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                {...register('email')}
                aria-invalid={!!errors.email}
              />
              {errors.email && <span className="form-error">{errors.email.message}</span>}
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                {...register('password')}
                aria-invalid={!!errors.password}
              />
              {errors.password && <span className="form-error">{errors.password.message}</span>}
            </label>
            {!signup && (
              <Link className="text-link forgot-link" href="/forgot-password">
                Forgot your password?
              </Link>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={isSubmitting}>
              {isSubmitting ? 'One moment…' : signup ? 'Create your account' : 'Sign in'}
              <ArrowRight size={16} />
            </Button>
          </form>
          <p className="auth-alternative">
            {signup ? 'Already have an account?' : 'New to Avenor?'}{' '}
            <Link href={signup ? '/sign-in' : '/sign-up'}>
              {signup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <div className="or-divider">
            <span>or take a look around</span>
          </div>
          <DemoButton />
          <p className="small-text muted">No credit card. No API keys. Just your curiosity.</p>
        </div>
      </main>
    </div>
  );
}
export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="recovery-page">
      <Link className="brand" href="/">
        <span className="brand-mark">a</span>
        <span className="brand-name">avenor.</span>
      </Link>
      <h1>{reset ? 'A fresh start.' : 'Let’s get you back in.'}</h1>
      <p className="muted">
        {reset
          ? 'Choose a new password for your account.'
          : 'We’ll send a one-time reset link to your email.'}
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const r = await api<{ message: string }>(
              `/auth/${reset ? 'reset-password' : 'forgot-password'}`,
              {
                method: 'POST',
                body: JSON.stringify(
                  reset ? { token: params.get('token') || '', password } : { email },
                ),
              },
            );
            setMessage(r.message);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {reset ? (
          <label>
            New password
            <input
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        ) : (
          <label>
            Email address
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <Button disabled={busy}>{reset ? 'Reset password' : 'Send reset link'}</Button>
        <Link className="text-link" href="/sign-in">
          Back to sign in
        </Link>
      </form>
    </main>
  );
}

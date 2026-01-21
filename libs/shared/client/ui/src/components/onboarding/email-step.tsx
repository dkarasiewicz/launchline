'use client';

import type React from 'react';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { OnboardingData } from './onboarding.interfaces';

interface BaseEmailStepProps {
  apiBaseUrl?: string;
  onNext: () => void;
}

interface OnboardingEmailStepProps extends BaseEmailStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  // Simple props not provided
  initialEmail?: never;
  onEmailChange?: never;
}

interface StandaloneEmailStepProps extends BaseEmailStepProps {
  initialEmail: string;
  onEmailChange: (email: string) => void;
  // OnboardingData not provided
  data?: never;
  updateData?: never;
}

type EmailStepProps = OnboardingEmailStepProps | StandaloneEmailStepProps;

export function EmailStep(props: EmailStepProps) {
  const { apiBaseUrl = '', onNext } = props;

  // Determine initial email and whether we're in standalone mode
  const isStandalone =
    'initialEmail' in props && props.initialEmail !== undefined;
  const initialEmailValue = isStandalone
    ? props.initialEmail
    : props.data?.email || props.data?.invite?.emailHint || '';
  const emailHint = !isStandalone ? props.data?.invite?.emailHint : undefined;

  const [email, setEmail] = useState(initialEmailValue);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login/otp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to send verification code');
      }

      // Update parent state
      if (isStandalone) {
        props.onEmailChange(email);
      } else {
        props.updateData({ email });
      }
      onNext();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to send verification code. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {isStandalone ? 'Welcome back' : 'Verify your email'}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {isStandalone
            ? 'Enter your email to sign in to your account.'
            : "We'll send you a one-time code to verify your email."}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm text-foreground/80">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground/50"
            autoFocus
            readOnly={!!emailHint}
          />
          {emailHint && (
            <p className="text-xs text-muted-foreground">
              This email was set by your workspace admin
            </p>
          )}
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm mt-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
          disabled={!email.trim() || isLoading}
        >
          {isLoading ? (
            'Sending code...'
          ) : (
            <>
              {isStandalone ? 'Continue with email' : 'Send verification code'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      {/* Footer text */}
      <p className="text-center text-xs text-muted-foreground">
        {isStandalone
          ? "We'll send you a one-time code to verify your identity."
          : "We'll only use your email for authentication and important updates."}
      </p>
    </div>
  );
}

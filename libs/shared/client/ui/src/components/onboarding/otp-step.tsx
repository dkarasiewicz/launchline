'use client';

import type React from 'react';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Shield, ArrowRight, AlertCircle, ArrowLeft } from 'lucide-react';
import type { OnboardingData } from './onboarding.interfaces';

interface BaseOtpStepProps {
  onNext: () => void;
  apiBaseUrl?: string;
  redirectTo?: string;
  onBack?: () => void;
}

interface OnboardingOtpStepProps extends BaseOtpStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  // Simple props not provided
  email?: never;
}

interface StandaloneOtpStepProps extends BaseOtpStepProps {
  email: string;
  // OnboardingData not provided
  data?: never;
  updateData?: never;
}

type OtpStepProps = OnboardingOtpStepProps | StandaloneOtpStepProps;

export function OtpStep(props: OtpStepProps) {
  const { apiBaseUrl = '', redirectTo = '/inbox', onBack } = props;

  // Determine email based on props type
  const isStandalone = 'email' in props && typeof props.email === 'string';
  const email = isStandalone ? props.email : props.data?.email || '';

  const router = useRouter();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    const newOtp = [...otp];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');

    if (code.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Invalid code. Please try again.');
      }

      if (isStandalone) {
        router.push(redirectTo);
      } else {
        props.onNext();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Verification failed. Please try again.',
      );
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResendCooldown(30);
    try {
      await fetch(`${apiBaseUrl}/auth/login/otp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });
    } catch {
      // Silently fail - user can try again
    }
  };

  const isComplete = otp.every((digit) => digit !== '');

  return (
    <div className="space-y-8">
      {/* Back button (only shown if onBack is provided) */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      )}

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Check your email
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We sent a 6-digit code to
          <br />
          <span className="text-foreground font-medium">{email}</span>
        </p>
      </div>

      {/* OTP Input */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-xl font-mono bg-secondary/50 border border-border/50 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            ))}
          </div>
          {error && (
            <div className="flex items-center justify-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
          disabled={!isComplete || isLoading}
        >
          {isLoading ? (
            isStandalone ? (
              'Signing in...'
            ) : (
              'Verifying...'
            )
          ) : (
            <>
              {isStandalone ? 'Sign in' : 'Verify email'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      {/* Resend */}
      <div className="text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : "Didn't receive the code? Resend"}
        </button>
      </div>
    </div>
  );
}

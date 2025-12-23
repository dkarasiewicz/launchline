'use client';

import type React from 'react';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { OnboardingData } from './onboarding.interfaces';

interface EmailStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
}

export function EmailStep({ data, updateData, onNext }: EmailStepProps) {
  const [email, setEmail] = useState(data.email);
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

    // Simulate sending OTP
    await new Promise((resolve) => setTimeout(resolve, 1000));

    updateData({ email });
    onNext();
    setIsLoading(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Enter your email
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We&apos;ll send you a one-time code to verify your email.
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
          />
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
              Send verification code
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      {/* Privacy note */}
      <p className="text-center text-xs text-muted-foreground/60">
        We&apos;ll never share your email with third parties.
      </p>
    </div>
  );
}

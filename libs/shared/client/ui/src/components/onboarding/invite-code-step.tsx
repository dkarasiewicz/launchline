'use client';

import type React from 'react';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import type { OnboardingData } from './onboarding.interfaces';

// Mock valid invite codes for demo
const VALID_INVITE_CODES = ['LAUNCH2024', 'EARLY-ACCESS', 'BETA-USER', 'DEMO'];

interface InviteCodeStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
}

export function InviteCodeStep({
  data,
  updateData,
  onNext,
}: InviteCodeStepProps) {
  const [inviteCode, setInviteCode] = useState(data.inviteCode);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    const normalizedCode = inviteCode.trim().toUpperCase();
    if (VALID_INVITE_CODES.includes(normalizedCode)) {
      updateData({ inviteCode: normalizedCode });
      onNext();
    } else {
      setError('Invalid invite code. Please check and try again.');
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome to Launchline
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Enter your early access invite code to get started.
          <br />
          Don&apos;t have one?{' '}
          <a href="/" className="text-primary hover:underline">
            Request access
          </a>
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="invite-code" className="text-sm text-foreground/80">
            Invite Code
          </Label>
          <Input
            id="invite-code"
            type="text"
            placeholder="XXXX-XXXX"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="h-11 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground/50 uppercase tracking-wider text-center font-mono"
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
          disabled={!inviteCode.trim() || isLoading}
        >
          {isLoading ? (
            'Verifying...'
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      {/* Demo hint */}
      <p className="text-center text-xs text-muted-foreground/60">
        Try &quot;DEMO&quot; for testing
      </p>
    </div>
  );
}

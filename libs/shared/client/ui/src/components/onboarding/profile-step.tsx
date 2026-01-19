'use client';

import type React from 'react';

import { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { User, ArrowRight, AlertCircle } from 'lucide-react';
import type { OnboardingData } from './onboarding.interfaces';

const REDEEM_INVITE = gql`
  mutation RedeemInvite($input: RedeemWorkspaceInvitationInput!) {
    redeemInvite(input: $input)
  }
`;

interface ProfileStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
}

export function ProfileStep({ data, updateData, onNext }: ProfileStepProps) {
  const [name, setName] = useState(data.name);
  const [error, setError] = useState('');

  const [redeemInvite, { loading: isLoading }] = useMutation(REDEEM_INVITE, {
    onCompleted: () => {
      updateData({ name });
      onNext();
    },
    onError: (err) => {
      setError(
        err.message || 'Failed to complete registration. Please try again.',
      );
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!data.invite?.token) {
      setError(
        'Invalid invite. Please go back and enter your invite code again.',
      );
      return;
    }

    // Use email hint from invite, or require user to have set one
    const email = data.invite.emailHint || data.email;
    if (!email) {
      setError('Email is required to complete registration.');
      return;
    }

    redeemInvite({
      variables: {
        input: {
          token: data.invite.token,
          fullName: name.trim(),
          email,
        },
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <User className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome to {data.orgName || 'Launchline'}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Let&apos;s get you set up. What should we call you?
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm text-foreground/80">
            Your Name
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground/50"
            autoFocus
          />
        </div>

        {data.invite?.emailHint && (
          <div className="space-y-2">
            <Label className="text-sm text-foreground/80">Email</Label>
            <div className="h-11 px-3 flex items-center bg-secondary/30 border border-border/50 rounded-md text-foreground/70">
              {data.invite.emailHint}
            </div>
            <p className="text-xs text-muted-foreground">
              This email was set by your workspace admin
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="pt-2">
          <Button
            type="submit"
            className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? (
              'Setting up...'
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

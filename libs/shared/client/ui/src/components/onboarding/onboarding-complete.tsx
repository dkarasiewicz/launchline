'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { CheckCircle2, ArrowRight, Zap, AlertTriangle } from 'lucide-react';
import type { OnboardingData } from './onboarding.interfaces';

interface OnboardingCompleteProps {
  data: OnboardingData;
}

export function OnboardingComplete({ data }: OnboardingCompleteProps) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const hasIntegrations = data.connectedIntegrations.length > 0;

  return (
    <div
      className={`space-y-8 transition-all duration-500 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      {/* Success icon */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-success-muted mb-2">
          <CheckCircle2 className="w-8 h-8 text-status-success" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          You&apos;re all set, {data.name.split(' ')[0]}!
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Welcome to {data.orgName}&apos;s workspace on Launchline.
        </p>
      </div>

      {/* Summary */}
      <div className="p-4 rounded-lg bg-secondary/50 border border-border/50 space-y-3">
        <h3 className="font-medium text-sm text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Quick Summary
        </h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-status-success" />
            Account created with {data.email}
          </li>
          {data.position && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-status-success" />
              Role:{' '}
              {data.position.charAt(0).toUpperCase() +
                data.position.slice(1).replace('-', ' ')}
            </li>
          )}
          {data.connectedIntegrations.length > 0 ? (
            <li className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-status-success" />
              Connected:{' '}
              {data.connectedIntegrations
                .map((i) => i.charAt(0).toUpperCase() + i.slice(1))
                .join(', ')}
            </li>
          ) : (
            <li className="flex items-center gap-2 text-status-warning">
              <AlertTriangle className="w-4 h-4" />
              No integrations connected yet
            </li>
          )}
          {data.suggestedIntegrations.length > 0 && (
            <li className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-status-info" />
              Requested: {data.suggestedIntegrations.length} future integration
              {data.suggestedIntegrations.length !== 1 ? 's' : ''}
            </li>
          )}
        </ul>
      </div>

      {/* No integrations warning */}
      {!hasIntegrations && (
        <div className="p-4 rounded-lg bg-status-warning-muted border border-status-warning/20 space-y-2">
          <h3 className="font-medium text-sm text-status-warning-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Limited functionality
          </h3>
          <p className="text-sm text-muted-foreground">
            Without integrations, you&apos;ll see demo data. Connect Slack,
            GitHub, or Linear to unlock full features.
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="space-y-3">
        <Link href={hasIntegrations ? '/inbox' : '/app'}>
          <Button className="w-full h-11 bg-foreground text-background hover:bg-foreground/90">
            {hasIntegrations ? 'Go to your inbox' : 'Explore the dashboard'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
        {!hasIntegrations && (
          <Link href="/app?connect=true">
            <Button
              variant="outline"
              className="w-full h-11 border-border/50 text-foreground hover:bg-secondary/50 bg-transparent"
            >
              Connect integrations first
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

'use client';

import type React from 'react';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Check, ArrowRight, Plug, X } from 'lucide-react';
import type {
  OnboardingData,
  OnboardingStep,
  ConnectedIntegration,
  SkippedIntegration,
} from './onboarding.interfaces';

interface Integration {
  id: ConnectedIntegration;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notifications and updates in Slack',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
      </svg>
    ),
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Sync PRs, commits, and code changes',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Track issues, projects, and roadmaps',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3.357 3.357a1.616 1.616 0 0 0-.354 1.75l6.086 14.5a1.617 1.617 0 0 0 2.852.253l11.757-15.16a1.617 1.617 0 0 0-1.103-2.643l-17.49-1.088a1.617 1.617 0 0 0-1.748 2.388zm3.78 1.401L18.85 5.85l-9.44 12.17-4.273-10.17 2-3.091z" />
      </svg>
    ),
  },
];

interface IntegrationsStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  goToStep: (step: OnboardingStep) => void;
}

export function IntegrationsStep({
  data,
  updateData,
  onNext,
  goToStep,
}: IntegrationsStepProps) {
  const [connected, setConnected] = useState<ConnectedIntegration[]>(
    data.connectedIntegrations,
  );
  const [skipped, setSkipped] = useState<SkippedIntegration[]>(
    data.skippedIntegrations,
  );
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (integrationId: ConnectedIntegration) => {
    setConnecting(integrationId);

    // Simulate OAuth flow
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setConnected([...connected, integrationId]);
    setSkipped(skipped.filter((id) => id !== integrationId));
    setConnecting(null);
  };

  const handleSkip = (integrationId: SkippedIntegration) => {
    if (!skipped.includes(integrationId)) {
      setSkipped([...skipped, integrationId]);
    }
  };

  const handleContinue = () => {
    updateData({
      connectedIntegrations: connected,
      skippedIntegrations: skipped,
    });

    // If only 1 or less integrations connected, go to suggestions
    if (connected.length <= 1) {
      goToStep('suggestions');
    } else {
      onNext();
    }
  };

  const canContinue = connected.length >= 1 || skipped.length === 3;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <Plug className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect your tools
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Connect at least one integration to get started.
          <br />
          More integrations = more insights.
        </p>
      </div>

      {/* Integrations */}
      <div className="space-y-3">
        {INTEGRATIONS.map((integration) => {
          const isConnected = connected.includes(integration.id);
          const isSkipped = skipped.includes(integration.id);
          const isConnecting = connecting === integration.id;

          return (
            <div
              key={integration.id}
              className={`relative p-4 rounded-lg border transition-all ${
                isConnected
                  ? 'bg-status-success-muted border-status-success/30'
                  : isSkipped
                    ? 'bg-muted/30 border-border/30 opacity-60'
                    : 'bg-secondary/50 border-border/50 hover:border-border'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex-shrink-0 ${isConnected ? 'text-status-success' : 'text-foreground/70'}`}
                >
                  {integration.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground">
                    {integration.name}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {integration.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <div className="flex items-center gap-1.5 text-status-success text-sm font-medium">
                      <Check className="w-4 h-4" />
                      Connected
                    </div>
                  ) : isSkipped ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSkipped(
                          skipped.filter((id) => id !== integration.id),
                        )
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Undo
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSkip(integration.id)}
                        className="text-muted-foreground hover:text-foreground h-8 px-2"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleConnect(integration.id)}
                        disabled={isConnecting}
                        className="h-8 bg-foreground text-background hover:bg-foreground/90"
                      >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {connected.length === 0 && skipped.length < 3 && (
        <p className="text-center text-sm text-muted-foreground">
          Connect at least one integration to continue
        </p>
      )}

      {/* Continue without integrations */}
      {connected.length === 0 && skipped.length === 3 && (
        <p className="text-center text-sm text-status-warning">
          You can continue without integrations, but functionality will be
          limited.
        </p>
      )}

      {/* Continue button */}
      <Button
        onClick={handleContinue}
        className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
        disabled={!canContinue}
      >
        Continue
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>

      {/* Skip all */}
      {connected.length === 0 && skipped.length < 3 && (
        <button
          type="button"
          onClick={() => setSkipped(['slack', 'github', 'linear'])}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      )}
    </div>
  );
}

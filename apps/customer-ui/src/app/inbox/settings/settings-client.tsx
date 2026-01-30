'use client';

import type React from 'react';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { LogoIcon } from '@launchline/ui/components/logo';
import { Button } from '@launchline/ui/components/ui/button';
import { cn } from '@launchline/ui/lib/utils';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Keyboard,
  X,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const INTEGRATIONS_QUERY = gql`
  query Integrations {
    integrations {
      integrations {
        id
        type
        status
        name
        externalAccountName
        externalOrganizationName
        createdAt
        lastSyncAt
      }
    }
  }
`;

const DELETE_INTEGRATION_MUTATION = gql`
  mutation DeleteIntegration($input: DeleteIntegrationInput!) {
    deleteIntegration(input: $input)
  }
`;

type Integration = {
  id: string;
  type: string;
  status: string;
  name?: string;
  externalAccountName?: string;
  externalOrganizationName?: string;
  createdAt: string;
  lastSyncAt?: string;
};

type IntegrationDefinition = {
  type: 'linear' | 'slack' | 'github';
  name: string;
  description: string;
  icon: React.ReactNode;
  connectable: boolean;
  connectLabel: string;
};

const INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  {
    type: 'linear',
    name: 'Linear',
    description: 'Issues, projects, cycles, and blockers',
    icon: <img src="/linear.png" alt="Linear" className="w-5 h-5" />,
    connectable: true,
    connectLabel: 'Connect Linear',
  },
  {
    type: 'slack',
    name: 'Slack',
    description: 'Channel signals and threaded updates',
    icon: (
      <div className="w-5 h-5 text-[#4A154B]">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      </div>
    ),
    connectable: true,
    connectLabel: 'Connect Slack',
  },
  {
    type: 'github',
    name: 'GitHub',
    description: 'PRs, commits, and engineering signal',
    icon: <span className="text-sm font-semibold">GH</span>,
    connectable: false,
    connectLabel: 'Coming soon',
  },
];

const normalize = (value?: string) => (value || '').toLowerCase();

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState<
    'integrations' | 'preferences' | 'data'
  >('integrations');
  const [pendingDisconnectId, setPendingDisconnectId] = useState<string | null>(
    null,
  );

  const { data, loading, refetch } = useQuery<{
    integrations: { integrations: Integration[] };
  }>(INTEGRATIONS_QUERY, { fetchPolicy: 'network-only' });

  const [deleteIntegration, { loading: deleting }] = useMutation(
    DELETE_INTEGRATION_MUTATION,
  );

  const integrations = data?.integrations?.integrations ?? [];

  const integrationMap = useMemo(() => {
    return new Map(
      integrations.map((integration) => [
        normalize(integration.type),
        integration,
      ]),
    );
  }, [integrations]);

  const connectedIntegrations = INTEGRATION_DEFINITIONS.filter((definition) => {
    const integration = integrationMap.get(definition.type);
    if (!integration) return false;
    return normalize(integration.status) === 'active';
  });

  const availableIntegrations = INTEGRATION_DEFINITIONS.filter((definition) => {
    const integration = integrationMap.get(definition.type);
    return !integration || normalize(integration.status) !== 'active';
  });

  const handleConnect = (type: 'linear' | 'slack') => {
    const redirectUrl = encodeURIComponent(window.location.href);
    window.location.href = `${API_BASE}/integrations/oauth/${type}/init?redirect_url=${redirectUrl}`;
  };

  const handleDisconnect = async (integrationId: string) => {
    setPendingDisconnectId(integrationId);
    try {
      await deleteIntegration({
        variables: {
          input: { integrationId },
        },
      });
      await refetch();
    } catch (error) {
      console.error('Failed to disconnect integration:', error);
    } finally {
      setPendingDisconnectId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/inbox">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <LogoIcon className="w-6 h-6 text-foreground" />
              <h1 className="text-lg font-semibold">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex gap-1 mb-8 p-1 bg-muted/30 rounded-lg w-fit">
          {(['integrations', 'preferences', 'data'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize',
                activeTab === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'integrations' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-4">
                Connected ({connectedIntegrations.length})
              </h2>
              {loading ? (
                <div className="rounded-xl border border-border/50 bg-card/30 p-4 text-sm text-muted-foreground">
                  Loading integrations...
                </div>
              ) : connectedIntegrations.length === 0 ? (
                <div className="rounded-xl border border-border/50 bg-card/30 p-4 text-sm text-muted-foreground">
                  No integrations connected yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {connectedIntegrations.map((definition) => {
                    const integration = integrationMap.get(definition.type);
                    if (!integration) return null;

                    return (
                      <div
                        key={definition.type}
                        className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/30"
                      >
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          {definition.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{definition.name}</p>
                            <span className="text-xs text-status-success bg-status-success/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Active
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {integration.externalOrganizationName ||
                              integration.name ||
                              definition.description}
                          </p>
                          {integration.externalAccountName && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Connected as {integration.externalAccountName}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {integration.lastSyncAt && (
                            <span className="text-xs text-muted-foreground">
                              Sync{' '}
                              {new Date(
                                integration.lastSyncAt,
                              ).toLocaleDateString()}
                            </span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                definition.type === 'linear'
                                  ? 'https://linear.app'
                                  : 'https://slack.com',
                                '_blank',
                              )
                            }
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Open
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={
                              deleting || pendingDisconnectId === integration.id
                            }
                            onClick={() => handleDisconnect(integration.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-4">
                Available
              </h2>
              <div className="space-y-3">
                {availableIntegrations.map((definition) => (
                  <div
                    key={definition.type}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/30"
                  >
                    <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center">
                      {definition.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{definition.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {definition.description}
                      </p>
                    </div>
                    <div>
                      <Button
                        size="sm"
                        variant={definition.connectable ? 'default' : 'outline'}
                        disabled={!definition.connectable}
                        onClick={() =>
                          definition.connectable &&
                          handleConnect(definition.type)
                        }
                      >
                        {definition.connectLabel}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-border/50 bg-card/30">
              <h3 className="font-medium mb-2">Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Set delivery preferences for inbox alerts and weekly summaries.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-border/50 bg-card/30">
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertTriangle className="w-5 h-5" />
                <div>
                  <h3 className="font-medium text-foreground">Data controls</h3>
                  <p className="text-sm">
                    Export or delete your workspace data on request.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
          <Keyboard className="w-3.5 h-3.5" />
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded">?</kbd> to view
          inbox shortcuts
          <button
            className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => refetch()}
          >
            <X className="w-3 h-3" />
            Refresh status
          </button>
        </div>
      </main>
    </div>
  );
}

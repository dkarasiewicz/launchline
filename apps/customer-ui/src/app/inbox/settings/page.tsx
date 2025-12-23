'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogoIcon } from '@launchline/ui/components/logo';
import { Button } from '@launchline/ui/components/ui/button';
import { cn } from '@launchline/ui/lib/utils';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Keyboard,
  X,
} from 'lucide-react';

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  lastSync?: string;
  workspace?: string;
};

const INTEGRATIONS: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Receive notifications and discuss items in Slack channels',
    icon: 'S',
    connected: true,
    lastSync: '2 minutes ago',
    workspace: 'acme-team',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Track PRs, issues, and code changes',
    icon: 'G',
    connected: true,
    lastSync: '5 minutes ago',
    workspace: 'acme-org',
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Sync issues, projects, and roadmap items',
    icon: 'L',
    connected: true,
    lastSync: '1 minute ago',
    workspace: 'ACME',
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Link design files and track design changes',
    icon: 'F',
    connected: false,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Connect docs, wikis, and knowledge bases',
    icon: 'N',
    connected: false,
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Sync Jira issues and sprints',
    icon: 'J',
    connected: false,
  },
  {
    id: 'google',
    name: 'Google Workspace',
    description: 'Calendar, Docs, and Gmail integration',
    icon: 'G',
    connected: false,
  },
];

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<
    'integrations' | 'preferences' | 'data'
  >('integrations');

  const handleConnect = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              connected: true,
              lastSync: 'Just now',
              workspace: `${i.name.toLowerCase()}-workspace`,
            }
          : i,
      ),
    );
  };

  const handleDisconnect = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              connected: false,
              lastSync: undefined,
              workspace: undefined,
            }
          : i,
      ),
    );
    setShowDeleteConfirm(null);
  };

  const handleSync = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, lastSync: 'Just now' } : i)),
    );
  };

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
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

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Tabs */}
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
            {/* Connected */}
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-4">
                Connected ({connectedCount})
              </h2>
              <div className="space-y-3">
                {integrations
                  .filter((i) => i.connected)
                  .map((integration) => (
                    <div
                      key={integration.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/30"
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary">
                        {integration.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{integration.name}</p>
                          <span className="text-xs text-status-success bg-status-success/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Connected
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {integration.workspace}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Last synced: {integration.lastSync}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSync(integration.id)}
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          Sync
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDeleteConfirm(integration.id)}
                          className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            {/* Available */}
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-4">
                Available integrations
              </h2>
              <div className="space-y-3">
                {integrations
                  .filter((i) => !i.connected)
                  .map((integration) => (
                    <div
                      key={integration.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/20 hover:bg-card/40 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center text-lg font-semibold text-muted-foreground">
                        {integration.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{integration.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {integration.description}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(integration.id)}
                        className="h-9"
                      >
                        Connect
                        <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            </section>

            {/* Request Integration */}
            <div className="p-6 rounded-xl border border-dashed border-border/50 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Don't see your tool?
              </p>
              <Button variant="outline" size="sm">
                Request an integration
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-4">
                Notifications
              </h2>
              <div className="space-y-3">
                {[
                  {
                    id: 'blockers',
                    label: 'Blockers',
                    desc: 'Get notified about blocked items',
                    enabled: true,
                  },
                  {
                    id: 'drift',
                    label: 'Priority drift',
                    desc: 'Alert when priorities shift',
                    enabled: true,
                  },
                  {
                    id: 'updates',
                    label: 'Project updates',
                    desc: 'Weekly update reminders',
                    enabled: false,
                  },
                  {
                    id: 'coverage',
                    label: 'Test coverage',
                    desc: 'Coverage threshold alerts',
                    enabled: true,
                  },
                ].map((pref) => (
                  <div
                    key={pref.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/30"
                  >
                    <div>
                      <p className="font-medium">{pref.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {pref.desc}
                      </p>
                    </div>
                    <button
                      className={cn(
                        'w-11 h-6 rounded-full transition-colors relative',
                        pref.enabled ? 'bg-primary' : 'bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm',
                          pref.enabled ? 'left-6' : 'left-1',
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-4">
                Keyboard shortcuts
              </h2>
              <div className="p-4 rounded-xl border border-border/50 bg-card/30">
                <div className="flex items-center gap-3">
                  <Keyboard className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">Enable keyboard shortcuts</p>
                    <p className="text-sm text-muted-foreground">
                      Use J/K to navigate, E to resolve, Q for quick action
                    </p>
                  </div>
                  <button className="w-11 h-6 rounded-full bg-primary relative">
                    <span className="absolute top-1 left-6 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl border border-border/50 bg-card/30">
              <h2 className="font-medium mb-2">Export your data</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Download all your inbox items, activity logs, and settings as a
                JSON file.
              </p>
              <Button variant="outline" size="sm">
                Export data
              </Button>
            </div>

            <div className="p-6 rounded-xl border border-destructive/20 bg-destructive/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-medium text-destructive mb-2">
                    Danger zone
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete your account and all associated data.
                    This action cannot be undone.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 bg-transparent"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete all data
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Disconnect Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(null)}
          />
          <div className="relative bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-semibold text-lg mb-2">
              Disconnect integration?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              This will remove access to{' '}
              {integrations.find((i) => i.id === showDeleteConfirm)?.name}. You
              can reconnect anytime.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDisconnect(showDeleteConfirm)}
                className="flex-1"
              >
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

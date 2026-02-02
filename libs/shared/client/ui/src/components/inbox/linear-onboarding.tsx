'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Loader2,
  AlertTriangle,
  Plus,
  Zap,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

// GraphQL queries
const INTEGRATIONS_QUERY = gql`
  query Integrations {
    integrations {
      integrations {
        id
        type
        status
        name
        externalAccountName
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

interface Integration {
  id: string;
  type: string;
  status: string;
  name?: string;
  externalAccountName?: string;
  createdAt: string;
  lastSyncAt?: string;
}

interface LinearOnboardingProps {
  onConnected?: () => void;
}

/**
 * Linear Onboarding Component
 *
 * Shows connection status and allows user to connect/disconnect Linear.
 * Uses REST API for OAuth flow (redirects automatically).
 */
export function LinearOnboarding({ onConnected }: LinearOnboardingProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Query existing integrations
  const { data, loading, refetch } = useQuery<{
    integrations: { integrations: Integration[] };
  }>(INTEGRATIONS_QUERY);

  // Delete mutation
  const [deleteIntegration, { loading: deleting }] = useMutation(
    DELETE_INTEGRATION_MUTATION,
  );

  // Find Linear integration
  const linearIntegration = useMemo(() => {
    if (loading || !data?.integrations?.integrations) {
      return undefined;
    }

    return data.integrations.integrations.find(
      (integration) =>
        integration.type.toLowerCase() === 'linear' &&
        integration.status.toLowerCase() === 'active',
    );
  }, [data, loading]);

  // Handle OAuth connect - redirect to REST API
  const handleConnect = useCallback(() => {
    // Build redirect URL with current location
    const redirectUrl = encodeURIComponent(window.location.href);

    // Redirect to the OAuth init endpoint - it will redirect to Linear
    window.location.href = `${API_BASE}/integrations/oauth/linear/init?redirect_url=${redirectUrl}`;
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (!linearIntegration) return;

    try {
      await deleteIntegration({
        variables: {
          input: {
            integrationId: linearIntegration.id,
          },
        },
      });
      refetch();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }, [linearIntegration, deleteIntegration, refetch]);

  // Check for OAuth callback result in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const integrationId = params.get('integration_id');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (success === 'true' && integrationId) {
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
      refetch();
      onConnected?.();
    } else if (error) {
      setOauthError(errorDescription || error);
      // Clear URL params after showing error
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refetch, onConnected]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (linearIntegration) {
    return null;
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-accent/50 transition-colors">
          <Plus className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Connect Linear</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src="/linear.png" alt="Linear" className="w-5 h-5" />
            Connect Linear
          </DialogTitle>
          <DialogDescription>
            Connect your Linear workspace to get insights about blockers,
            priorities, and team workload.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {oauthError && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Connection failed</p>
                <p className="text-xs mt-0.5">{oauthError}</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Zap className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium">What you&apos;ll get</p>
                <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                  <li>• Real-time blocker detection</li>
                  <li>• Sprint progress tracking</li>
                  <li>• Team workload insights</li>
                  <li>• Priority drift alerts</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Permissions needed</p>
                <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                  <li>• Read issues, projects, and cycles</li>
                  <li>• Add comments (with your approval)</li>
                  <li>• Receive webhook events</li>
                </ul>
              </div>
            </div>
          </div>
          <Button
            onClick={handleConnect}
            className="w-full bg-violet-600 hover:bg-violet-700"
          >
            <img src="/linear.png" alt="Linear" className="w-4 h-4 mr-2" />
            Connect with Linear
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            You&apos;ll be redirected to Linear to authorize access
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact integration status indicator
 */
export function IntegrationStatus() {
  const { data, loading } = useQuery<{
    integrations: { integrations: Integration[] };
  }>(INTEGRATIONS_QUERY);

  const linearIntegration = data?.integrations?.integrations?.find(
    (i) => i.type === 'linear' && i.status === 'active',
  );

  if (loading) {
    return null;
  }

  if (linearIntegration) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Linear synced
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      No integrations
    </div>
  );
}

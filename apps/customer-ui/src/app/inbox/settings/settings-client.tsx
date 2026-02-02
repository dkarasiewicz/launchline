'use client';

import type React from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  Clock,
  Brain,
  Sparkles,
  Mail,
  CalendarDays,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

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

const LINEA_DATA_QUERY = gql`
  query LineaData {
    lineaWorkspacePrompt {
      prompt
      updatedAt
      updatedBy
      version
    }
    lineaJobs {
      jobs {
        id
        name
        type
        status
        cron
        timezone
        nextRunAt
        runAt
        task
      }
    }
    lineaMemories(input: { limit: 30 }) {
      memories {
        id
        namespace
        category
        summary
        importance
        updatedAt
      }
    }
    lineaSkills {
      skills {
        id
        name
        content
        updatedAt
      }
    }
  }
`;

const LINEA_HEARTBEAT_SETTINGS_QUERY = gql`
  query LineaHeartbeatSettings {
    lineaHeartbeatSettings {
      enabled
      summaryDelivery
      slackChannelId
      quietHoursStart
      quietHoursEnd
      timezone
      lastRunAt
      updatedAt
      updatedBy
    }
  }
`;

const UPDATE_WORKSPACE_PROMPT_MUTATION = gql`
  mutation UpdateLineaWorkspacePrompt(
    $input: UpdateLineaWorkspacePromptInput!
  ) {
    updateLineaWorkspacePrompt(input: $input) {
      prompt
      updatedAt
      updatedBy
      version
    }
  }
`;

const UPSERT_LINEA_SKILL_MUTATION = gql`
  mutation UpsertLineaSkill($input: UpsertLineaSkillInput!) {
    upsertLineaSkill(input: $input) {
      id
      name
      content
      updatedAt
    }
  }
`;

const UPDATE_LINEA_HEARTBEAT_SETTINGS_MUTATION = gql`
  mutation UpdateLineaHeartbeatSettings(
    $input: UpdateLineaHeartbeatSettingsInput!
  ) {
    updateLineaHeartbeatSettings(input: $input) {
      enabled
      summaryDelivery
      slackChannelId
      quietHoursStart
      quietHoursEnd
      timezone
      lastRunAt
      updatedAt
      updatedBy
    }
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
  type: 'linear' | 'slack' | 'github' | 'google';
  name: string;
  description: string;
  icon: React.ReactNode;
  connectable: boolean;
  connectLabel: string;
};

type LineaJob = {
  id: string;
  name: string;
  type: string;
  status: string;
  cron?: string;
  timezone?: string;
  nextRunAt?: string;
  runAt?: string;
  task?: string;
};

type LineaMemory = {
  id: string;
  namespace: string;
  category: string;
  summary: string;
  importance: number;
  updatedAt?: string;
};

type LineaSkill = {
  id: string;
  name: string;
  content: string;
  updatedAt?: string;
};

type LineaWorkspacePrompt = {
  prompt: string;
  updatedAt: string;
  updatedBy?: string;
  version: number;
};

type LineaHeartbeatSettings = {
  enabled: boolean;
  summaryDelivery: string;
  slackChannelId?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  lastRunAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

const INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  {
    type: 'slack',
    name: 'Slack',
    description: 'Primary interface for Linea (DMs, mentions, digests)',
    icon: (
      <div className="w-5 h-5 text-[#4A154B]">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      </div>
    ),
    connectable: true,
    connectLabel: 'Connect Slack (recommended)',
  },
  {
    type: 'linear',
    name: 'Linear',
    description: 'Issues, projects, cycles, and blockers',
    icon: <img src="/linear.png" alt="Linear" className="w-5 h-5" />,
    connectable: true,
    connectLabel: 'Connect Linear',
  },
  {
    type: 'google',
    name: 'Google Workspace',
    description: 'Gmail + Calendar signals for Linea',
    icon: (
      <div className="flex items-center gap-1 text-red-500">
        <Mail className="w-4 h-4" />
        <CalendarDays className="w-4 h-4 text-blue-500" />
      </div>
    ),
    connectable: true,
    connectLabel: 'Connect Google',
  },
  {
    type: 'github',
    name: 'GitHub',
    description: 'PRs, commits, and engineering signal',
    icon: <span className="text-sm font-semibold">GH</span>,
    connectable: true,
    connectLabel: 'Install GitHub App',
  },
];

const normalize = (value?: string) => (value || '').toLowerCase();

export default function SettingsClient() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<
    'integrations' | 'preferences' | 'data'
  >('integrations');
  const [pendingDisconnectId, setPendingDisconnectId] = useState<string | null>(
    null,
  );
  const [promptDraft, setPromptDraft] = useState('');
  const [promptDirty, setPromptDirty] = useState(false);
  const [memoryFilter, setMemoryFilter] = useState('all');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillName, setSkillName] = useState('');
  const [skillContent, setSkillContent] = useState('');
  const [skillDirty, setSkillDirty] = useState(false);
  const skillFileRef = useRef<HTMLInputElement | null>(null);
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(true);
  const [heartbeatDelivery, setHeartbeatDelivery] = useState<
    'inbox' | 'slack' | 'none'
  >('inbox');
  const [heartbeatSlackChannel, setHeartbeatSlackChannel] = useState('');
  const [heartbeatQuietStart, setHeartbeatQuietStart] = useState('');
  const [heartbeatQuietEnd, setHeartbeatQuietEnd] = useState('');
  const [heartbeatTimezone, setHeartbeatTimezone] = useState('UTC');
  const [heartbeatDirty, setHeartbeatDirty] = useState(false);

  const { data, loading, refetch } = useQuery<{
    integrations: { integrations: Integration[] };
  }>(INTEGRATIONS_QUERY, { fetchPolicy: 'network-only' });

  const [deleteIntegration, { loading: deleting }] = useMutation(
    DELETE_INTEGRATION_MUTATION,
  );

  const {
    data: lineaData,
    loading: lineaLoading,
    refetch: refetchLinea,
  } = useQuery<{
    lineaWorkspacePrompt?: LineaWorkspacePrompt | null;
    lineaJobs: { jobs: LineaJob[] };
    lineaMemories: { memories: LineaMemory[] };
    lineaSkills: { skills: LineaSkill[] };
  }>(LINEA_DATA_QUERY, {
    skip: activeTab !== 'data',
    fetchPolicy: 'network-only',
  });

  const [updateWorkspacePrompt, { loading: updatingPrompt }] = useMutation(
    UPDATE_WORKSPACE_PROMPT_MUTATION,
  );
  const [upsertLineaSkill, { loading: updatingSkill }] = useMutation<{
    upsertLineaSkill: {
      id: string;
      name: string;
      content: string;
    };
  }>(UPSERT_LINEA_SKILL_MUTATION);

  const {
    data: heartbeatData,
    loading: heartbeatLoading,
    refetch: refetchHeartbeat,
  } = useQuery<{
    lineaHeartbeatSettings: LineaHeartbeatSettings;
  }>(LINEA_HEARTBEAT_SETTINGS_QUERY, {
    skip: activeTab !== 'preferences',
    fetchPolicy: 'network-only',
  });

  const [updateHeartbeatSettings, { loading: updatingHeartbeat }] = useMutation(
    UPDATE_LINEA_HEARTBEAT_SETTINGS_MUTATION,
  );

  const integrations = data?.integrations?.integrations ?? [];
  const jobs = lineaData?.lineaJobs?.jobs ?? [];
  const memories = lineaData?.lineaMemories?.memories ?? [];
  const skills = lineaData?.lineaSkills?.skills ?? [];
  const promptRecord = lineaData?.lineaWorkspacePrompt ?? null;
  const heartbeatSettings = heartbeatData?.lineaHeartbeatSettings;

  const sortedJobs = useMemo(() => {
    const uniqueJobs = new Map<string, LineaJob>();

    for (const job of jobs) {
      const rawId = job.id || '';
      const idParts = rawId.split(':');
      const baseId =
        idParts[0] === 'repeat' || idParts[0] === 'scheduled'
          ? idParts[1] || rawId
          : rawId;
      const fallbackKey = [
        job.name,
        job.type,
        job.task || '',
        job.cron || '',
      ].join(':');
      const key = baseId || fallbackKey;
      const existing = uniqueJobs.get(key);

      if (!existing) {
        uniqueJobs.set(key, job);
        continue;
      }

      const scoreJob = (candidate: LineaJob) => {
        const status = candidate.status?.toLowerCase();
        const statusScore =
          status === 'repeatable'
            ? 3
            : status === 'active' || status === 'waiting'
              ? 2
              : status === 'delayed'
                ? 1
                : 0;
        const scheduleScore =
          (candidate.nextRunAt ? 1 : 0) +
          (candidate.cron ? 0.5 : 0) +
          (candidate.runAt ? 0.25 : 0);

        return statusScore + scheduleScore;
      };

      if (scoreJob(job) > scoreJob(existing)) {
        uniqueJobs.set(key, job);
      }
    }

    return Array.from(uniqueJobs.values()).sort((a, b) => {
      const aTime = a.nextRunAt
        ? new Date(a.nextRunAt).getTime()
        : a.runAt
          ? new Date(a.runAt).getTime()
          : Number.POSITIVE_INFINITY;
      const bTime = b.nextRunAt
        ? new Date(b.nextRunAt).getTime()
        : b.runAt
          ? new Date(b.runAt).getTime()
          : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
  }, [jobs]);

  const memoryNamespaces = useMemo(() => {
    const set = new Set(memories.map((memory) => memory.namespace));
    return ['all', ...Array.from(set).sort()];
  }, [memories]);

  const visibleMemories = useMemo(() => {
    if (memoryFilter === 'all') {
      return memories;
    }

    return memories.filter((memory) => memory.namespace === memoryFilter);
  }, [memories, memoryFilter]);

  useEffect(() => {
    if (!promptDirty && promptRecord?.prompt) {
      setPromptDraft(promptRecord.prompt);
    }
  }, [promptRecord, promptDirty]);

  useEffect(() => {
    if (heartbeatDirty || !heartbeatSettings) {
      return;
    }

    const delivery = (
      heartbeatSettings.summaryDelivery || 'INBOX'
    ).toLowerCase() as 'inbox' | 'slack' | 'none';

    setHeartbeatEnabled(Boolean(heartbeatSettings.enabled));
    setHeartbeatDelivery(delivery);
    setHeartbeatSlackChannel(heartbeatSettings.slackChannelId || '');
    setHeartbeatQuietStart(heartbeatSettings.quietHoursStart || '');
    setHeartbeatQuietEnd(heartbeatSettings.quietHoursEnd || '');
    setHeartbeatTimezone(heartbeatSettings.timezone || 'UTC');
  }, [heartbeatDirty, heartbeatSettings]);

  useEffect(() => {
    if (skillDirty) {
      return;
    }

    if (selectedSkillId) {
      const match = skills.find((skill) => skill.id === selectedSkillId);
      if (match) {
        setSkillName(match.name);
        setSkillContent(match.content);
      }
      return;
    }

    if (!skillName && !skillContent && skills.length > 0) {
      const first = skills[0];
      setSelectedSkillId(first.id);
      setSkillName(first.name);
      setSkillContent(first.content);
    }
  }, [skills, selectedSkillId, skillDirty, skillName, skillContent]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (!tabParam) {
      return;
    }

    if (
      tabParam === 'integrations' ||
      tabParam === 'preferences' ||
      tabParam === 'data'
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

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

  const handleConnect = (type: 'linear' | 'slack' | 'google' | 'github') => {
    const redirectUrl = encodeURIComponent(window.location.href);
    const slackTeam = searchParams.get('slack_team');
    const slackParam =
      type === 'slack' && slackTeam
        ? `&team=${encodeURIComponent(slackTeam)}`
        : '';
    window.location.href = `${API_BASE}/integrations/oauth/${type}/init?redirect_url=${redirectUrl}${slackParam}`;
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

  const handleSavePrompt = async () => {
    if (!promptDraft.trim()) {
      return;
    }

    try {
      await updateWorkspacePrompt({
        variables: {
          input: { prompt: promptDraft.trim() },
        },
      });
      setPromptDirty(false);
      await refetchLinea();
    } catch (error) {
      console.error('Failed to update workspace prompt:', error);
    }
  };

  const handleSelectSkill = (skill: LineaSkill) => {
    setSelectedSkillId(skill.id);
    setSkillName(skill.name);
    setSkillContent(skill.content);
    setSkillDirty(false);
  };

  const handleNewSkill = () => {
    setSelectedSkillId(null);
    setSkillName('');
    setSkillContent('');
    setSkillDirty(true);
  };

  const handleSaveSkill = async () => {
    if (!skillName.trim() || !skillContent.trim()) {
      return;
    }

    try {
      const response = await upsertLineaSkill({
        variables: {
          input: {
            id: selectedSkillId || undefined,
            name: skillName.trim(),
            content: skillContent.trim(),
          },
        },
      });

      const updated = response.data?.upsertLineaSkill;
      if (updated) {
        setSelectedSkillId(updated.id);
        setSkillName(updated.name);
        setSkillContent(updated.content);
      }

      setSkillDirty(false);
      await refetchLinea();
    } catch (error) {
      console.error('Failed to save skill:', error);
    }
  };

  const handleSaveHeartbeat = async () => {
    try {
      await updateHeartbeatSettings({
        variables: {
          input: {
            enabled: heartbeatEnabled,
            summaryDelivery: heartbeatDelivery.toUpperCase(),
            slackChannelId: heartbeatSlackChannel.trim() || null,
            quietHoursStart: heartbeatQuietStart.trim() || null,
            quietHoursEnd: heartbeatQuietEnd.trim() || null,
            timezone: heartbeatTimezone.trim() || null,
          },
        },
      });
      setHeartbeatDirty(false);
      await refetchHeartbeat();
    } catch (error) {
      console.error('Failed to update heartbeat settings:', error);
    }
  };

  const handleSkillFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const content = await file.text();
    const name = file.name.replace(/\.[^/.]+$/, '');

    setSelectedSkillId(null);
    setSkillName(name);
    setSkillContent(content);
    setSkillDirty(true);

    if (skillFileRef.current) {
      skillFileRef.current.value = '';
    }
  };

  const handleRefresh = async () => {
    await refetch();
    if (activeTab === 'data') {
      await refetchLinea();
    }
    if (activeTab === 'preferences') {
      await refetchHeartbeat();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-4">
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

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-56 flex-shrink-0">
            <div className="rounded-2xl border border-border/50 bg-card/40 p-2">
              <p className="px-3 pt-3 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Settings
              </p>
              <div className="flex flex-col gap-1">
                {(['integrations', 'preferences', 'data'] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm font-medium rounded-xl transition-colors capitalize',
                        activeTab === tab
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      )}
                    >
                      {tab}
                    </button>
                  ),
                )}
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
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
                            className="flex flex-col gap-4 p-4 rounded-xl border border-border/50 bg-card/30 lg:flex-row lg:items-center"
                          >
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                              {definition.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
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
                            <div className="flex flex-wrap items-center gap-2">
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
                                      : definition.type === 'google'
                                        ? 'https://mail.google.com'
                                        : definition.type === 'github'
                                          ? 'https://github.com'
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
                                  deleting ||
                                  pendingDisconnectId === integration.id
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
                        className="flex flex-col gap-4 p-4 rounded-xl border border-border/50 bg-card/30 lg:flex-row lg:items-center"
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
                            variant={
                              definition.connectable ? 'default' : 'outline'
                            }
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
                <div className="rounded-2xl border border-border/50 bg-card/30 p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-status-info" />
                    <div>
                      <h3 className="font-medium text-foreground">
                        Heartbeat settings
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Linea checks your workspace every 30 minutes and reports
                        new signals.
                      </p>
                    </div>
                  </div>

                  {heartbeatLoading && !heartbeatSettings ? (
                    <p className="text-sm text-muted-foreground">
                      Loading heartbeat settings...
                    </p>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <label className="flex items-center justify-between rounded-lg border border-border/40 bg-background/60 px-4 py-3 text-sm">
                          <span className="font-medium text-foreground">
                            Enable heartbeat
                          </span>
                          <input
                            type="checkbox"
                            checked={heartbeatEnabled}
                            onChange={(event) => {
                              setHeartbeatEnabled(event.target.checked);
                              setHeartbeatDirty(true);
                            }}
                            className="h-4 w-4 accent-foreground"
                          />
                        </label>

                        <div className="rounded-lg border border-border/40 bg-background/60 px-4 py-3 text-sm space-y-2">
                          <p className="font-medium text-foreground">
                            Summary delivery
                          </p>
                          <select
                            value={heartbeatDelivery}
                            onChange={(event) => {
                              setHeartbeatDelivery(
                                event.target.value as
                                  | 'inbox'
                                  | 'slack'
                                  | 'none',
                              );
                              setHeartbeatDirty(true);
                            }}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          >
                            <option value="inbox">Inbox update</option>
                            <option value="slack">Slack channel</option>
                            <option value="none">
                              No summary (actionable only)
                            </option>
                          </select>
                          {heartbeatDelivery === 'slack' && (
                            <input
                              type="text"
                              value={heartbeatSlackChannel}
                              onChange={(event) => {
                                setHeartbeatSlackChannel(event.target.value);
                                setHeartbeatDirty(true);
                              }}
                              placeholder="Slack channel ID (e.g. C0123...)"
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            />
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-lg border border-border/40 bg-background/60 px-4 py-3 text-sm space-y-2">
                          <p className="font-medium text-foreground">
                            Quiet hours
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="time"
                              value={heartbeatQuietStart}
                              onChange={(event) => {
                                setHeartbeatQuietStart(event.target.value);
                                setHeartbeatDirty(true);
                              }}
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            />
                            <input
                              type="time"
                              value={heartbeatQuietEnd}
                              onChange={(event) => {
                                setHeartbeatQuietEnd(event.target.value);
                                setHeartbeatDirty(true);
                              }}
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                            />
                          </div>
                          <input
                            type="text"
                            value={heartbeatTimezone}
                            onChange={(event) => {
                              setHeartbeatTimezone(event.target.value);
                              setHeartbeatDirty(true);
                            }}
                            placeholder="Timezone (e.g. America/Los_Angeles)"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          />
                          {heartbeatSettings?.lastRunAt && (
                            <p className="text-xs text-muted-foreground">
                              Last run:{' '}
                              {new Date(
                                heartbeatSettings.lastRunAt,
                              ).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {heartbeatSettings?.updatedAt && (
                      <span>
                        Updated{' '}
                        {new Date(heartbeatSettings.updatedAt).toLocaleString()}
                      </span>
                    )}
                    {heartbeatSettings?.updatedBy && (
                      <span>By {heartbeatSettings.updatedBy}</span>
                    )}
                    <Button
                      size="sm"
                      className="ml-auto"
                      disabled={updatingHeartbeat || !heartbeatDirty}
                      onClick={handleSaveHeartbeat}
                    >
                      Save heartbeat settings
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-8">
                <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Brain className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-widest">
                          Agent control center
                        </span>
                      </div>
                      <h2 className="text-lg font-semibold text-foreground">
                        Linea workspace intelligence
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                        Review the workspace prompt, active jobs, and memory
                        store. This is Linea&apos;s operating context for your
                        team.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/inbox/team">
                        <Button size="sm" variant="ghost">
                          View team map
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void refetchLinea()}
                      >
                        Refresh agent data
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                      <p className="text-xs text-muted-foreground">
                        Scheduled jobs
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        {jobs.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Heartbeat + recurring tasks
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                      <p className="text-xs text-muted-foreground">Memories</p>
                      <p className="text-lg font-semibold text-foreground">
                        {memories.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Team, decisions, blockers
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                      <p className="text-xs text-muted-foreground">Skills</p>
                      <p className="text-lg font-semibold text-foreground">
                        {skills.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Workspace playbooks
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-background/70 p-4">
                      <p className="text-xs text-muted-foreground">
                        Prompt version
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        {promptRecord?.version ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last updated{' '}
                        {promptRecord?.updatedAt
                          ? new Date(
                              promptRecord.updatedAt,
                            ).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border/50 bg-card/30 p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <Brain className="w-4 h-4 text-accent" />
                      <div>
                        <h3 className="font-medium text-foreground">
                          Workspace prompt
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Guardrails and preferences for Linea in this
                          workspace.
                        </p>
                      </div>
                    </div>

                    {lineaLoading && !promptRecord ? (
                      <p className="text-sm text-muted-foreground">
                        Loading workspace prompt...
                      </p>
                    ) : (
                      <>
                        <textarea
                          className="w-full min-h-[160px] rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                          placeholder="Add instructions for Linea..."
                          value={promptDraft}
                          onChange={(event) => {
                            setPromptDraft(event.target.value);
                            setPromptDirty(true);
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {promptRecord && (
                            <span>
                              v{promptRecord.version} • Updated{' '}
                              {new Date(
                                promptRecord.updatedAt,
                              ).toLocaleString()}
                            </span>
                          )}
                          {promptRecord?.updatedBy && (
                            <span>By {promptRecord.updatedBy}</span>
                          )}
                          <Button
                            size="sm"
                            className="ml-auto"
                            disabled={updatingPrompt || !promptDraft.trim()}
                            onClick={handleSavePrompt}
                          >
                            Save instructions
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-card/30 p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-status-info" />
                      <div>
                        <h3 className="font-medium text-foreground">
                          Scheduled tasks
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Heartbeats and recurring jobs for this workspace.
                        </p>
                      </div>
                    </div>

                    {lineaLoading && jobs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Loading scheduled tasks...
                      </p>
                    ) : jobs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No tasks scheduled yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {sortedJobs.map((job) => {
                          const title =
                            job.task ||
                            (job.type === 'heartbeat' ? 'Heartbeat' : job.name);

                          return (
                            <div
                              key={job.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/60 px-4 py-3 text-sm"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {job.type} • {job.status}
                                </p>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {job.nextRunAt
                                  ? `Next: ${new Date(job.nextRunAt).toLocaleString()}`
                                  : job.runAt
                                    ? `Runs: ${new Date(job.runAt).toLocaleString()}`
                                    : job.cron
                                      ? `Cron: ${job.cron}`
                                      : 'On demand'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/30 p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-status-success" />
                    <div>
                      <h3 className="font-medium text-foreground">
                        Agent skills
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Upload workspace playbooks. Skills mount in sandbox at
                        /workspace/skills.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <div className="space-y-2">
                      {skills.length === 0 ? (
                        <div className="rounded-lg border border-border/40 bg-background/60 p-4 text-sm text-muted-foreground">
                          No skills yet. Upload a markdown file to create one.
                        </div>
                      ) : (
                        skills.map((skill) => {
                          const isActive = skill.id === selectedSkillId;
                          return (
                            <button
                              key={skill.id}
                              onClick={() => handleSelectSkill(skill)}
                              className={cn(
                                'w-full text-left rounded-lg border px-4 py-3 transition-colors',
                                isActive
                                  ? 'border-foreground/30 bg-foreground/5'
                                  : 'border-border/40 bg-background/60 hover:border-foreground/20',
                              )}
                            >
                              <p className="text-sm font-medium text-foreground">
                                {skill.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Updated{' '}
                                {skill.updatedAt
                                  ? new Date(
                                      skill.updatedAt,
                                    ).toLocaleDateString()
                                  : 'just now'}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="rounded-lg border border-border/40 bg-background/60 p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {selectedSkillId ? 'Edit skill' : 'New skill'}
                        </p>
                        <div className="ml-auto flex flex-wrap gap-2">
                          <input
                            ref={skillFileRef}
                            type="file"
                            accept=".md,text/markdown"
                            className="hidden"
                            onChange={handleSkillFileUpload}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => skillFileRef.current?.click()}
                          >
                            Upload .md
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleNewSkill}
                          >
                            New
                          </Button>
                          <Button
                            size="sm"
                            disabled={
                              updatingSkill ||
                              !skillName.trim() ||
                              !skillContent.trim()
                            }
                            onClick={handleSaveSkill}
                          >
                            Save skill
                          </Button>
                        </div>
                      </div>

                      <input
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="Skill name"
                        value={skillName}
                        onChange={(event) => {
                          setSkillName(event.target.value);
                          setSkillDirty(true);
                        }}
                      />
                      <textarea
                        className="w-full min-h-[180px] rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                        placeholder="Describe the workflow, commands, and safeguards..."
                        value={skillContent}
                        onChange={(event) => {
                          setSkillContent(event.target.value);
                          setSkillDirty(true);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Skills are markdown instructions that Linea can run
                        inside a sandboxed container.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/30 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-accent/50" />
                      <div>
                        <h3 className="font-medium text-foreground">
                          Memory snapshot
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          What Linea currently remembers about your team.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {memoryNamespaces.map((namespace) => (
                        <button
                          key={namespace}
                          onClick={() => setMemoryFilter(namespace)}
                          className={cn(
                            'rounded-full px-3 py-1 text-xs capitalize transition-colors',
                            memoryFilter === namespace
                              ? 'bg-foreground text-background'
                              : 'bg-muted/60 text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {namespace.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {lineaLoading && memories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Loading memories...
                    </p>
                  ) : memories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No memories yet. Connect integrations to start learning.
                    </p>
                  ) : visibleMemories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No memories in this namespace yet.
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {visibleMemories.map((memory) => (
                        <div
                          key={memory.id}
                          className="rounded-lg border border-border/40 bg-background/60 px-4 py-3"
                        >
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>
                              {memory.namespace} • {memory.category}
                            </span>
                            <span>
                              {memory.updatedAt
                                ? new Date(
                                    memory.updatedAt,
                                  ).toLocaleDateString()
                                : ''}
                            </span>
                          </div>
                          <p className="text-sm text-foreground">
                            {memory.summary}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Importance: {memory.importance.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/30 p-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <AlertTriangle className="w-5 h-5" />
                    <div>
                      <h3 className="font-medium text-foreground">
                        Data controls
                      </h3>
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
              Press <kbd className="px-1.5 py-0.5 bg-muted rounded">?</kbd> to
              view inbox shortcuts
              <button
                className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
                onClick={handleRefresh}
              >
                <X className="w-3 h-3" />
                Refresh status
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

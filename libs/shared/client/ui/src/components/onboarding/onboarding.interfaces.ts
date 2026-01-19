export type OnboardingStep =
  | 'invite-code'
  | 'profile'
  | 'email'
  | 'otp'
  | 'integrations'
  | 'suggestions'
  | 'complete';

export type ConnectedIntegration = 'slack' | 'github' | 'linear';
export type SkippedIntegration = 'slack' | 'github' | 'linear';

export interface WorkspaceInviteData {
  token: string;
  workspaceId: string;
  workspaceName?: string;
  role: string;
  emailHint?: string;
  expiresAt: string;
}

export interface OnboardingData {
  inviteCode: string;
  invite?: WorkspaceInviteData;
  email: string;
  name: string;
  orgName: string;
  position: string;
  connectedIntegrations: ConnectedIntegration[];
  skippedIntegrations: SkippedIntegration[];
  suggestedIntegrations: string[];
}

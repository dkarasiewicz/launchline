export type OnboardingStep =
  | 'invite-code'
  | 'email'
  | 'otp'
  | 'profile'
  | 'integrations'
  | 'suggestions'
  | 'complete';

export type ConnectedIntegration = 'slack' | 'github' | 'linear';
export type SkippedIntegration = 'slack' | 'github' | 'linear';

export interface OnboardingData {
  inviteCode: string;
  email: string;
  name: string;
  orgName: string;
  position: string;
  connectedIntegrations: ConnectedIntegration[];
  skippedIntegrations: SkippedIntegration[];
  suggestedIntegrations: string[];
}

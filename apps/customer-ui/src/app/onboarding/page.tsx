'use client';

import { useState } from 'react';
import { InviteCodeStep } from '@launchline/ui/components/onboarding/invite-code-step';
import { EmailStep } from '@launchline/ui/components/onboarding/email-step';
import { OtpStep } from '@launchline/ui/components/onboarding/otp-step';
import { ProfileStep } from '@launchline/ui/components/onboarding/profile-step';
import { IntegrationsStep } from '@launchline/ui/components/onboarding/integrations-step';
import { IntegrationSuggestionsStep } from '@launchline/ui/components/onboarding/integration-suggestions-step';
import { OnboardingComplete } from '@launchline/ui/components/onboarding/onboarding-complete';
import {
  OnboardingData,
  OnboardingStep,
} from '@launchline/ui/components/onboarding/onboarding.interfaces';

export default function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>('invite-code');
  const [data, setData] = useState<OnboardingData>({
    inviteCode: '',
    email: '',
    name: '',
    orgName: '',
    position: '',
    connectedIntegrations: [],
    skippedIntegrations: [],
    suggestedIntegrations: [],
  });

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    const steps: OnboardingStep[] = [
      'invite-code',
      'email',
      'otp',
      'profile',
      'integrations',
      'suggestions',
      'complete',
    ];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const goToStep = (targetStep: OnboardingStep) => {
    setStep(targetStep);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {step === 'invite-code' && (
          <InviteCodeStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
          />
        )}
        {step === 'email' && (
          <EmailStep data={data} updateData={updateData} onNext={nextStep} />
        )}
        {step === 'otp' && (
          <OtpStep data={data} updateData={updateData} onNext={nextStep} />
        )}
        {step === 'profile' && (
          <ProfileStep data={data} updateData={updateData} onNext={nextStep} />
        )}
        {step === 'integrations' && (
          <IntegrationsStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
            goToStep={goToStep}
          />
        )}
        {step === 'suggestions' && (
          <IntegrationSuggestionsStep
            data={data}
            updateData={updateData}
            onNext={nextStep}
          />
        )}
        {step === 'complete' && <OnboardingComplete data={data} />}
      </div>
    </div>
  );
}

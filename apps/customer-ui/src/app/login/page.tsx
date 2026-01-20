'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EmailStep } from '@launchline/ui/components/onboarding/email-step';
import { OtpStep } from '@launchline/ui/components/onboarding/otp-step';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

type LoginStep = 'email' | 'otp';

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');

  const handleBack = () => {
    setStep('email');
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {step === 'email' && (
          <div className="space-y-8">
            <EmailStep
              initialEmail={email}
              onEmailChange={setEmail}
              onNext={() => setStep('otp')}
              apiBaseUrl={API_BASE_URL}
            />

            {/* Sign up link */}
            <div className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link
                href="/onboarding"
                className="text-foreground hover:underline"
              >
                Get started
              </Link>
            </div>
          </div>
        )}

        {step === 'otp' && (
          <OtpStep
            email={email}
            onNext={() => {
              /* empty */
            }}
            apiBaseUrl={API_BASE_URL}
            redirectTo="/inbox"
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}

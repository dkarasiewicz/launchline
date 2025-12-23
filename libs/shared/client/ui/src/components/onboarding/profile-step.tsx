'use client';

import type React from 'react';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { User, ArrowRight, Building2 } from 'lucide-react';
import type { OnboardingData } from './onboarding.interfaces';

const POSITIONS = [
  { value: 'ceo', label: 'CEO / Founder' },
  { value: 'cto', label: 'CTO / Technical Lead' },
  { value: 'cpo', label: 'CPO / Head of Product' },
  { value: 'pm', label: 'Product Manager' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'designer', label: 'Designer' },
  { value: 'other', label: 'Other' },
];

interface ProfileStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
}

export function ProfileStep({ data, updateData, onNext }: ProfileStepProps) {
  const [name, setName] = useState(data.name);
  const [orgName, setOrgName] = useState(data.orgName);
  const [position, setPosition] = useState(data.position);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    updateData({ name, orgName, position });
    onNext();
    setIsLoading(false);
  };

  const isValid = name.trim() && orgName.trim();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
          <User className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tell us about yourself
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We&apos;ll personalize your experience based on your role.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm text-foreground/80">
            Your Name
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground/50"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-name" className="text-sm text-foreground/80">
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Organization Name
            </span>
          </Label>
          <Input
            id="org-name"
            type="text"
            placeholder="Acme Inc."
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="h-11 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="position" className="text-sm text-foreground/80">
            Your Role{' '}
            <span className="text-muted-foreground/60">(optional)</span>
          </Label>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger className="h-11 bg-secondary/50 border-border/50 text-foreground">
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              {POSITIONS.map((pos) => (
                <SelectItem key={pos.value} value={pos.value}>
                  {pos.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              'Saving...'
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

'use client';

import type React from 'react';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { ArrowRight, Lightbulb, Sparkles } from 'lucide-react';
import type { OnboardingData } from './onboarding.interfaces';

interface SuggestedIntegration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  popular?: boolean;
}

const SUGGESTED_INTEGRATIONS: SuggestedIntegration[] = [
  {
    id: 'figma',
    name: 'Figma',
    description: 'Design files and prototypes',
    popular: true,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zM8.148 24c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v4.49c0 2.476-2.013 4.49-4.588 4.49zm0-7.51h3.117c1.665 0 3.019 1.355 3.019 3.02s-1.354 3.019-3.019 3.019-3.019-1.355-3.019-3.019l-.098-3.02zM8.148 8.981c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981H8.148zm0-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zM8.172 15.019c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.564v8.981H8.172zm0-7.509c-1.665 0-3.019 1.354-3.019 3.019s1.354 3.019 3.019 3.019h3.093V7.51H8.172zM15.852 15.019h-4.588V6.038h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zm-3.117-7.51v5.981h3.117c1.665 0 3.019-1.354 3.019-3.019 0-1.665-1.355-2.962-3.019-2.962h-3.117z" />
      </svg>
    ),
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Project and issue tracking',
    popular: true,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z" />
      </svg>
    ),
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Docs, wikis, and notes',
    popular: true,
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.933.653.933 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.448-1.632z" />
      </svg>
    ),
  },
  {
    id: 'google-docs',
    name: 'Google Docs',
    description: 'Documents and spreadsheets',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6zm-.545 10.455H7.09v-1.364h7.09v1.364zm2.727-3.273H7.091v-1.364h9.818v1.364zm0-3.273H7.091V9.273h9.818v1.363zM14.727 6h6l-6-6v6z" />
      </svg>
    ),
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Meetings and schedules',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
      </svg>
    ),
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Gmail, Outlook integration',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
      </svg>
    ),
  },
  {
    id: 'confluence',
    name: 'Confluence',
    description: 'Team wiki and documentation',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M.87 18.257c-.248.382-.53.875-.763 1.245a.764.764 0 0 0 .255 1.04l4.965 3.054a.764.764 0 0 0 1.058-.26c.199-.332.454-.763.733-1.221 1.967-3.247 3.945-2.853 7.508-1.146l4.957 2.378a.764.764 0 0 0 1.028-.382l2.14-4.892a.764.764 0 0 0-.382-1.022c-1.402-.67-4.143-1.98-6.262-2.994C9.16 11.058 4.015 12.215.87 18.257zm22.26-12.514c.249-.382.531-.875.764-1.245a.764.764 0 0 0-.256-1.04L18.673.404a.764.764 0 0 0-1.058.26c-.199.332-.454.763-.733 1.221-1.967 3.247-3.945 2.853-7.508 1.146L4.417.653a.764.764 0 0 0-1.028.382l-2.14 4.892a.764.764 0 0 0 .382 1.022c1.402.67 4.143 1.98 6.262 2.994 6.948 2.999 12.093 1.842 15.238-4.2z" />
      </svg>
    ),
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Task and project management',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.78 12.653c-2.882 0-5.22 2.336-5.22 5.218s2.338 5.218 5.22 5.218 5.22-2.336 5.22-5.218-2.338-5.218-5.22-5.218zm-13.56 0c-2.882 0-5.22 2.336-5.22 5.218s2.338 5.218 5.22 5.218 5.22-2.336 5.22-5.218-2.338-5.218-5.22-5.218zM12 1.911c-2.882 0-5.22 2.336-5.22 5.218s2.338 5.218 5.22 5.218 5.22-2.336 5.22-5.218S14.882 1.91 12 1.91z" />
      </svg>
    ),
  },
];

interface IntegrationSuggestionsStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
}

export function IntegrationSuggestionsStep({
  data,
  updateData,
  onNext,
}: IntegrationSuggestionsStepProps) {
  const [selected, setSelected] = useState<string[]>(
    data.suggestedIntegrations,
  );

  const toggleIntegration = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleContinue = () => {
    updateData({ suggestedIntegrations: selected });
    onNext();
  };

  const connectedCount = data.connectedIntegrations.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-status-warning-muted mb-2">
          <Lightbulb className="w-6 h-6 text-status-warning" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {connectedCount === 0
            ? 'What tools do you use?'
            : 'Want to add more integrations?'}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {connectedCount === 0
            ? "Let us know what you'd like to connect. We'll notify you when they're available."
            : 'More integrations give you a complete view of your product development.'}
        </p>
      </div>

      {/* Encouragement badge */}
      {connectedCount === 1 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-status-info-muted border border-status-info/20">
          <Sparkles className="w-4 h-4 text-status-info flex-shrink-0" />
          <p className="text-sm text-status-info-foreground">
            Teams with 2+ integrations see 3x more insights
          </p>
        </div>
      )}

      {/* Integration grid */}
      <div className="grid grid-cols-2 gap-3">
        {SUGGESTED_INTEGRATIONS.map((integration) => {
          const isSelected = selected.includes(integration.id);
          return (
            <button
              key={integration.id}
              type="button"
              onClick={() => toggleIntegration(integration.id)}
              className={`relative p-3 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-secondary/30 border-border/50 hover:border-border'
              }`}
            >
              {integration.popular && (
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] font-medium bg-status-warning text-background rounded">
                  Popular
                </span>
              )}
              <div className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 mt-0.5 ${isSelected ? 'text-primary' : 'text-foreground/60'}`}
                >
                  {integration.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-foreground">
                    {integration.name}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {integration.description}
                  </p>
                </div>
                <Checkbox checked={isSelected} className="mt-0.5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected count */}
      {selected.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {selected.length} integration{selected.length !== 1 ? 's' : ''}{' '}
          selected
        </p>
      )}

      {/* Continue */}
      <div className="space-y-3">
        <Button
          onClick={handleContinue}
          className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
        >
          {selected.length > 0 ? 'Continue' : 'Skip for now'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

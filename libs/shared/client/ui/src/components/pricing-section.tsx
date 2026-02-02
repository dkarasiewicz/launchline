import Link from 'next/link';
import { Button } from './ui/button';
import { ArrowRight, Sparkles, Check } from 'lucide-react';

const earlyAccessFeatures = [
  'Autonomous heartbeat & inbox',
  'Slack-first interface',
  'Linear + Google context',
  'Team map + collaboration insights',
  'Workspace memory & decisions',
  'Priority support & feedback channel',
  'Shape the product roadmap',
];

export function PricingSection() {
  return (
    <section id="cta" className="py-24 bg-background">
      <div className="mx-auto max-w-2xl px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-medium text-muted-foreground/80 mb-4 uppercase tracking-widest">
            Early Access
          </p>
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground mb-4">
            Join the founding users
          </h2>
          <p className="text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            We're onboarding a small group of teams who want an autonomous,
            transparent copilot with guardrails. Limited spots available.
          </p>
        </div>

        {/* Early Adopters Card */}
        <div className="p-6 rounded-xl border border-accent/40 bg-accent/5 ring-1 ring-accent/20 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="text-base font-medium text-foreground">
                Early Adopters
              </h3>
              <p className="text-xs text-muted-foreground">
                Founding member pricing
              </p>
            </div>
          </div>

          <ul className="space-y-2.5 mb-6">
            {earlyAccessFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2.5 text-sm text-muted-foreground"
              >
                <Check className="h-4 w-4 text-accent shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="mailto:dawid@launchline.dev"
              className="w-full sm:w-auto"
            >
              <Button
                size="lg"
                className="w-full h-11 px-6 text-sm bg-accent text-accent-foreground hover:bg-accent/90 border-0"
              >
                Request Early Access
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/onboarding" className="w-full sm:w-auto">
              <Button
                variant="ghost"
                size="lg"
                className="w-full h-11 px-6 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              >
                Try Demo First
              </Button>
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/70">
          Full pricing tiers coming soon. Early adopters lock in
          founder-friendly rates.
        </p>
      </div>
    </section>
  );
}

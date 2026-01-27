import { Inbox, Brain, Sparkles, ChevronRight } from 'lucide-react';

const stages = [
  {
    label: 'Today',
    title: 'Execution inbox',
    description: 'Captures blockers, risks, and decisions across tools.',
    icon: Inbox,
    active: true,
  },
  {
    label: 'Next',
    title: 'Product memory',
    description:
      'Understands how your team, product, and users behave over time.',
    icon: Brain,
    active: false,
  },
  {
    label: 'Eventually',
    title: 'Product copilot',
    description: 'Helps steer priorities and tradeoffs - grounded in reality.',
    icon: Sparkles,
    active: false,
  },
];

export function VisionSection() {
  return (
    <section className="py-24 bg-background">
      <div className="mx-auto max-w-4xl px-6">
        {/* Frame shift */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium text-muted-foreground/80 mb-6 uppercase tracking-widest">
            The bigger picture
          </p>
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground mb-6">
            Product work is becoming too complex
            <br />
            <span className="text-muted-foreground">for humans alone</span>
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Products today are built across dozens of tools, teams, and
            decisions. PMs are expected to keep everything aligned - but the
            system itself doesn't learn. Launchline is building the missing
            layer: a product copilot that understands{' '}
            <span className="text-accent">context</span>,{' '}
            <span className="text-status-info">history</span>, and{' '}
            <span className="text-status-success">tradeoffs</span> - not just
            tickets.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-stretch gap-3 md:gap-0">
          {stages.map((stage, index) => (
            <div key={stage.label} className="flex-1 flex items-center">
              {/* Card - Using semantic tokens */}
              <div
                className={`flex-1 p-5 rounded-xl border transition-all ${
                  stage.active
                    ? 'border-accent/40 bg-accent/10 ring-1 ring-accent/30'
                    : index === 1
                      ? 'border-status-info/30 bg-status-info/10'
                      : 'border-border bg-card/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-[10px] font-medium uppercase tracking-widest ${
                      stage.active
                        ? 'text-accent'
                        : index === 1
                          ? 'text-status-info'
                          : 'text-muted-foreground/80'
                    }`}
                  >
                    {stage.label}
                  </span>
                  {stage.active && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      stage.active
                        ? 'bg-accent/15'
                        : index === 1
                          ? 'bg-status-info/15'
                          : 'bg-secondary'
                    }`}
                  >
                    <stage.icon
                      className={`h-4 w-4 ${
                        stage.active
                          ? 'text-accent'
                          : index === 1
                            ? 'text-status-info'
                            : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <h3
                    className={`text-sm font-medium ${stage.active ? 'text-foreground' : 'text-foreground/90'}`}
                  >
                    {stage.title}
                  </h3>
                </div>
                <p
                  className={`text-xs leading-relaxed ${stage.active ? 'text-muted-foreground' : 'text-muted-foreground/80'}`}
                >
                  {stage.description}
                </p>
              </div>

              {/* Arrow connector */}
              {index < stages.length - 1 && (
                <div className="hidden md:flex items-center justify-center w-8 shrink-0">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Anchor back to today */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground/80 leading-relaxed">
            We start where the pain is highest:{' '}
            <span className="text-muted-foreground">
              execution. See context → understand impact → ship with confidence.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

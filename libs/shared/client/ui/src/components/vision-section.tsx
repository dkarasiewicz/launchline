import { Inbox, Brain, Sparkles, ChevronRight } from 'lucide-react';

const stages = [
  {
    label: 'Now',
    title: 'Slack-native execution inbox',
    description:
      'Heartbeat + scheduled jobs that surface blockers, drift, and risks in real time.',
    icon: Inbox,
    active: true,
  },
  {
    label: 'Scaling',
    title: 'Autonomous coworker',
    description:
      'Learns each workspace, builds a collaboration graph, and acts with guardrails.',
    icon: Brain,
    active: false,
  },
  {
    label: 'Endgame',
    title: 'Product copilot',
    description:
      'Makes strengths, gaps, and tradeoffs visible so teams ship with clarity.',
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
            Product teams are drowning in context
            <br />
            <span className="text-muted-foreground">
              Linea keeps it coherent, 24/7
            </span>
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            We are building a product copilot: an always-on agent that connects
            Linear, Slack, GitHub, and email into a live collaboration graph.
            It schedules check-ins, remembers your playbooks, and takes safe
            actions in a sandbox. No dashboards — just clarity.
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
            Start with execution, then scale into a 24/7 product copilot.
          </p>
        </div>
      </div>
    </section>
  );
}

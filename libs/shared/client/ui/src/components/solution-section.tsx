import {
  Inbox,
  AlertTriangle,
  TrendingDown,
  FileText,
  RefreshCw,
  Hand,
} from 'lucide-react';

const features = [
  {
    icon: Inbox,
    title: 'Slack-first Inbox',
    description:
      'Your action queue for blockers, decisions, and drift. Works where your team already chats.',
    accent: 'text-accent',
    bg: 'bg-accent/15',
  },
  {
    icon: AlertTriangle,
    title: 'Collaboration graph',
    description:
      'See how tickets, PRs, projects, and people connect — so silos and bottlenecks are obvious.',
    accent: 'text-status-error',
    bg: 'bg-status-error/15',
  },
  {
    icon: TrendingDown,
    title: 'Scheduled check-ins',
    description:
      'Run daily or weekly jobs that draft updates, check blockers, and keep teams aligned.',
    accent: 'text-status-warning',
    bg: 'bg-status-warning/15',
  },
  {
    icon: RefreshCw,
    title: 'Autonomous heartbeat',
    description:
      'Every 30 minutes, Linea scans for drift, stalled work, and risks before they explode.',
    accent: 'text-muted-foreground',
    bg: 'bg-secondary',
  },
  {
    icon: FileText,
    title: 'Workspace skills',
    description:
      'Add playbooks and guardrails so Linea adapts to each workspace.',
    accent: 'text-status-info',
    bg: 'bg-status-info/15',
  },
  {
    icon: Hand,
    title: 'Safe automation',
    description:
      'Approve actions or let Linea run in a sandbox — always transparent, never risky.',
    accent: 'text-status-success',
    bg: 'bg-status-success/15',
  },
];

export function SolutionSection() {
  return (
    <section id="inbox" className="py-24 bg-background">
      <div className="mx-auto max-w-4xl px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <p className="text-xs font-medium text-muted-foreground/80 mb-3 uppercase tracking-widest">
              Features
            </p>
            <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
              Autonomous product copilot
            </h2>
          </div>
          <p className="text-sm text-muted-foreground md:text-right max-w-xs">
            Transparency without micromanagement. Impact without fake KPIs.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-5 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors"
            >
              <div
                className={`w-10 h-10 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}
              >
                <feature.icon className={`h-5 w-5 ${feature.accent}`} />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

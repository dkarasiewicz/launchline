import { ArrowRight, Zap } from 'lucide-react';

const integrations = [
  {
    name: 'Linear',
    description: 'Bidirectional sync of tickets, blockers, and status changes',
    color: 'bg-status-info',
    features: ['Ticket sync', 'Blocker detection', 'Status updates'],
  },
  {
    name: 'Slack',
    description: 'Context from standups, threads, and @mentions',
    color: 'bg-accent',
    features: ['Standup parsing', 'Thread context', 'Notifications'],
  },
  {
    name: 'GitHub',
    description: 'PR status, reviews, and deployment metadata',
    color: 'bg-foreground/60',
    features: ['PR tracking', 'Review status', 'Deploy events'],
  },
];

const upcoming = ['Notion', 'Jira', 'Figma', 'Customer feedback tools'];

export function IntegrationsSection() {
  return (
    <section id="integrations" className="py-24 bg-background">
      <div className="mx-auto max-w-4xl px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <p className="text-xs font-medium text-muted-foreground/80 mb-3 uppercase tracking-widest">
              Integrations
            </p>
            <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
              Works with the tools you already use
            </h2>
          </div>
          <p className="text-sm text-muted-foreground md:text-right max-w-xs">
            We collect signals across your tools and turn them into insights
            about real impact.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="p-5 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-3 w-3 rounded-full ${integration.color}`} />
                <span className="text-base font-medium text-foreground">
                  {integration.name}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                {integration.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {integration.features.map((feature) => (
                  <span
                    key={feature}
                    className="text-[10px] px-2 py-1 rounded-full bg-secondary text-muted-foreground border border-border"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card/30">
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-muted-foreground/80" />
            <span className="text-sm text-muted-foreground">Coming soon:</span>
            <div className="flex flex-wrap gap-2">
              {upcoming.map((name) => (
                <span key={name} className="text-sm text-foreground/90">
                  {name}
                </span>
              ))}
            </div>
          </div>
          <a
            href="#demo"
            className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Request an integration <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}

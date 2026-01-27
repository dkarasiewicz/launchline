import { Code2, Users, Building2, Target } from 'lucide-react';

const reasons = [
  {
    icon: Code2,
    text: 'For developers: See how your work shapes the product - even without shipping features',
    accent: 'text-accent',
  },
  {
    icon: Users,
    text: 'For teams: Highlight underdeveloped areas and frequent pain points',
    accent: 'text-status-info',
  },
  {
    icon: Building2,
    text: 'For organizations: Understand how small actions compound into outcomes',
    accent: 'text-status-success',
  },
  {
    icon: Target,
    text: 'For managers: Get clarity without surveillance',
    accent: 'text-accent',
  },
];

export function ValuePropsSection() {
  return (
    <section className="py-24 bg-background">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-xs font-medium text-muted-foreground/80 mb-6 uppercase tracking-widest">
          Why it matters
        </p>
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground mb-8">
          Organize around people's strengths - not arbitrary processes
        </h2>

        <div className="grid sm:grid-cols-2 gap-3">
          {reasons.map((reason, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50"
            >
              <reason.icon className={`h-4 w-4 ${reason.accent} shrink-0`} />
              <p className="text-sm text-foreground/90">{reason.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

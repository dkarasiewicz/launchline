import { Eye, Inbox, Zap } from 'lucide-react';

const steps = [
  {
    step: '01',
    icon: Eye,
    title: 'Observe',
    description:
      'Connects to Linear, Slack, and GitHub. Watches your work in real time.',
    accent: 'text-status-info',
    bg: 'bg-status-info/15',
  },
  {
    step: '02',
    icon: Inbox,
    title: 'Surface',
    description:
      'Blockers and decisions appear in your inbox with context and actions.',
    accent: 'text-accent',
    bg: 'bg-accent/15',
  },
  {
    step: '03',
    icon: Zap,
    title: 'Act',
    description:
      'One click to update tickets, ping teammates, or reprioritize work.',
    accent: 'text-status-success',
    bg: 'bg-status-success/15',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-background">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center mb-16">
          <p className="text-xs font-medium text-muted-foreground/80 mb-6 uppercase tracking-widest">
            How it works
          </p>
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
            Three steps to transparency
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, index) => (
            <div
              key={index}
              className="p-6 rounded-xl bg-card/50 border border-border hover:bg-card transition-colors"
            >
              <div
                className={`w-10 h-10 rounded-lg ${step.bg} flex items-center justify-center mb-4`}
              >
                <step.icon className={`h-5 w-5 ${step.accent}`} />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-sm font-medium ${step.accent}`}>
                  {step.step}
                </span>
                <h3 className="text-base font-medium text-foreground">
                  {step.title}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

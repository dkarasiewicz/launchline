import { Github, Code2, Users, Shield, Star } from 'lucide-react';
import { Button } from './ui/button';

const openSourceBenefits = [
  {
    icon: Code2,
    title: 'Transparent by design',
    description:
      'Audit the agent logic and guardrails. No black boxes or hidden metrics.',
  },
  {
    icon: Users,
    title: 'Community-driven',
    description:
      'Contribute features, report issues, and shape responsible automation.',
  },
  {
    icon: Shield,
    title: 'Self-host if you want',
    description:
      'Run Launchline on your own infrastructure. Your data, your rules.',
  },
];

export function OpenSourceSection() {
  return (
    <section className="py-24 bg-background">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-muted-foreground/80 mb-4 uppercase tracking-widest">
            Open Source
          </p>
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground mb-4">
            Built in the open
          </h2>
          <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Launchline's core is open source. Autonomous copilot software must
            be auditable, extensible, and community-owned.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {openSourceBenefits.map((benefit) => (
            <div
              key={benefit.title}
              className="p-5 rounded-xl border border-border bg-card/50 hover:border-accent/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center mb-4">
                <benefit.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-2">
                {benefit.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            variant="outline"
            className="h-10 px-5 text-sm border-border hover:border-accent/50 hover:bg-accent/5 bg-transparent"
            asChild
          >
            <a
              href="https://github.com/dkarasiewicz/launchline"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="mr-2 h-4 w-4" />
              Star on GitHub
              <Star className="ml-2 h-3 w-3" />
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Built by{' '}
            <a
              href="https://x.com/_dkarasiewicz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-accent transition-colors"
            >
              @_dkarasiewicz
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

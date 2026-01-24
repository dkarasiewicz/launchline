import { BarChart3, TrendingDown, Layers, UserX } from 'lucide-react';

const problems = [
  {
    icon: BarChart3,
    title: 'Signals are split',
    text: 'Slack, Linear, email, and calendar live in different silos.',
  },
  {
    icon: TrendingDown,
    title: 'Context decays fast',
    text: 'Decisions happen in threads and vanish by the next standup.',
  },
  {
    icon: Layers,
    title: 'No shared memory',
    text: 'Teams repeat decisions because the rationale never sticks.',
  },
  {
    icon: UserX,
    title: "PMs can't be always-on",
    text: 'Important signals appear while you are offline or busy.',
  },
];

export function ProblemSection() {
  return (
    <section id="product" className="py-24 bg-background">
      <div className="mx-auto max-w-4xl px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <p className="text-xs font-medium text-muted-foreground/70 mb-3 uppercase tracking-widest">
              The problem
            </p>
            <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
              Teams lose time not because people aren&#39;t working
              <br />
              <span className="text-muted-foreground">
                but because the system forgets what matters
              </span>
            </h2>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card/50"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <problem.icon className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  {problem.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {problem.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

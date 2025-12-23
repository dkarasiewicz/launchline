import { AlertCircle, TrendingDown, Layers, Clock } from "lucide-react"

const problems = [
  {
    icon: AlertCircle,
    title: "Blockers go unnoticed",
    text: "Dependencies stall silently until delivery slips.",
  },
  {
    icon: TrendingDown,
    title: "Priorities drift",
    text: "What's being built diverges from what was planned.",
  },
  {
    icon: Layers,
    title: "Context is fragmented",
    text: "Linear, Slack, GitHub — never connected.",
  },
  {
    icon: Clock,
    title: "Updates consume time",
    text: "Hours spent on status that could resolve problems.",
  },
]

export function ProblemSection() {
  return (
    <section id="product" className="py-24 bg-background">
      <div className="mx-auto max-w-4xl px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <p className="text-xs font-medium text-muted-foreground/70 mb-3 uppercase tracking-widest">The problem</p>
            <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
              Product management is not about tools
              <br />
              <span className="text-muted-foreground">— it's about what you miss</span>
            </h2>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {problems.map((problem, index) => (
            <div key={index} className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card/50">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <problem.icon className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">{problem.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{problem.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

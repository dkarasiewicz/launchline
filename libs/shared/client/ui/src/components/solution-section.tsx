import { Inbox, AlertTriangle, TrendingDown, FileText, GitBranch, Hand } from "lucide-react"

const features = [
  {
    icon: Inbox,
    title: "PM Inbox",
    description: "Your action queue for blockers, decisions, and drift. One place for everything that needs attention.",
    accent: "text-accent",
    bg: "bg-accent/15",
  },
  {
    icon: AlertTriangle,
    title: "Blocker Detection",
    description: "Automatically surfaces stalled work, dependency conflicts, and blocked teammates.",
    accent: "text-status-error",
    bg: "bg-status-error/15",
  },
  {
    icon: TrendingDown,
    title: "Priority Drift Alerts",
    description: "Know when execution diverges from plan. Catch scope changes before they compound.",
    accent: "text-status-warning",
    bg: "bg-status-warning/15",
  },
  {
    icon: FileText,
    title: "Auto Project Updates",
    description: "Draft stakeholder updates from real work. No more status meeting prep.",
    accent: "text-status-info",
    bg: "bg-status-info/15",
  },
  {
    icon: GitBranch,
    title: "Linear & GitHub Sync",
    description: "Bidirectional sync keeps everything aligned. Work in the tools you already use.",
    accent: "text-muted-foreground",
    bg: "bg-secondary",
  },
  {
    icon: Hand,
    title: "Human-in-the-Loop",
    description: "You approve; Launchline executes. Stay in control while moving faster.",
    accent: "text-status-success",
    bg: "bg-status-success/15",
  },
]

export function SolutionSection() {
  return (
    <section id="inbox" className="py-24 bg-background">
      <div className="mx-auto max-w-4xl px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <p className="text-xs font-medium text-muted-foreground/80 mb-3 uppercase tracking-widest">Features</p>
            <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">
              A single place for what matters
            </h2>
          </div>
          <p className="text-sm text-muted-foreground md:text-right max-w-xs">
            Everything you need to stay ahead of execution — nothing you don't.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <div key={index} className="p-5 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors">
              <div className={`w-10 h-10 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                <feature.icon className={`h-5 w-5 ${feature.accent}`} />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-2">{feature.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

import { Search, RefreshCw, Eye, Layers } from "lucide-react"

const reasons = [
  { icon: Search, text: "Find issues before they become delays", accent: "text-accent" },
  { icon: RefreshCw, text: "Coordinate execution without chasing updates", accent: "text-status-info" },
  { icon: Eye, text: "Get visibility without dashboards that distract", accent: "text-status-success" },
  { icon: Layers, text: "Stay in control without constant tool switching", accent: "text-accent" },
]

export function ValuePropsSection() {
  return (
    <section className="py-24 bg-background">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-xs font-medium text-muted-foreground/80 mb-6 uppercase tracking-widest">Why it matters</p>
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground mb-8">
          Designed for the way PMs actually work
        </h2>

        <div className="grid sm:grid-cols-2 gap-3">
          {reasons.map((reason, index) => (
            <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50">
              <reason.icon className={`h-4 w-4 ${reason.accent} shrink-0`} />
              <p className="text-sm text-foreground/90">{reason.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

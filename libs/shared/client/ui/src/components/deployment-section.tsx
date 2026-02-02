import { Cloud, Server, Building2, Check } from "lucide-react"

const deploymentOptions = [
  {
    icon: Cloud,
    title: "Launchline Cloud",
    description: "Managed hosting. Zero setup. Auto-updates.",
    features: ["Slack-first onboarding", "Managed infrastructure", "Guardrail policies", "Priority support"],
    highlight: true,
    badge: "Recommended",
  },
  {
    icon: Server,
    title: "Self-Hosted",
    description: "Run on your own infrastructure.",
    features: ["Full control", "Your own data", "Custom LLM choice", "Audit automation"],
    highlight: false,
    badge: "Open Source",
  },
  {
    icon: Building2,
    title: "Enterprise",
    description: "Private cloud with dedicated support.",
    features: ["VPC deployment", "SSO / SAML", "SLA & compliance", "Custom guardrails"],
    highlight: false,
    badge: "Coming soon",
  },
]

export function DeploymentSection() {
  return (
    <section className="py-24 bg-secondary/30">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-muted-foreground/80 mb-4 uppercase tracking-widest">Deployment</p>
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground mb-4">Run it your way</h2>
          <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Whether you want managed simplicity or full control, Linea adapts with transparent guardrails.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {deploymentOptions.map((option) => (
            <div
              key={option.title}
              className={`p-5 rounded-xl border transition-all ${
                option.highlight ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20" : "border-border bg-card/50"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    option.highlight ? "bg-accent/15" : "bg-secondary"
                  }`}
                >
                  <option.icon className={`h-4 w-4 ${option.highlight ? "text-accent" : "text-muted-foreground"}`} />
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${
                    option.highlight
                      ? "bg-accent/20 text-accent"
                      : option.badge === "Coming soon"
                        ? "bg-muted text-muted-foreground"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {option.badge}
                </span>
              </div>

              <h3 className="text-sm font-medium text-foreground mb-1">{option.title}</h3>
              <p className="text-xs text-muted-foreground mb-4">{option.description}</p>

              <ul className="space-y-2">
                {option.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className={`h-3 w-3 ${option.highlight ? "text-accent" : "text-muted-foreground/60"}`} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

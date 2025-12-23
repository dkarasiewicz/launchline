import { HeroSection } from '@launchline/ui/components/hero-section';
import { ProblemSection } from '@launchline/ui/components/problem-section';
import { SolutionSection } from '@launchline/ui/components/solution-section';
import { HowItWorksSection } from '@launchline/ui/components/how-it-works-section';
import { ValuePropsSection } from '@launchline/ui/components/value-props-section';
import { VisionSection } from '@launchline/ui/components/vision-section';
import { IntegrationsSection } from '@launchline/ui/components/integrations-section';
import { OpenSourceSection } from '@launchline/ui/components/open-source-section';
import { DeploymentSection } from '@launchline/ui/components/deployment-section';
import { PricingSection } from '@launchline/ui/components/pricing-section';
import { FooterSection } from '@launchline/ui/components/footer-section';
import { Navbar } from '@launchline/ui/components/navbar';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="bg-background text-foreground">
        <Navbar />
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <SolutionSection />
        <ValuePropsSection />
        <VisionSection />
        <IntegrationsSection />
        <OpenSourceSection />
        <DeploymentSection />
        <PricingSection />
        <FooterSection />
      </div>
    </main>
  );
}

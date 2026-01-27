'use client';

import Link from 'next/link';
import { Button } from './ui/button';
import { ArrowRight } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-14 bg-background">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/[0.07] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <div className="inline-flex items-center rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs text-muted-foreground mb-12">
          Early access
        </div>

        <h1 className="text-4xl md:text-6xl font-medium tracking-tight text-foreground leading-[1.1] mb-6">
          Transparency without
          <br />
          <span className="text-accent">micromanagement</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
          Launchline helps teams see what's{' '}
          <em className="text-accent not-italic">actually</em> happening - not
          what fits in spreadsheets. Surface hidden impact, respect context,
          embrace different working styles.
        </p>

        <p className="text-sm text-muted-foreground/80 mb-12">
          Impact without fake KPIs.{' '}
          <span className="text-foreground/80">Finally.</span>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/onboarding">
            <Button
              size="lg"
              className="h-11 px-6 text-sm bg-foreground text-background hover:bg-foreground/90 border-0 transition-all"
            >
              See Inbox in action
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="mailto:dawid@launchline.dev">
            <Button
              variant="ghost"
              size="lg"
              className="h-11 px-6 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            >
              Request Early Access
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

import type React from 'react';
import { LogoIcon } from '@launchline/ui/components/logo';
import Link from 'next/link';
import { ThemeToggle } from '@launchline/ui/components/theme-toggle';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Minimal header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex h-14 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <LogoIcon className="h-6 w-6" />
              <span className="text-sm font-medium text-foreground/90">
                Launchline
              </span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-14">{children}</main>
    </div>
  );
}

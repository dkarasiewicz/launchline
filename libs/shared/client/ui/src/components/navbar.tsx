'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { Menu, X } from 'lucide-react';
import { LogoIcon } from './logo';
import { ThemeToggle } from './theme-toggle';
import { GitHubStars } from './github-stars';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <LogoIcon className="h-6 w-6" />
            <span className="text-sm font-medium text-foreground/90">
              Launchline
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a
              href="#product"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Product
            </a>
            <a
              href="#inbox"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Inbox
            </a>
            <a
              href="#integrations"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Integrations
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <GitHubStars repo="dkarasiewicz/launchline" />
            <ThemeToggle />
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-4 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button
                size="sm"
                className="h-8 px-4 text-xs bg-foreground text-background hover:bg-foreground/90 border-0"
              >
                Get Started
              </Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-muted-foreground"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col gap-4">
              <a
                href="#product"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Product
              </a>
              <a
                href="#inbox"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Inbox
              </a>
              <a
                href="#integrations"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Integrations
              </a>
              <Link
                href="/demo/onboarding"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Demo
              </Link>
              <div className="pt-4 border-t border-border/50 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Theme</span>
                  <ThemeToggle />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">GitHub</span>
                  <GitHubStars repo="dkarasiewicz/launchline" />
                </div>
                <Link href="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/onboarding">
                  <Button
                    size="sm"
                    className="w-full bg-foreground text-background hover:bg-foreground/90"
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

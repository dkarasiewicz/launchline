import Link from 'next/link';
import { LogoIcon } from './logo';
import { Github } from 'lucide-react';

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function FooterSection() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid sm:grid-cols-3 gap-8 mb-8">
          {/* Logo */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <LogoIcon className="h-5 w-5" />
              <span className="text-sm text-foreground/80">Launchline</span>
            </Link>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/dkarasiewicz/launchline"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://x.com/_dkarasiewicz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Product
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="#inbox"
                className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                Inbox
              </a>
              <a
                href="#integrations"
                className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                Integrations
              </a>
              <Link
                href="/inbox"
                className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                Demo
              </Link>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Resources
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="https://github.com/dkarasiewicz/launchline"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://x.com/_dkarasiewicz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                Twitter / X
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground/60">© 2026 Launchline</p>
        </div>
      </div>
    </footer>
  );
}

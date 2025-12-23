import type React from 'react';
import { InboxProvider } from '@launchline/ui/lib/inbox-store';

export default function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InboxProvider>{children}</InboxProvider>;
}

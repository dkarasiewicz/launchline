import type React from 'react';
import type { Metadata, Viewport } from 'next';

import './global.css';
import { ThemeProvider } from '@launchline/ui/components/theme-provider';

import { ApolloClientProvider, PostHogProvider } from '@launchline/ui';

// Initialize fonts

export const metadata: Metadata = {
  title: 'Launchline — The execution inbox for product managers',
  description:
    'Launchline watches Linear, Slack, and GitHub — surfaces the things you must act on — so you can unblock teams and deliver with confidence.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/logo.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#1a1625',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gqlApiUrl = `${process.env.NEXT_PUBLIC_API_URL}/graphql`;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ApolloClientProvider gqlApiUrl={gqlApiUrl}>
          <PostHogProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              {children}
            </ThemeProvider>
          </PostHogProvider>
        </ApolloClientProvider>
      </body>
    </html>
  );
}

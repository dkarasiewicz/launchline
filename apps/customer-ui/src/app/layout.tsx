import type React from 'react';
import type { Metadata, Viewport } from 'next';

// import './globals.css';
import './global.css';
import { ThemeProvider } from '@launchline/ui/components/theme-provider';

import { Geist, Geist_Mono, Source_Serif_4 } from 'next/font/google';

// Initialize fonts
const _geist = Geist({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});
const _geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});
const _sourceSerif_4 = Source_Serif_4({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
});

const _sourceSerif4 = Source_Serif_4({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'Launchline — Turn ideas into real products, instantly',
  description:
    'Launchline transforms your ideas into PRDs, plans, Linear tickets, MVP previews, and verified implementation. The AI Product Partner for PMs, founders, and CEOs.',
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

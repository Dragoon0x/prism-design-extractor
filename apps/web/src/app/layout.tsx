import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Prism — extract design systems from any source',
    template: '%s · Prism',
  },
  description:
    'Open-source design extractor. Turn any URL, screenshot, or PDF into a complete design system — tokens, components, assets, audits — with Claude vision + reasoning.',
  applicationName: 'Prism',
  authors: [{ name: 'Prism contributors' }],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    title: 'Prism',
    description:
      'Extract a complete design system from any URL, screenshot, or PDF. Open source. BYOK.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}

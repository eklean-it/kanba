import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { UserProvider } from '@/components/user-provider';
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'EKGO! Tasks',
    template: '%s · EKGO! Tasks',
  },
  description: 'Task and project management for the EKGO! team.',
  applicationName: 'EKGO! Tasks',
  authors: [{ name: 'EKGO!' }],
  creator: 'EKGO!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Task and project management for the EKGO! team." />

        {/* Icons */}
        <link rel="icon" href="/ekgo-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/ekgo-icon.svg" />

        {/* Open Graph */}
        <meta property="og:title" content="EKGO! Tasks" />
        <meta property="og:description" content="Task and project management for the EKGO! team." />
        <meta property="og:url" content="https://tasks.eklean.com" />
        <meta property="og:site_name" content="EKGO! Tasks" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:type" content="website" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="EKGO! Tasks" />
        <meta name="twitter:description" content="Task and project management for the EKGO! team." />

        {/* Internal tool — keep it out of search indexes */}
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <UserProvider>
            <Analytics />
            {children}
            <Toaster />
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

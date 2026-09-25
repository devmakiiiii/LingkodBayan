import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { NavigationLoader } from '@/components/navigation-loader'
import { SupabaseSessionGuard } from '@/components/supabase-session-guard'
import { ThemeProvider } from '@/components/theme-provider'
import { GlobalHotkeys } from '@/components/global-hotkeys'
import { ServiceWorkerRegister } from '@/components/service-worker-register'

const _geist = Geist({ subsets: ["latin"], display: "swap" });
const _geistMono = Geist_Mono({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: 'LingkodBayan',
  description: 'Connecting Citizens and Government Services',
  generator: 'v0.app',
  applicationName: 'LingkodBayan',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/lingkod-logo.png',
    shortcut: '/lingkod-logo.png',
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'LingkodBayan',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#080a0b' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
          >
            Skip to main content
          </a>
          <SupabaseSessionGuard />
          <NavigationLoader />
          <GlobalHotkeys />
          <ServiceWorkerRegister />
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import { Outfit, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ConvexClientProvider } from './components/ConvexClientProvider'
import { ProviderProvider } from './context/ProviderContext'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Ichigo Game Studio',
  description: 'Create and process game-ready sprite sheets',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`bg-surface-primary text-content-primary ${outfit.variable} ${jetbrainsMono.variable}`}>
        <ConvexClientProvider>
          <ProviderProvider>{children}</ProviderProvider>
        </ConvexClientProvider>
      </body>
    </html>
  )
}

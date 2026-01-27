import type { Metadata } from 'next'
import './globals.css'
import { ConvexClientProvider } from './components/ConvexClientProvider'

export const metadata: Metadata = {
  title: 'Sprite Sheet Creator',
  description: 'Create pixel art sprite sheets using fal.ai',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-surface-primary text-content-primary">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  )
}

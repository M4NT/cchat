import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'C.Chat | Sistema de Comunicação Interna',
  description: 'Sistema de comunicação interna para equipes',
  generator: 'v0.dev',
  icons: {
    icon: '/logo-saude-cred.png',
    apple: '/logo-saude-cred.png',
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo-saude-cred.png" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}

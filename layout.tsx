// app/layout.tsx
import './globals.css'

export const metadata = {
  title: 'KlassVough Form',
  description: 'Formulário interativo - KlassVough',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}

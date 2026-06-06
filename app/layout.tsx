import type { Metadata } from "next"
import { Bricolage_Grotesque, DM_Sans } from "next/font/google"
import "./globals.css"
import { LocaleProvider } from "@/lib/locale"

// Display : Bricolage Grotesque — caractériel/trendy mais bien plus lisible que Syne.
const display = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["700", "800"],
})

// Corps : DM Sans (lisible) — 700 ajouté pour les boutons en gras (plus de synthèse).
const body = DM_Sans({
  variable: "--font-body-face",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
})

export const metadata: Metadata = {
  title: "Kluup — le party game qui révèle votre groupe",
  description:
    "Le party game qui brise la glace et révèle votre groupe. Sur vos téléphones, sans installation. Gratuit, sans inscription.",
  applicationName: "Kluup",
  openGraph: {
    title: "Kluup — le party game qui révèle votre groupe",
    description:
      "Brisez la glace et révélez votre groupe. Sur vos téléphones, sans installation. Gratuit, sans inscription.",
    siteName: "Kluup",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kluup — le party game qui révèle votre groupe",
    description: "Brisez la glace et révélez votre groupe. Sur vos téléphones, sans installation.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} h-full`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="min-h-full flex flex-col bg-kluup-bg text-white antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  )
}

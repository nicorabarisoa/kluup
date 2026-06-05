import type { Metadata } from "next"
import { Syne, DM_Sans } from "next/font/google"
import "./globals.css"
import { LocaleProvider } from "@/lib/locale"

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["800"],
})

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "Kluup",
  description: "Le party game qui révèle tout",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${syne.variable} ${dmSans.variable} h-full`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="min-h-full flex flex-col bg-kluup-bg text-white antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  )
}

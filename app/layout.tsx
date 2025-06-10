import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "katex/dist/katex.min.css"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { ConvexClientProvider } from "@/components/ConvexClientProvider"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "Chat Studio",
  description: "Fast AI Chat App"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ConvexClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  )
}

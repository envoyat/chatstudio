"use client"

import dynamic from "next/dynamic"
import { AuthWrapper } from "@/components/auth/AuthWrapper"

const App = dynamic(() => import("@/frontend/app"), { ssr: false })

export default function Home() {
  return (
    <AuthWrapper>
      <App />
    </AuthWrapper>
  )
}

"use client"

interface WelcomeScreenProps {
  // No props needed for the simplified welcome screen
}

export default function WelcomeScreen({}: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-2xl w-full text-center space-y-6">
        {/* Welcome heading */}
        <h1 className="text-4xl font-semibold text-foreground">
          Welcome to ChatStudio
        </h1>
        
        <p className="text-xl text-muted-foreground">
          How can I help?
        </p>
      </div>
    </div>
  )
} 
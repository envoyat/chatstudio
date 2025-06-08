export default function MessageLoading() {
  return (
    <div className="flex items-center space-x-2">
      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]"></div>
      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]"></div>
      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"></div>
    </div>
  )
}

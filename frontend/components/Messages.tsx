import { memo } from "react"
import PreviewMessage from "./Message"
import type { UIMessage } from "ai"
import equal from "fast-deep-equal"
import MessageLoading from "@/components/ui/message-loading"
import type { Id } from "@/convex/_generated/dataModel"

function PureMessages({
  messages,
  isStreaming,
  convexThreadId,
}: {
  messages: UIMessage[]
  isStreaming: boolean
  convexThreadId: Id<"threads"> | null
}) {
  return (
    <section className="flex flex-col space-y-12">
      {messages.map((message) => (
        <PreviewMessage
          key={message.id}
          message={message}
          convexThreadId={convexThreadId}
        />
      ))}
      {isStreaming && messages[messages.length - 1]?.content === "" && <MessageLoading />}
    </section>
  )
}

const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isStreaming !== nextProps.isStreaming) return false
  if (!equal(prevProps.messages, nextProps.messages)) return false
  if (prevProps.convexThreadId !== nextProps.convexThreadId) return false
  return true
})

Messages.displayName = "Messages"

export default Messages

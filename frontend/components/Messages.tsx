import { memo } from "react"
import PreviewMessage from "./Message"
import type { UIMessage } from "ai"
import equal from "fast-deep-equal"
import MessageLoading from "@/components/ui/message-loading"
import type { Id } from "@/convex/_generated/dataModel"

function PureMessages({
  messages,
  isStreaming,
  convexConversationId,
}: {
  messages: UIMessage[]
  isStreaming: boolean
  convexConversationId: Id<"conversations"> | null
}) {
  return (
    <section className="flex flex-col space-y-12">
      {messages.map((message) => (
        <PreviewMessage
          key={message.id}
          message={message}
          messages={messages}
          convexConversationId={convexConversationId}
        />
      ))}
      {isStreaming && messages[messages.length - 1]?.content === "" && <MessageLoading />}
    </section>
  )
}

const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isStreaming !== nextProps.isStreaming) return false
  if (!equal(prevProps.messages, nextProps.messages)) return false
  if (prevProps.convexConversationId !== nextProps.convexConversationId) return false
  return true
})

Messages.displayName = "Messages"

export default Messages

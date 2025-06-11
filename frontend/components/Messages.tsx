import { memo } from "react"
import PreviewMessage from "./Message"
import type { UIMessage } from "ai"
import type { UseChatHelpers } from "@ai-sdk/react"
import equal from "fast-deep-equal"
import MessageLoading from "@/components/ui/message-loading"
import Error from "./Error"
import type { Id } from "@/convex/_generated/dataModel"

function PureMessages({
  threadId,
  messages,
  status,
  setMessages,
  reload,
  error,
  stop,
  convexThreadId,
}: {
  threadId: string
  messages: UIMessage[]
  setMessages: UseChatHelpers["setMessages"]
  reload: UseChatHelpers["reload"]
  status: UseChatHelpers["status"]
  error: UseChatHelpers["error"]
  stop: UseChatHelpers["stop"]
  convexThreadId: Id<"threads"> | null
}) {
  return (
    <section className="flex flex-col space-y-12">
      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          threadId={threadId}
          message={message}
          isStreaming={status === "streaming" && messages.length - 1 === index}
          setMessages={setMessages}
          reload={reload}
          stop={stop}
          convexThreadId={convexThreadId}
        />
      ))}
      {status === "submitted" && <MessageLoading />}
      {error && <Error message={error.message} />}
    </section>
  )
}

const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) return false
  if (prevProps.error !== nextProps.error) return false
  if (prevProps.messages.length !== nextProps.messages.length) return false
  if (!equal(prevProps.messages, nextProps.messages)) return false
  if (prevProps.convexThreadId !== nextProps.convexThreadId) return false
  return true
})

Messages.displayName = "Messages"

export default Messages

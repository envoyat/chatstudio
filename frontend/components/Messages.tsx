import { memo } from "react"
import PreviewMessage from "./Message"
import type { UIMessage } from "ai"
import equal from "fast-deep-equal"
import MessageLoading from "@/components/ui/message-loading"
import type { Id } from "@/convex/_generated/dataModel"
import type { UIMessageData } from "@/convex/types"

function PureMessages({
  messages,
  isStreaming,
  convexConversationId,
}: {
  messages: UIMessage[];
  isStreaming: boolean;
  convexConversationId: Id<"conversations"> | null;
}) {
  return (
    <section className="flex flex-col">
      {messages.map((message, index) => {
        const prevMessage = messages[index - 1];

        let marginTopClass = 'mt-12'; // Default large gap

        if (index > 0 && message.role === 'assistant' && prevMessage?.role === 'assistant') {
          // If this assistant message follows another assistant message (e.g., text -> tool_call -> text), reduce the gap.
          marginTopClass = 'mt-2';
        } else if (index === 0) {
          marginTopClass = ''; // No margin for the first message
        }

        return (
          <div key={message.id} className={marginTopClass}>
            <PreviewMessage message={message} messages={messages} convexConversationId={convexConversationId} />
          </div>
        );
      })}
      {isStreaming && messages[messages.length - 1]?.content === "" && (() => {
        const lastMessage = messages[messages.length - 1];
        const messageData = lastMessage?.data as UIMessageData | undefined;
        const hasToolCalls = messageData?.toolCalls && messageData.toolCalls.length > 0;
        return !hasToolCalls;
      })() && (
        <div className="mt-2">
          <MessageLoading />
        </div>
      )}
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

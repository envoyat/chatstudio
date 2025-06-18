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
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  
  // Early return if no messages to avoid unnecessary computation
  if (!lastMessage) {
    return <section className="flex flex-col"></section>;
  }
  
  // Determine if the assistant is generating a response
  const assistantIsGenerating =
    lastMessage.role === "assistant" &&
    (lastMessage.data as UIMessageData)?.isComplete === false;

  // Determine if we should show the "typing dots"
  // Show only if the assistant is generating AND has not yet produced any content (text, tools, or reasoning)
  const showLoadingDots =
    assistantIsGenerating &&
    !lastMessage.content &&
    (!lastMessage.parts || lastMessage.parts.length === 0) &&
    !(lastMessage as any).reasoning; // Also check our new temporary field

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
      {showLoadingDots && (
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

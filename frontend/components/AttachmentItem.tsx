"use client"

import React from "react"
import { File as FileIcon } from "lucide-react"
import type { Doc } from "@/convex/_generated/dataModel"

type AttachmentItemProps = {
  attachment: Doc<"attachments"> & { url: string | null }
}

export function AttachmentItem({ attachment }: AttachmentItemProps) {
  const isImage = attachment.contentType.startsWith("image/")

  return (
    <div className="flex items-center gap-3 p-2 border-b last:border-b-0">
      <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-md flex items-center justify-center">
        {isImage && attachment.url ? (
          <img
            src={attachment.url}
            alt={attachment.fileName}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <FileIcon className="w-6 h-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex-grow min-w-0">
        {attachment.url ? (
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary truncate hover:underline block"
          >
            {attachment.fileName}
          </a>
        ) : (
          <span className="text-sm font-medium text-muted-foreground truncate block">
            {attachment.fileName}
          </span>
        )}
        <p className="text-xs text-muted-foreground">
          {attachment.promptTokens
            ? `${attachment.promptTokens} tokens (message turn)`
            : "Token count pending..."}
        </p>
      </div>
    </div>
  )
} 
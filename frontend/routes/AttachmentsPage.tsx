"use client"

import React from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, Download, FileIcon, ImageIcon } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function AttachmentsPage() {
  const attachments = useQuery(api.attachments.getAttachmentsForUser)
  const deleteAttachment = useMutation(api.attachments.deleteAttachment)

  const handleDelete = async (attachmentId: Id<"attachments">) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
      try {
        await deleteAttachment({ attachmentId })
      } catch (error) {
        console.error("Failed to delete attachment:", error)
        alert("Failed to delete attachment. Please try again.")
      }
    }
  }

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (attachments === undefined) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading attachments...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Your Attachments</h1>
        <p className="text-muted-foreground mt-2">
          Manage files you've uploaded to your conversations
        </p>
      </div>

      {attachments.length === 0 ? (
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No attachments yet</h3>
            <p className="text-sm text-muted-foreground text-center">
              Files you upload in your conversations will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 text-sm text-muted-foreground">
            {attachments.length} {attachments.length === 1 ? "file" : "files"} uploaded
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {attachments.map((attachment) => {
              const isImage = attachment.contentType.startsWith("image/")
              const createdDate = new Date(attachment.createdAt)
              
              return (
                <Card key={attachment._id} className="overflow-hidden">
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {isImage ? (
                          <ImageIcon className="h-5 w-5 text-blue-500" />
                        ) : (
                          <FileIcon className="h-5 w-5 text-gray-500" />
                        )}
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm font-medium truncate">
                            {attachment.fileName}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {attachment.contentType}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isImage && attachment.url && (
                    <div className="px-4">
                      <div className="aspect-video relative bg-gray-100 rounded-md overflow-hidden">
                        <img
                          src={attachment.url}
                          alt={attachment.fileName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                  
                  <CardContent className="p-4 pt-2">
                    <div className="text-xs text-muted-foreground">
                      Uploaded {formatDistanceToNow(createdDate, { addSuffix: true })}
                    </div>
                  </CardContent>
                  
                  <CardFooter className="p-4 pt-0 flex justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => attachment.url && handleDownload(attachment.url, attachment.fileName)}
                      disabled={!attachment.url}
                      className="flex-1 mr-2"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(attachment._id)}
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
} 
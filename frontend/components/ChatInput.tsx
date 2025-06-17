"use client"

import type React from "react"
import { memo, useState, useCallback, useMemo, useRef } from "react"
import { ChevronDown, Check, ArrowUpIcon, Globe, Paperclip, Trash2, File as FileIcon, Image as ImageIcon } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import useAutoResizeTextarea from "@/hooks/useAutoResizeTextArea"
import { useNavigate, useLocation } from "react-router-dom"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { useModelStore } from "@/frontend/stores/ModelStore"
import { AI_MODELS, type AIModel, isModelAvailable, getModelConfig } from "@/lib/models"
import { useConvexAuth } from "convex/react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useCreateConversation } from "@/lib/convex-hooks"
import type { Id } from "@/convex/_generated/dataModel"
import { useChatRunSettingsStore } from "../stores/ChatRunSettingsStore"

interface ChatInputProps {
  threadId: string
  isStreaming: boolean
  convexConversationId: Id<"conversations"> | null
  onConvexConversationIdChange: React.Dispatch<React.SetStateAction<Id<"conversations"> | null>>
}

// A component to render a preview of the staged file
const FilePreview = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const isImage = file.type.startsWith('image/')
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file])
  
  return (
    <div className="relative group w-20 h-20 border rounded-lg p-1 flex items-center justify-center bg-gray-100">
      {isImage ? (
        <img src={previewUrl} alt={file.name} className="max-w-full max-h-full object-contain rounded" />
      ) : (
        <FileIcon className="w-10 h-10 text-gray-500" />
      )}
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove file"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 rounded-b-lg truncate">
        {file.name}
      </div>
    </div>
  )
}

function PureChatInput({ threadId, isStreaming, convexConversationId, onConvexConversationIdChange }: ChatInputProps) {
  const [input, setInput] = useState("")
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 72, maxHeight: 200 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  
  const selectedModel = useModelStore((state) => state.selectedModel)
  const { getKey, hasUserKey } = useAPIKeyStore()
  const { isWebSearchEnabled, toggleWebSearch } = useChatRunSettingsStore()
  
  const isDisabled = useMemo(() => (!input.trim() && stagedFiles.length === 0) || isStreaming, [input, stagedFiles.length, isStreaming])
  
  const { isAuthenticated } = useConvexAuth()
  const convexCreateConversation = useCreateConversation()
  const sendMessage = useMutation(api.messages.send)
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl)
  const saveAttachment = useMutation(api.attachments.saveAttachment)

  // File handling functions
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      setStagedFiles((prev) => [...prev, ...Array.from(files)])
    }
    // Reset input value so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files) {
      setStagedFiles((prev) => [...prev, ...Array.from(files)])
    }
  }

  // Convert files to base64 for sending
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        // Remove the data URL prefix to get just the base64 data
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = error => reject(error)
    })
  }

  // Upload files to Convex storage and get attachment references
  const uploadFiles = async (files: File[]) => {
    const attachmentRefs = []
    
    for (const file of files) {
      try {
        // Get upload URL
        const uploadUrl = await generateUploadUrl({})
        
        // Upload file
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        })
        
        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }
        
        const { storageId } = await uploadResponse.json()
        
        // Save attachment metadata
        const attachmentId = await saveAttachment({
          storageId: storageId,
          fileName: file.name,
          contentType: file.type,
        })
        
        attachmentRefs.push({
          attachmentId,
          fileName: file.name,
          contentType: file.type,
        })
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
        throw error
      }
    }
    
    return attachmentRefs
  }

  const handleSubmit = useCallback(async () => {
    if (isDisabled) return
    
    const currentInput = input.trim()
    const currentFiles = stagedFiles
    
    // Clear input and files
    setInput("")
    setStagedFiles([])
    adjustHeight(true)

    let currentConvexConversationId = convexConversationId

    if (isAuthenticated) {
      if (!currentConvexConversationId) {
        const newConversationId = await convexCreateConversation({
          uuid: threadId,
        })
        currentConvexConversationId = newConversationId
        onConvexConversationIdChange(newConversationId)
        
        const isNewThreadRoute = location.pathname === "/" || location.pathname === "/chat";
        if (isNewThreadRoute) {
          navigate(`/chat/${threadId}`)
        }
      }

      const modelConfig = getModelConfig(selectedModel)
      const userApiKeyForModel = hasUserKey(modelConfig.provider) ? getKey(modelConfig.provider) : undefined
      
      // Process attachments
      let attachments
      if (currentFiles.length > 0) {
        attachments = await uploadFiles(currentFiles)
      }

      const payload = {
        conversationId: currentConvexConversationId,
        content: currentInput,
        model: selectedModel,
        userApiKey: userApiKeyForModel || undefined,
        isWebSearchEnabled: isWebSearchEnabled,
        attachmentRefs: attachments,
      }

      try {
        await sendMessage(payload)
      } catch (error) {
        console.error("[ChatInput] 'messages.send' mutation call failed:", error)
        // Restore input and files on error
        setInput(currentInput)
        setStagedFiles(currentFiles)
      }
    } else {
      console.warn("[ChatInput] Attempted to send message while unauthenticated.")
    }
  }, [
    input, stagedFiles, isDisabled, sendMessage, convexConversationId, onConvexConversationIdChange,
    isAuthenticated, convexCreateConversation, threadId, location.pathname, navigate,
    selectedModel, getKey, hasUserKey, adjustHeight, isWebSearchEnabled, uploadFiles,
    generateUploadUrl, saveAttachment
  ])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    adjustHeight()
  }

  return (
    <div 
      className="w-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`bg-background/80 backdrop-blur-md border rounded-[20px] p-4 w-full shadow-lg transition-colors ${
        isDragging ? 'border-blue-400 bg-blue-50' : 'border-border/50'
      }`}>
        
        {/* Staged files preview */}
        {stagedFiles.length > 0 && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {stagedFiles.map((file, index) => (
              <FilePreview 
                key={`${file.name}-${file.size}-${index}`} 
                file={file} 
                onRemove={() => removeStagedFile(index)} 
              />
            ))}
          </div>
        )}

        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-100/50 border-2 border-dashed border-blue-400 rounded-[20px] flex items-center justify-center z-10">
            <div className="text-blue-600 font-medium">Drop files here to attach</div>
          </div>
        )}

        <div className="relative">
          <div className="flex flex-col">
            <Textarea
              id="chat-input"
              value={input}
              placeholder={stagedFiles.length > 0 ? "Add a message (optional)..." : "What can I do for you?"}
              className="w-full px-4 py-3 border-none shadow-none bg-transparent placeholder:text-muted-foreground resize-none focus-visible:ring-0 focus-visible:ring-offset-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 scrollbar-thumb-rounded-full min-h-[72px]"
              ref={textareaRef}
              onKeyDown={handleKeyDown}
              onChange={handleInputChange}
              aria-label="Chat message input"
              disabled={isStreaming}
            />
            <div className="h-12 flex items-center px-2 pt-2">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1">
                  <ChatModelDropdown />
                  <Button
                    onClick={toggleWebSearch}
                    variant={isWebSearchEnabled ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Toggle web search"
                  >
                    <Globe className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    aria-label="Attach file"
                    disabled={isStreaming}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    multiple
                    accept="image/*"
                  />
                </div>
                <Button onClick={handleSubmit} variant="default" size="icon" disabled={isDisabled} aria-label="Send message">
                  <ArrowUpIcon size={18} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ChatInput = memo(PureChatInput)

const PureChatModelDropdown = () => {
  const selectedModel = useModelStore((state) => state.selectedModel)
  const setModel = useModelStore((state) => state.setModel)
  const { getKey } = useAPIKeyStore()

  const availableModels = useMemo(() => {
    return AI_MODELS.filter((model) => isModelAvailable(model, getKey))
  }, [getKey])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium">
          {selectedModel}
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {availableModels.map((model) => (
          <DropdownMenuItem
            key={model}
            onClick={() => setModel(model)}
            className="flex items-center justify-between text-xs"
          >
            <span>{model}</span>
            {selectedModel === model && <Check className="h-3 w-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const ChatModelDropdown = memo(PureChatModelDropdown)

export default ChatInput

"use client"

import { useState, useEffect } from "react"
import { Save, Key, Eye, EyeOff, Trash2, User, Mail, Calendar, ArrowLeft, LogOut, FileIcon, ImageIcon, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { Badge } from "@/components/ui/badge"
import { hasHostAPIKey, FREE_MODELS_WITH_HOST_KEY } from "@/lib/host-config"
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react"
import { useUser, SignInButton, SignOutButton } from "@clerk/nextjs"
import { Link, useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { formatDistanceToNow } from "date-fns"

interface ApiKeyState {
  value: string
  showKey: boolean
  isSaving: boolean
  saveStatus: 'idle' | 'success' | 'error'
}

interface Provider {
  key: 'google' | 'anthropic' | 'openai' | 'openrouter'
  name: string
  placeholder: string
  helpUrl: string
  models: string[]
  validateKey: (key: string) => boolean
  validationMessage: string
  required?: boolean
  hasHostKey?: boolean
  freeModels?: string[]
}

const providers: Provider[] = [
  {
    key: 'openrouter',
    name: 'OpenRouter',
    placeholder: 'sk-or-...',
    helpUrl: 'https://openrouter.ai/keys',
          models: ['All Models'],
    validateKey: (key: string) => key.startsWith('sk-or-') && key.length > 20,
    validationMessage: 'API key format appears incorrect. OpenRouter keys typically start with "sk-or-"',
    required: true,
  },
  {
    key: 'google',
    name: 'Google',
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/apikey',
          models: ['Gemini 2.5 Pro', 'Gemini 2.5 Flash', 'Gemini 2.5 Flash-Lite Preview'],
    validateKey: (key: string) => key.startsWith('AIza') && key.length > 30,
    validationMessage: 'API key format appears incorrect. Google AI keys typically start with "AIza"',
    hasHostKey: hasHostAPIKey('google'),
          freeModels: FREE_MODELS_WITH_HOST_KEY.filter(model => ['Gemini 2.5 Flash', 'Gemini 2.5 Flash-Lite Preview'].includes(model))
  },
  {
    key: 'anthropic',
    name: 'Anthropic',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    models: ['Claude 4 Sonnet', 'Claude Haiku 3.5', 'Claude 4 Opus'],
    validateKey: (key: string) => key.startsWith('sk-ant-') && key.length > 20,
    validationMessage: 'API key format appears incorrect. Anthropic keys typically start with "sk-ant-"',
    required: true,
  },
  {
    key: 'openai',
    name: 'OpenAI',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/settings/organization/api-keys',
    models: ['GPT-4.1', 'GPT-4.1-mini', 'GPT-4.1-nano', 'o4-mini'],
    validateKey: (key: string) => key.startsWith('sk-') && key.length > 40,
    validationMessage: 'API key format appears incorrect. OpenAI keys typically start with "sk-"',
    required: true,
  }
]

export default function Settings() {
  const { keys, setKeys, clearKey, hasUserKey } = useAPIKeyStore()
  const { isAuthenticated } = useConvexAuth()
  const { user } = useUser()
  const attachments = useQuery(api.attachments.getAttachmentsForUser)
  const deleteAttachment = useMutation(api.attachments.deleteAttachment)
  const [searchParams] = useSearchParams()
  
  // Get the tab from query parameter, default to "account"
  const defaultTab = searchParams.get("tab") === "attachments" ? "attachments" : "account"
  
  const [apiKeys, setApiKeys] = useState<{
    google: ApiKeyState
    anthropic: ApiKeyState
    openai: ApiKeyState
    openrouter: ApiKeyState
  }>({
    google: { value: "", showKey: false, isSaving: false, saveStatus: 'idle' },
    anthropic: { value: "", showKey: false, isSaving: false, saveStatus: 'idle' },
    openai: { value: "", showKey: false, isSaving: false, saveStatus: 'idle' },
    openrouter: { value: "", showKey: false, isSaving: false, saveStatus: 'idle' },
  })

  useEffect(() => {
    setApiKeys(prev => ({
      google: { ...prev.google, value: keys.google || "" },
      anthropic: { ...prev.anthropic, value: keys.anthropic || "" },
      openai: { ...prev.openai, value: keys.openai || "" },
      openrouter: { ...prev.openrouter, value: keys.openrouter || "" },
    }))
  }, [keys])

  const updateApiKey = (providerKey: keyof typeof apiKeys, updates: Partial<ApiKeyState>) => {
    setApiKeys(prev => ({
      ...prev,
      [providerKey]: { ...prev[providerKey], ...updates }
    }))
  }

  const handleSave = async (providerKey: keyof typeof apiKeys) => {
    const provider = providers.find(p => p.key === providerKey)
    const keyValue = apiKeys[providerKey].value

    if (!provider) return

    if (provider.required && !keyValue.trim()) {
      updateApiKey(providerKey, { saveStatus: 'error' })
      toast.error(`${provider.name} API key is required`)
      setTimeout(() => updateApiKey(providerKey, { saveStatus: 'idle' }), 3000)
      return
    }

    try {
      updateApiKey(providerKey, { isSaving: true })
      
      const updatedKeys = {
        ...keys,
        [providerKey]: keyValue.trim()
      }
      setKeys(updatedKeys)
      
      updateApiKey(providerKey, { saveStatus: 'success' })
      toast.success(`${provider.name} API key saved successfully`)
      setTimeout(() => updateApiKey(providerKey, { saveStatus: 'idle' }), 3000)
    } catch (error) {
      console.error(`Failed to save ${provider.name} API key:`, error)
      updateApiKey(providerKey, { saveStatus: 'error' })
      toast.error(`Failed to save ${provider.name} API key`)
      setTimeout(() => updateApiKey(providerKey, { saveStatus: 'idle' }), 3000)
    } finally {
      updateApiKey(providerKey, { isSaving: false })
    }
  }

  const handleClear = async (providerKey: keyof typeof apiKeys) => {
    const provider = providers.find(p => p.key === providerKey)
    if (!provider) return

    try {
      clearKey(providerKey)
      updateApiKey(providerKey, { value: "" })
      toast.success(`${provider.name} API key cleared`)
    } catch (error) {
      console.error(`Failed to clear ${provider.name} API key:`, error)
      toast.error(`Failed to clear ${provider.name} API key`)
    }
  }

  const handleDeleteAttachment = async (attachmentId: Id<"attachments">) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
      try {
        await deleteAttachment({ attachmentId })
        toast.success("File deleted successfully")
      } catch (error) {
        console.error("Failed to delete attachment:", error)
        toast.error("Failed to delete attachment. Please try again.")
      }
    }
  }

  const handleDownloadAttachment = (url: string, fileName: string) => {
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link 
              to="/chat"
              className={cn(
                "flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Chat</span>
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <h1 className="text-base sm:text-lg font-semibold">Settings</h1>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="container max-w-4xl mx-auto py-4 px-4">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <CardTitle className="text-base">Account</CardTitle>
                </div>
                <CardDescription className="text-sm">
                  Your account details and authentication status
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Authenticated>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0">
                        {user?.imageUrl ? (
                          <img 
                            src={user.imageUrl} 
                            alt={user.fullName || "User"} 
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">
                          {user?.fullName || user?.firstName || "User"}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{user?.primaryEmailAddress?.emailAddress}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                        Active
                      </Badge>
                    </div>
                    
                    <div className="flex justify-end">
                      <SignOutButton>
                        <Button variant="outline" size="sm" className="gap-2 text-xs">
                          <LogOut className="h-3 w-3" />
                          Sign Out
                        </Button>
                      </SignOutButton>
                    </div>
                  </div>
                </Authenticated>
                
                <Unauthenticated>
                  <div className="text-center py-4">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-sm mb-2">Not Signed In</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Sign in to save conversations across devices.
                    </p>
                    <SignInButton mode="modal">
                      <Button size="sm" className="gap-2 text-xs">
                        <Mail className="h-3 w-3" />
                        Sign In with Google
                      </Button>
                    </SignInButton>
                  </div>
                </Unauthenticated>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  <CardTitle className="text-base">API Keys</CardTitle>
                </div>
                <CardDescription className="text-sm">
                  Free Gemini access available! Add your keys for more models.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {providers.map((provider) => {
                  const keyState = apiKeys[provider.key]
                  const hasUserApiKey = hasUserKey(provider.key)
                  
                  return (
                    <div key={provider.key} className="space-y-3 p-3 border rounded-lg bg-card/50">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium">
                            {provider.name}
                            {provider.hasHostKey && (
                              <span className="text-muted-foreground text-xs font-normal ml-1">
                                (Free tier)
                              </span>
                            )}
                            {!provider.hasHostKey && provider.required && (
                              <span className="text-muted-foreground text-xs font-normal ml-1">
                                (Required)
                              </span>
                            )}
                          </h3>
                          {hasUserApiKey && (
                            <span className="text-green-600 dark:text-green-400 text-xs">Active</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {provider.hasHostKey && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              🎉 Free models available:
                            </p>
                            <div className="flex gap-1 flex-wrap">
                              {provider.freeModels?.map((model) => (
                                <Badge key={model} variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-0">
                                  {model}
                                </Badge>
                              ))}
                            </div>
                            {provider.models.filter(model => !provider.freeModels?.includes(model)).length > 0 && (
                              <>
                                <p className="text-xs text-muted-foreground">
                                  Premium models with your key:
                                </p>
                                <div className="flex gap-1 flex-wrap">
                                  {provider.models.filter(model => !provider.freeModels?.includes(model)).map((model) => (
                                    <Badge key={model} variant="outline" className="text-xs px-2 py-0">{model}</Badge>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        
                        {!provider.hasHostKey && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              Available models:
                            </p>
                            <div className="flex gap-1 flex-wrap">
                              {provider.models.map((model) => (
                                <Badge key={model} variant="secondary" className="text-xs px-2 py-0">{model}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <label htmlFor={`${provider.key}ApiKey`} className="text-xs font-medium text-foreground">
                            API Key
                          </label>
                          <div className="relative">
                            <Input
                              id={`${provider.key}ApiKey`}
                              type={keyState.showKey ? "text" : "password"}
                              value={keyState.value}
                              onChange={(e) => updateApiKey(provider.key, { value: e.target.value })}
                              placeholder={provider.placeholder}
                              className="pr-8 text-xs h-8"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => updateApiKey(provider.key, { showKey: !keyState.showKey })}
                            >
                              {keyState.showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                          </div>
                          
                          {keyState.value && !provider.validateKey(keyState.value) && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                              Key format may be incorrect
                            </p>
                          )}
                        </div>

                        <div className="text-center">
                          <a 
                            href={provider.helpUrl} 
                            target="_blank" 
                            className="text-xs text-blue-500 hover:underline" 
                            rel="noreferrer"
                          >
                            Get {provider.name} API Key
                          </a>
                        </div>

                        {/* Status Messages */}
                        {keyState.saveStatus === 'success' && (
                          <div className="text-xs text-green-600 dark:text-green-400">
                            ✓ Saved successfully
                          </div>
                        )}
                        
                        {keyState.saveStatus === 'error' && (
                          <div className="text-xs text-red-600 dark:text-red-400">
                            ✗ Failed to save. Please try again.
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleSave(provider.key)}
                            disabled={keyState.isSaving || (!keyState.value.trim() && provider.required)}
                            size="sm"
                            className="flex-1 gap-1 text-xs h-8"
                          >
                            <Save className="h-3 w-3" />
                            {keyState.isSaving ? 'Saving...' : 'Save'}
                          </Button>
                          
                          {hasUserApiKey && (
                            <Button
                              onClick={() => handleClear(provider.key)}
                              variant="outline"
                              size="sm"
                              className="gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs h-8"
                            >
                              <Trash2 className="h-3 w-3" />
                              Clear
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attachments Tab */}
          <TabsContent value="attachments" className="space-y-4">
            {attachments === undefined ? (
              <Card>
                <CardContent className="flex items-center justify-center min-h-[400px]">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading attachments...</p>
                  </div>
                </CardContent>
              </Card>
            ) : attachments.length === 0 ? (
              <Card>
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            onClick={() => attachment.url && handleDownloadAttachment(attachment.url, attachment.fileName)}
                            disabled={!attachment.url}
                            className="flex-1 mr-2"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteAttachment(attachment._id)}
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 
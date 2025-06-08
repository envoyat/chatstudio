"use client"

import { useState, useEffect } from "react"
import { Save, Key, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { Badge } from "@/components/ui/badge"

interface ApiKeyState {
  value: string
  showKey: boolean
  isSaving: boolean
  saveStatus: 'idle' | 'success' | 'error'
}

interface Provider {
  key: 'google' | 'anthropic' | 'openai'
  name: string
  placeholder: string
  helpUrl: string
  models: string[]
  validateKey: (key: string) => boolean
  validationMessage: string
  required?: boolean
}

const providers: Provider[] = [
  {
    key: 'google',
    name: 'Google',
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/apikey',
    models: ['Gemini 2.5 Pro', 'Gemini 2.5 Flash', 'Gemini 2.0 Flash'],
    validateKey: (key: string) => key.startsWith('AIza') && key.length > 30,
    validationMessage: 'API key format appears incorrect. Google AI keys typically start with "AIza"',
    required: true
  },
  {
    key: 'anthropic',
    name: 'Anthropic',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    models: ['Claude 4 Sonnet', 'Claude Haiku 3.5', 'Claude 4 Opus'],
    validateKey: (key: string) => key.startsWith('sk-ant-') && key.length > 20,
    validationMessage: 'API key format appears incorrect. Anthropic keys typically start with "sk-ant-"'
  },
  {
    key: 'openai',
    name: 'OpenAI',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/settings/organization/api-keys',
    models: ['GPT-4.1', 'GPT-4.1-mini', 'GPT-4.1-nano', 'o3', 'o4-mini'],
    validateKey: (key: string) => key.startsWith('sk-') && key.length > 40,
    validationMessage: 'API key format appears incorrect. OpenAI keys typically start with "sk-"'
  }
]

export default function APIKeyForm() {
  const { keys, setKeys } = useAPIKeyStore()
  const [apiKeys, setApiKeys] = useState<{
    google: ApiKeyState
    anthropic: ApiKeyState
    openai: ApiKeyState
  }>({
    google: { value: "", showKey: false, isSaving: false, saveStatus: 'idle' },
    anthropic: { value: "", showKey: false, isSaving: false, saveStatus: 'idle' },
    openai: { value: "", showKey: false, isSaving: false, saveStatus: 'idle' },
  })

  useEffect(() => {
    setApiKeys(prev => ({
      google: { ...prev.google, value: keys.google || "" },
      anthropic: { ...prev.anthropic, value: keys.anthropic || "" },
      openai: { ...prev.openai, value: keys.openai || "" },
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
      
      // Update the store with the new key
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          <CardTitle>Add Your API Keys To Start Chatting</CardTitle>
        </div>
        <CardDescription>Keys are stored locally in your browser.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {providers.map((provider) => {
          const keyState = apiKeys[provider.key]
          
          return (
            <div key={provider.key} className="space-y-4 p-6 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  {provider.name} API Key
                  {provider.required && <span className="text-muted-foreground text-sm font-normal ml-2">(Required)</span>}
                </h3>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Enter your {provider.name} API key to enable {provider.name} models. Your key is stored locally and securely.
                </p>
                
                <div className="flex gap-2">
                  {provider.models.map((model) => (
                    <Badge key={model} variant="secondary">{model}</Badge>
                  ))}
                </div>
                
                <div className="space-y-2">
                  <label htmlFor={`${provider.key}ApiKey`} className="text-sm font-medium text-foreground">
                    API Key
                  </label>
                  <div className="relative">
                    <Input
                      id={`${provider.key}ApiKey`}
                      type={keyState.showKey ? "text" : "password"}
                      value={keyState.value}
                      onChange={(e) => updateApiKey(provider.key, { value: e.target.value })}
                      placeholder={provider.placeholder}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => updateApiKey(provider.key, { showKey: !keyState.showKey })}
                    >
                      {keyState.showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {keyState.value && !provider.validateKey(keyState.value) && (
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      {provider.validationMessage}
                    </p>
                  )}
                </div>

                <a 
                  href={provider.helpUrl} 
                  target="_blank" 
                  className="text-sm text-blue-500 hover:underline inline-block" 
                  rel="noreferrer"
                >
                  Create {provider.name} API Key
                </a>

                {/* Status Messages */}
                {keyState.saveStatus === 'success' && (
                  <div className="text-sm text-green-600 dark:text-green-400">
                    ✓ {provider.name} API key saved successfully
                  </div>
                )}
                
                {keyState.saveStatus === 'error' && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    ✗ Failed to save {provider.name} API key. Please try again.
                  </div>
                )}

                <Button
                  onClick={() => handleSave(provider.key)}
                  disabled={keyState.isSaving || (!keyState.value.trim() && provider.required)}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {keyState.isSaving ? 'Saving...' : `Save ${provider.name} Key`}
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

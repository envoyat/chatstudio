"use client"

import { useState, useEffect } from "react"
import { Save, Key, Eye, EyeOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useAPIKeyStore } from "@/frontend/stores/APIKeyStore"
import { Badge } from "@/components/ui/badge"
import { hasHostAPIKey, FREE_MODELS_WITH_HOST_KEY } from "@/lib/host-config"

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
    key: 'google',
    name: 'Google',
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/apikey',
    models: ['Gemini 2.5 Pro', 'Gemini 2.5 Flash', 'Gemini 2.0 Flash'],
    validateKey: (key: string) => key.startsWith('AIza') && key.length > 30,
    validationMessage: 'API key format appears incorrect. Google AI keys typically start with "AIza"',
    hasHostKey: hasHostAPIKey('google'),
    freeModels: FREE_MODELS_WITH_HOST_KEY.filter(model => ['Gemini 2.5 Flash', 'Gemini 2.0 Flash'].includes(model))
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
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    placeholder: 'sk-or-...',
    helpUrl: 'https://openrouter.ai/keys',
    models: ['deepseek/deepseek-r1-0528:free', 'google/gemini-2.0-flash-exp:free'],
    validateKey: (key: string) => key.startsWith('sk-or-') && key.length > 20,
    validationMessage: 'API key format appears incorrect. OpenRouter keys typically start with "sk-or-"'
  }
]

export default function APIKeyForm() {
  const { keys, setKeys, clearKey, hasUserKey } = useAPIKeyStore()
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          <CardTitle>API Keys - Start Chatting</CardTitle>
        </div>
        <CardDescription>
          Free access to Gemini models is available! Add your own keys for increased rate limits and access to all models.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {providers.map((provider) => {
          const keyState = apiKeys[provider.key]
          const hasUserApiKey = hasUserKey(provider.key)
          
          return (
            <div key={provider.key} className="space-y-4 p-6 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  {provider.name} API Key
                  {provider.hasHostKey && (
                    <span className="text-muted-foreground text-sm font-normal ml-2">(Optional - Free tier available)</span>
                  )}
                  {!provider.hasHostKey && provider.required && (
                    <span className="text-muted-foreground text-sm font-normal ml-2">(Required)</span>
                  )}
                </h3>
              </div>
              
              <div className="space-y-3">
                {provider.hasHostKey ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      🎉 Free access available! You can use the following models without an API key:
                    </p>
                    <div className="flex gap-2">
                      {provider.freeModels?.map((model) => (
                        <Badge key={model} variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {model} (Free)
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Add your own {provider.name} API key for increased rate limits and access to all models:
                    </p>
                    <div className="flex gap-2">
                      {provider.models.filter(model => !provider.freeModels?.includes(model)).map((model) => (
                        <Badge key={model} variant="outline">{model}</Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Enter your {provider.name} API key to enable {provider.name} models. Your key is stored locally and securely.
                    </p>
                    <div className="flex gap-2">
                      {provider.models.map((model) => (
                        <Badge key={model} variant="secondary">{model}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <label htmlFor={`${provider.key}ApiKey`} className="text-sm font-medium text-foreground">
                    API Key {hasUserApiKey && <span className="text-green-600 dark:text-green-400">(Active)</span>}
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

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSave(provider.key)}
                    disabled={keyState.isSaving || (!keyState.value.trim() && provider.required)}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {keyState.isSaving ? 'Saving...' : `Save ${provider.name} Key`}
                  </Button>
                  
                  {hasUserApiKey && (
                    <Button
                      onClick={() => handleClear(provider.key)}
                      variant="outline"
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear Key
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

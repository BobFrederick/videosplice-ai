import { useState, useEffect } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { CheckCircle, XCircle, Spinner, ArrowCounterClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createLLMService } from '@/lib/llm'
import { toast } from 'sonner'

export interface LLMSettings {
  model: string
  provider: 'openai' | 'anthropic' | 'local'
  customPrompt?: string
  openaiApiKey?: string
  anthropicApiKey?: string
  localEndpoint?: string
}

const DEFAULT_PROMPT = `You are a video segmentation expert. Analyze the following transcript and identify logical chapter boundaries where topic changes occur.

For each segment, provide:
1. A descriptive title (3-7 words)
2. Start time in seconds
3. End time in seconds
4. Brief description of the segment content

IMPORTANT: The video duration is {duration} seconds. ALL segment times must be between 0 and {duration} seconds. The last segment's endTime must not exceed {duration} seconds.

Transcript:
{transcript}

Video duration: {duration} seconds

Return the result as a valid JSON object with a single property called "segments" that contains an array of segment objects.

Format:
{
  "segments": [
    {
      "title": "Introduction",
      "startTime": 0,
      "endTime": 45,
      "description": "Brief overview of the topic"
    }
  ]
}`

export function SettingsPage() {
  const [settings, setSettings] = useLocalStorage<LLMSettings>('llm-settings', {
    model: 'gpt-4',
    provider: 'local',
    localEndpoint: 'http://localhost:11434',
    customPrompt: DEFAULT_PROMPT,
  })

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  useEffect(() => {
    if (settings.provider === 'local' && settings.localEndpoint) {
      loadAvailableModels()
    }
  }, [settings.provider, settings.localEndpoint])

  const loadAvailableModels = async () => {
    if (!settings.localEndpoint) return

    setIsLoadingModels(true)
    try {
      // Use backend proxy to avoid CORS issues
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
      const response = await fetch(`${apiUrl}/ollama/tags`)
      
      if (response.ok) {
        const data = await response.json()
        const models = data.models?.map((m: any) => m.name) || []
        setAvailableModels(models)
        
        if (models.length > 0 && !models.includes(settings.model)) {
          setSettings({ ...settings, model: models[0] })
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error)
      setAvailableModels([])
    } finally {
      setIsLoadingModels(false)
    }
  }

  const testConnection = async () => {
    setTestStatus('testing')
    setTestMessage('Testing connection...')

    try {
      if (settings.provider === 'local' && settings.localEndpoint) {
        // Test Ollama connection via backend proxy
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
        const response = await fetch(`${apiUrl}/ollama/test`)
        
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setTestStatus('success')
            setTestMessage(`Connection successful! Found ${data.models} models.`)
            toast.success('Ollama connection test passed!')
          } else {
            setTestStatus('error')
            setTestMessage(data.error || 'Failed to connect to Ollama endpoint.')
            toast.error('Ollama connection failed')
          }
        } else {
          setTestStatus('error')
          setTestMessage('Failed to connect to Ollama endpoint.')
          toast.error('Ollama connection failed')
        }
      } else {
        setTestStatus('error')
        setTestMessage('Only local Ollama testing is currently supported.')
        toast.error('Test not available for this provider')
      }
    } catch (error: any) {
      setTestStatus('error')
      setTestMessage(`Connection failed: ${error.message}`)
      toast.error('Connection failed')
    }
  }

  const resetToDefaults = () => {
    setSettings({
      model: 'gpt-4',
      provider: 'local',
      localEndpoint: 'http://localhost:11434',
      customPrompt: DEFAULT_PROMPT,
    })
    toast.success('Settings reset to defaults')
  }

  return (
    <Card className="bg-white dark:bg-[#21252b] border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle>LLM Configuration</CardTitle>
        <CardDescription>
          Configure the AI model used for video segmentation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="provider" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="provider">Provider</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
          </TabsList>

          <TabsContent value="provider" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider">LLM Provider</Label>
              <Select
                value={settings.provider}
                onValueChange={(value: any) =>
                  setSettings({ ...settings, provider: value })
                }
              >
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local (Ollama)</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {settings.provider === 'local' && (
              <div className="space-y-2">
                <Label htmlFor="localEndpoint">Ollama Endpoint</Label>
                <Input
                  id="localEndpoint"
                  value={settings.localEndpoint || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      localEndpoint: e.target.value,
                    })
                  }
                  placeholder="http://localhost:11434"
                />
                <p className="text-xs text-muted-foreground">
                  Make sure Ollama is running locally
                </p>
              </div>
            )}

            {settings.provider === 'openai' && (
              <div className="space-y-2">
                <Label htmlFor="openaiKey">OpenAI API Key</Label>
                <Input
                  id="openaiKey"
                  type="password"
                  value={settings.openaiApiKey || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      openaiApiKey: e.target.value,
                    })
                  }
                  placeholder="sk-..."
                />
              </div>
            )}

            {settings.provider === 'anthropic' && (
              <div className="space-y-2">
                <Label htmlFor="anthropicKey">Anthropic API Key</Label>
                <Input
                  id="anthropicKey"
                  type="password"
                  value={settings.anthropicApiKey || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      anthropicApiKey: e.target.value,
                    })
                  }
                  placeholder="sk-ant-..."
                />
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={testConnection} disabled={testStatus === 'testing'}>
                {testStatus === 'testing' && (
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                )}
                Test Connection
              </Button>
              <Button variant="outline" onClick={resetToDefaults}>
                <ArrowCounterClockwise className="mr-2 h-4 w-4" />
                Reset to Defaults
              </Button>
            </div>

            {testStatus !== 'idle' && (
              <div
                className={`flex items-center gap-2 p-3 rounded-md ${
                  testStatus === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : testStatus === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                }`}
              >
                {testStatus === 'success' && (
                  <CheckCircle className="h-5 w-5" weight="fill" />
                )}
                {testStatus === 'error' && (
                  <XCircle className="h-5 w-5" weight="fill" />
                )}
                {testStatus === 'testing' && (
                  <Spinner className="h-5 w-5 animate-spin" />
                )}
                <span className="text-sm">{testMessage}</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="model" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              {settings.provider === 'local' && availableModels.length > 0 ? (
                <Select
                  value={settings.model}
                  onValueChange={(value) =>
                    setSettings({ ...settings, model: value })
                  }
                >
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="model"
                  value={settings.model}
                  onChange={(e) =>
                    setSettings({ ...settings, model: e.target.value })
                  }
                  placeholder={
                    settings.provider === 'openai'
                      ? 'gpt-4'
                      : settings.provider === 'anthropic'
                      ? 'claude-3-opus-20240229'
                      : 'llama2'
                  }
                />
              )}
              {isLoadingModels && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Spinner className="h-3 w-3 animate-spin" />
                  Loading available models...
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customPrompt">Custom Prompt Template</Label>
              <Textarea
                id="customPrompt"
                value={settings.customPrompt || DEFAULT_PROMPT}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    customPrompt: e.target.value,
                  })
                }
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use {'{transcript}'} and {'{duration}'} as placeholders
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() =>
                setSettings({
                  ...settings,
                  customPrompt: DEFAULT_PROMPT,
                })
              }
            >
              <ArrowCounterClockwise className="mr-2 h-4 w-4" />
              Reset Prompt
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

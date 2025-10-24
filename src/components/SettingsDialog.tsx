import { useState, useEffect } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { Gear, CheckCircle, XCircle, Spinner, ArrowCounterClockwise } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
      "description": "Opening remarks and overview"
    }
  ]
}`

export function SettingsDialog() {
  const [settings, setSettings] = useLocalStorage<LLMSettings>('llm-settings', {
    model: 'qwen2.5:7b',
    provider: 'local',
    customPrompt: DEFAULT_PROMPT,
    localEndpoint: 'http://localhost:11434',
  })
  
  const [localModel, setLocalModel] = useState(settings?.model || 'qwen2.5:7b')
  const [localProvider, setLocalProvider] = useState<'openai' | 'anthropic' | 'local'>(
    settings?.provider || 'local'
  )
  const [localPrompt, setLocalPrompt] = useState(settings?.customPrompt || DEFAULT_PROMPT)
  const [openaiApiKey, setOpenaiApiKey] = useState(settings?.openaiApiKey || '')
  const [anthropicApiKey, setAnthropicApiKey] = useState(settings?.anthropicApiKey || '')
  const [localEndpoint, setLocalEndpoint] = useState(settings?.localEndpoint || 'http://localhost:11434')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (settings) {
      setLocalModel(settings.model)
      setLocalProvider(settings.provider)
      setLocalPrompt(settings.customPrompt || DEFAULT_PROMPT)
      setOpenaiApiKey(settings.openaiApiKey || '')
      setAnthropicApiKey(settings.anthropicApiKey || '')
      setLocalEndpoint(settings.localEndpoint || 'http://localhost:11434')
    }
  }, [settings])

  const handleSave = () => {
    setSettings({
      model: localModel,
      provider: localProvider,
      customPrompt: localPrompt,
      openaiApiKey: openaiApiKey,
      anthropicApiKey: anthropicApiKey,
      localEndpoint: localEndpoint,
    })
    toast.success('Settings saved', {
      description: 'LLM configuration has been updated',
    })
    setOpen(false)
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)

    try {
      // Create temporary settings object for testing
      const testSettings: LLMSettings = {
        model: localModel,
        provider: localProvider,
        customPrompt: localPrompt,
        openaiApiKey: openaiApiKey,
        anthropicApiKey: anthropicApiKey,
        localEndpoint: localEndpoint,
      }

      const llmService = createLLMService(testSettings)
      const isConnected = await llmService.testConnection()
      
      if (isConnected) {
        setTestResult('success')
        toast.success('Connection successful', {
          description: `${localProvider}/${localModel} is responding correctly`,
        })
      } else {
        setTestResult('error')
        toast.error('Connection failed', {
          description: 'Model test did not return expected response',
        })
      }
    } catch (error) {
      setTestResult('error')
      toast.error('Connection failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleResetPrompt = () => {
    console.log('Reset clicked, current prompt length:', localPrompt.length)
    console.log('Default prompt length:', DEFAULT_PROMPT.length)
    console.log('Setting prompt to:', DEFAULT_PROMPT.substring(0, 50) + '...')
    setLocalPrompt(DEFAULT_PROMPT)
    console.log('Prompt after set:', localPrompt.substring(0, 50) + '...')
    toast.success('Prompt reset to default')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Gear size={16} weight="bold" className="mr-2" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>LLM Settings</DialogTitle>
          <DialogDescription>
            Configure the language model used for video segmentation analysis
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="model" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="model">Model Configuration</TabsTrigger>
            <TabsTrigger value="prompt">Prompt Template</TabsTrigger>
          </TabsList>

          <TabsContent value="model" className="space-y-4 mt-4 min-h-[520px]">
            <Card className="h-[520px]">
              <CardHeader className="min-h-[88px]">
                <CardTitle className="text-base">Model Selection</CardTitle>
                <CardDescription>
                  Choose the AI model for analyzing video transcripts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 min-h-[330px] flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select
                    value={localProvider}
                    onValueChange={(value) => setLocalProvider(value as any)}
                  >
                    <SelectTrigger id="provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="local">Local (Ollama)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select value={localModel} onValueChange={setLocalModel}>
                    <SelectTrigger id="model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {localProvider === 'openai' && (
                        <>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                        </>
                      )}
                      {localProvider === 'anthropic' && (
                        <>
                          <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                          <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                          <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                        </>
                      )}
                      {localProvider === 'local' && (
                        <>
                          <SelectItem value="qwen2.5:7b">Qwen2.5 7B (Best for Analysis)</SelectItem>
                          <SelectItem value="mistral:7b">Mistral 7B (Good Reasoning)</SelectItem>
                          <SelectItem value="llama3.2:1b">Llama 3.2 1B (Fast)</SelectItem>
                          <SelectItem value="llama3.1:8b">Llama 3.1 8B</SelectItem>
                          <SelectItem value="gemma2:9b">Gemma 2 9B</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {localProvider === 'openai' && (
                  <div className="space-y-2">
                    <Label htmlFor="openai-key">OpenAI API Key</Label>
                    <Input
                      id="openai-key"
                      type="password"
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your API key is stored locally in your browser
                    </p>
                  </div>
                )}

                {localProvider === 'anthropic' && (
                  <div className="space-y-2">
                    <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                    <Input
                      id="anthropic-key"
                      type="password"
                      value={anthropicApiKey}
                      onChange={(e) => setAnthropicApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your API key is stored locally in your browser
                    </p>
                  </div>
                )}

                {localProvider === 'local' && (
                  <div className="space-y-2">
                    <Label htmlFor="local-endpoint">Local Endpoint URL</Label>
                    <Input
                      id="local-endpoint"
                      type="text"
                      value={localEndpoint}
                      onChange={(e) => setLocalEndpoint(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      URL for your local LLM server (Ollama, LM Studio)
                    </p>
                  </div>
                )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="flex-1"
                  >
                    {isTesting ? (
                      <>
                        <Spinner size={16} className="mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                  {testResult === 'success' && (
                    <CheckCircle size={20} weight="fill" className="text-accent" />
                  )}
                  {testResult === 'error' && (
                    <XCircle size={20} weight="fill" className="text-destructive" />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prompt" className="space-y-4 mt-4 min-h-[520px]">
            <Card className="h-[520px]">
              <CardHeader className="min-h-[88px]">
                <CardTitle className="text-base">Prompt Template</CardTitle>
                <CardDescription>
                  Customize the prompt sent to the AI model. Use {'{'}transcript{'}'} and {'{'}
                  duration{'}'} as placeholders.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt">System Prompt</Label>
                  <Textarea
                    id="prompt"
                    value={localPrompt}
                    onChange={(e) => setLocalPrompt(e.target.value)}
                    className="font-mono text-sm h-[360px] resize-none"
                    placeholder="Enter your custom prompt template..."
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between gap-2 pt-4">
              <Button 
                variant="outline" 
                size="sm" 
                type="button" 
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleResetPrompt()
                }}
                className="hover:bg-accent hover:text-accent-foreground"
              >
                <ArrowCounterClockwise size={16} weight="bold" className="mr-2" />
                Reset Prompt to Default
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Save Settings</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

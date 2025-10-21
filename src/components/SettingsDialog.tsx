import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Gear, CheckCircle, XCircle, Spinner } from '@phosphor-icons/react'
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
import { toast } from 'sonner'

export interface LLMSettings {
  model: string
  provider: 'openai' | 'anthropic' | 'local'
  customPrompt?: string
}

const DEFAULT_PROMPT = `You are a video segmentation expert. Analyze the following transcript and identify logical chapter boundaries where topic changes occur.

For each segment, provide:
1. A descriptive title (3-7 words)
2. Start time in seconds
3. End time in seconds
4. Brief description of the segment content

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
  const [settings, setSettings] = useKV<LLMSettings>('llm-settings', {
    model: 'gpt-4o',
    provider: 'openai',
    customPrompt: DEFAULT_PROMPT,
  })
  
  const [localModel, setLocalModel] = useState(settings?.model || 'gpt-4o')
  const [localProvider, setLocalProvider] = useState<'openai' | 'anthropic' | 'local'>(
    settings?.provider || 'openai'
  )
  const [localPrompt, setLocalPrompt] = useState(settings?.customPrompt || DEFAULT_PROMPT)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (settings) {
      setLocalModel(settings.model)
      setLocalProvider(settings.provider)
      setLocalPrompt(settings.customPrompt || DEFAULT_PROMPT)
    }
  }, [settings])

  const handleSave = () => {
    setSettings({
      model: localModel,
      provider: localProvider,
      customPrompt: localPrompt,
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
      const testPrompt = spark.llmPrompt`Say "Hello" if you can read this.`
      const response = await spark.llm(testPrompt, localModel)
      
      if (response && response.length > 0) {
        setTestResult('success')
        toast.success('Connection successful', {
          description: `Model ${localModel} is responding correctly`,
        })
      } else {
        setTestResult('error')
        toast.error('Connection failed', {
          description: 'Model returned empty response',
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
    setLocalPrompt(DEFAULT_PROMPT)
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

          <TabsContent value="model" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Model Selection</CardTitle>
                <CardDescription>
                  Choose the AI model for analyzing video transcripts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                          <SelectItem value="llama3">Llama 3</SelectItem>
                          <SelectItem value="mistral">Mistral</SelectItem>
                          <SelectItem value="gemma">Gemma</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
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

          <TabsContent value="prompt" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
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
                    className="font-mono text-sm min-h-[300px]"
                    placeholder="Enter your custom prompt template..."
                  />
                </div>

                <Button variant="outline" size="sm" onClick={handleResetPrompt}>
                  Reset to Default
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

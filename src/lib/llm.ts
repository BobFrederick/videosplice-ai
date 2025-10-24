import type { LLMSettings } from '@/components/SettingsDialog'

export interface LLMResponse {
  text: string
  model: string
  provider: string
}

export class LLMService {
  private settings: LLMSettings

  constructor(settings: LLMSettings) {
    this.settings = settings
  }

  async generateText(prompt: string): Promise<LLMResponse> {
    switch (this.settings.provider) {
      case 'local':
        return this.callOllama(prompt)
      case 'openai':
        return this.callOpenAI(prompt)
      case 'anthropic':
        return this.callAnthropic(prompt)
      default:
        throw new Error(`Unsupported provider: ${this.settings.provider}`)
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const testPrompt = 'Say "Hello" if you can read this.'
      const response = await this.generateText(testPrompt)
      return response.text.toLowerCase().includes('hello')
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }

  private async callOllama(prompt: string): Promise<LLMResponse> {
    const endpoint = this.settings.localEndpoint || 'http://localhost:11434'
    const model = this.settings.model || 'llama3'

    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: 2048,
        }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    if (!data.response) {
      throw new Error('No response from Ollama')
    }

    return {
      text: data.response,
      model: model,
      provider: 'ollama'
    }
  }

  private async callOpenAI(prompt: string): Promise<LLMResponse> {
    if (!this.settings.openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.model || 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('No response from OpenAI')
    }

    return {
      text: data.choices[0].message.content,
      model: this.settings.model || 'gpt-4o',
      provider: 'openai'
    }
  }

  private async callAnthropic(prompt: string): Promise<LLMResponse> {
    if (!this.settings.anthropicApiKey) {
      throw new Error('Anthropic API key not configured')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.settings.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.settings.model || 'claude-3-sonnet-20240229',
        max_tokens: 2048,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    
    if (!data.content?.[0]?.text) {
      throw new Error('No response from Anthropic')
    }

    return {
      text: data.content[0].text,
      model: this.settings.model || 'claude-3-sonnet-20240229',
      provider: 'anthropic'
    }
  }
}

export function createLLMService(settings: LLMSettings): LLMService {
  return new LLMService(settings)
}
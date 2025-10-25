import WebSocket from 'ws'
import { EventEmitter } from 'events'

export interface ClientConnection {
  ws: WebSocket
  clientId: string
  subscribedJobs: Set<string>
}

class WebSocketService extends EventEmitter {
  private wss: WebSocket.Server | null = null
  private clients: Map<string, ClientConnection> = new Map()

  initialize(port: number) {
    this.wss = new WebSocket.Server({ port })
    
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId()
      const connection: ClientConnection = {
        ws,
        clientId,
        subscribedJobs: new Set()
      }
      
      this.clients.set(clientId, connection)
      console.log(`🔌 WebSocket client connected: ${clientId}`)

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleMessage(clientId, message)
        } catch (error) {
          console.error('❌ Invalid WebSocket message:', error)
        }
      })

      ws.on('close', () => {
        this.clients.delete(clientId)
        console.log(`🔌 WebSocket client disconnected: ${clientId}`)
      })

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for client ${clientId}:`, error)
        this.clients.delete(clientId)
      })

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        message: 'Connected to video processing server'
      })
    })

    console.log(`🌐 WebSocket server listening on port ${port}`)
  }

  private handleMessage(clientId: string, message: any) {
    const connection = this.clients.get(clientId)
    if (!connection) return

    switch (message.type) {
      case 'subscribe':
        if (message.jobId) {
          connection.subscribedJobs.add(message.jobId)
          console.log(`📺 Client ${clientId} subscribed to job ${message.jobId}`)
        }
        break
      
      case 'unsubscribe':
        if (message.jobId) {
          connection.subscribedJobs.delete(message.jobId)
          console.log(`📺 Client ${clientId} unsubscribed from job ${message.jobId}`)
        }
        break
    }
  }

  sendJobUpdate(jobId: string, update: any) {
    let sentCount = 0
    
    for (const [clientId, connection] of this.clients) {
      if (connection.subscribedJobs.has(jobId) && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify({
          type: 'job-update',
          jobId,
          ...update
        }))
        sentCount++
      }
    }

    if (sentCount > 0) {
      console.log(`📡 Sent job update to ${sentCount} clients for job ${jobId}`)
    }
  }

  broadcast(message: any) {
    let sentCount = 0
    
    for (const [clientId, connection] of this.clients) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message))
        sentCount++
      }
    }

    console.log(`📡 Broadcasted message to ${sentCount} clients`)
  }

  private sendToClient(clientId: string, message: any) {
    const connection = this.clients.get(clientId)
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message))
    }
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  getConnectedClients(): number {
    return this.clients.size
  }

  close() {
    if (this.wss) {
      this.wss.close()
      this.clients.clear()
      console.log('🔌 WebSocket server closed')
    }
  }
}

export const wsService = new WebSocketService()
export default wsService
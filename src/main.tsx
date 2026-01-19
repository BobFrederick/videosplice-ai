import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Initialize WebSocket connection early
import queueAPI from '@/services/queueAPI'

// Force WebSocket to initialize immediately
console.log('🚀 App starting, WebSocket status:', queueAPI ? 'initialized' : 'not initialized')

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)

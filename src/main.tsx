import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { setupPwa } from './pwa'
import { RenderErrorBoundary } from './components/RenderErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RenderErrorBoundary>
      <App />
    </RenderErrorBoundary>
  </StrictMode>,
)

setupPwa()

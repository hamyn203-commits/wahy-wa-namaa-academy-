import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'
import { initAnalytics } from './utils/analytics'
import { installVitePreloadRecovery } from './lib/chunkRecovery'

installVitePreloadRecovery();
initAnalytics();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

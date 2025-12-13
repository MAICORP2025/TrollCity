import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { LiveKitProvider } from './contexts/LiveKitContext'
import { AuthProvider } from './contexts/AuthProvider'
import { GlobalAppProvider } from './contexts/GlobalAppContext'
// GlobalAppProvider intentionally removed per required root layout

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element (#root) not found')
}

createRoot(rootElement).render(
  <LiveKitProvider>
    <AuthProvider>
      <GlobalAppProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </GlobalAppProvider>
    </AuthProvider>
  </LiveKitProvider>
)

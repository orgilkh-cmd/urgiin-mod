import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Only the Cyrillic and Latin subsets: smaller, and all of it is cached for offline use.
import '@fontsource/noto-sans/cyrillic-400.css'
import '@fontsource/noto-sans/latin-400.css'
import '@fontsource/noto-sans/cyrillic-600.css'
import '@fontsource/noto-sans/latin-600.css'
import '@fontsource/noto-serif/cyrillic-600.css'
import '@fontsource/noto-serif/latin-600.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // Offline support is optional; the app works without it.
  })
}

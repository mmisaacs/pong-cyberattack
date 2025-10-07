import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Dashboard from './Dashboard.jsx'

const root = createRoot(document.getElementById('root'))

function renderByPath() {
  const path = window.location.pathname
  console.log('[main] current path:', path)
  try {
    if (path === '/dashboard') {
      console.log('[main] rendering Dashboard')
      root.render(
        <StrictMode>
          <Dashboard />
        </StrictMode>
      )
    } else {
      console.log('[main] rendering App')
      root.render(
        <StrictMode>
          <App />
        </StrictMode>
      )
    }
  } catch (err) {
    console.error('[main] render error:', err)
    // render a minimal fallback so you can see an error message in the page
    root.render(
      <StrictMode>
        <div style={{padding:20,color:'red',fontFamily:'monospace'}}>Render error: {String(err)}</div>
      </StrictMode>
    )
  }
}

const _pushState = history.pushState
history.pushState = function (...args) {
  const result = _pushState.apply(this, args)
  window.dispatchEvent(new Event('popstate'))
  return result
}

window.addEventListener('popstate', renderByPath)

renderByPath()
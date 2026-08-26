import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerSW } from './lib/pwa'

const boot = document.getElementById('boot')
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
requestAnimationFrame(() => boot?.remove())

registerSW()

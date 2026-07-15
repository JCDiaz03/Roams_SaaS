// Entrada de la SPA.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/global.css'
import { App } from './App'

const raiz = document.getElementById('root')
if (raiz === null) throw new Error('Falta <div id="root"> en index.html')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

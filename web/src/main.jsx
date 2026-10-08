import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { aplicarTema, lerTema } from './tema.js'
import './estilo.css'

// Antes do primeiro desenho, para a página não piscar no tema errado
aplicarTema(lerTema())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

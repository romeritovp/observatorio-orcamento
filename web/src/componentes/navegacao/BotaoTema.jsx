import { useState } from 'react'

import { aplicarTema, lerTema } from '../../tema.js'

const Sol = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

const Lua = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)

// Botão só com ícone (lua no tema claro, sol no escuro), com aria-label e dica. Lógica de tema de tema.js.
export default function BotaoTema() {
  const [tema, setTema] = useState(lerTema)
  const outro = tema === 'escuro' ? 'claro' : 'escuro'
  const rotulo = `Mudar para o tema ${outro}`
  return (
    <button type="button" className="botao-icone" aria-label={rotulo} title={rotulo}
      onClick={() => { aplicarTema(outro); setTema(outro) }}>
      {tema === 'escuro' ? <Sol /> : <Lua />}
    </button>
  )
}

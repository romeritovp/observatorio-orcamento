import { useState } from 'react'

import { VIEW_PADRAO, VIEWS } from '../estado.js'
import { aplicarTema, lerTema } from '../tema.js'

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

// Barra do topo: nome do site, menu das telas e o botão que alterna entre tema claro e escuro.
// O menu são links comuns (?view=...), que também funcionam abertos em outra aba; com onIr, a troca
// acontece sem recarregar. links: {view: string de busca}; view: a tela ativa.
export default function Navegacao({ view = VIEW_PADRAO, links = {}, onIr }) {
  const [tema, setTema] = useState(lerTema)
  const outro = tema === 'escuro' ? 'claro' : 'escuro'

  const alternar = () => {
    aplicarTema(outro)
    setTema(outro)
  }

  return (
    <nav className="nav" aria-label="Principal">
      <div className="nav-interno">
        <a className="nav-marca" href="./">Observatório dos Orçamentos</a>
        <ul className="nav-menu">
          {Object.entries(VIEWS).map(([id, nome]) => (
            <li key={id}>
              <a
                href={links[id] ?? (id === VIEW_PADRAO ? './' : `?view=${id}`)}
                aria-current={view === id ? 'page' : undefined}
                onClick={(e) => {
                  if (!onIr || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                  e.preventDefault()
                  onIr(id)
                }}
              >
                {nome}
              </a>
            </li>
          ))}
        </ul>
        <button type="button" className="nav-tema" onClick={alternar} aria-label={`Mudar para o tema ${outro}`}>
          {tema === 'escuro' ? <Sol /> : <Lua />}
          <span className="nav-tema-texto">Tema {outro}</span>
        </button>
      </div>
    </nav>
  )
}

import { useId, useState } from 'react'

import { buscarUf } from '../../navegacao.config.js'
import { caminhoUf } from '../../rotas.js'

const Lupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
  </svg>
)

// Campo compacto que procura o estado pelo nome ou pela sigla ("pern", "PE") e leva ao painel dele.
// Padrão combobox (ARIA 1.2): setas escolhem a sugestão, Enter vai (a escolhida ou a primeira), Esc fecha.
// onIr(url): navegação sem recarregar (App.jsx). autoFocus: no celular, o campo abre já com o cursor.
export default function BuscaUF({ onIr, autoFocus = false, aoIr }) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [ativo, setAtivo] = useState(0)
  const [aberta, setAberta] = useState(false)
  const sugestoes = buscarUf(texto)
  const listaAberta = aberta && sugestoes.length > 0

  const ir = (uf) => {
    if (!uf) return
    onIr(caminhoUf(uf))
    setTexto('')
    setAberta(false)
    aoIr?.()
  }
  const tecla = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAberta(true)
      if (sugestoes.length) setAtivo((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + sugestoes.length) % sugestoes.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      ir(sugestoes[ativo] ?? sugestoes[0])
    } else if (e.key === 'Escape') {
      setAberta(false)
    }
  }

  return (
    <div className="busca-uf">
      <label htmlFor={`${id}-campo`} className="visualmente-oculto">Buscar estado</label>
      <span className="busca-uf-icone"><Lupa /></span>
      <input id={`${id}-campo`} type="search" role="combobox" autoComplete="off" placeholder="Buscar estado" value={texto}
        autoFocus={autoFocus} aria-autocomplete="list" aria-expanded={listaAberta} aria-controls={`${id}-lista`}
        aria-activedescendant={listaAberta ? `${id}-opcao-${ativo}` : undefined}
        onChange={(e) => { setTexto(e.target.value); setAtivo(0); setAberta(true) }}
        onFocus={() => setAberta(true)} onBlur={() => setTimeout(() => setAberta(false), 150)} onKeyDown={tecla} />
      <ul id={`${id}-lista`} role="listbox" aria-label="Estados encontrados" className="busca-uf-lista" hidden={!listaAberta}>
        {sugestoes.map((uf, i) => (
          <li key={uf.sigla} id={`${id}-opcao-${i}`} role="option" aria-selected={i === ativo}
            onPointerDown={(e) => { e.preventDefault(); ir(uf) }} onPointerEnter={() => setAtivo(i)}>
            <span className="sigla">{uf.sigla}</span> {uf.nome}
          </li>
        ))}
      </ul>
    </div>
  )
}

export { Lupa }

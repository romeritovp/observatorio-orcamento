import { useState } from 'react'

import { BASE, caminho } from '../../rotas.js'
import BotaoTema from './BotaoTema.jsx'
import BuscaUF, { Lupa } from './BuscaUF.jsx'
import DrawerMobile from './DrawerMobile.jsx'
import MegaMenuIndicadores from './MegaMenuIndicadores.jsx'
import MenuSuspenso from './MenuSuspenso.jsx'
import PainelEstados from './PainelEstados.jsx'

// Barra principal, numa linha: marca, Estados ▾, Indicadores ▾, Comparar, Metodologia e, à direita, busca de UF e
// tema. No celular (< 768 px): marca, lupa (abre a busca), tema e o botão que abre a gaveta com o menu inteiro.
// rota: a página atual (rotas.js), para marcar o item ativo; onIr(url): navegação sem recarregar.
export default function Header({ rota, onIr }) {
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [gavetaAberta, setGavetaAberta] = useState(false)
  const temUf = rota.tipo === 'uf' || rota.tipo === 'ufIndicador'
  const atual = (tipo) => (rota.tipo === tipo ? 'page' : undefined)

  return (
    <header className="cabecalho-site">
      <nav className="cabecalho-barra" aria-label="Principal">
        <a className="nav-marca" href={BASE}>Observatório dos Orçamentos</a>
        <ul className="barra-menu">
          <li>
            <MenuSuspenso id="menu-estados" rotulo="Estados" ativo={temUf} classe="estados">
              {(fechar) => <PainelEstados atual={rota.uf?.sigla} aoEscolher={fechar} />}
            </MenuSuspenso>
          </li>
          <li>
            <MenuSuspenso id="menu-indicadores" rotulo="Indicadores" ativo={rota.tipo === 'indicador'} largo>
              {(fechar) => <MegaMenuIndicadores atual={rota.tipo === 'indicador' ? rota.indicador.slug : null} aoEscolher={fechar} />}
            </MenuSuspenso>
          </li>
          <li><a className="barra-item" href={caminho({ tipo: 'comparar' })} aria-current={atual('comparar')}>Comparar</a></li>
          <li><a className="barra-item" href={caminho({ tipo: 'metodologia' })} aria-current={atual('metodologia')}>Metodologia</a></li>
        </ul>
        <div className="barra-acoes">
          <div className="busca-larga"><BuscaUF onIr={onIr} /></div>
          <button type="button" className="botao-icone so-celular" aria-label="Buscar estado" title="Buscar estado"
            aria-expanded={buscaAberta} aria-controls="busca-celular" onClick={() => setBuscaAberta((a) => !a)}>
            <Lupa />
          </button>
          <BotaoTema />
          <button type="button" className="botao-icone so-celular" aria-label="Abrir o menu" title="Menu"
            aria-expanded={gavetaAberta} aria-controls="gaveta-menu" onClick={() => setGavetaAberta(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>
      {buscaAberta && (
        <div id="busca-celular" className="busca-celular so-celular">
          <BuscaUF onIr={onIr} autoFocus aoIr={() => setBuscaAberta(false)} />
        </div>
      )}
      <DrawerMobile aberto={gavetaAberta} rota={rota} onFechar={() => setGavetaAberta(false)} />
    </header>
  )
}

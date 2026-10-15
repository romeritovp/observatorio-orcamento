import { useEffect, useRef } from 'react'

import { INDICADORES_POR_EIXO, UFS_POR_REGIAO } from '../../navegacao.config.js'
import { caminho, caminhoIndicador, caminhoUf } from '../../rotas.js'

// Gaveta do celular, em tela cheia: seções que abrem e fecham ("Estados", por região; "Indicadores", por eixo) e os
// links Comparar e Metodologia. Fecha com o botão, com Esc e ao escolher um link; o foco vai para o botão de fechar
// ao abrir e a página de trás não rola.
export default function DrawerMobile({ aberto, rota, onFechar }) {
  const fecharRef = useRef(null)
  useEffect(() => {
    if (!aberto) return undefined
    fecharRef.current?.focus()
    const esc = (e) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', esc)
    document.body.classList.add('sem-rolagem')
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.classList.remove('sem-rolagem')
    }
  }, [aberto, onFechar])
  if (!aberto) return null

  const fecharAoClicar = (e) => { if (e.target.closest('a')) onFechar() }
  return (
    <div id="gaveta-menu" className="gaveta" role="dialog" aria-modal="true" aria-label="Menu" onClick={fecharAoClicar}>
      <div className="gaveta-topo">
        <span className="nav-marca">Observatório dos Orçamentos</span>
        <button ref={fecharRef} type="button" className="botao-icone" aria-label="Fechar o menu" title="Fechar" onClick={onFechar}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <nav aria-label="Menu do celular">
        <details className="gaveta-secao" open={rota.tipo === 'uf' || rota.tipo === 'ufIndicador'}>
          <summary>Estados</summary>
          {UFS_POR_REGIAO.map(({ regiao, ufs }) => (
            <details key={regiao} className="gaveta-subsecao" open={ufs.some((u) => u.sigla === rota.uf?.sigla)}>
              <summary>{regiao}</summary>
              <ul>
                {ufs.map((uf) => (
                  <li key={uf.sigla}>
                    <a href={caminhoUf(uf)} aria-current={uf.sigla === rota.uf?.sigla ? 'page' : undefined}>
                      <span className="sigla">{uf.sigla}</span> {uf.nome}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </details>
        <details className="gaveta-secao" open={rota.tipo === 'indicador'}>
          <summary>Indicadores</summary>
          {INDICADORES_POR_EIXO.map(({ eixo, indicadores }) => (
            <div key={eixo.slug} className="gaveta-subsecao">
              <h3>{eixo.nome}</h3>
              <ul>
                {indicadores.map((i) => (
                  <li key={i.slug}>
                    {i.disponivel
                      ? <a href={caminhoIndicador(i)} aria-current={rota.indicador?.slug === i.slug && rota.tipo === 'indicador' ? 'page' : undefined}>{i.nome}</a>
                      : <span className="indisponivel" aria-disabled="true">{i.nome} <span className="selo-em-breve">em breve</span></span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </details>
        <a className="gaveta-link" href={caminho({ tipo: 'comparar' })} aria-current={rota.tipo === 'comparar' ? 'page' : undefined}>Comparar</a>
        <a className="gaveta-link" href={caminho({ tipo: 'metodologia' })} aria-current={rota.tipo === 'metodologia' ? 'page' : undefined}>Metodologia</a>
      </nav>
    </div>
  )
}

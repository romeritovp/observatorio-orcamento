import { useEffect, useRef } from 'react'

import { doNome, INDICADORES, UFS_POR_REGIAO } from '../../navegacao.config.js'
import { caminhoUf } from '../../rotas.js'

// Faixa fixa (sticky) abaixo do cabeçalho, só nas páginas de um estado: seletor de UF e abas dos indicadores.
// Trocar a UF mantém o indicador (/sp/pib → /pe/pib); trocar a aba mantém a UF. No celular, o seletor ocupa a
// largura toda e as abas rolam na horizontal, com a ativa à vista ao carregar.
export default function SubheaderUF({ uf, indicador, onIr }) {
  const abas = useRef(null)
  useEffect(() => {
    const faixa = abas.current
    const ativa = faixa?.querySelector('[aria-current="page"]')
    if (faixa && ativa) faixa.scrollLeft = ativa.offsetLeft - (faixa.clientWidth - ativa.offsetWidth) / 2
  }, [uf.sigla, indicador?.slug])

  return (
    <div className="subcabecalho-uf">
      <div className="subcabecalho-interno">
        <label className="visualmente-oculto" htmlFor="seletor-uf">Estado</label>
        <select id="seletor-uf" className="seletor-uf" value={uf.slug}
          onChange={(e) => onIr(caminhoUf(UFS_POR_REGIAO.flatMap((r) => r.ufs).find((u) => u.slug === e.target.value), indicador))}>
          {UFS_POR_REGIAO.map(({ regiao, ufs }) => (
            <optgroup key={regiao} label={regiao}>
              {ufs.map((u) => <option key={u.sigla} value={u.slug}>{u.nome}</option>)}
            </optgroup>
          ))}
        </select>
        <nav aria-label={`Indicadores ${doNome(uf)}`}>
          <ul ref={abas} className="abas-indicadores">
            <li><a href={caminhoUf(uf)} aria-current={!indicador ? 'page' : undefined}>Visão geral</a></li>
            {INDICADORES.map((i) => (
              <li key={i.slug}>
                {i.disponivel
                  ? <a href={caminhoUf(uf, i)} aria-current={indicador?.slug === i.slug ? 'page' : undefined}>{i.nome}</a>
                  : <span className="indisponivel" aria-disabled="true">{i.nome}</span>}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}

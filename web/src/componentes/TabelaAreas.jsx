import { Fragment } from 'react'

import { TABELAS } from '../estado.js'
import { csv } from '../formatacao.js'

const NOME_DEMAIS = { demais: 'Demais subfunções', demais_calculado: 'Demais subfunções (calculado)' }

// Tabela áreas × anos com seletor de métrica e CSV no cabeçalho. Cada área abre as subáreas
// (subfunções e "demais") logo abaixo; várias podem ficar abertas. O CSV traz sempre áreas e subáreas,
// com a coluna "nivel" e os números sem arredondar.
// linhas: tabelaAreasPorAno; subareas: Map funcao_cod → tabelaSubareasPorAno; formatar: número → texto.
export default function TabelaAreas({ linhas, subareas, anos, nomes, nomesSub, titulo, unidade, metrica, formatar,
  destaqueArea, anoSelecionado, abertas, nomeArquivo, onMudarMetrica, onAlternarArea }) {
  const nomeSub = (s) => NOME_DEMAIS[s.nivel] ?? nomesSub[s.subfuncao_cod] ?? s.subfuncao_cod

  const baixar = () => {
    const corpo = linhas.flatMap((l) => [
      ['area', nomes[l.funcao_cod], '', ...l.valores],
      ...(subareas.get(l.funcao_cod) ?? []).map((s) => ['subarea', nomes[l.funcao_cod], nomeSub(s), ...s.valores]),
    ])
    const conteudo = csv([['nivel', 'Área', 'Subárea', ...anos.map(String)], ...corpo])
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = nomeArquivo
    link.click()
    URL.revokeObjectURL(url)
  }

  const classeAno = (ano) => (ano === anoSelecionado ? 'ano-ativo' : '')

  return (
    <div>
      <div className="tabela-cabecalho">
        <h3>{titulo}</h3>
        <div className="tabela-acoes">
          <div className="alternador alternador-pequeno" role="group" aria-label="Métrica da tabela">
            {Object.entries(TABELAS).map(([m, nome]) => (
              <button key={m} type="button" aria-pressed={metrica === m} onClick={() => onMudarMetrica(m)}>{nome}</button>
            ))}
          </div>
          <button type="button" className="botao" onClick={baixar}>Baixar CSV</button>
        </div>
      </div>
      <p className="nota unidade-tabela">
        {unidade} Toque numa área para ver as subáreas.
        {metrica === 'pct_total' && ' Nas subáreas, o % também é sobre o orçamento total do estado.'}
      </p>
      <div className="rolagem">
        <table className="tabela tabela-areas numeros">
          <thead>
            <tr>
              <th scope="col">Área</th>
              {anos.map((a) => <th key={a} scope="col" className={classeAno(a)}>{a}</th>)}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const subs = subareas.get(l.funcao_cod) ?? []
              const aberta = abertas.includes(l.funcao_cod)
              return (
                <Fragment key={l.funcao_cod}>
                  <tr className={[l.funcao_cod === destaqueArea ? 'destaque' : '', aberta ? 'aberta' : ''].join(' ').trim()}>
                    <th scope="row">
                      {subs.length > 0 ? (
                        <button type="button" className="abrir-area" aria-expanded={aberta} onClick={() => onAlternarArea(l.funcao_cod)}>
                          <span className="indicador" aria-hidden="true">{aberta ? '▾' : '▸'}</span>
                          {nomes[l.funcao_cod]}
                        </button>
                      ) : <span className="sem-indicador">{nomes[l.funcao_cod]}</span>}
                    </th>
                    {l.valores.map((v, i) => <td key={anos[i]} className={classeAno(anos[i])}>{formatar(v)}</td>)}
                  </tr>
                  {aberta && subs.map((s) => (
                    <tr key={`${s.nivel}-${s.subfuncao_cod}`} className="subarea">
                      <th scope="row">{nomeSub(s)}</th>
                      {s.valores.map((v, i) => <td key={anos[i]} className={classeAno(anos[i])}>{formatar(v)}</td>)}
                    </tr>
                  ))}
                  {aberta && (
                    <tr className="soma-subareas">
                      <td colSpan={anos.length + 1}>soma das subáreas = total da área</td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

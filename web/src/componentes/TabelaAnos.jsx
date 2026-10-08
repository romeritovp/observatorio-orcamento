import { csv } from '../formatacao.js'

// Tabela indicadores × anos com Baixar CSV no cabeçalho (o CSV traz o que está na tabela, sem arredondar).
// linhas: [{id, rotulo, valores: [por ano], formatar(v) → texto}].
// metricas (opcional): {id: nome} para um seletor no cabeçalho, com `metrica` e `onMudarMetrica`.
export default function TabelaAnos({ titulo, nota, linhas, anos, anoSelecionado, nomeArquivo, metricas, metrica, onMudarMetrica }) {
  const baixar = () => {
    const conteudo = csv([['Indicador', ...anos.map(String)], ...linhas.map((l) => [l.rotulo, ...l.valores])])
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = nomeArquivo
    link.click()
    URL.revokeObjectURL(url)
  }
  const classeAno = (a) => (a === anoSelecionado ? 'ano-ativo' : '')
  return (
    <div>
      <div className="tabela-cabecalho">
        <h3>{titulo}</h3>
        <div className="tabela-acoes">
          {metricas && (
            <div className="alternador alternador-pequeno" role="group" aria-label="Métrica da tabela">
              {Object.entries(metricas).map(([m, nome]) => (
                <button key={m} type="button" aria-pressed={metrica === m} onClick={() => onMudarMetrica(m)}>{nome}</button>
              ))}
            </div>
          )}
          <button type="button" className="botao" onClick={baixar}>Baixar CSV</button>
        </div>
      </div>
      {nota && <p className="nota unidade-tabela">{nota}</p>}
      <div className="rolagem">
        <table className="tabela tabela-areas numeros">
          <thead>
            <tr><th scope="col">Indicador</th>{anos.map((a) => <th key={a} scope="col" className={classeAno(a)}>{a}</th>)}</tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <th scope="row">{l.rotulo}</th>
                {l.valores.map((v, i) => <td key={anos[i]} className={classeAno(anos[i])}>{l.formatar(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

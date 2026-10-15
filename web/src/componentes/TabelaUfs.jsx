import { csv } from '../formatacao.js'

// Tabela de estados com colunas definidas pela tela e Baixar CSV (o CSV traz os números sem arredondar).
// colunas: [{id, titulo, valor(linha) → número/texto, formatar(valor) → texto, classe}];
// linhas: na ordem de exibição, cada uma com `uf`; destaque: UF em destaque; pares: UFs comparadas.
export default function TabelaUfs({ titulo, colunas, linhas, destaque, pares = [], nomeArquivo, nota }) {
  const baixar = () => {
    const conteudo = csv([colunas.map((c) => c.titulo), ...linhas.map((l) => colunas.map((c) => c.valor(l)))])
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = nomeArquivo
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div>
      <div className="tabela-cabecalho">
        <h3>{titulo}</h3>
        <button type="button" className="botao" onClick={baixar}>Baixar CSV</button>
      </div>
      <div className="rolagem">
        <table className="tabela tabela-estados numeros">
          <thead><tr>{colunas.map((c) => <th key={c.id} scope="col" className={c.classe}>{c.titulo}</th>)}</tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.uf} className={l.uf === destaque ? 'destaque' : pares.includes(l.uf) ? 'par' : undefined}>
                {colunas.map((c) => <td key={c.id} className={c.classe}>{c.formatar(c.valor(l))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nota && <p className="nota">{nota}</p>}
    </div>
  )
}

import { csv, data, numero, pct } from '../formatacao.js'

const dinheiro = (v) => numero(v, 2) // a unidade (R$) está no cabeçalho

// Tabela de auditoria: os 27 estados no ano escolhido, na ordem do ranking, com cada passo da conta.
// O CSV baixa exatamente estas colunas e linhas (com os números sem arredondar).
// colunas: [{id, titulo, valor(linha) → número/texto, formatar(valor) → texto, classe}]
function colunasDaTabela({ metrica, valores, anoBase, nomes, fonteCurta }) {
  const resultado = metrica === 'pct_total'
    ? { titulo: '% do orçamento', valor: (l) => l.pct_despesa_total, formatar: (v) => pct(v, 2) }
    : valores === 'epoca'
      ? { titulo: 'Por habitante (R$ da época)', valor: (l) => l.per_capita_nominal, formatar: dinheiro }
      : { titulo: `Por habitante (R$ dez/${anoBase})`, valor: (l) => l.per_capita_real, formatar: dinheiro }
  const posicao = metrica === 'pct_total' ? 'posicao_pct_despesa_total'
    : valores === 'epoca' ? 'posicao_per_capita_nominal' : 'posicao_per_capita_real'

  return [
    { id: 'posicao', titulo: 'Posição', valor: (l) => l[posicao], formatar: (v) => `${v}º` },
    { id: 'estado', titulo: 'Estado', valor: (l) => `${l.uf} · ${nomes[l.uf]}`, formatar: (v) => v, classe: 'estado' },
    { id: 'nominal', titulo: 'Valor gasto (R$ da época)', valor: (l) => l.nominal, formatar: dinheiro },
    { id: 'fator', titulo: `Fator IPCA (→ dez/${anoBase})`, valor: (l) => l.fator_ipca, formatar: (v) => numero(v, 6) },
    { id: 'real', titulo: `Valor corrigido (R$ dez/${anoBase})`, valor: (l) => l.real, formatar: dinheiro },
    { id: 'populacao', titulo: 'População', valor: (l) => l.populacao, formatar: (v) => numero(v) },
    ...(metrica === 'pct_total'
      ? [{ id: 'total', titulo: 'Despesa total do estado (R$ da época)', valor: (l) => l.total_despesa, formatar: dinheiro }]
      : []),
    { id: 'resultado', titulo: resultado.titulo, valor: resultado.valor, formatar: resultado.formatar, classe: 'resultado' },
    { id: 'obs', titulo: 'Observação', valor: (l) => (l.sem_gasto_declarado ? 'sem gasto declarado' : ''), formatar: (v) => v, classe: 'obs' },
    { id: 'fonte', titulo: 'Fonte', valor: () => fonteCurta, formatar: (v) => v, classe: 'fonte' },
    { id: 'extracao', titulo: 'Extraído em', valor: (l) => l.extraido_em, formatar: (v) => data(v) },
  ]
}

export default function TabelaEstados({ linhas, destaque, ano, nomeArea, metrica, valores, anoBase, nomes, fonteCurta }) {
  const colunas = colunasDaTabela({ metrica, valores, anoBase, nomes, fonteCurta })

  const baixar = () => {
    const conteudo = csv([colunas.map((c) => c.titulo), ...linhas.map((l) => colunas.map((c) => c.valor(l)))])
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `estados_${nomeArea.toLocaleLowerCase('pt-BR').replaceAll(' ', '-')}_${ano}_${metrica}${metrica === 'pct_total' ? '' : `_${valores}`}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="tabela-cabecalho">
        <h2>Os {linhas.length} estados em {ano}: {nomeArea.toLocaleLowerCase('pt-BR')}, passo a passo</h2>
        <button type="button" className="botao" onClick={baixar}>Baixar CSV</button>
      </div>
      <div className="rolagem">
        <table className="tabela tabela-estados numeros">
          <thead><tr>{colunas.map((c) => <th key={c.id} scope="col" className={c.classe}>{c.titulo}</th>)}</tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.uf} className={[l.uf === destaque ? 'destaque' : '', l.sem_gasto_declarado ? 'sem-gasto' : ''].join(' ').trim()}>
                {colunas.map((c) => <td key={c.id} className={c.classe}>{c.formatar(c.valor(l))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nota">
        Valor corrigido = valor gasto × fator IPCA. Por habitante = valor (corrigido ou da época) ÷ população.
        % do orçamento = valor gasto ÷ despesa total do estado (soma de todas as áreas, sem intraorçamentárias) × 100.
      </p>
    </div>
  )
}

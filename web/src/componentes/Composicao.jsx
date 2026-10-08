import { pct, reaisCompacto } from '../formatacao.js'

// Composição do orçamento: uma barra por área, já na ordem (recebida pronta), com o % do orçamento,
// o valor e um selo com a posição do estado na área entre os estados. Tocar numa área a seleciona.
// linhas: composicaoDoAno; colunaValor: 'real' ou 'nominal'; nomes: funcao_cod → nome.
export default function Composicao({ linhas, colunaValor, nomes, selecionada, onEscolher }) {
  const maximo = Math.max(...linhas.map((l) => l.pct_despesa_total ?? 0)) || 1
  return (
    <ol className="composicao numeros">
      {linhas.map((l) => {
        const ativa = l.funcao_cod === selecionada
        const posicao = l.posicao_pct_despesa_total
        return (
          <li key={l.funcao_cod} className={ativa ? 'ativa' : ''}>
            <button
              type="button" className="linha-composicao" onClick={() => onEscolher(l.funcao_cod)} aria-pressed={ativa}
              aria-label={`${nomes[l.funcao_cod]}: ${pct(l.pct_despesa_total)} do orçamento, ${reaisCompacto(l[colunaValor])}`
                + `${l.sem_gasto_declarado ? ', sem gasto declarado' : `, ${posicao}º de ${l.n_ufs} estados`}`}
            >
              <span className="area">{nomes[l.funcao_cod]}</span>
              <span className="trilho">
                <span className="barra" style={{ width: `${((l.pct_despesa_total ?? 0) / maximo) * 100}%` }} />
              </span>
              <span className="pct">{l.sem_gasto_declarado ? 'sem gasto declarado' : pct(l.pct_despesa_total)}</span>
              <span className="valor">{l.sem_gasto_declarado ? '' : reaisCompacto(l[colunaValor])}</span>
              <span className="selo" title="Posição do estado nesta área entre os estados, no % do orçamento">
                {l.sem_gasto_declarado ? '' : `${posicao}º/${l.n_ufs}`}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

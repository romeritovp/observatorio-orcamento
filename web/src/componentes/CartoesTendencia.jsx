// Cards de tendência, um por janela (últimos N anos e série completa). Só exibem textos prontos.
// itens: [{id, rotulo, valor, categoria, linhas: [texto]}]; selecionado: id do card cuja tendência aparece no
// gráfico; onEscolher(id): troca a janela.
export default function CartoesTendencia({ itens, selecionado, onEscolher }) {
  return (
    <ul className="cartoes-tendencia numeros">
      {itens.map((i) => (
        <li key={i.id}>
          <button type="button" className="cartao-tendencia" aria-pressed={i.id === selecionado} onClick={() => onEscolher(i.id)}>
            <span className="rotulo">{i.rotulo}</span>
            <span className="valor">{i.valor}</span>
            {i.categoria && <span className="categoria">{i.categoria}</span>}
            {i.linhas.map((l) => <span key={l} className="linha">{l}</span>)}
          </button>
        </li>
      ))}
    </ul>
  )
}

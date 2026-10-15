// Barras horizontais agrupadas: para cada item, uma barra por série (ex.: a UF, a média da região e a do Brasil).
// itens: [{id, rotulo, valores: {serie: número}}]; series: [{id, rotulo, classe}] na ordem das barras;
// maximo: valor que ocupa a barra inteira; formatar(v) → texto. Só desenha.
export default function BarrasComparadas({ itens, series, maximo, formatar, rotuloAcessivel }) {
  return (
    <div>
      <ul className="legenda">
        {series.map((s) => <li key={s.id}><span className={`amostra ${s.classe}`} />{s.rotulo}</li>)}
      </ul>
      <ul className="barras-comparadas numeros" aria-label={rotuloAcessivel}>
        {itens.map((i) => (
          <li key={i.id}>
            <span className="rotulo">{i.rotulo}</span>
            <span className="grupo">
              {series.map((s) => {
                const v = i.valores[s.id]
                return (
                  <span key={s.id} className={`linha-barra ${s.classe}`} aria-label={`${s.rotulo}: ${formatar(v)}`}>
                    <span className="trilho"><span className="barra" style={{ width: `${Math.max(v ?? 0, 0) / maximo * 100}%` }} /></span>
                    <span className="texto">{formatar(v)}</span>
                  </span>
                )
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Barras horizontais simples, já na ordem recebida. itens: [{id, rotulo, valor, texto, destaque}].
// valor: comprimento da barra (≥ 0); texto: o que aparece à direita (pronto). Só desenha.
export default function BarrasHorizontais({ itens, rotuloAcessivel }) {
  const maximo = Math.max(...itens.map((i) => Math.max(i.valor ?? 0, 0))) || 1
  return (
    <ul className="barras-horizontais numeros" aria-label={rotuloAcessivel}>
      {itens.map((i) => (
        <li key={i.id} className={i.destaque ? 'destaque' : ''}>
          <span className="rotulo">{i.rotulo}</span>
          <span className="trilho"><span className="barra" style={{ width: `${(Math.max(i.valor ?? 0, 0) / maximo) * 100}%` }} /></span>
          <span className="texto">{i.texto}</span>
        </li>
      ))}
    </ul>
  )
}

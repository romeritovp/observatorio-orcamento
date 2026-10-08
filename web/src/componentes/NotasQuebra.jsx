// Notas de quebra de série (mudança de dependência de estatal), abaixo dos gráficos de evolução.
export default function NotasQuebra({ avisos, fonte }) {
  if (avisos.length === 0) return null
  return (
    <div className="notas-quebra">
      {avisos.map((a) => <p key={a.id} className="nota">{a.texto}</p>)}
      <p className="nota fonte-quebra">{fonte}</p>
    </div>
  )
}

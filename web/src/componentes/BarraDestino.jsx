import { pct, reaisCompacto } from '../formatacao.js'

// Uma barra horizontal empilhada: como um total se divide (ex.: ICMS arrecadado → municípios, FUNDEB,
// estado). partes: [{id, rotulo, valor, classe}] na ordem da barra; total: o 100% da barra. Só desenha.
export default function BarraDestino({ titulo, total, partes }) {
  const visiveis = partes.filter((p) => p.valor > 0)
  return (
    <figure className="barra-destino">
      <figcaption><strong>{titulo}</strong> <span className="nota">arrecadado: {reaisCompacto(total)}</span></figcaption>
      <div className="barra-destino-trilho" role="img"
        aria-label={visiveis.map((p) => `${p.rotulo}: ${reaisCompacto(p.valor)} (${pct((p.valor / total) * 100)})`).join('; ')}>
        {visiveis.map((p) => <span key={p.id} className={`parte ${p.classe}`} style={{ width: `${(p.valor / total) * 100}%` }} />)}
      </div>
      <ul className="legenda barra-destino-legenda numeros">
        {visiveis.map((p) => (
          <li key={p.id}><span className={`amostra ${p.classe}`} />{p.rotulo}: {reaisCompacto(p.valor)} ({pct((p.valor / total) * 100)})</li>
        ))}
      </ul>
    </figure>
  )
}

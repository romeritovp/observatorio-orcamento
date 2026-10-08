// Ressalvas lidas do meta.json: avisos de estatais do estado em destaque e as específicas da
// área primeiro, depois as gerais. avisos: [{id, texto}] (textos prontos); fonteAvisos: atribuição.
export default function Ressalvas({ ressalvas, daArea = [], nomeArea, avisos = [], fonteAvisos }) {
  return (
    <ul className="ressalvas">
      {avisos.map((a) => (
        <li key={a.id} className="ressalva-estatal">
          <strong>Estatal fora destas contas</strong>
          <p>{a.texto}</p>
          {fonteAvisos && <p className="nota">{fonteAvisos}</p>}
        </li>
      ))}
      {daArea.map((r) => (
        <li key={r.id} className="ressalva-area"><strong>{nomeArea}: {r.titulo}</strong><p>{r.texto}</p></li>
      ))}
      {ressalvas.map((r) => <li key={r.id}><strong>{r.titulo}</strong><p>{r.texto}</p></li>)}
    </ul>
  )
}

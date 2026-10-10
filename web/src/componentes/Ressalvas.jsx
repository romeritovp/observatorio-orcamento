import { linkEntenda } from '../conteudo/metodo/ligacoes.js'

/** Link "entenda" para a explicação na página "Como fazemos" (nada se a ressalva não tiver ligação). */
export function Entenda({ id }) {
  const href = linkEntenda(id)
  return href ? <a className="entenda" href={href}>entenda</a> : null
}

// Ressalvas lidas do meta.json: avisos de estatais do estado em destaque e as específicas da
// área primeiro, depois as gerais. avisos: [{id, texto}] (textos prontos); fonteAvisos: atribuição.
// semInfoEstatais: texto para ano sem cadastro de estatais (antes da primeira edição), ou null.
// Cada item leva o link "entenda" para a seção correspondente da página "Como fazemos".
export default function Ressalvas({ ressalvas, daArea = [], nomeArea, avisos = [], fonteAvisos, semInfoEstatais = null }) {
  return (
    <ul className="ressalvas">
      {semInfoEstatais && (
        <li key="sem-info-estatais" className="ressalva-estatal">
          <strong>Estatais</strong><p>{semInfoEstatais} <Entenda id="sem_info_estatais" /></p>
        </li>
      )}
      {avisos.map((a) => (
        <li key={a.id} className="ressalva-estatal">
          <strong>Estatal fora destas contas</strong>
          <p>{a.texto} <Entenda id="aviso_estatal" /></p>
          {fonteAvisos && <p className="nota">{fonteAvisos}</p>}
        </li>
      ))}
      {daArea.map((r) => (
        <li key={r.id} className="ressalva-area"><strong>{nomeArea}: {r.titulo}</strong><p>{r.texto} <Entenda id={r.id} /></p></li>
      ))}
      {ressalvas.map((r) => <li key={r.id}><strong>{r.titulo}</strong><p>{r.texto} <Entenda id={r.id} /></p></li>)}
    </ul>
  )
}

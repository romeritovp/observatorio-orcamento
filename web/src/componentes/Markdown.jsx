// Elementos React a partir da árvore de `lerMarkdown` (src/markdown.js). Sem innerHTML: o texto nunca vira HTML.

import { lerMarkdown } from '../markdown.js'

const externo = (href) => /^https?:\/\//.test(href)

function Inline({ partes }) {
  return partes.map((p, i) => {
    if (p.tipo === 'texto') return p.texto
    if (p.tipo === 'codigo') return <code key={i}>{p.texto}</code>
    if (p.tipo === 'negrito') return <strong key={i}><Inline partes={p.filhos} /></strong>
    if (p.tipo === 'italico') return <em key={i}><Inline partes={p.filhos} /></em>
    return (
      <a key={i} href={p.href} {...(externo(p.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        <Inline partes={p.filhos} />
      </a>
    )
  })
}

function Bloco({ bloco, deslocarTitulos }) {
  switch (bloco.tipo) {
    case 'titulo': {
      const Nivel = `h${Math.min(6, bloco.nivel + deslocarTitulos)}`
      return <Nivel id={bloco.id}><Inline partes={bloco.filhos} /></Nivel>
    }
    case 'paragrafo': return <p><Inline partes={bloco.filhos} /></p>
    case 'lista': {
      const Lista = bloco.ordenada ? 'ol' : 'ul'
      return <Lista>{bloco.itens.map((item, i) => <li key={i}><Inline partes={item} /></li>)}</Lista>
    }
    case 'citacao': return <aside className="md-destaque"><Blocos blocos={bloco.blocos} deslocarTitulos={deslocarTitulos} /></aside>
    case 'codigo': return <pre className="md-codigo"><code>{bloco.texto}</code></pre>
    case 'linha': return <hr />
    case 'tabela': return (
      <div className="rolagem">
        <table className="tabela md-tabela">
          <thead><tr>{bloco.cabecalho.map((c, i) => <th key={i} scope="col"><Inline partes={c} /></th>)}</tr></thead>
          <tbody>
            {bloco.linhas.map((linha, i) => (
              <tr key={i}>{linha.map((c, j) => <td key={j}><Inline partes={c} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    default: throw new Error(`bloco desconhecido: ${bloco.tipo}`)
  }
}

function Blocos({ blocos, deslocarTitulos = 0 }) {
  return blocos.map((b, i) => <Bloco key={i} bloco={b} deslocarTitulos={deslocarTitulos} />)
}

/** Texto Markdown (já preenchido) → elementos. deslocarTitulos: soma ao nível dos títulos (# vira h2 com 1). */
export default function Markdown({ texto, deslocarTitulos = 0 }) {
  return <Blocos blocos={lerMarkdown(texto)} deslocarTitulos={deslocarTitulos} />
}

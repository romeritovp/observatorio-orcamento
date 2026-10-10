// Leitor de Markdown pequeno, só para os textos de src/conteudo/ (sem biblioteca externa).
// Duas etapas: `lerMarkdown` (aqui) monta uma árvore simples, que os testes usam para conferir âncoras e
// links; o componente `Markdown` (componentes/Markdown.jsx) a transforma em elementos React (sem innerHTML).
//
// O que entende: títulos (# a ####, com âncora opcional {#id}), parágrafos, listas (- e 1.), citação (>),
// tabela (| a | b |, com a linha |---|), bloco de código (```), linha horizontal (---) e, no texto,
// **negrito**, *itálico*, `código` e [link](endereço). Marcadores {{chave}} são trocados antes, por `preencher`.

/** "Liquidado (despesa)" → "liquidado-despesa": âncora a partir do texto do título. */
export function ancora(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Troca cada {{caminho.da.chave}} pelo valor em `valores` (objeto aninhado). Chave desconhecida é erro:
 * melhor não publicar do que mostrar um marcador cru ou um número errado.
 */
export function preencher(texto, valores) {
  return texto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, caminho) => {
    const valor = caminho.split('.').reduce((obj, parte) => (obj == null ? undefined : obj[parte]), valores)
    if (valor === undefined || valor === null || typeof valor === 'object') {
      throw new Error(`marcador sem valor no texto: {{${caminho}}}`)
    }
    return String(valor)
  })
}

// --- texto corrido (inline) ---------------------------------------------------------------------------

const PADRAO_INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*\*)/

/** Texto → [{tipo: 'texto'|'codigo'|'negrito'|'italico'|'link', ...}]. */
export function lerInline(texto) {
  const partes = []
  let resto = texto
  while (resto) {
    const m = resto.match(PADRAO_INLINE)
    if (!m) { partes.push({ tipo: 'texto', texto: resto }); break }
    if (m.index > 0) partes.push({ tipo: 'texto', texto: resto.slice(0, m.index) })
    const [achado] = m
    if (m[1]) partes.push({ tipo: 'codigo', texto: achado.slice(1, -1) })
    else if (m[2]) partes.push({ tipo: 'negrito', filhos: lerInline(achado.slice(2, -2)) })
    else if (m[3]) {
      const [, rotulo, href] = achado.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
      partes.push({ tipo: 'link', href, filhos: lerInline(rotulo) })
    } else partes.push({ tipo: 'italico', filhos: lerInline(achado.slice(1, -1)) })
    resto = resto.slice(m.index + achado.length)
  }
  return partes
}

// --- blocos -------------------------------------------------------------------------------------------

const celulas = (linha) => linha.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

/** Markdown → lista de blocos: {tipo: 'titulo'|'paragrafo'|'lista'|'citacao'|'tabela'|'codigo'|'linha', ...}. */
export function lerMarkdown(texto) {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n')
  const blocos = []
  let i = 0
  const fimDeParagrafo = (l) => !l.trim() || /^(#{1,4} |[-*] |\d+\. |> |\||```|---\s*$)/.test(l)
  while (i < linhas.length) {
    const linha = linhas[i]
    if (!linha.trim()) { i++; continue }
    let m
    if ((m = linha.match(/^(#{1,4}) (.+?)(?:\s*\{#([\w-]+)\})?\s*$/))) {
      blocos.push({ tipo: 'titulo', nivel: m[1].length, filhos: lerInline(m[2]), id: m[3] ?? ancora(m[2]) })
      i++
    } else if (linha.startsWith('```')) {
      const corpo = []
      for (i++; i < linhas.length && !linhas[i].startsWith('```'); i++) corpo.push(linhas[i])
      blocos.push({ tipo: 'codigo', texto: corpo.join('\n') })
      i++
    } else if (/^---\s*$/.test(linha)) {
      blocos.push({ tipo: 'linha' })
      i++
    } else if (linha.startsWith('|')) {
      const tabela = []
      for (; i < linhas.length && linhas[i].startsWith('|'); i++) tabela.push(linhas[i])
      const [cabecalho, separador, ...corpo] = tabela
      if (!separador || !/^\|?[\s:|-]+\|?$/.test(separador)) throw new Error(`tabela sem linha |---|: ${cabecalho}`)
      blocos.push({ tipo: 'tabela', cabecalho: celulas(cabecalho).map(lerInline), linhas: corpo.map((l) => celulas(l).map(lerInline)) })
    } else if ((m = linha.match(/^([-*]|\d+\.) /))) {
      const ordenada = /\d/.test(m[1])
      const itens = []
      while (i < linhas.length && /^([-*]|\d+\.) /.test(linhas[i])) {
        let item = linhas[i].replace(/^([-*]|\d+\.) /, '')
        for (i++; i < linhas.length && /^ {2,}\S/.test(linhas[i]); i++) item += ` ${linhas[i].trim()}`
        itens.push(lerInline(item))
      }
      blocos.push({ tipo: 'lista', ordenada, itens })
    } else if (linha.startsWith('> ')) {
      const corpo = []
      for (; i < linhas.length && linhas[i].startsWith('>'); i++) corpo.push(linhas[i].replace(/^> ?/, ''))
      blocos.push({ tipo: 'citacao', blocos: lerMarkdown(corpo.join('\n')) })
    } else {
      const corpo = []
      for (; i < linhas.length && !fimDeParagrafo(linhas[i]); i++) corpo.push(linhas[i].trim())
      if (!corpo.length) { corpo.push(linha.trim()); i++ }
      blocos.push({ tipo: 'paragrafo', filhos: lerInline(corpo.join(' ')) })
    }
  }
  return blocos
}

/** Todos os ids de título e todos os links (href) dos blocos, inclusive dentro de listas, tabelas e citações. */
export function ancorasELinks(blocos) {
  const ids = []
  const links = []
  const doInline = (partes) => partes.forEach((p) => {
    if (p.tipo === 'link') links.push(p.href)
    if (p.filhos) doInline(p.filhos)
  })
  const visitar = (lista) => lista.forEach((b) => {
    if (b.tipo === 'titulo') ids.push(b.id)
    if (b.filhos) doInline(b.filhos)
    if (b.itens) b.itens.forEach(doInline)
    if (b.cabecalho) [b.cabecalho, ...b.linhas].flat().forEach(doInline)
    if (b.blocos) visitar(b.blocos)
  })
  visitar(blocos)
  return { ids, links }
}

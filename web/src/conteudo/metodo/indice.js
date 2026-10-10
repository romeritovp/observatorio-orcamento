// Seções da página "Como fazemos", na ordem da página. O texto fica nos .md desta pasta, um por seção,
// cada um com "# Título {#id}" e as duas versões ("## simples" e "## tecnico"). Nada de texto nos componentes.

import introducao from './0-introducao.md?raw'
import oQueE from './1-o-que-e.md?raw'
import fontes from './2-fontes.md?raw'
import refacaAConta from './3-refaca-a-conta.md?raw'
import calculos from './4-calculos.md?raw'
import decisoes from './5-decisoes.md?raw'
import limitacoes from './6-limitacoes.md?raw'
import glossario from './7-glossario.md?raw'
import historico from './8-historico.md?raw'

export const TEXTOS = [oQueE, fontes, refacaAConta, calculos, decisoes, limitacoes, glossario, historico]

/**
 * Arquivo de seção → {id, titulo, simples, tecnico}. Falta de título, de âncora ou de uma das versões é erro.
 * As versões são o texto entre "## simples" e "## tecnico" e depois de "## tecnico".
 */
export function lerSecao(texto) {
  const titulo = texto.match(/^# (.+?)\s*\{#([\w-]+)\}\s*$/m)
  if (!titulo) throw new Error(`seção sem "# Título {#id}": ${texto.slice(0, 60)}`)
  const partes = texto.split(/^## (simples|tecnico)\s*$/m)
  const versoes = {}
  for (let i = 1; i < partes.length; i += 2) versoes[partes[i]] = partes[i + 1].trim()
  if (!versoes.simples || !versoes.tecnico) throw new Error(`seção ${titulo[2]} sem as duas versões`)
  return { id: titulo[2], titulo: titulo[1], simples: versoes.simples, tecnico: versoes.tecnico }
}

export const SECOES = TEXTOS.map(lerSecao)

/** Título e parágrafo de abertura da página (não entra no índice). */
export const INTRODUCAO = lerSecao(introducao)

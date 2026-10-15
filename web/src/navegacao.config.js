// Fonte única da navegação: estados, eixos e indicadores. Menus, abas, seletores, títulos e rotas saem daqui.
// Para acrescentar um indicador: uma entrada em INDICADORES (e, se ele tiver tela, a tela em telas/ e a chave dela em
// `view`). Com `disponivel: false`, ele aparece no menu esmaecido, com o selo "em breve", e não abre.
//
// As UFs NÃO são escritas aqui: vêm do dicionarios.json publicado (gerado de dicionarios/nacional/ufs.csv pelo
// pipeline), que é a única fonte de sigla, nome, região e artigo no projeto.

import dicionarios from '../public/data/dicionarios.json'

/** Regiões na ordem dos menus. */
export const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']

/** As 27 UFs: {sigla, nome, slug, regiao, artigo ('o', 'a' ou '')}, em ordem alfabética de nome. */
export const UFS = dicionarios.ufs
  .map((u) => ({ sigla: u.uf, nome: u.nome, slug: u.uf.toLowerCase(), regiao: u.regiao, artigo: u.artigo ?? '' }))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

/** UFs agrupadas por região, na ordem de REGIOES: [{regiao, ufs: [...]}]. */
export const UFS_POR_REGIAO = REGIOES.map((regiao) => ({ regiao, ufs: UFS.filter((u) => u.regiao === regiao) }))

/** Eixos temáticos, na ordem do mega-menu. */
export const EIXOS = [
  { slug: 'financas', nome: 'Finanças públicas' },
  { slug: 'economia', nome: 'Economia' },
  { slug: 'social', nome: 'Social' },
  { slug: 'ciencia', nome: 'Ciência' },
]

/**
 * Indicadores, na ordem das abas. slug: parte da URL (/sp/pib); artigo: para o título ("O PIB de São Paulo");
 * view: a tela que mostra o indicador num estado e na visão nacional (chaves de VIEWS em estado.js).
 */
export const INDICADORES = [
  { slug: 'orcamento', nome: 'Orçamento', artigo: 'o', eixo: 'financas', view: 'estado', viewNacional: 'comparar',
    descricaoCurta: 'Receitas, despesas, dívidas e empresas do governo estadual', disponivel: true },
  { slug: 'pib', nome: 'PIB', artigo: 'o', eixo: 'economia', view: 'pib', viewNacional: 'pib',
    descricaoCurta: 'Tamanho da economia, peso dos setores e crescimento', disponivel: true },
  { slug: 'educacao', nome: 'Educação', artigo: 'a', eixo: 'social', view: 'educacao', viewNacional: 'educacao',
    descricaoCurta: 'IDEB por etapa e rede, de 2005 a 2025', disponivel: true },
  { slug: 'pesquisa-e-inovacao', nome: 'Pesquisa e Inovação', artigo: 'a', eixo: 'ciencia', view: 'inovacao', viewNacional: 'inovacao',
    descricaoCurta: 'Índice de inovação do INPI e gasto em ciência e tecnologia', disponivel: true },
]

/** Indicadores agrupados por eixo, na ordem de EIXOS: [{eixo, indicadores: [...]}] (eixos vazios ficam de fora). */
export const INDICADORES_POR_EIXO = EIXOS
  .map((eixo) => ({ eixo, indicadores: INDICADORES.filter((i) => i.eixo === eixo.slug) }))
  .filter((g) => g.indicadores.length)

export const ufPorSlug = (slug) => UFS.find((u) => u.slug === String(slug ?? '').toLowerCase()) ?? null
export const ufPorSigla = (sigla) => UFS.find((u) => u.sigla === String(sigla ?? '').toUpperCase()) ?? null
export const indicadorPorSlug = (slug) => INDICADORES.find((i) => i.slug === slug) ?? null
export const indicadorPorView = (view) => INDICADORES.find((i) => i.view === view) ?? null

/** "de São Paulo", "da Bahia", "do Ceará" (preposição pelo artigo da UF). */
export function doNome(uf) {
  const preposicao = { o: 'do', a: 'da' }[uf.artigo] ?? 'de'
  return `${preposicao} ${uf.nome}`
}

/** "O PIB de São Paulo", "A Educação da Bahia", "O Orçamento do Rio de Janeiro"; sem UF, só o nome do indicador. */
export function tituloDoIndicador(indicador, uf) {
  if (!uf) return indicador.nome
  const artigo = indicador.artigo === 'a' ? 'A' : 'O'
  return `${artigo} ${indicador.nome} ${doNome(uf)}`
}

/**
 * Busca de UF por nome ou sigla, sem acento e sem diferenciar maiúsculas: "pern" → Pernambuco, "PE" → Pernambuco
 * primeiro (sigla exata), depois os nomes que começam com o texto, depois os que contêm. Devolve até `limite` UFs.
 */
export function buscarUf(texto, limite = 8) {
  const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const t = normalizar(texto ?? '')
  if (!t) return []
  const sigla = UFS.filter((u) => u.slug === t)
  const comeca = UFS.filter((u) => !sigla.includes(u) && normalizar(u.nome).startsWith(t))
  const contem = UFS.filter((u) => !sigla.includes(u) && !comeca.includes(u)
    && (normalizar(u.nome).includes(t) || (t.length === 2 && u.slug.startsWith(t))))
  return [...sigla, ...comeca, ...contem].slice(0, limite)
}

/**
 * Título (h1) da tela de um indicador: "O PIB de São Paulo" com a UF (sigla) e o texto da visão nacional sem ela.
 * Para as telas, que recebem a sigla da UF do estado da tela.
 */
export function tituloDaPagina(slugIndicador, sigla, semUf) {
  const uf = ufPorSigla(sigla)
  return uf ? tituloDoIndicador(indicadorPorSlug(slugIndicador), uf) : semUf
}

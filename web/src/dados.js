// Carrega os JSON de public/data/ (gerados por `uv run python -m publicacao.exportar`).
// Geral (todas as UFs, na abertura): meta, dicionários, IPCA, despesa por função, estatais (avisos),
// dívida e receita (totais). Por UF (sob demanda, tela "Por estado"): subfunções, linhas da receita e
// lista completa de estatais. Tela "PIB dos Estados" (sob demanda): pib.json (todas as UFs e o país) e
// pib/<UF>.json (atividades da UF). Tela "Pesquisa e Inovação" (sob demanda): ibid.json e
// despesa_ensino_superior.json. Tela "Educação" (sob demanda): ideb.json e ideb/<UF>.json. Tela "Violência"
// (sob demanda): violencia.json.

// Nome no objeto de dados → arquivo
const GERAIS = {
  meta: 'meta', dicionarios: 'dicionarios', ipca: 'ipca', despesa: 'despesa_funcoes',
  estatais: 'estatais', divida: 'divida', receita: 'receita',
}
const POR_UF = { despesa: 'despesa', receitaLinhas: 'receita', estatais: 'estatais' }

const base = () => `${import.meta.env.BASE_URL}data/`

async function lerJson(caminho) {
  const resposta = await fetch(`${base()}${caminho}.json`)
  if (!resposta.ok) throw new Error(`não foi possível ler ${caminho}.json (${resposta.status})`)
  return resposta.json()
}

export async function carregarDados() {
  const conteudos = await Promise.all(Object.values(GERAIS).map(lerJson))
  return Object.fromEntries(Object.keys(GERAIS).map((nome, i) => [nome, conteudos[i]]))
}

// Uma busca por UF na sessão inteira (a promessa fica guardada, inclusive enquanto ainda baixa)
const cacheUf = new Map()

/**
 * Dados de uma UF: {despesa: linhas de subfunção e demais, receitaLinhas: linhas por item da receita,
 * estatais: {edição: [empresas]}}. Chamar antes de precisar (ex.: com a UF da URL, já na abertura)
 * só adianta o download.
 */
export function carregarDadosDaUf(uf) {
  if (!cacheUf.has(uf)) {
    const promessa = Promise.all(Object.values(POR_UF).map((pasta) => lerJson(`${pasta}/${uf}`)))
      .then((conteudos) => Object.fromEntries(Object.keys(POR_UF).map((nome, i) => [nome, conteudos[i]])))
    promessa.catch(() => cacheUf.delete(uf))  // falhou: tenta de novo na próxima vez
    cacheUf.set(uf, promessa)
  }
  return cacheUf.get(uf)
}

// PIB dos Estados: o arquivo geral e o de cada UF, uma busca por arquivo na sessão inteira
const cachePib = new Map()

function lerUmaVez(caminho) {
  if (!cachePib.has(caminho)) {
    const promessa = lerJson(caminho)
    promessa.catch(() => cachePib.delete(caminho))  // falhou: tenta de novo na próxima vez
    cachePib.set(caminho, promessa)
  }
  return cachePib.get(caminho)
}

/** pib.json: PIB, VAB e volume de todas as UFs e do país, dicionário das atividades e ressalvas. */
export const carregarPib = () => lerUmaVez('pib')

/** ibid.json: IBID (INPI), escores e ranking das 27 UFs, das regiões e do Brasil (tela "Pesquisa e Inovação"). */
export const carregarIbid = () => lerUmaVez('ibid')

/** ideb.json: IDEB das 27 UFs, regiões e Brasil, sem metas (tela "Educação"). */
export const carregarIdeb = () => lerUmaVez('ideb')

/** ideb/<UF>.json: aprovação por série da UF (tela "Educação"). */
export const carregarIdebDaUf = (uf) => lerUmaVez(`ideb/${uf}`)

/** despesa_ensino_superior.json: subfunção 364 em Educação, 27 UFs (mesma tela). */
export const carregarEnsinoSuperior = () => lerUmaVez('despesa_ensino_superior')

/** violencia.json: mortes violentas intencionais (FBSP) das 27 UFs e do Brasil (tela "Violência"). */
export const carregarViolencia = () => lerUmaVez('violencia')

/** pib/<UF>.json: a conta da produção da UF por atividade. */
export const carregarPibDaUf = (uf) => lerUmaVez(`pib/${uf}`)

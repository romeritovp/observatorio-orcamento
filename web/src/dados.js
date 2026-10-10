// Carrega os JSON de public/data/ (gerados por `uv run python -m publicacao.exportar`).
// Geral (todas as UFs, na abertura): meta, dicionários, IPCA, despesa por função, estatais (avisos),
// dívida e receita (totais). Por UF (sob demanda, tela "Por estado"): subfunções, linhas da receita e
// lista completa de estatais.

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

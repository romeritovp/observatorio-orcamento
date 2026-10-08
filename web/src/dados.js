// Carrega os JSON de public/data/ (gerados por `uv run python -m publicacao.exportar`).

const ARQUIVOS = ['meta', 'dicionarios', 'ipca', 'despesa', 'estatais', 'divida', 'receita']

export async function carregarDados() {
  const base = `${import.meta.env.BASE_URL}data/`
  const conteudos = await Promise.all(ARQUIVOS.map(async (nome) => {
    const resposta = await fetch(`${base}${nome}.json`)
    if (!resposta.ok) throw new Error(`não foi possível ler ${nome}.json (${resposta.status})`)
    return resposta.json()
  }))
  return Object.fromEntries(ARQUIVOS.map((nome, i) => [nome, conteudos[i]]))
}

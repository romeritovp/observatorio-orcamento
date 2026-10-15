// Leitura dos JSON publicados (public/data/) para os testes, sem rede.
// O site divide os dados em geral + um arquivo por UF (src/dados.js); os testes de conta juntam tudo de novo
// para continuar cobrindo as 27 UFs contra o gabarito.json.
import { readFileSync } from 'node:fs'

/** Arquivo publicado como está (sem juntar as partes por UF). */
export const lerArquivo = (caminho) => JSON.parse(readFileSync(new URL(`../../public/data/${caminho}`, import.meta.url), 'utf-8'))

const UFS = lerArquivo('meta.json').ufs
const TERRITORIOS_PIB = lerArquivo('pib.json').territorios.map((t) => t.uf)

/**
 * Arquivo publicado; "despesa.json", "receita.json" e "estatais.json" vêm com as partes de todas as UFs juntas,
 * e "pib/<todas>.json" junta pib/<UF>.json de todos os territórios (27 UFs e o país).
 */
export function lerJson(nome) {
  if (nome === 'pib/<todas>.json') return TERRITORIOS_PIB.flatMap((uf) => lerArquivo(`pib/${uf}.json`))
  if (nome === 'despesa.json') return [...lerArquivo('despesa_funcoes.json'), ...UFS.flatMap((uf) => lerArquivo(`despesa/${uf}.json`))]
  if (nome === 'receita.json') return { ...lerArquivo('receita.json'), linhas: UFS.flatMap((uf) => lerArquivo(`receita/${uf}.json`)) }
  if (nome === 'estatais.json') {
    const geral = lerArquivo('estatais.json')
    const lista = Object.fromEntries(geral.edicoes.map((e) => [String(e), {}]))
    for (const uf of UFS) {
      for (const [edicao, empresas] of Object.entries(lerArquivo(`estatais/${uf}.json`))) {
        if (empresas.length) lista[edicao][uf] = empresas
      }
    }
    return { ...geral, lista_por_edicao: lista }
  }
  return lerArquivo(nome)
}

/** Os dados como o site os carrega na abertura (src/dados.js → carregarDados). */
export function dadosDoSite() {
  return {
    meta: lerArquivo('meta.json'), dicionarios: lerArquivo('dicionarios.json'), ipca: lerArquivo('ipca.json'), despesa: lerArquivo('despesa_funcoes.json'),
    estatais: lerArquivo('estatais.json'), divida: lerArquivo('divida.json'), receita: lerArquivo('receita.json'),
  }
}

/** Os dados de uma UF como o site os carrega sob demanda (src/dados.js → carregarDadosDaUf). */
export function dadosDaUf(uf) {
  return { despesa: lerArquivo(`despesa/${uf}.json`), receitaLinhas: lerArquivo(`receita/${uf}.json`), estatais: lerArquivo(`estatais/${uf}.json`) }
}

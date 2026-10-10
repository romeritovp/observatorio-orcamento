// Carregamento dos JSON: geral na abertura, UF sob demanda e uma vez só (src/dados.js), e a divisão
// publicada (nada se perde nem se repete entre o arquivo geral e os das UFs).
import { afterEach, describe, expect, it, vi } from 'vitest'

import { carregarDados, carregarDadosDaUf } from './dados.js'
import { dadosDaUf, lerArquivo, lerJson } from './testes/publicados.js'

const respostas = (chamadas) => vi.fn(async (url) => {
  chamadas.push(url)
  return { ok: true, json: async () => ({ url }) }
})

afterEach(() => vi.unstubAllGlobals())

describe('carregamento', () => {
  it('abertura: só os arquivos gerais (sem subfunções nem listas por UF)', async () => {
    const chamadas = []
    vi.stubGlobal('fetch', respostas(chamadas))
    const dados = await carregarDados()
    expect(Object.keys(dados).sort()).toEqual(['despesa', 'dicionarios', 'divida', 'estatais', 'ipca', 'meta', 'receita'])
    expect(chamadas.map((u) => u.split('data/')[1]).sort()).toEqual(
      ['despesa_funcoes.json', 'dicionarios.json', 'divida.json', 'estatais.json', 'ipca.json', 'meta.json', 'receita.json'])
  })

  it('UF: três arquivos, baixados uma vez só por sessão', async () => {
    const chamadas = []
    vi.stubGlobal('fetch', respostas(chamadas))
    const [a, b] = await Promise.all([carregarDadosDaUf('ZZ'), carregarDadosDaUf('ZZ')])
    expect(a).toBe(b)
    expect(chamadas.map((u) => u.split('data/')[1]).sort()).toEqual(['despesa/ZZ.json', 'estatais/ZZ.json', 'receita/ZZ.json'])
    expect(Object.keys(a).sort()).toEqual(['despesa', 'estatais', 'receitaLinhas'])
  })

  it('arquivo que falha não fica guardado: a próxima tentativa busca de novo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    await expect(carregarDadosDaUf('YY')).rejects.toThrow('404')
    const chamadas = []
    vi.stubGlobal('fetch', respostas(chamadas))
    await carregarDadosDaUf('YY')
    expect(chamadas.length).toBe(3)
  })
})

describe('divisão publicada', () => {
  const meta = lerJson('meta.json')
  const geral = lerJson('despesa_funcoes.json')

  it('geral só com total e função das 27 UFs; arquivo da UF só com subfunções e demais', () => {
    expect(new Set(geral.map((l) => l.nivel))).toEqual(new Set(['total', 'funcao']))
    expect(new Set(geral.map((l) => l.uf)).size).toBe(meta.ufs.length)
    for (const uf of meta.ufs) {
      const d = dadosDaUf(uf)
      expect(d.despesa.every((l) => l.uf === uf && !['total', 'funcao'].includes(l.nivel)), uf).toBe(true)
      expect(d.receitaLinhas.every((l) => l.uf === uf), uf).toBe(true)
    }
    expect(geral.length + meta.ufs.reduce((n, uf) => n + dadosDaUf(uf).despesa.length, 0)).toBe(meta.linhas.despesa)
  })

  it('receita geral sem as linhas por item; estatais geral sem a lista completa', () => {
    expect(lerArquivo('receita.json')).not.toHaveProperty('linhas')
    expect(lerArquivo('estatais.json')).not.toHaveProperty('lista_por_edicao')
    // juntas de novo (testes), as partes cobrem todas as UFs
    expect(new Set(lerJson('receita.json').linhas.map((l) => l.uf)).size).toBe(meta.ufs.length)
  })
})

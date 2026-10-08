import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  completarComZero, deflacionar, edicaoParaAno, estataisNaArea, filtrar, indiceEncadeado, indicadoresDaFuncao, mediana, medianaPorAno,
  mudancasDeDependencia, ordenarPorPosicao, participacao, perCapita, ranking, ufsComEstatalNaArea,
} from './calculos.js'

const lerJson = (nome) => JSON.parse(readFileSync(new URL(`../public/data/${nome}`, import.meta.url), 'utf-8'))

// --- exemplos pequenos, duas UFs fictícias -------------------------------------

const IPCA = [
  { ano: 2023, variacao_pct: 10 },
  { ano: 2024, variacao_pct: 5 },
]

const LINHAS = [
  { uf: 'AA', ano: 2023, nivel: 'funcao', funcao_cod: '10', liquidado: 30, populacao: 100 },
  { uf: 'AA', ano: 2023, nivel: 'funcao', funcao_cod: '12', liquidado: 70, populacao: 100 },
  { uf: 'BB', ano: 2023, nivel: 'funcao', funcao_cod: '10', liquidado: 10, populacao: 50 },
  { uf: 'BB', ano: 2023, nivel: 'funcao', funcao_cod: '12', liquidado: 10, populacao: 50 },
]

describe('deflação', () => {
  it('encadeia as variações anuais', () => {
    const indice = indiceEncadeado(IPCA)
    expect(indice.get(2023)).toBeCloseTo(1.1)
    expect(indice.get(2024)).toBeCloseTo(1.155)
  })

  it('leva a preços de dezembro do ano base', () => {
    const [linha] = deflacionar([LINHAS[0]], ['liquidado'], 2024, IPCA)
    expect(linha.liquidado_real).toBeCloseTo(31.5)
    expect(linha.liquidado).toBe(30)
  })

  it('recusa ano sem IPCA e série com lacuna', () => {
    expect(() => deflacionar([{ ano: 2030, liquidado: 1 }], ['liquidado'], 2024, IPCA)).toThrow('sem IPCA')
    expect(() => indiceEncadeado([{ ano: 2020, variacao_pct: 1 }, { ano: 2022, variacao_pct: 1 }])).toThrow('faltando')
  })

  it('não altera a entrada e mantém nulo', () => {
    const entrada = [{ ano: 2023, liquidado: null }]
    expect(deflacionar(entrada, ['liquidado'], 2024, IPCA)[0].liquidado_real).toBeNull()
    expect(entrada[0]).not.toHaveProperty('liquidado_real')
  })
})

describe('per capita, participação e ranking', () => {
  it('per capita usa a população da linha', () => {
    expect(perCapita(LINHAS, ['liquidado']).map((l) => l.liquidado_per_capita)).toEqual([0.3, 0.7, 0.2, 0.2])
    expect(() => perCapita([{ uf: 'AA', ano: 2023, liquidado: 1 }], ['liquidado'])).toThrow('população')
  })

  it('participação no total da UF e ano', () => {
    expect(participacao(LINHAS, 'liquidado').map((l) => l.liquidado_part_pct)).toEqual([30, 70, 50, 50])
  })

  it('recusa níveis misturados', () => {
    const misturado = [...LINHAS, { ...LINHAS[0], nivel: 'total' }]
    expect(() => participacao(misturado, 'liquidado')).toThrow('níveis')
  })

  it('ranking: 1 = maior, empate com a melhor posição, nulo sem posição', () => {
    const linhas = [
      { uf: 'AA', ano: 2023, v: 5 }, { uf: 'BB', ano: 2023, v: 9 },
      { uf: 'CC', ano: 2023, v: 5 }, { uf: 'DD', ano: 2023, v: null },
    ]
    const resultado = ranking(linhas, 'v')
    expect(resultado.map((l) => l.v_posicao)).toEqual([2, 1, 2, null])
    expect(resultado[0].v_n_ufs).toBe(3)
    expect(() => ranking([...linhas, linhas[0]], 'v')).toThrow('mais de uma linha')
  })

  it('ordem do ranking: posição, sem posição no fim, empate pela sigla', () => {
    const linhas = [{ uf: 'CC', p: 2 }, { uf: 'DD', p: null }, { uf: 'AA', p: 2 }, { uf: 'BB', p: 1 }]
    expect(ordenarPorPosicao(linhas, 'p').map((l) => l.uf)).toEqual(['BB', 'AA', 'CC', 'DD'])
  })

  it('filtrar por vários critérios', () => {
    expect(filtrar(LINHAS, { uf: 'AA', funcao_cod: '10' })).toEqual([LINHAS[0]])
  })
})

describe('mediana e auditoria', () => {
  it('mediana ignora nulos e usa a média dos dois do meio', () => {
    expect(mediana([3, null, 1, 2])).toBe(2)
    expect(mediana([4, 1, 3, 2])).toBe(2.5)
    expect(mediana([null])).toBeNull()
  })

  it('mediana por ano', () => {
    const linhas = [{ ano: 2024, v: 1 }, { ano: 2023, v: 5 }, { ano: 2024, v: 3 }, { ano: 2023, v: null }]
    expect(medianaPorAno(linhas, 'v')).toEqual([
      { ano: 2023, mediana: 5, n_ufs: 1 }, { ano: 2024, mediana: 2, n_ufs: 2 },
    ])
  })

})

describe('ausência = zero', () => {
  const DESPESA = [
    ...LINHAS.filter((l) => !(l.uf === 'BB' && l.funcao_cod === '12')),
  ].map((l) => ({ ...l, fonte_dado: 'siconfi_dca', intra: false, extraido_em: `ext-${l.uf}` }))

  it('completarComZero acrescenta a UF sem linha, com as colunas do universo', () => {
    const universo = [{ uf: 'AA', ano: 2023, populacao: 100 }, { uf: 'BB', ano: 2023, populacao: 50 }]
    const linhas = filtrar(DESPESA, { funcao_cod: '12' })
    const completo = completarComZero(linhas, universo, ['uf', 'ano'], [{ nivel: 'funcao', funcao_cod: '12' }], ['liquidado'])
    expect(completo).toHaveLength(2)
    const nova = completo.find((l) => l.uf === 'BB')
    expect(nova).toMatchObject({ liquidado: 0, populacao: 50, funcao_cod: '12', sem_gasto_declarado: true })
    expect(completo.find((l) => l.uf === 'AA').sem_gasto_declarado).toBe(false)
    expect(() => completarComZero(linhas, [...universo, universo[0]], ['uf', 'ano'], [], [])).toThrow('universo')
  })

  it('indicadores: UF sem linha entra com 0, no fim do ranking e na mediana', () => {
    const ind = indicadoresDaFuncao(DESPESA, IPCA, { funcao: '12', anoBase: 2024 })
    const bb = ind.find((l) => l.uf === 'BB')
    expect(bb).toMatchObject({ nominal: 0, per_capita_real: 0, pct_despesa_total: 0, sem_gasto_declarado: true,
      posicao_per_capita_real: 2, n_ufs: 2, extraido_em: 'ext-BB', total_despesa: 10 })
    expect(medianaPorAno(ind, 'per_capita_nominal')[0].mediana).toBeCloseTo(0.35)
  })

  it('linha sem valor no estágio conta como ausência', () => {
    const comNulo = DESPESA.map((l) => (l.uf === 'AA' && l.funcao_cod === '12' ? { ...l, liquidado: null } : l))
    const aa = indicadoresDaFuncao(comNulo, IPCA, { funcao: '12', anoBase: 2024 }).find((l) => l.uf === 'AA')
    expect(aa).toMatchObject({ nominal: 0, sem_gasto_declarado: true, n_ufs: 2 })
  })

  it('indicadores trazem os passos da conta', () => {
    const [aa] = indicadoresDaFuncao(DESPESA, IPCA, { funcao: '10', anoBase: 2024 }).filter((l) => l.uf === 'AA')
    expect(aa.nominal).toBe(30)
    expect(aa.fator_ipca).toBeCloseTo(1.05)
    expect(aa.real).toBeCloseTo(31.5)
    expect(aa.populacao).toBe(100)
    expect(aa.total_despesa).toBe(100)
    expect(aa.per_capita_real).toBeCloseTo(0.315)
    expect(aa.per_capita_nominal).toBeCloseTo(0.3)
    expect(aa.pct_despesa_total).toBe(30)
  })
})

// --- conferência com o gabarito gerado pelo Python ---------------------------------

describe('gabarito.json (todas as áreas, regra do zero)', () => {
  const despesa = lerJson('despesa.json')
  const ipca = lerJson('ipca.json').serie
  const gabarito = lerJson('gabarito.json')
  const meta = lerJson('meta.json')
  const { estagio, ano_base_precos: anoBase, fonte_dado: fonte } = gabarito.parametros
  const funcoes = [...new Set(gabarito.valores.map((v) => v.funcao_cod))]

  const calculados = new Map()
  const medianas = new Map()
  for (const funcao of funcoes) {
    const ind = indicadoresDaFuncao(despesa, ipca, { funcao, estagio, anoBase, fonte })
    for (const l of ind) calculados.set(`${funcao}|${l.uf}|${l.ano}`, l)
    for (const medida of ['per_capita_real', 'per_capita_nominal', 'pct_despesa_total']) {
      for (const m of medianaPorAno(ind, medida)) medianas.set(`${funcao}|${m.ano}|${medida}`, m.mediana)
    }
  }

  const igual = (a, b) => (b === 0 ? Math.abs(a) < 1e-9 : Math.abs(a / b - 1) < 1e-9)

  it('cobre todas as UFs, anos e funções do gabarito', () => {
    expect(gabarito.valores).toHaveLength(funcoes.length * meta.ufs.length * meta.anos.length)
    expect(calculados.size).toBe(gabarito.valores.length)
    expect(gabarito.valores.some((v) => v.sem_gasto_declarado)).toBe(true)
  })

  it('valores, posições e marcação de ausência batem com o Python', () => {
    const erros = []
    for (const esperado of gabarito.valores) {
      const chave = `${esperado.funcao_cod}|${esperado.uf}|${esperado.ano}`
      const c = calculados.get(chave)
      if (!c) { erros.push(`${chave}: ausente`); continue }
      for (const campo of ['per_capita_real', 'per_capita_nominal', 'pct_despesa_total']) {
        if (!igual(c[campo], esperado[campo])) erros.push(`${chave} ${campo}: ${c[campo]} ≠ ${esperado[campo]}`)
      }
      for (const campo of ['nominal', 'posicao_per_capita_real', 'posicao_per_capita_nominal',
        'posicao_pct_despesa_total', 'n_ufs', 'sem_gasto_declarado']) {
        if (c[campo] !== esperado[campo]) erros.push(`${chave} ${campo}: ${c[campo]} ≠ ${esperado[campo]}`)
      }
    }
    expect(erros.slice(0, 10)).toEqual([])
  })

  it('medianas batem com o Python (incluindo as UFs com 0)', () => {
    const erros = []
    for (const m of gabarito.medianas) {
      for (const medida of ['per_capita_real', 'per_capita_nominal', 'pct_despesa_total']) {
        const c = medianas.get(`${m.funcao_cod}|${m.ano}|${medida}`)
        if (!igual(c, m[medida])) erros.push(`${m.funcao_cod} ${m.ano} ${medida}: ${c} ≠ ${m[medida]}`)
      }
    }
    expect(erros.slice(0, 10)).toEqual([])
  })
})

// --- estatais (só informativo) ------------------------------------------------------

describe('estatais não dependentes por área', () => {
  const ESTATAIS = {
    edicoes: [2023, 2024],
    por_edicao: {
      2023: {
        AA: { 17: [{ sigla: 'SAN', empresa: 'Saneamento AA', cnpj: '1' }] },
        BB: { 17: [{ sigla: 'PRIV', empresa: 'Privatizada em 2024', cnpj: '9' }] },
      },
      2024: {
        AA: { 17: [{ sigla: 'SAN', empresa: 'Saneamento AA', cnpj: '1' }], 24: [{ sigla: 'TV', empresa: 'TV AA', cnpj: '2' }] },
        BB: { 24: [{ sigla: 'IMP', empresa: 'Imprensa BB', cnpj: '3' }] },
      },
    },
  }

  it('edição: a mais recente que não passa do ano; antes de todas, a primeira', () => {
    expect([2019, 2022, 2023, 2024, 2025].map((a) => edicaoParaAno([2024, 2023], a))).toEqual([2023, 2023, 2023, 2024, 2024])
    expect(() => edicaoParaAno([], 2024)).toThrow()
  })

  it('lista as estatais da UF na função, na edição do ano', () => {
    expect(estataisNaArea(ESTATAIS, 'AA', '17', 2025).map((e) => e.sigla)).toEqual(['SAN'])
    expect(estataisNaArea(ESTATAIS, 'BB', '17', 2023).map((e) => e.sigla)).toEqual(['PRIV'])
    expect(estataisNaArea(ESTATAIS, 'BB', '17', 2020).map((e) => e.sigla)).toEqual(['PRIV'])
    expect(estataisNaArea(ESTATAIS, 'BB', '17', 2024)).toEqual([]) // privatizada: some em 2024
    expect(estataisNaArea(ESTATAIS, 'CC', '17', 2024)).toEqual([])
    expect(estataisNaArea(undefined, 'AA', '17', 2024)).toEqual([])
  })

  it('UFs com estatal na função, na edição do ano', () => {
    expect([...ufsComEstatalNaArea(ESTATAIS, '17', 2023)].sort()).toEqual(['AA', 'BB'])
    expect([...ufsComEstatalNaArea(ESTATAIS, '17', 2024)]).toEqual(['AA'])
    expect([...ufsComEstatalNaArea(ESTATAIS, '24', 2024)].sort()).toEqual(['AA', 'BB'])
    expect(ufsComEstatalNaArea(ESTATAIS, '24', 2023).size).toBe(0)
  })

  it('estatais.json publicado: edição de cada ano bate com o Python, atribuição e UFs conhecidas', () => {
    const estatais = lerJson('estatais.json')
    const meta = lerJson('meta.json')
    for (const ano of meta.anos) expect(edicaoParaAno(estatais.edicoes, ano)).toBe(estatais.edicao_por_ano[String(ano)])
    expect(estatais.atribuicao).toContain('Tesouro Nacional')
    expect(estatais.fonte_curta).toBeTruthy()
    for (const porUf of Object.values(estatais.por_edicao)) {
      expect(Object.keys(porUf).every((uf) => meta.ufs.includes(uf))).toBe(true)
    }
    expect(ufsComEstatalNaArea(estatais, '17', Math.max(...meta.anos)).size).toBeGreaterThan(0)
  })
})

describe('mudanças de dependência (quebra de série)', () => {
  const ESTATAIS = {
    mudancas_dependencia: {
      AA: { 26: [
        { ano: 2024, ano_anterior: 2023, sentido: 'passou_a_dependente', sigla: 'MET', empresa: 'Metrô AA', cnpj: '1' },
        { ano: 2016, ano_anterior: 2015, sentido: 'deixou_de_ser_dependente', sigla: 'X', empresa: 'X', cnpj: '2' },
      ] },
    },
  }

  it('só as da UF e função, nos anos do gráfico', () => {
    expect(mudancasDeDependencia(ESTATAIS, 'AA', '26', [2019, 2024]).map((m) => m.sigla)).toEqual(['MET'])
    expect(mudancasDeDependencia(ESTATAIS, 'AA', '17', [2024])).toEqual([])
    expect(mudancasDeDependencia(ESTATAIS, 'BB', '26', [2024])).toEqual([])
    expect(mudancasDeDependencia(undefined, 'AA', '26', [2024])).toEqual([])
  })

  it('estatais.json publicado: mudanças em UFs, funções e anos conhecidos', () => {
    const estatais = lerJson('estatais.json')
    const meta = lerJson('meta.json')
    for (const [uf, porFuncao] of Object.entries(estatais.mudancas_dependencia)) {
      expect(meta.ufs).toContain(uf)
      for (const lista of Object.values(porFuncao)) {
        for (const m of lista) {
          expect(['passou_a_dependente', 'deixou_de_ser_dependente']).toContain(m.sentido)
          expect(estatais.edicoes).toContain(m.ano)
        }
      }
    }
  })
})

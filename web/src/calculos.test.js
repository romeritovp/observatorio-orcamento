import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  completarComZero, composicaoDivida, composicaoReceita, destinoDoImposto, indicadoresReceita, populacoes, tabelaReceita, composicaoDoAno, dividaContraAreas, indicadoresDivida, deflacionar, edicaoParaAno, estataisDoEstado, estataisNaArea,
  indicadoresDeTodasAsFuncoes, serieDaUf, subareasDaUf, tabelaAreasPorAno, tabelaSubareasPorAno, totaisPorUfAno, filtrar, indiceEncadeado, indicadoresDaFuncao, mediana, medianaPorAno,
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

// --- tela "Por estado" ------------------------------------------------------------------

describe('tela Por estado', () => {
  // Duas UFs em dois anos (2024 = 2023 com +10% na saúde de AA)
  const DOIS_ANOS = [...LINHAS, ...LINHAS.map((l) => ({ ...l, ano: 2024, liquidado: l.uf === 'AA' && l.funcao_cod === '10' ? 33 : l.liquidado }))]
    .map((l) => ({ ...l, fonte_dado: 'siconfi_dca', intra: false }))
  const porFuncao = indicadoresDeTodasAsFuncoes(DOIS_ANOS, IPCA, { anoBase: 2024 })

  it('totais por UF e ano: soma das funções, por habitante e variação', () => {
    const t = totaisPorUfAno(DOIS_ANOS, IPCA, { anoBase: 2024 })
    const aa23 = t.find((l) => l.uf === 'AA' && l.ano === 2023)
    expect(aa23.total_nominal).toBe(100)
    expect(aa23.total_real).toBeCloseTo(105)
    expect(aa23.per_capita_nominal).toBeCloseTo(1)
    expect(aa23.var_real_pct).toBeNull()
    const aa24 = t.find((l) => l.uf === 'AA' && l.ano === 2024)
    expect(aa24.total_nominal).toBe(103)
    expect(aa24.var_nominal_pct).toBeCloseTo(3)
    expect(aa24.var_real_pct).toBeCloseTo((103 / 105 - 1) * 100)
  })

  it('composição em ordem de % do orçamento e tabela áreas × anos', () => {
    const comp = composicaoDoAno(porFuncao, 'AA', 2023)
    expect(comp.map((l) => l.funcao_cod)).toEqual(['12', '10'])
    expect(comp[0].pct_despesa_total).toBe(70)
    expect(serieDaUf(porFuncao.get('10'), 'AA').map((l) => l.ano)).toEqual([2023, 2024])
    const tab = tabelaAreasPorAno(porFuncao, 'AA', [2023, 2024, 2030], 'pct_despesa_total', ['12', '10', '99'])
    expect(tab.map((l) => l.funcao_cod)).toEqual(['12', '10'])
    expect(tab[0].valores[0]).toBe(70)
    expect(tab[0].valores[2]).toBeNull()
  })

  it('estatais do estado na edição do ano, separadas por dependência', () => {
    const estatais = {
      edicoes: [2023, 2024],
      paineis: { 2023: 'p2023', 2024: 'p2024' },
      lista_por_edicao: {
        2023: { AA: [{ sigla: 'Z', dependente: false }, { sigla: 'A', dependente: true }] },
        2024: { AA: [{ sigla: 'B', dependente: false }, { sigla: 'A', dependente: false }] },
      },
    }
    const e23 = estataisDoEstado(estatais, 'AA', 2020)
    expect(e23).toMatchObject({ edicao: 2023, painel: 'p2023' })
    expect(e23.naoDependentes.map((e) => e.sigla)).toEqual(['Z'])
    expect(e23.dependentes.map((e) => e.sigla)).toEqual(['A'])
    expect(estataisDoEstado(estatais, 'AA', 2025).naoDependentes.map((e) => e.sigla)).toEqual(['A', 'B'])
    expect(estataisDoEstado(estatais, 'BB', 2025).dependentes).toEqual([])
  })

  it('totais batem com o gabarito do Python (27 UFs × todos os anos)', () => {
    const despesa = lerJson('despesa.json')
    const ipca = lerJson('ipca.json').serie
    const gabarito = lerJson('gabarito.json')
    const meta = lerJson('meta.json')
    const { estagio, ano_base_precos: anoBase, fonte_dado: fonte } = gabarito.parametros
    const calculados = new Map(totaisPorUfAno(despesa, ipca, { estagio, anoBase, fonte }).map((l) => [`${l.uf}|${l.ano}`, l]))
    expect(gabarito.totais).toHaveLength(meta.ufs.length * meta.anos.length)
    expect(calculados.size).toBe(gabarito.totais.length)
    const erros = []
    const igual = (a, b) => (a === null || b === null ? a === b : b === 0 ? Math.abs(a) < 1e-9 : Math.abs(a / b - 1) < 1e-9)
    for (const esperado of gabarito.totais) {
      const c = calculados.get(`${esperado.uf}|${esperado.ano}`)
      for (const campo of ['total_nominal', 'total_real', 'per_capita_nominal', 'per_capita_real', 'var_nominal_pct', 'var_real_pct']) {
        if (!c || !igual(c[campo], esperado[campo])) erros.push(`${esperado.uf} ${esperado.ano} ${campo}: ${c?.[campo]} ≠ ${esperado[campo]}`)
      }
    }
    expect(erros.slice(0, 10)).toEqual([])
  })
})

// --- subáreas ---------------------------------------------------------------------------

describe('subáreas (subfunções)', () => {
  const sub = (funcao, subfuncao, nivel, liquidado) => ({
    uf: 'AA', ano: 2023, nivel, funcao_cod: funcao, subfuncao_cod: subfuncao, liquidado, populacao: 100,
    fonte_dado: 'siconfi_dca', intra: false,
  })
  const DESPESA = [
    sub('10', null, 'funcao', 30), sub('10', '301', 'subfuncao', 20), sub('10', '302', 'subfuncao', 4),
    sub('10', null, 'demais', 6), sub('10', '303', 'subfuncao', null),
    sub('12', null, 'funcao', 70), sub('12', '361', 'subfuncao', 70),
  ]

  it('mesmas medidas da área; % sobre o orçamento total; linha nula fica de fora', () => {
    const s = subareasDaUf(DESPESA, IPCA, { uf: 'AA', anoBase: 2024 })
    expect(s).toHaveLength(4)
    const s301 = s.find((l) => l.subfuncao_cod === '301')
    expect(s301.pct_despesa_total).toBe(20) // 20 de um orçamento de 100, não 20 de 30
    expect(s301.per_capita_nominal).toBe(0.2)
    expect(s301.real).toBeCloseTo(21)
  })

  it('tabela: maior primeiro, "demais" no fim', () => {
    const s = subareasDaUf(DESPESA, IPCA, { uf: 'AA', anoBase: 2024 })
    const tab = tabelaSubareasPorAno(s, '10', [2023, 2024], 'nominal', 2023)
    expect(tab.map((l) => [l.nivel, l.subfuncao_cod, l.valores[0]])).toEqual([
      ['subfuncao', '301', 20], ['subfuncao', '302', 4], ['demais', null, 6]])
    expect(tab[0].valores[1]).toBeNull()
  })

  it('soma das subáreas = área, em todas as medidas, todas as UFs, áreas e anos publicados', () => {
    const despesa = lerJson('despesa.json')
    const ipca = lerJson('ipca.json').serie
    const meta = lerJson('meta.json')
    const anoBase = meta.deflacao.ano_base_padrao
    const porFuncao = indicadoresDeTodasAsFuncoes(despesa, ipca, { anoBase })
    const medidas = [['nominal', 'nominal'], ['real', 'real'], ['per_capita_nominal', 'per_capita_nominal'],
      ['per_capita_real', 'per_capita_real'], ['pct_despesa_total', 'pct_despesa_total']]
    const erros = []
    let conferidas = 0
    for (const uf of meta.ufs) {
      const somas = new Map()
      for (const l of subareasDaUf(despesa, ipca, { uf, anoBase })) {
        const chave = `${l.funcao_cod}|${l.ano}`
        const soma = somas.get(chave) ?? Object.fromEntries(medidas.map(([m]) => [m, 0]))
        for (const [m] of medidas) soma[m] += l[m]
        somas.set(chave, soma)
      }
      for (const [funcao, linhas] of porFuncao) {
        for (const area of linhas.filter((l) => l.uf === uf)) {
          const soma = somas.get(`${funcao}|${area.ano}`) ?? Object.fromEntries(medidas.map(([m]) => [m, 0]))
          for (const [m, campoArea] of medidas) {
            const esperado = area[campoArea]
            const ok = esperado === 0 ? Math.abs(soma[m]) < 1e-6 : Math.abs(soma[m] / esperado - 1) < 1e-9
            if (!ok) erros.push(`${uf} ${area.ano} ${funcao} ${m}: subáreas ${soma[m]} ≠ área ${esperado}`)
          }
          conferidas += 1
        }
      }
    }
    expect(conferidas).toBe(porFuncao.size * meta.ufs.length * meta.anos.length)
    expect(erros.slice(0, 10)).toEqual([])
  })
})

// --- dívida -------------------------------------------------------------------------------

describe('dívida', () => {
  const linha = (uf, ano, dclRcl, juros, amortizacao) => ({
    uf, ano, dcl_rcl_pct: dclRcl, juros, amortizacao, dc: 100, dcl: 80, deducoes: 20, rcl: 50, limite: 100, alerta: 90,
    composicao: { reestruturacao: 60, internos: 25, externos: 10, parcelamentos: 0, precatorios: 5, outras: 0 },
  })
  const LINHAS_DIVIDA = [linha('AA', 2023, 150, 10, 5), linha('BB', 2023, 30, 1, null), linha('AA', 2024, 140, 20, 10),
    linha('BB', 2024, 160, 2, 2)]

  it('pago, valores corrigidos e posição (1 = maior DCL/RCL)', () => {
    const ind = indicadoresDivida(LINHAS_DIVIDA, IPCA, { anoBase: 2024 })
    const aa23 = ind.find((l) => l.uf === 'AA' && l.ano === 2023)
    expect(aa23.pago).toBe(15)
    expect(aa23.pago_real).toBeCloseTo(15.75)
    expect(aa23.dcl_real).toBeCloseTo(84)
    expect(aa23.composicao_real.reestruturacao).toBeCloseTo(63)
    expect(aa23.posicao_dcl_rcl).toBe(1)
    expect(ind.find((l) => l.uf === 'BB' && l.ano === 2023).pago).toBeNull() // falta amortização
    expect(ind.find((l) => l.uf === 'BB' && l.ano === 2024).posicao_dcl_rcl).toBe(1)
  })

  it('composição do maior para o menor, com % da dívida consolidada', () => {
    const c = composicaoDivida(LINHAS_DIVIDA[0])
    expect(c.map((x) => x.tipo).slice(0, 3)).toEqual(['reestruturacao', 'internos', 'externos'])
    expect(c[0].pct_dc).toBe(60)
    expect(c.reduce((s, x) => s + x.pct_dc, 0)).toBeCloseTo(100)
    expect(composicaoDivida(undefined)).toEqual([])
  })

  it('dívida contra saúde e educação, total e por habitante', () => {
    const despesa = [
      { uf: 'AA', ano: 2023, nivel: 'funcao', funcao_cod: '10', liquidado: 30, populacao: 10, fonte_dado: 'siconfi_dca', intra: false },
      { uf: 'AA', ano: 2023, nivel: 'funcao', funcao_cod: '12', liquidado: 70, populacao: 10, fonte_dado: 'siconfi_dca', intra: false },
    ]
    const porFuncao = indicadoresDeTodasAsFuncoes(despesa, IPCA, { anoBase: 2024 })
    const ind = indicadoresDivida(LINHAS_DIVIDA, IPCA, { anoBase: 2024 }).find((l) => l.uf === 'AA' && l.ano === 2023)
    const [d, s, e] = dividaContraAreas(ind, porFuncao, 'AA', 2023, false)
    expect([d.valor, s.valor, e.valor]).toEqual([15, 30, 70])
    expect(d.per_capita).toBe(1.5)
    const [dReal] = dividaContraAreas(ind, porFuncao, 'AA', 2023, true)
    expect(dReal.valor).toBeCloseTo(15.75)
  })

  it('bate com o gabarito do Python: DCL/RCL, posição, juros e amortização reais, medianas', () => {
    const divida = lerJson('divida.json')
    const ipca = lerJson('ipca.json').serie
    const gabarito = lerJson('gabarito.json')
    const meta = lerJson('meta.json')
    const anoBase = gabarito.parametros.ano_base_precos
    const ind = new Map(indicadoresDivida(divida.linhas, ipca, { anoBase }).map((l) => [`${l.uf}|${l.ano}`, l]))
    expect(gabarito.divida.length).toBeGreaterThan(0)
    expect(ind.size).toBe(gabarito.divida.length)
    expect(gabarito.divida.length).toBeLessThanOrEqual(meta.ufs.length * meta.anos.length)
    const igual = (a, b) => (a === null || b === null ? a === b : b === 0 ? Math.abs(a) < 1e-6 : Math.abs(a / b - 1) < 1e-9)
    const erros = []
    for (const g of gabarito.divida) {
      const c = ind.get(`${g.uf}|${g.ano}`)
      for (const campo of ['dcl_rcl_pct', 'juros_real', 'amortizacao_real', 'pago_real']) {
        if (!c || !igual(c[campo], g[campo])) erros.push(`${g.uf} ${g.ano} ${campo}: ${c?.[campo]} ≠ ${g[campo]}`)
      }
      for (const campo of ['posicao_dcl_rcl', 'n_ufs']) if (c?.[campo] !== g[campo]) erros.push(`${g.uf} ${g.ano} ${campo}`)
    }
    for (const m of gabarito.medianas_divida) {
      const c = medianaPorAno([...ind.values()], 'dcl_rcl_pct').find((x) => x.ano === m.ano)
      if (!igual(c.mediana, m.dcl_rcl_pct)) erros.push(`mediana ${m.ano}: ${c.mediana} ≠ ${m.dcl_rcl_pct}`)
    }
    expect(erros.slice(0, 10)).toEqual([])
  })
})

// --- receita ---------------------------------------------------------------------------------

describe('receita', () => {
  const TOTAIS = [
    { uf: 'AA', ano: 2023, liquida_exceto_intra: 100, impostos_proprios: 60, transferencias_uniao: 30 },
    { uf: 'BB', ano: 2023, liquida_exceto_intra: 50, impostos_proprios: 10, transferencias_uniao: 35 },
  ]
  const POP = new Map([['AA|2023', 100], ['BB|2023', 10]])
  const LINHAS_RECEITA = [
    { uf: 'AA', ano: 2023, item: 'icms', bruta: 100, ded_transferencias: 25, ded_fundeb: 15, ded_outras: 0, liquida: 60 },
    { uf: 'AA', ano: 2023, item: 'fpe', bruta: 40, ded_transferencias: 0, ded_fundeb: 0, ded_outras: 0, liquida: 40 },
    { uf: 'AA', ano: 2023, item: 'intraorcamentarias', bruta: 9, ded_transferencias: 0, ded_fundeb: 0, ded_outras: 0, liquida: 9 },
  ]

  it('indicadores: real, por habitante, pesos e posições', () => {
    const ind = indicadoresReceita(TOTAIS, IPCA, { anoBase: 2024, populacao: POP })
    const aa = ind.find((l) => l.uf === 'AA')
    expect(aa.receita_liquida_real).toBeCloseTo(105)
    expect(aa.per_capita_real).toBeCloseTo(1.05)
    expect(aa.pct_impostos_proprios).toBe(60)
    expect(aa.posicao_pct_impostos).toBe(1)
    expect(ind.find((l) => l.uf === 'BB').posicao_per_capita_real).toBe(1) // 5,25 por habitante
    expect(() => indicadoresReceita(TOTAIS, IPCA, { anoBase: 2024, populacao: new Map() })).toThrow('população')
  })

  it('composição sem intra, destino do ICMS e tabela', () => {
    const c = composicaoReceita(LINHAS_RECEITA, 'AA', 2023)
    expect(c.map((x) => [x.item, x.pct])).toEqual([['icms', 60], ['fpe', 40]])
    expect(destinoDoImposto(LINHAS_RECEITA, 'AA', 2023, 'icms')).toEqual({ arrecadado: 100, municipios: 25, fundeb: 15, outras: 0, estado: 60 })
    expect(destinoDoImposto(LINHAS_RECEITA, 'AA', 2023, 'ipva')).toBeNull()
    const opcoes = { serieIpca: IPCA, anoBase: 2024, populacao: POP }
    const pct = tabelaReceita(LINHAS_RECEITA, 'AA', [2023, 2024], ['icms', 'ipva'], { ...opcoes, metrica: 'pct', corrigidos: false })
    expect(pct).toEqual([{ item: 'icms', valores: [60, null] }, { item: 'ipva', valores: [0, null] }])
    const real = tabelaReceita(LINHAS_RECEITA, 'AA', [2023], ['icms'], { ...opcoes, metrica: 'per_capita', corrigidos: true })
    expect(real[0].valores[0]).toBeCloseTo(0.63)
  })

  it('bate com o gabarito do Python: receita líquida, real, por habitante, pesos, posições e medianas', () => {
    const receita = lerJson('receita.json')
    const despesa = lerJson('despesa.json')
    const ipca = lerJson('ipca.json').serie
    const gabarito = lerJson('gabarito.json')
    const meta = lerJson('meta.json')
    const anoBase = gabarito.parametros.ano_base_precos
    const ind = indicadoresReceita(receita.totais, ipca, { anoBase, populacao: populacoes(despesa) })
    const porChave = new Map(ind.map((l) => [`${l.uf}|${l.ano}`, l]))
    expect(gabarito.receita).toHaveLength(meta.ufs.length * meta.anos.length)
    const igual = (a, b) => (b === 0 ? Math.abs(a) < 1e-9 : Math.abs(a / b - 1) < 1e-9)
    const erros = []
    for (const g of gabarito.receita) {
      const c = porChave.get(`${g.uf}|${g.ano}`)
      for (const campo of ['receita_liquida', 'receita_liquida_real', 'per_capita_real', 'pct_impostos_proprios', 'pct_transferencias_uniao']) {
        if (!c || !igual(c[campo], g[campo])) erros.push(`${g.uf} ${g.ano} ${campo}: ${c?.[campo]} ≠ ${g[campo]}`)
      }
      for (const campo of ['posicao_per_capita_real', 'posicao_pct_impostos', 'n_ufs']) if (c?.[campo] !== g[campo]) erros.push(`${g.uf} ${g.ano} ${campo}`)
    }
    for (const m of gabarito.medianas_receita) {
      for (const medida of ['per_capita_real', 'pct_impostos_proprios']) {
        const calc = medianaPorAno(ind, medida).find((x) => x.ano === m.ano).mediana
        if (!igual(calc, m[medida])) erros.push(`mediana ${m.ano} ${medida}`)
      }
    }
    expect(erros.slice(0, 10)).toEqual([])
    // Soma dos itens (sem intra) = receita líquida dos totais, em todas as UFs e anos
    for (const t of receita.totais.slice(0, 50)) {
      const soma = receita.linhas.filter((l) => l.uf === t.uf && l.ano === t.ano && l.item !== 'intraorcamentarias')
        .reduce((s, l) => s + l.liquida, 0)
      expect(Math.abs(soma - t.liquida_exceto_intra)).toBeLessThan(1)
    }
  })
})

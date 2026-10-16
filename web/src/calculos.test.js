import { describe, expect, it } from 'vitest'

import {
  completarComZero, composicaoDivida, composicaoReceita, ressalvasDoAno, petroleoDaUf, reconciliacaoPetroleo, seriePetroleo, destinoDoImposto, indicadoresReceita, populacoes, tabelaReceita, composicaoDoAno, dividaContraAreas, indicadoresDivida, deflacionar, edicaoParaAno, estataisDoEstado, estataisNaArea,
  indicadoresDeTodasAsFuncoes, indicadoresSobDemanda, serieDaUf, subareasDaUf, tabelaAreasPorAno, tabelaSubareasPorAno, totaisPorUfAno, filtrar, indiceEncadeado, indicadoresDaFuncao, mediana, medianaPorAno,
  mudancasDeDependencia, ordenarPorPosicao, participacao, perCapita, ranking, ufsComEstatalNaArea,
  aprovacaoPorSerie, idebRecalculado, rankingIdeb, ressalvasDoIdeb, serieIdeb, tendenciasDoIdeb,
  cruzamentoPesquisa, dispersaoIbid, idAgregado, indicadoresDaSubfuncao, pilaresComparados, rankingIbid, serieIbid,
  crescimentoAcumulado, participacaoNoPais, participacaoNoVab, participacoesNoPais, rebasear, setoresPorAno, tabelaPib,
  indiceMvi, pctMdipNasMvi, rankingMvi, serieMvi, valorMvi,
} from './calculos.js'
import { lerJson } from './testes/publicados.js'


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

  it('edição: a mais recente que não passa do ano; antes de todas, nenhuma (null)', () => {
    expect([2019, 2022, 2023, 2024, 2025].map((a) => edicaoParaAno([2024, 2023], a))).toEqual([null, null, 2023, 2024, 2024])
    expect(() => edicaoParaAno([], 2024)).toThrow()
  })

  it('lista as estatais da UF na função, na edição do ano', () => {
    expect(estataisNaArea(ESTATAIS, 'AA', '17', 2025).map((e) => e.sigla)).toEqual(['SAN'])
    expect(estataisNaArea(ESTATAIS, 'BB', '17', 2023).map((e) => e.sigla)).toEqual(['PRIV'])
    expect(estataisNaArea(ESTATAIS, 'BB', '17', 2020)).toEqual([]) // antes da primeira edição: sem informação
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
    for (const ano of meta.anos) expect(edicaoParaAno(estatais.edicoes, ano)).toBe(estatais.edicao_por_ano[String(ano)] ?? null)
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
    expect(estataisDoEstado(estatais, 'AA', 2020)).toMatchObject({ edicao: null, naoDependentes: [], dependentes: [] })
    const e23 = estataisDoEstado(estatais, 'AA', 2023)
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

describe('ressalvas por ano', () => {
  it('as com anos só valem nesses anos', () => {
    const r = [{ id: 'a' }, { id: 'b', anos: [2022] }]
    expect(ressalvasDoAno(r, 2022).map((x) => x.id)).toEqual(['a', 'b'])
    expect(ressalvasDoAno(r, 2024).map((x) => x.id)).toEqual(['a'])
    expect(ressalvasDoAno(undefined, 2024)).toEqual([])
  })
})

describe('petróleo: DCA × ANP', () => {
  const linha = (ano, anp, demais, parcial = false) => ({ uf: 'AA', ano, anp_total: parcial ? null : anp, anp_parcial: parcial,
    demais_patrimoniais: demais, dca_petroleo: 0, anp_royalties: anp })

  it('regra dos 95%: explica, não reconcilia (inclusive ANP acima da linha), parcial e sem dado', () => {
    expect(reconciliacaoPetroleo(linha(2024, 96, 100)).situacao).toBe('explica')
    expect(reconciliacaoPetroleo(linha(2024, 100, 100)).situacao).toBe('explica')
    expect(reconciliacaoPetroleo(linha(2024, 94, 100)).situacao).toBe('nao_reconcilia')
    expect(reconciliacaoPetroleo(linha(2021, 112, 100)).situacao).toBe('nao_reconcilia') // a ANP não pode passar da linha
    expect(reconciliacaoPetroleo(linha(2025, 50, 100, true)).situacao).toBe('parcial')
    expect(reconciliacaoPetroleo(linha(2024, 0, 100)).situacao).toBe('sem_dado')
    expect(reconciliacaoPetroleo(undefined).situacao).toBe('sem_dado')
  })

  it('série por ano com fator; nulo continua nulo', () => {
    const porAno = petroleoDaUf([linha(2023, 10, 20), linha(2025, 5, 20, true)], 'AA')
    expect(seriePetroleo(porAno, [2023, 2024, 2025], 'anp_total', (a) => (a === 2023 ? 1.5 : 1))).toEqual([15, null, null])
    expect(seriePetroleo(porAno, [2025], 'anp_royalties')).toEqual([5])
  })

  it('dados publicados: RJ 2022–2024 explicado pela ANP; 2021 não reconcilia; 2025 parcial', () => {
    const receita = lerJson('receita.json')
    const rj = petroleoDaUf(receita.petroleo.linhas, 'RJ')
    for (const ano of [2022, 2023, 2024]) expect(reconciliacaoPetroleo(rj.get(ano)).situacao).toBe('explica')
    expect(reconciliacaoPetroleo(rj.get(2021)).situacao).toBe('nao_reconcilia')
    expect(reconciliacaoPetroleo(rj.get(2025)).situacao).toBe('parcial')
    expect(receita.petroleo.ufs_nao_separa_na_dca).toEqual(expect.arrayContaining(['RJ', 'DF']))
  })
})

describe('indicadores sob demanda (tela "Por estado"): mesmas contas, outra ordem', () => {
  const despesa = lerJson('despesa_funcoes.json')
  const ipca = lerJson('ipca.json').serie
  const meta = lerJson('meta.json')
  const anoBase = meta.deflacao.ano_base_padrao
  const completo = indicadoresDeTodasAsFuncoes(despesa, ipca, { anoBase })
  const ordenar = (linhas) => [...linhas].sort((a, b) => a.uf.localeCompare(b.uf) || a.ano - b.ano)
  const POSICOES = ['posicao_per_capita_real', 'posicao_per_capita_nominal', 'posicao_pct_despesa_total', 'n_ufs']
  const semPosicao = (l) => Object.fromEntries(Object.entries(l).filter(([k]) => !POSICOES.includes(k)))

  it('doAno: cada ano, todas as funções, igual ao cálculo completo (inclusive posições)', () => {
    const sob = indicadoresSobDemanda(despesa, ipca, { anoBase })
    expect(sob.funcoes).toEqual([...completo.keys()])
    for (const ano of meta.anos) {
      const doAno = sob.doAno(ano)
      expect([...doAno.keys()]).toEqual([...completo.keys()])
      for (const [funcao, linhas] of completo) {
        expect(ordenar(doAno.get(funcao)), `${funcao} ${ano}`).toEqual(ordenar(linhas.filter((l) => l.ano === ano)))
      }
    }
  })

  it('daFuncao: igual ao cálculo completo da função', () => {
    const sob = indicadoresSobDemanda(despesa, ipca, { anoBase })
    for (const funcao of completo.keys()) expect(ordenar(sob.daFuncao(funcao)), funcao).toEqual(ordenar(completo.get(funcao)))
  })

  it('daUf: valores iguais ao cálculo completo nas 27 UFs, sem as posições (que não valem numa fatia)', () => {
    const sob = indicadoresSobDemanda(despesa, ipca, { anoBase })
    for (const uf of meta.ufs) {
      const daUf = sob.daUf(uf)
      expect([...daUf.keys()]).toEqual([...completo.keys()])  // lista nacional: inclui funções zeradas da UF
      for (const [funcao, linhas] of completo) {
        const esperado = ordenar(linhas.filter((l) => l.uf === uf)).map(semPosicao)
        expect(ordenar(daUf.get(funcao)), `${uf} ${funcao}`).toEqual(esperado)
        expect(daUf.get(funcao).every((l) => POSICOES.every((k) => !(k in l)))).toBe(true)
      }
    }
  })

  it('memorização: a mesma parte pedida de novo é o mesmo objeto (não recalcula)', () => {
    const sob = indicadoresSobDemanda(despesa, ipca, { anoBase })
    expect(sob.doAno(2024)).toBe(sob.doAno(2024))
    expect(sob.daFuncao('10')).toBe(sob.daFuncao('10'))
    expect(sob.daUf('SP')).toBe(sob.daUf('SP'))
    expect(sob.doAno(2023)).not.toBe(sob.doAno(2024))
  })
})

// --- PIB dos estados (IBGE, Contas Regionais) -------------------------------------

describe('PIB: exemplos pequenos, duas UFs fictícias', () => {
  const ATIV = [
    { uf: 'AA', ano: 2020, atividade_cod: '01', nivel: 'total', vab: 100 },
    { uf: 'AA', ano: 2020, atividade_cod: '02', nivel: 'atividade', vab: 30 },
    { uf: 'AA', ano: 2020, atividade_cod: '03', nivel: 'atividade', vab: 70 },
    { uf: 'BB', ano: 2020, atividade_cod: '01', nivel: 'total', vab: 50 },
    { uf: 'BB', ano: 2020, atividade_cod: '02', nivel: 'atividade', vab: 10 },
    { uf: 'BB', ano: 2020, atividade_cod: '03', nivel: 'atividade', vab: null },
  ]
  const UF = [
    { uf: 'AA', ano: 2020, pib_corrente: 300, volume_pib_2002_100: 120 },
    { uf: 'AA', ano: 2021, pib_corrente: 330, volume_pib_2002_100: 132 },
    { uf: 'BB', ano: 2020, pib_corrente: 100, volume_pib_2002_100: 110 },
    { uf: 'BB', ano: 2021, pib_corrente: null, volume_pib_2002_100: 121 },
    { uf: 'ZZ', ano: 2020, pib_corrente: 400, volume_pib_2002_100: 115 },
    { uf: 'ZZ', ano: 2021, pib_corrente: 440, volume_pib_2002_100: 120 },
  ]
  const porChave = (linhas) => Object.fromEntries(linhas.map((l) => [`${l.uf}|${l.chave}`, l.pct]))

  it('participação no VAB: denominador é a linha de total, nunca a soma com as atividades', () => {
    expect(porChave(participacaoNoVab(ATIV))).toEqual({ 'AA|02': 30, 'AA|03': 70, 'BB|02': 20, 'BB|03': null })
  })

  it('por grupo: soma as atividades do grupo; grupo com atividade nula fica nulo', () => {
    expect(porChave(participacaoNoVab(ATIV, { '02': 'x', '03': 'x' }))).toEqual({ 'AA|x': 100, 'BB|x': null })
    expect(() => participacaoNoVab(ATIV, { '02': 'x' })).toThrow('sem grupo')
  })

  it('recusa total repetido ou ausente', () => {
    expect(() => participacaoNoVab([...ATIV, ATIV[0]])).toThrow('mais de uma linha de total')
    expect(() => participacaoNoVab(ATIV.filter((l) => l.nivel !== 'total' || l.uf !== 'BB'))).toThrow('sem a linha de total')
  })

  it('participação no PIB do país; nulo quando falta o valor', () => {
    expect(participacaoNoPais(UF, 'AA', 2020, 'ZZ')).toBeCloseTo(75)
    expect(participacaoNoPais(UF, 'BB', 2021, 'ZZ')).toBeNull()
    expect(participacaoNoPais(UF, 'AA', 1999, 'ZZ')).toBeNull()
  })

  it('rebase e crescimento acumulado do volume', () => {
    expect(rebasear(UF, 'AA', 'volume_pib_2002_100', 2020, [2020, 2021])).toEqual([{ ano: 2020, valor: 100 }, { ano: 2021, valor: 110.00000000000001 }])
    expect(rebasear(UF, 'AA', 'volume_pib_2002_100', 1999, [2020]).map((l) => l.valor)).toEqual([null])
    expect(crescimentoAcumulado(UF, 'BB', 'volume_pib_2002_100', 2020, 2021)).toBeCloseTo(10)
    expect(crescimentoAcumulado(UF, 'BB', 'volume_pib_2002_100', 2020, 2030)).toBeNull()
  })

  it('tabela atividades × anos: total em primeiro, % ou valor', () => {
    const pct = tabelaPib(ATIV, 'BB', [2020, 2021], ['01', '02', '03'], 'pct')
    expect(pct).toEqual([
      { atividade_cod: '01', nivel: 'total', valores: [100, null] },
      { atividade_cod: '02', nivel: 'atividade', valores: [20, null] },
      { atividade_cod: '03', nivel: 'atividade', valores: [null, null] },
    ])
    expect(tabelaPib(ATIV, 'AA', [2020], ['01', '03'], 'valor').map((l) => l.valores)).toEqual([[100], [70]])
  })

  it('setores por ano: % de cada grupo; ano com grupo nulo fica todo nulo; ano sem dado também', () => {
    const grupos = { '02': 'agro', '03': 'ind' }
    expect(setoresPorAno(ATIV, 'AA', [2020, 2021], grupos)).toEqual([
      { ano: 2020, partes: { agro: 30, ind: 70 } }, { ano: 2021, partes: { agro: null, ind: null } },
    ])
    expect(setoresPorAno(ATIV, 'BB', [2020], grupos)).toEqual([{ ano: 2020, partes: { agro: null, ind: null } }])
  })

  it('participações no país: todas as UFs do ano, maior primeiro, com posição; o país fica de fora', () => {
    expect(participacoesNoPais(UF, 2020, 'ZZ')).toEqual([
      { uf: 'AA', pct: 75, posicao: 1, n_ufs: 2 }, { uf: 'BB', pct: 25, posicao: 2, n_ufs: 2 },
    ])
    expect(participacoesNoPais(UF, 2021, 'ZZ')).toEqual([
      { uf: 'AA', pct: 75, posicao: 1, n_ufs: 1 }, { uf: 'BB', pct: null, posicao: null, n_ufs: 1 },
    ])
  })
})

describe('PIB: gabarito.json (27 UFs e o país, todos os anos)', () => {
  const { pib: gabarito } = lerJson('gabarito.json')
  const pib = lerJson('pib.json')
  const atividades = lerJson('pib/<todas>.json')
  const igual = (a, b) => (a === null || b === null ? a === b : b === 0 ? Math.abs(a) < 1e-9 : Math.abs(a / b - 1) < 1e-9)
  const conferir = (esperados, chave, calcular, campo = 'pct') => {
    const erros = []
    for (const e of esperados) {
      const c = calcular(e)
      if (c === undefined || !igual(c, e[campo])) erros.push(`${chave(e)}: ${c} ≠ ${e[campo]}`)
    }
    return erros.slice(0, 10)
  }

  it('cobre todos os territórios e anos', () => {
    const territorios = new Set(pib.territorios.map((t) => t.uf))
    expect(new Set(atividades.map((l) => l.uf))).toEqual(territorios)
    expect(gabarito.pct_pais).toHaveLength(territorios.size * pib.anos.length)
  })

  it('participação de cada atividade e de cada grande setor no VAB', () => {
    const chave = (e) => `${e.uf}|${e.ano}|${e.chave}`
    const porAtividade = new Map(participacaoNoVab(atividades).map((l) => [chave(l), l.pct]))
    expect(conferir(gabarito.atividades, chave, (e) => porAtividade.get(chave(e)))).toEqual([])
    const grupos = Object.fromEntries(pib.atividades.filter((a) => a.grande_setor !== 'total').map((a) => [a.atividade_cod, a.grande_setor]))
    const porSetor = new Map(participacaoNoVab(atividades, grupos).map((l) => [chave(l), l.pct]))
    expect(conferir(gabarito.setores, chave, (e) => porSetor.get(chave(e)))).toEqual([])
  })

  it('participação no PIB do país', () => {
    expect(conferir(gabarito.pct_pais, (e) => `${e.uf}|${e.ano}`,
      (e) => participacaoNoPais(pib.linhas, e.uf, e.ano, pib.pais))).toEqual([])
  })

  it('volume rebaseado e crescimento real acumulado', () => {
    expect(conferir(gabarito.rebase, (e) => `${e.uf}|${e.ano}|${e.base}`,
      (e) => rebasear(pib.linhas, e.uf, 'volume_pib_2002_100', e.base, [e.ano])[0].valor, 'valor')).toEqual([])
    expect(conferir(gabarito.crescimento, (e) => `${e.uf}|${e.inicio}-${e.fim}`,
      (e) => crescimentoAcumulado(pib.linhas, e.uf, 'volume_pib_2002_100', e.inicio, e.fim), 'crescimento_pct')).toEqual([])
  })
})

// --- Pesquisa e Inovação (IBID) ---------------------------------------------------

describe('IBID: exemplos pequenos, duas UFs fictícias', () => {
  const IBID = {
    anos: [2024, 2025],
    dimensoes: [
      { id: 'geral', pai: null, nome: 'IBID – Geral' }, { id: 'contexto', pai: 'geral', nome: 'IBID – Contexto' },
      { id: 'capital', pai: 'contexto', nome: 'Capital' }, { id: 'resultado', pai: 'geral', nome: 'IBID – Resultado' },
      { id: 'tecnologia', pai: 'resultado', nome: 'Tecnologia' },
    ],
    ufs: {
      AA: { nome: 'Aa', escores: { geral: { 2024: 0.5, 2025: 0.4 }, contexto: { 2024: 0.6, 2025: 0.5 }, capital: { 2024: 0.7, 2025: 0.6 }, resultado: { 2024: 0.3, 2025: 0.2 }, tecnologia: { 2024: 0.1, 2025: 0.2 } },
        ranking: { geral: { 2024: 1, 2025: 2 }, contexto: { 2024: 1, 2025: 2 }, resultado: { 2024: 2, 2025: 2 } } },
      BB: { nome: 'Bb', escores: { geral: { 2024: 0.3, 2025: 0.45 }, contexto: { 2024: 0.2, 2025: 0.6 }, capital: { 2024: 0.4, 2025: 0.5 }, resultado: { 2024: 0.4, 2025: 0.3 }, tecnologia: { 2024: 0.3, 2025: 0.4 } },
        ranking: { geral: { 2024: 2, 2025: 1 }, contexto: { 2024: 2, 2025: 1 }, resultado: { 2024: 1, 2025: 1 } } },
    },
    agregados: {
      centro_oeste: { nome: 'Centro-Oeste', escores: { capital: { 2025: 0.55 }, tecnologia: { 2025: 0.25 } } },
      brasil: { nome: 'Brasil', escores: { capital: { 2025: 0.52 }, tecnologia: { 2025: 0.33 } } },
    },
    mediana_ufs: { escores: { capital: { 2025: 0.55 }, tecnologia: { 2025: 0.3 }, contexto: { 2025: 0.55 }, resultado: { 2025: 0.25 } } },
  }

  it('ranking do ano na ordem oficial, sem recalcular', () => {
    expect(rankingIbid(IBID, 2025).map((l) => [l.uf, l.posicao, l.geral, l.posicao_resultado])).toEqual([['BB', 1, 0.45, 1], ['AA', 2, 0.4, 2]])
  })

  it('série por posição ou por escore; UF desconhecida é erro', () => {
    expect(serieIbid(IBID, 'AA', 'geral', 'posicao')).toEqual([{ ano: 2024, valor: 1 }, { ano: 2025, valor: 2 }])
    expect(serieIbid(IBID, 'BB', 'geral', 'escore', [2025, 2026])).toEqual([{ ano: 2025, valor: 0.45 }, { ano: 2026, valor: null }])
    expect(() => serieIbid(IBID, 'ZZ', 'geral', 'posicao')).toThrow('sem posicao')
  })

  it('pilares (filhos dos subíndices) contra a região e o Brasil', () => {
    expect(idAgregado('Centro-Oeste')).toBe('centro_oeste')
    expect(pilaresComparados(IBID, 'AA', 'Centro-Oeste', 2025)).toEqual([
      { dimensao: 'capital', nome: 'Capital', pai: 'contexto', uf: 0.6, regiao: 0.55, brasil: 0.52, tipico: 0.55 },
      { dimensao: 'tecnologia', nome: 'Tecnologia', pai: 'resultado', uf: 0.2, regiao: 0.25, brasil: 0.33, tipico: 0.3 },
    ])
    expect(() => pilaresComparados(IBID, 'AA', 'Atlântida', 2025)).toThrow('sem agregado')
  })

  it('dispersão: pontos do ano e as medianas publicadas (estado típico), sem recalcular', () => {
    const d = dispersaoIbid(IBID, 2025)
    expect(d.pontos).toEqual([{ uf: 'AA', nome: 'Aa', contexto: 0.5, resultado: 0.2 }, { uf: 'BB', nome: 'Bb', contexto: 0.6, resultado: 0.3 }])
    expect(d.medianaContexto).toBe(0.55)
    expect(d.medianaResultado).toBe(0.25)
    // usa o publicado mesmo que difira da conta (a conta é do pipeline)
    expect(dispersaoIbid({ ...IBID, mediana_ufs: { escores: { contexto: { 2025: 0.9 }, resultado: { 2025: 0.1 } } } }, 2025).medianaContexto).toBe(0.9)
  })

  it('Ensino Superior (subfunção): contas das subáreas, % sobre o total da UF, zero onde não foi declarada', () => {
    const DESP = [
      { uf: 'AA', ano: 2025, nivel: 'funcao', funcao_cod: '12', liquidado: 300, intra: false, populacao: 10, fonte_dado: 'siconfi_dca' },
      { uf: 'AA', ano: 2025, nivel: 'funcao', funcao_cod: '19', liquidado: 100, intra: false, populacao: 10, fonte_dado: 'siconfi_dca' },
      { uf: 'BB', ano: 2025, nivel: 'funcao', funcao_cod: '12', liquidado: 200, intra: false, populacao: 20, fonte_dado: 'siconfi_dca' },
    ]
    const SUB = [
      { uf: 'AA', ano: 2025, nivel: 'subfuncao', funcao_cod: '12', subfuncao_cod: '364', liquidado: 40, intra: false, populacao: 10, fonte_dado: 'siconfi_dca' },
      { uf: 'AA', ano: 2025, nivel: 'subfuncao', funcao_cod: '19', subfuncao_cod: '364', liquidado: 99, intra: false, populacao: 10, fonte_dado: 'siconfi_dca' },
    ]
    const r = indicadoresDaSubfuncao(DESP, SUB, [{ ano: 2025, variacao_pct: 5 }], { funcao: '12', subfuncao: '364', anoBase: 2025 })
    expect(r).toEqual([
      { uf: 'AA', ano: 2025, nominal: 40, real: 40, per_capita_real: 4, pct_despesa_total: 10, sem_gasto_declarado: false, posicao_per_capita_real: 1, n_ufs: 2 },
      { uf: 'BB', ano: 2025, nominal: 0, real: 0, per_capita_real: 0, pct_despesa_total: 0, sem_gasto_declarado: true, posicao_per_capita_real: 2, n_ufs: 2 },
    ])  // 19.364 não entra: só a 364 dentro de Educação
  })

  it('cruzamento: só anos das duas fontes, duas séries, a soma e a posição no IBID', () => {
    const ct = [
      { uf: 'AA', ano: 2023, per_capita_real: 1, pct_despesa_total: 0.1, posicao_per_capita_real: 1, sem_gasto_declarado: false },
      { uf: 'AA', ano: 2025, per_capita_real: 2, pct_despesa_total: 0.2, posicao_per_capita_real: 1, sem_gasto_declarado: false },
      { uf: 'BB', ano: 2025, per_capita_real: 0, pct_despesa_total: 0, posicao_per_capita_real: 2, sem_gasto_declarado: true },
    ]
    const es = [
      { uf: 'AA', ano: 2023, per_capita_real: 9, pct_despesa_total: 0.9, posicao_per_capita_real: 1, sem_gasto_declarado: false },
      { uf: 'AA', ano: 2025, per_capita_real: 1, pct_despesa_total: 0.1, posicao_per_capita_real: 2, sem_gasto_declarado: false },
      { uf: 'BB', ano: 2025, per_capita_real: 5, pct_despesa_total: 0.5, posicao_per_capita_real: 1, sem_gasto_declarado: false },
    ]
    const c = cruzamentoPesquisa(ct, es, IBID)
    expect(c.map((l) => [l.uf, l.ano, l.soma_per_capita_real, l.posicao_soma, l.posicao_ibid, l.ct_sem_gasto])).toEqual([
      ['AA', 2025, 3, 2, 2, false], ['BB', 2025, 5, 1, 1, true],
    ])
    expect(c[0].soma_pct).toBeCloseTo(0.3)
    expect(() => cruzamentoPesquisa(ct, es.slice(0, 1), IBID)).toThrow('sem Ensino Superior')
  })
})

describe('IBID: dados publicados', () => {
  const ibid = lerJson('ibid.json')
  const gabarito = lerJson('gabarito.json')
  const meta = lerJson('meta.json')

  it('ranking de cada ano = ranking oficial publicado; 27 UFs, posições 1 a 27', () => {
    for (const ano of ibid.anos) {
      const r = rankingIbid(ibid, ano)
      expect(r.map((l) => l.posicao)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1))
      for (let i = 1; i < r.length; i += 1) expect(r[i - 1].geral).toBeGreaterThan(r[i].geral)  // conferência do extrator
    }
  })

  it('cada UF tem os sete pilares com o agregado da sua região', () => {
    const ufs = lerJson('dicionarios.json').ufs
    for (const u of ufs) {
      const p = pilaresComparados(ibid, u.uf, u.regiao, 2025)
      expect(p).toHaveLength(7)
      expect(p.every((x) => [x.uf, x.regiao, x.brasil].every((v) => v > 0 && v <= 1)), u.uf).toBe(true)
    }
  })

  it('estado típico publicado = mediana das 27 UFs, em todas as dimensões e anos (pipeline × front)', () => {
    for (const d of ibid.dimensoes) {
      for (const a of ibid.anos) {
        const esperado = mediana(Object.values(ibid.ufs).map((u) => u.escores[d.id][String(a)]))
        expect(Math.abs(ibid.mediana_ufs.escores[d.id][String(a)] - esperado), `${d.id} ${a}`).toBeLessThan(5e-7)  // 6 casas
      }
    }
    expect(ibid.mediana_ufs.nome).toBe('Estado típico (mediana das UFs)')
  })

  it('cruzamento: C&T (19) e Ensino Superior (12.364) iguais ao gabarito.json (Python), soma e anos comuns', () => {
    const despesa = lerJson('despesa_funcoes.json')
    const ipca = lerJson('ipca.json').serie
    const anoBase = meta.deflacao.ano_base_padrao
    const ct = indicadoresDaFuncao(despesa, ipca, { funcao: '19', anoBase })
    const es = indicadoresDaSubfuncao(despesa, lerJson('despesa_ensino_superior.json'), ipca, { funcao: '12', subfuncao: '364', anoBase })
    const igual = (a, b) => (b === 0 ? Math.abs(a) < 1e-9 : Math.abs(a / b - 1) < 1e-9)
    expect(es).toHaveLength(gabarito.ensino_superior.length)
    for (const g of gabarito.ensino_superior) {
      const l = es.find((x) => x.uf === g.uf && x.ano === g.ano)
      expect(igual(l.per_capita_real, g.per_capita_real) && igual(l.pct_despesa_total, g.pct_despesa_total), `${g.uf} ${g.ano}`).toBe(true)
      expect([l.posicao_per_capita_real, l.sem_gasto_declarado], `${g.uf} ${g.ano}`).toEqual([g.posicao_per_capita_real, g.sem_gasto_declarado])
    }
    const cruzamento = cruzamentoPesquisa(ct, es, ibid)
    expect([...new Set(cruzamento.map((l) => l.ano))].sort()).toEqual(meta.anos.filter((a) => ibid.anos.includes(a)))
    expect(cruzamento).toHaveLength(27 * new Set(cruzamento.map((l) => l.ano)).size)
    for (const l of cruzamento) {
      const g = gabarito.valores.find((v) => v.funcao_cod === '19' && v.uf === l.uf && v.ano === l.ano)
      expect(igual(l.ct_per_capita_real, g.per_capita_real), `${l.uf} ${l.ano}`).toBe(true)
      expect(l.soma_per_capita_real).toBe(l.ct_per_capita_real + l.es_per_capita_real)
      expect(l.posicao_ibid).toBe(ibid.ufs[l.uf].ranking.geral[String(l.ano)])
    }
  })
})

// --- Educação (IDEB) ---------------------------------------------------------------

describe('IDEB: exemplos pequenos, duas UFs fictícias', () => {
  const IDEB = {
    anos: [2021, 2023, 2025],
    ufs: {
      AA: { nome: 'Aa', etapas: { medio: { estadual: { ideb: [3.5, 3.8, 4.4], nota_padronizada: [4.5, 4.6, 4.8], rendimento: [0.78, 0.83, 0.92], aprovacao: { total: [80, 85, 92] } } } } },
      BB: { nome: 'Bb', etapas: { medio: { estadual: { ideb: [3.9, 3.7, null], nota_padronizada: [4.4, 4.4, null], rendimento: [0.89, 0.84, null] } } } },
    },
    agregados: { brasil: { nome: 'Brasil', etapas: { medio: { estadual: { ideb: [3.6, 3.8, 4.1] } } } } },
    ressalvas: [{ id: 'geral' }, { id: 'so_ai', etapas: ['anos_iniciais'] }, { id: 'so_medio', etapas: ['medio'] }],
    ressalvas_por_uf: { AA: [{ id: 'nota', linhas: [{ etapa: 'medio', rede: 'privada' }] }, { id: 'distrital' }] },
  }

  it('série da UF e do agregado, alinhada aos anos; território ou rede sem dado dá nulos', () => {
    expect(serieIdeb(IDEB, 'AA', 'medio', 'estadual', 'ideb')).toEqual([{ ano: 2021, valor: 3.5 }, { ano: 2023, valor: 3.8 }, { ano: 2025, valor: 4.4 }])
    expect(serieIdeb(IDEB, 'brasil', 'medio', 'estadual', 'ideb').map((p) => p.valor)).toEqual([3.6, 3.8, 4.1])
    expect(serieIdeb(IDEB, 'AA', 'medio', 'estadual', 'aprovacao').map((p) => p.valor)).toEqual([80, 85, 92])
    expect(serieIdeb(IDEB, 'AA', 'medio', 'publica', 'ideb').map((p) => p.valor)).toEqual([null, null, null])
  })

  it('ranking do ano: posição, variação em pontos sobre a edição anterior; sem dado fica sem posição, no fim', () => {
    const r2023 = rankingIdeb(IDEB, 'medio', 'estadual', 2023)
    expect(r2023.map((l) => [l.uf, l.posicao, l.n_ufs])).toEqual([['AA', 1, 2], ['BB', 2, 2]])
    expect(r2023[0].variacao_pontos).toBeCloseTo(0.3)
    const r2025 = rankingIdeb(IDEB, 'medio', 'estadual', 2025)
    expect(r2025.map((l) => [l.uf, l.posicao, l.variacao_pontos === null])).toEqual([['AA', 1, false], ['BB', null, true]])
    expect(rankingIdeb(IDEB, 'medio', 'estadual', 2021)[0].variacao_pontos).toBeNull()  // primeira edição
    expect(() => rankingIdeb(IDEB, 'medio', 'estadual', 2022)).toThrow('fora da série')
  })

  it('tendência por janela de anos (edições bienais) e conferência N × P', () => {
    const t = tendenciasDoIdeb(IDEB, 'AA', 'medio', 'estadual', 2025, [{ id: '2', anos: 2 }, { id: 'tudo', anos: null }])
    expect(t.map((j) => [j.inicio, j.observacoes.length])).toEqual([[2023, 2], [2021, 3]])
    expect(t[1].resultado.taxaAnual).toBeGreaterThan(0)
    expect(idebRecalculado(IDEB, 'AA', 'medio', 'estadual', 2025)).toEqual({ n: 4.8, p: 0.92, calculado: 4.8 * 0.92, publicado: 4.4 })
    expect(idebRecalculado(IDEB, 'BB', 'medio', 'estadual', 2025).calculado).toBeNull()
  })

  it('aprovação por série (arquivo da UF) e ressalvas que valem para a etapa e a rede', () => {
    const porUf = { medio: { estadual: { aprovacao: { total: [1, 2, 3], 2: [9, 8, 7], 1: [5, 6, null] } } } }
    expect(aprovacaoPorSerie(porUf, IDEB.anos, 'medio', 'estadual', 2025)).toEqual([{ serie: '1', valor: null }, { serie: '2', valor: 7 }])
    expect(ressalvasDoIdeb(IDEB, 'AA', 'medio', 'estadual').map((r) => r.id)).toEqual(['distrital', 'geral', 'so_medio'])
    expect(ressalvasDoIdeb(IDEB, 'AA', 'medio', 'privada').map((r) => r.id)).toEqual(['nota', 'distrital', 'geral', 'so_medio'])
  })
})

describe('IDEB: dados publicados', () => {
  const ideb = lerJson('ideb.json')
  const gabarito = lerJson('gabarito.json').ideb

  it('posição e variação de todas as UFs, etapas, redes e anos = gabarito.json (Python)', () => {
    const erros = []
    const grupos = new Set(gabarito.map((g) => `${g.etapa}|${g.rede}|${g.ano}`))
    for (const grupo of grupos) {
      const [etapa, rede, ano] = grupo.split('|')
      const calculado = new Map(rankingIdeb(ideb, etapa, rede, Number(ano)).map((l) => [l.uf, l]))
      for (const g of gabarito.filter((x) => x.etapa === etapa && x.rede === rede && x.ano === Number(ano))) {
        const c = calculado.get(g.uf)
        if (c.ideb !== g.ideb || c.posicao !== g.posicao || c.n_ufs !== g.n_ufs) erros.push(`${grupo} ${g.uf}: posição ${c.posicao} ≠ ${g.posicao}`)
        const v = (x) => (x === null ? null : Math.round(x * 1e9) / 1e9)
        if (v(c.variacao_pontos) !== v(g.variacao_pontos)) erros.push(`${grupo} ${g.uf}: variação ${c.variacao_pontos} ≠ ${g.variacao_pontos}`)
      }
    }
    expect(erros.slice(0, 10)).toEqual([])
    expect(grupos.size).toBe(11 * (4 + 4 + 3))  // anos × redes das UFs por etapa (médio sem a pública)
  })

  it('o arquivo do site não tem metas; o IDEB publicado bate com N × P (±0,1) em todas as UFs', () => {
    expect(JSON.stringify(ideb)).not.toContain('"meta"')
    for (const [uf, d] of Object.entries(ideb.ufs)) {
      for (const [etapa, redes] of Object.entries(d.etapas)) {
        for (const rede of Object.keys(redes)) {
          for (const ano of ideb.anos) {
            const c = idebRecalculado(ideb, uf, etapa, rede, ano)
            if (c.calculado !== null && c.publicado !== null) expect(Math.abs(c.calculado - c.publicado), `${uf} ${etapa} ${rede} ${ano}`).toBeLessThanOrEqual(0.1 + 1e-9)
          }
        }
      }
    }
  })
})

// --- Violência (FBSP, mortes violentas intencionais) --------------------------------------------

describe('Violência: exemplos pequenos, UFs fictícias e o país ZZ', () => {
  const L = [
    { uf: 'AA', ano: 2020, mvi_numero: 100, mvi_taxa: 20 }, { uf: 'BB', ano: 2020, mvi_numero: 300, mvi_taxa: 30 },
    { uf: 'ZZ', ano: 2020, mvi_numero: 400, mvi_taxa: 26 },
    { uf: 'AA', ano: 2021, mvi_numero: 120, mvi_taxa: 30 }, { uf: 'BB', ano: 2021, mvi_numero: 280, mvi_taxa: 30 },
    { uf: 'ZZ', ano: 2021, mvi_numero: 400, mvi_taxa: 27 },
    { uf: 'AA', ano: 2022, mvi_numero: 90, mvi_taxa: null }, { uf: 'ZZ', ano: 2022, mvi_numero: 380, mvi_taxa: 25 },
  ]
  it('ranking pela taxa: 1 = maior, empate com a melhor posição, sem o país, nulo no fim', () => {
    expect(rankingMvi(L, 2020, 'ZZ')).toEqual([
      { uf: 'BB', taxa: 30, numero: 300, posicao: 1, n_ufs: 2 }, { uf: 'AA', taxa: 20, numero: 100, posicao: 2, n_ufs: 2 },
    ])
    expect(rankingMvi(L, 2021, 'ZZ').map((l) => l.posicao)).toEqual([1, 1])
    expect(rankingMvi(L, 2022, 'ZZ')).toEqual([{ uf: 'AA', taxa: null, numero: 90, posicao: null, n_ufs: 0 }])
  })
  it('índice da soma dos membros, primeiro ano = 100; falta de membro deixa o ano nulo', () => {
    expect(indiceMvi(L, ['AA'], 2020, [2020, 2021])).toEqual([{ ano: 2020, valor: 100 }, { ano: 2021, valor: 120 }])
    expect(indiceMvi(L, ['AA', 'BB'], 2020, [2021, 2022])).toEqual([{ ano: 2021, valor: 100 }, { ano: 2022, valor: null }])
    expect(indiceMvi(L, ['AA'], 2019, [2020])).toEqual([{ ano: 2020, valor: null }])
  })
  it('letalidade policial: ranking pela taxa de MDIP e % das MVI por grupo', () => {
    const M = [
      { uf: 'AA', ano: 2020, mvi_numero: 100, mdip_numero: 10, mdip_taxa: 2 }, { uf: 'BB', ano: 2020, mvi_numero: 300, mdip_numero: 60, mdip_taxa: 6 },
      { uf: 'ZZ', ano: 2020, mvi_numero: 400, mdip_numero: 70, mdip_taxa: 4.5 }, { uf: 'AA', ano: 2021, mvi_numero: 50, mdip_numero: null },
    ]
    expect(rankingMvi(M, 2020, 'ZZ', 'mdip').map((l) => [l.uf, l.numero, l.posicao])).toEqual([['BB', 60, 1], ['AA', 10, 2]])
    expect(pctMdipNasMvi(M, ['AA', 'BB'], [2020, 2021])).toEqual([{ ano: 2020, valor: 17.5 }, { ano: 2021, valor: null }])
    expect(pctMdipNasMvi(M, ['AA'], [2020])).toEqual([{ ano: 2020, valor: 10 }])
  })
  it('série e valor de um território', () => {
    expect(serieMvi(L, 'ZZ', [2021, 2023], 'mvi_taxa')).toEqual([{ ano: 2021, valor: 27 }, { ano: 2023, valor: null }])
    expect(valorMvi(L, 'AA', 2022, 'mvi_taxa')).toBeNull()
  })
})

describe('Violência: gabarito.json (27 UFs, regiões e o país, todos os anos)', () => {
  const { violencia: gabarito } = lerJson('gabarito.json')
  const violencia = lerJson('violencia.json')
  const regioes = {}
  for (const t of violencia.territorios) if (t.regiao) (regioes[t.regiao] ??= []).push(t.uf)

  it('ranking pela taxa em cada ano', () => {
    const erros = gabarito.ranking.filter((e) => {
      const c = rankingMvi(violencia.linhas, e.ano, violencia.pais).find((l) => l.uf === e.uf)
      return c?.posicao !== e.posicao || c?.n_ufs !== e.n_ufs
    })
    expect(gabarito.ranking).toHaveLength(27 * violencia.anos.length)
    expect(erros.slice(0, 5)).toEqual([])
  })
  it('letalidade policial: ranking pela taxa de MDIP e % das MDIP nas MVI (UF, região, país)', () => {
    const errosRanking = gabarito.ranking_mdip.filter((e) => {
      const c = rankingMvi(violencia.linhas, e.ano, violencia.pais, 'mdip').find((l) => l.uf === e.uf)
      return c?.posicao !== e.posicao || c?.n_ufs !== e.n_ufs
    })
    expect(gabarito.ranking_mdip).toHaveLength(27 * violencia.anos.length)
    expect(errosRanking.slice(0, 5)).toEqual([])
    const errosPct = gabarito.pct_mdip_nas_mvi.filter((e) => {
      const c = pctMdipNasMvi(violencia.linhas, regioes[e.uf] ?? [e.uf], [e.ano])[0].valor
      return Math.abs(c / e.pct - 1) > 1e-9
    })
    expect(gabarito.pct_mdip_nas_mvi).toHaveLength((27 + 1 + Object.keys(regioes).length) * violencia.anos.length)
    expect(errosPct.slice(0, 5)).toEqual([])
  })
  it('índice do número (UF, região = soma das UFs, país), primeiro ano = 100', () => {
    const erros = gabarito.indice.filter((e) => {
      const membros = regioes[e.uf] ?? [e.uf]
      const c = indiceMvi(violencia.linhas, membros, gabarito.base, [e.ano])[0].valor
      return e.indice === null ? c !== null : Math.abs(c / e.indice - 1) > 1e-9
    })
    expect(gabarito.indice).toHaveLength((27 + 1 + Object.keys(regioes).length) * violencia.anos.length)
    expect(erros.slice(0, 5)).toEqual([])
  })
})

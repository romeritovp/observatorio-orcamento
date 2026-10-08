// Todas as contas do front ficam aqui. Funções puras: recebem os dados já lidos dos
// JSON de public/data/ (despesa.json, ipca.json) e devolvem novos arrays; não buscam
// arquivo, não alteram a entrada e não conhecem componentes.
//
// Espelham analytics/ do Python; o teste compara o resultado com public/data/gabarito.json.

// --- seleção ---------------------------------------------------------------

/** Linhas que atendem a todos os critérios ({coluna: valor}). */
export function filtrar(linhas, criterios) {
  const pares = Object.entries(criterios)
  return linhas.filter((linha) => pares.every(([coluna, valor]) => linha[coluna] === valor))
}

function chaveDe(linha, colunas) {
  return colunas.map((c) => String(linha[c])).join('|')
}

function agrupar(linhas, colunas) {
  const grupos = new Map()
  for (const linha of linhas) {
    const chave = chaveDe(linha, colunas)
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(linha)
  }
  return grupos
}

/** Agrupamentos sempre incluem uf. */
function comUf(por) {
  return por.includes('uf') ? por : ['uf', ...por]
}

/** Linhas de níveis diferentes (total, funcao, ...) nunca entram juntas numa conta. */
function checarUmNivel(linhas) {
  const niveis = new Set(linhas.map((l) => l.nivel).filter((n) => n !== undefined))
  if (niveis.size > 1) {
    throw new Error(`linhas misturam níveis ${[...niveis].sort().join(', ')}; filtre um antes`)
  }
}

const ehNulo = (valor) => valor === null || valor === undefined || Number.isNaN(valor)

// --- deflação ----------------------------------------------------------------

/**
 * Índice encadeado do IPCA: ano → produto de (1 + variacao_pct/100) do primeiro ano até o ano.
 * serie: ipca.json → serie ([{ano, variacao_pct, ...}]), sem anos faltando.
 */
export function indiceEncadeado(serie) {
  const ordenada = [...serie].sort((a, b) => a.ano - b.ano)
  const indice = new Map()
  let acumulado = 1
  ordenada.forEach((ponto, i) => {
    if (indice.has(ponto.ano)) throw new Error(`IPCA com ano repetido: ${ponto.ano}`)
    if (i > 0 && ponto.ano !== ordenada[i - 1].ano + 1) throw new Error('IPCA com anos faltando')
    acumulado *= 1 + ponto.variacao_pct / 100
    indice.set(ponto.ano, acumulado)
  })
  return indice
}

/** Fator que leva valores do `ano` a preços de dezembro do `anoBase`. */
export function fatorDeflacao(indice, ano, anoBase) {
  if (!indice.has(anoBase)) throw new Error(`ano base ${anoBase} fora do IPCA`)
  if (!indice.has(ano)) throw new Error(`ano sem IPCA: ${ano}`)
  return indice.get(anoBase) / indice.get(ano)
}

/** Cria `<coluna>_real` a preços de dezembro do anoBase. Nulo continua nulo. */
export function deflacionar(linhas, colunas, anoBase, serieIpca) {
  const indice = indiceEncadeado(serieIpca)
  return linhas.map((linha) => {
    const fator = fatorDeflacao(indice, linha.ano, anoBase)
    const nova = { ...linha }
    for (const coluna of colunas) {
      nova[`${coluna}_real`] = ehNulo(linha[coluna]) ? null : linha[coluna] * fator
    }
    return nova
  })
}

// --- normalização --------------------------------------------------------------

/** Cria `<coluna>_per_capita` usando a `populacao` de cada linha. Sem população é erro. */
export function perCapita(linhas, colunas) {
  return linhas.map((linha) => {
    if (ehNulo(linha.populacao) || linha.populacao <= 0) {
      throw new Error(`sem população para ${linha.uf} ${linha.ano}`)
    }
    const nova = { ...linha }
    for (const coluna of colunas) {
      nova[`${coluna}_per_capita`] = ehNulo(linha[coluna]) ? null : linha[coluna] / linha.populacao
    }
    return nova
  })
}

/**
 * Participação percentual de cada linha no total do grupo `por` (+ uf): cria `<coluna>_part_pct`.
 * Para o % da despesa total: linhas de nível funcao, sem intra, por ['ano'].
 */
export function participacao(linhas, coluna, por = ['ano']) {
  checarUmNivel(linhas)
  const grupos = agrupar(linhas, comUf(por))
  const totais = new Map()
  for (const [chave, membros] of grupos) {
    totais.set(chave, membros.reduce((soma, l) => (ehNulo(l[coluna]) ? soma : soma + l[coluna]), 0))
  }
  return linhas.map((linha) => {
    const total = totais.get(chaveDe(linha, comUf(por)))
    const valor = ehNulo(linha[coluna]) || total === 0 ? null : (linha[coluna] / total) * 100
    return { ...linha, [`${coluna}_part_pct`]: valor }
  })
}

// --- comparação entre UFs ---------------------------------------------------

/**
 * Posição de cada UF em `coluna` dentro do grupo `por` (1 = maior). Cria `<coluna>_posicao`
 * e `<coluna>_n_ufs`. Empate fica com a melhor posição; valor nulo fica sem posição.
 * Use só colunas normalizadas (per capita ou %).
 */
export function ranking(linhas, coluna, por = ['ano']) {
  checarUmNivel(linhas)
  const grupoSemUf = por.filter((c) => c !== 'uf')
  const vistos = new Set()
  for (const linha of linhas) {
    const chave = chaveDe(linha, ['uf', ...grupoSemUf])
    if (vistos.has(chave)) throw new Error(`mais de uma linha por uf e ${grupoSemUf.join(', ')}`)
    vistos.add(chave)
  }

  const posicoes = new Map()
  for (const membros of agrupar(linhas, grupoSemUf).values()) {
    const valores = membros.map((l) => l[coluna]).filter((v) => !ehNulo(v))
    for (const linha of membros) {
      const valor = linha[coluna]
      posicoes.set(linha, {
        posicao: ehNulo(valor) ? null : 1 + valores.filter((v) => v > valor).length,
        n: valores.length,
      })
    }
  }
  return linhas.map((linha) => ({
    ...linha,
    [`${coluna}_posicao`]: posicoes.get(linha).posicao,
    [`${coluna}_n_ufs`]: posicoes.get(linha).n,
  }))
}

// --- ausência = zero -----------------------------------------------------------------

/**
 * Acrescenta linhas com valor 0 para as combinações ausentes de `universo` × `combinacoes`.
 * universo: UFs/anos que entregaram o demonstrativo ([{uf, ano, populacao, ...}]); suas
 *   propriedades são copiadas para as linhas novas.
 * chaves: o que identifica a linha do universo (ex.: ['uf', 'ano']).
 * combinacoes: valores cruzados com o universo (ex.: [{nivel: 'funcao', funcao_cod: '17'}]).
 * colunas: recebem 0 nas linhas novas. Cria `sem_gasto_declarado` (true nas novas).
 * Espelha analytics.completar_com_zero do Python.
 */
export function completarComZero(linhas, universo, chaves, combinacoes, colunas) {
  const vistosUniverso = new Set()
  for (const u of universo) {
    const chave = chaveDe(u, chaves)
    if (vistosUniverso.has(chave)) throw new Error(`universo com mais de uma linha por ${chaves.join(', ')}`)
    vistosUniverso.add(chave)
  }
  const porCombinacao = combinacoes.map((c) => Object.keys(c))
  const existentes = new Set(linhas.map((l) => combinacoes.map((c, i) => `${chaveDe(l, chaves)}#${chaveDe(l, porCombinacao[i])}`)).flat())
  const novas = []
  for (const u of universo) {
    combinacoes.forEach((c, i) => {
      if (!existentes.has(`${chaveDe(u, chaves)}#${chaveDe(c, porCombinacao[i])}`)) {
        novas.push({ ...u, ...c, ...Object.fromEntries(colunas.map((col) => [col, 0])), sem_gasto_declarado: true })
      }
    })
  }
  return [...linhas.map((l) => ({ ...l, sem_gasto_declarado: false })), ...novas]
}

// --- indicadores prontos para a tela -------------------------------------------

/**
 * Indicadores de uma função para todas as UFs e anos, a partir de despesa.json e ipca.json.
 * Cada linha traz os passos da conta (para a tabela de auditoria e o CSV):
 *   nominal (R$ da época), fator do IPCA, real, população, despesa total do estado,
 *   per capita real e da época, % da despesa total, posições nas três medidas,
 *   fonte, data da extração e se a UF não declarou gasto na função (entra com 0).
 */
export function indicadoresDaFuncao(despesa, serieIpca, {
  funcao, estagio = 'liquidado', anoBase, fonte = 'siconfi_dca',
}) {
  const funcoes = filtrar(despesa, { fonte_dado: fonte, nivel: 'funcao', intra: false })

  // Universo: UFs/anos que entregaram a DCA; e a despesa total de cada um (soma das funções)
  const universo = new Map()
  const totais = new Map()
  for (const l of funcoes) {
    const chave = chaveDe(l, ['uf', 'ano'])
    if (!universo.has(chave)) {
      universo.set(chave, { uf: l.uf, ano: l.ano, populacao: l.populacao, fonte_dado: l.fonte_dado, extraido_em: l.extraido_em })
    }
    totais.set(chave, (totais.get(chave) ?? 0) + (ehNulo(l[estagio]) ? 0 : l[estagio]))
  }

  let linhas = participacao(funcoes, estagio, ['ano'])
  // Linha da função sem valor no estágio (ex.: só empenhado) conta como ausência: entra com 0
  linhas = filtrar(linhas, { funcao_cod: funcao }).filter((l) => !ehNulo(l[estagio]))
  linhas = completarComZero(linhas, [...universo.values()], ['uf', 'ano'],
    [{ nivel: 'funcao', funcao_cod: funcao }], [estagio, `${estagio}_part_pct`])
  linhas = deflacionar(linhas, [estagio], anoBase, serieIpca)
  linhas = perCapita(linhas, [estagio, `${estagio}_real`])
  for (const coluna of [`${estagio}_real_per_capita`, `${estagio}_per_capita`, `${estagio}_part_pct`]) {
    linhas = ranking(linhas, coluna, ['ano'])
  }

  const indice = indiceEncadeado(serieIpca)
  return linhas.map((l) => ({
    uf: l.uf,
    ano: l.ano,
    funcao_cod: funcao,
    nominal: l[estagio],
    fator_ipca: fatorDeflacao(indice, l.ano, anoBase),
    real: l[`${estagio}_real`],
    populacao: l.populacao,
    total_despesa: totais.get(chaveDe(l, ['uf', 'ano'])),
    per_capita_real: l[`${estagio}_real_per_capita`],
    per_capita_nominal: l[`${estagio}_per_capita`],
    pct_despesa_total: l[`${estagio}_part_pct`],
    posicao_per_capita_real: l[`${estagio}_real_per_capita_posicao`],
    posicao_per_capita_nominal: l[`${estagio}_per_capita_posicao`],
    posicao_pct_despesa_total: l[`${estagio}_part_pct_posicao`],
    n_ufs: l[`${estagio}_real_per_capita_n_ufs`],
    sem_gasto_declarado: l.sem_gasto_declarado,
    fonte_dado: l.fonte_dado,
    extraido_em: l.extraido_em,
  }))
}

// --- mediana ------------------------------------------------------------------------

/** Mediana dos valores não nulos (média dos dois do meio quando a quantidade é par). */
export function mediana(valores) {
  const validos = valores.filter((v) => !ehNulo(v)).sort((a, b) => a - b)
  if (validos.length === 0) return null
  const meio = Math.floor(validos.length / 2)
  return validos.length % 2 ? validos[meio] : (validos[meio - 1] + validos[meio]) / 2
}

/** Mediana de `coluna` entre as UFs em cada ano: [{ano, mediana, n_ufs}], em ordem de ano. */
export function medianaPorAno(linhas, coluna) {
  return [...agrupar(linhas, ['ano']).values()]
    .map((membros) => ({
      ano: membros[0].ano,
      mediana: mediana(membros.map((l) => l[coluna])),
      n_ufs: membros.filter((l) => !ehNulo(l[coluna])).length,
    }))
    .sort((a, b) => a.ano - b.ano)
}

/** Linhas na ordem do ranking: posição crescente, sem posição no fim, empate pela sigla. */
export function ordenarPorPosicao(linhas, colunaPosicao) {
  return [...linhas].sort((a, b) => (a[colunaPosicao] ?? Infinity) - (b[colunaPosicao] ?? Infinity)
    || String(a.uf).localeCompare(String(b.uf)))
}

// --- estatais (só informativo: nunca altera valores) ---------------------------------

/**
 * Edição do dicionário de estatais para um ano da tela: a mais recente que não passa do ano;
 * ano anterior a todas usa a mais antiga. Espelha analytics.edicao_para_ano do Python.
 */
export function edicaoParaAno(edicoes, ano) {
  const ordenadas = [...edicoes].map(Number).sort((a, b) => a - b)
  if (ordenadas.length === 0) throw new Error('nenhuma edição')
  const anteriores = ordenadas.filter((e) => e <= ano)
  return anteriores.length ? anteriores[anteriores.length - 1] : ordenadas[0]
}

function estataisDoAno(estatais, ano) {
  if (!estatais?.edicoes?.length) return {}
  return estatais.por_edicao?.[String(edicaoParaAno(estatais.edicoes, ano))] ?? {}
}

/**
 * Estatais ativas e não dependentes da UF na função, na edição que vale para o ano (estatais.json), ou [].
 * A operação delas não aparece na despesa do estado; servem só para avisar.
 */
export function estataisNaArea(estatais, uf, funcao, ano) {
  return estataisDoAno(estatais, ano)[uf]?.[funcao] ?? []
}

/** UFs que têm ao menos uma estatal não dependente na função, na edição que vale para o ano. */
export function ufsComEstatalNaArea(estatais, funcao, ano) {
  return new Set(Object.entries(estataisDoAno(estatais, ano))
    .filter(([, funcoes]) => (funcoes[funcao] ?? []).length > 0)
    .map(([uf]) => uf))
}

/**
 * Mudanças de dependência da UF na função entre edições (estatais.json → mudancas_dependencia),
 * só as de anos em `anos` (os do gráfico), em ordem de ano. Viram aviso de quebra de série.
 */
export function mudancasDeDependencia(estatais, uf, funcao, anos) {
  return (estatais?.mudancas_dependencia?.[uf]?.[funcao] ?? [])
    .filter((m) => anos.includes(m.ano))
    .sort((a, b) => a.ano - b.ano)
}

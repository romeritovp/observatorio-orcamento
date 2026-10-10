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

/**
 * Passos da conta "gasto por habitante, corrigido pela inflação" de uma UF numa função e num ano, para a
 * seção "Refaça a conta" da página "Como fazemos". Usa as mesmas funções da tela (indiceEncadeado,
 * fatorDeflacao); o teste confere que o resultado é o de indicadoresDaFuncao e o do gabarito.json.
 * Devolve: valor (R$ da época, do estágio), ipca ([{ano, variacao_pct}] dos anos depois de `ano` até
 * `anoBase`), fator, real (valor × fator), populacao e porHabitante (real ÷ população).
 */
export function passosPorHabitante(despesa, serieIpca, { uf, funcao, ano, anoBase, estagio = 'liquidado', fonte = 'siconfi_dca' }) {
  const [linha] = filtrar(despesa, { fonte_dado: fonte, nivel: 'funcao', intra: false, uf, ano, funcao_cod: funcao })
  if (!linha || ehNulo(linha[estagio])) throw new Error(`sem ${estagio} para ${uf} ${ano} na função ${funcao}`)
  const fator = fatorDeflacao(indiceEncadeado(serieIpca), ano, anoBase)
  const real = linha[estagio] * fator
  return {
    uf, funcao, ano, anoBase, estagio,
    valor: linha[estagio],
    ipca: serieIpca.filter((p) => p.ano > ano && p.ano <= anoBase).sort((a, b) => a.ano - b.ano)
      .map((p) => ({ ano: p.ano, variacao_pct: p.variacao_pct })),
    fator,
    real,
    populacao: linha.populacao,
    porHabitante: real / linha.populacao,
  }
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
 * ano anterior a todas: null (sem informação de estatais). Espelha analytics.edicao_para_ano do Python.
 */
export function edicaoParaAno(edicoes, ano) {
  const ordenadas = [...edicoes].map(Number).sort((a, b) => a - b)
  if (ordenadas.length === 0) throw new Error('nenhuma edição')
  const anteriores = ordenadas.filter((e) => e <= ano)
  return anteriores.length ? anteriores[anteriores.length - 1] : null
}

/**
 * Edição que informa as estatais da UF no ano, ou null: ano antes da primeira edição, ou UF ausente
 * da edição (estatais.json → ufs_por_edicao; ex.: AP nos exercícios 2019 e 2020).
 */
export function edicaoDaUf(estatais, uf, ano) {
  if (!estatais?.edicoes?.length) return null
  const edicao = edicaoParaAno(estatais.edicoes, ano)
  if (edicao === null) return null
  const cobertas = estatais.ufs_por_edicao?.[String(edicao)]
  return !cobertas || cobertas.includes(uf) ? edicao : null
}

function estataisDoAno(estatais, ano) {
  if (!estatais?.edicoes?.length) return {}
  const edicao = edicaoParaAno(estatais.edicoes, ano)
  return edicao === null ? {} : estatais.por_edicao?.[String(edicao)] ?? {}
}

/**
 * Estatais ativas e não dependentes da UF na função, na edição que vale para o ano (estatais.json), ou [].
 * A operação delas não aparece na despesa do estado; servem só para avisar.
 */
export function estataisNaArea(estatais, uf, funcao, ano) {
  if (edicaoDaUf(estatais, uf, ano) === null) return []
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

// --- tela "Por estado" ------------------------------------------------------------------

/**
 * Despesa total de cada UF e ano (soma das linhas de função, sem intra), corrigida, por habitante
 * e variação sobre o ano anterior (nula no primeiro ano ou sem o ano anterior).
 * Espelha publicacao.exportar.totais_por_uf; o teste compara com gabarito.json → totais.
 */
export function totaisPorUfAno(despesa, serieIpca, { estagio = 'liquidado', anoBase, fonte = 'siconfi_dca' }) {
  const funcoes = filtrar(despesa, { fonte_dado: fonte, nivel: 'funcao', intra: false })
  const indice = indiceEncadeado(serieIpca)
  const linhas = [...agrupar(funcoes, ['uf', 'ano']).values()].map((membros) => {
    const validos = membros.filter((l) => !ehNulo(l[estagio]))
    const nominal = validos.length ? validos.reduce((soma, l) => soma + l[estagio], 0) : null
    const { uf, ano, populacao } = membros[0]
    const real = nominal === null ? null : nominal * fatorDeflacao(indice, ano, anoBase)
    if (ehNulo(populacao) || populacao <= 0) throw new Error(`sem população para ${uf} ${ano}`)
    return {
      uf, ano, populacao, total_nominal: nominal, total_real: real,
      per_capita_nominal: nominal === null ? null : nominal / populacao,
      per_capita_real: real === null ? null : real / populacao,
    }
  })
  const porChave = new Map(linhas.map((l) => [chaveDe(l, ['uf', 'ano']), l]))
  const variacaoPct = (atual, anterior) => (ehNulo(atual) || ehNulo(anterior) || anterior === 0
    ? null : (atual / anterior - 1) * 100)
  return linhas.map((l) => {
    const anterior = porChave.get(chaveDe({ uf: l.uf, ano: l.ano - 1 }, ['uf', 'ano']))
    return {
      ...l,
      var_nominal_pct: anterior ? variacaoPct(l.total_nominal, anterior.total_nominal) : null,
      var_real_pct: anterior ? variacaoPct(l.total_real, anterior.total_real) : null,
    }
  }).sort((a, b) => String(a.uf).localeCompare(String(b.uf)) || a.ano - b.ano)
}

/** indicadoresDaFuncao para todas as funções presentes nos dados: Map funcao_cod → linhas. */
export function indicadoresDeTodasAsFuncoes(despesa, serieIpca, opcoes) {
  const fonte = opcoes.fonte ?? 'siconfi_dca'
  const funcoes = [...new Set(filtrar(despesa, { fonte_dado: fonte, nivel: 'funcao' }).map((l) => l.funcao_cod))].sort()
  return new Map(funcoes.map((funcao) => [funcao, indicadoresDaFuncao(despesa, serieIpca, { ...opcoes, funcao })]))
}

/**
 * Composição do orçamento da UF no ano: uma linha por função, em ordem de % do orçamento
 * (maior primeiro; as sem gasto declarado no fim, pelo código). porFuncao: indicadoresDeTodasAsFuncoes.
 */
export function composicaoDoAno(porFuncao, uf, ano) {
  const linhas = []
  for (const [funcao, ind] of porFuncao) {
    const linha = ind.find((l) => l.uf === uf && l.ano === ano)
    if (linha) linhas.push({ ...linha, funcao_cod: funcao })
  }
  return linhas.sort((a, b) => (b.pct_despesa_total ?? -Infinity) - (a.pct_despesa_total ?? -Infinity)
    || a.funcao_cod.localeCompare(b.funcao_cod))
}

/** Série de uma UF numa função, em ordem de ano: [{ano, ...linha}]. */
export function serieDaUf(linhas, uf) {
  return linhas.filter((l) => l.uf === uf).sort((a, b) => a.ano - b.ano)
}

/**
 * Tabela áreas × anos de uma UF: [{funcao_cod, valores: [valor de cada ano em `anos`]}], na ordem
 * de `ordemFuncoes`. coluna: campo dos indicadores (per_capita_real, pct_despesa_total, real, ...).
 */
export function tabelaAreasPorAno(porFuncao, uf, anos, coluna, ordemFuncoes) {
  return ordemFuncoes.filter((f) => porFuncao.has(f)).map((funcao) => {
    const daUf = new Map(porFuncao.get(funcao).filter((l) => l.uf === uf).map((l) => [l.ano, l]))
    return { funcao_cod: funcao, valores: anos.map((ano) => daUf.get(ano)?.[coluna] ?? null) }
  })
}

/**
 * Estatais da UF na edição que vale para o ano (estatais.json → lista_por_edicao), separadas em
 * não dependentes e dependentes, cada grupo pela sigla. Só cadastro: nenhum valor financeiro.
 */
export function estataisDoEstado(estatais, uf, ano) {
  const vazio = { edicao: null, painel: null, naoDependentes: [], dependentes: [] }
  if (!estatais?.edicoes?.length) return vazio
  const edicao = edicaoDaUf(estatais, uf, ano)
  if (edicao === null) return vazio // ano antes da primeira edição, ou UF fora da edição: sem informação
  const todas = [...(estatais.lista_por_edicao?.[String(edicao)]?.[uf] ?? [])]
    .sort((a, b) => String(a.sigla_exibicao ?? a.sigla).localeCompare(String(b.sigla_exibicao ?? b.sigla), 'pt-BR'))
  return {
    edicao,
    painel: estatais.paineis?.[String(edicao)] ?? null,
    naoDependentes: todas.filter((e) => !e.dependente),
    dependentes: todas.filter((e) => e.dependente),
  }
}

// --- subáreas (subfunções) ---------------------------------------------------------------

/** Níveis de subárea: subfunção, demais declarado e demais calculado (função − Σ subfunções, onde a DCA não traz "demais"). */
export const NIVEIS_SUBAREA = ['subfuncao', 'demais', 'demais_calculado']
const ehDemais = (nivel) => nivel === 'demais' || nivel === 'demais_calculado'

/**
 * Subáreas de todas as funções de uma UF, em todos os anos: linhas `subfuncao`, `demais`
 * (subfunções não listadas) e `demais_calculado`, com as mesmas medidas da área: nominal, real, por habitante (real e
 * da época) e % do orçamento, sempre sobre o orçamento TOTAL da UF no ano (não sobre a área).
 * Subfunções + demais de uma função = a função. Linha sem valor no estágio fica de fora, como na área.
 */
export function subareasDaUf(despesa, serieIpca, { uf, estagio = 'liquidado', anoBase, fonte = 'siconfi_dca' }) {
  const daUf = filtrar(despesa, { fonte_dado: fonte, uf, intra: false })
  const totais = new Map(totaisPorUfAno(daUf, serieIpca, { estagio, anoBase, fonte }).map((t) => [t.ano, t]))
  const indice = indiceEncadeado(serieIpca)
  return daUf
    .filter((l) => NIVEIS_SUBAREA.includes(l.nivel) && !ehNulo(l[estagio]))
    .map((l) => {
      const nominal = l[estagio]
      const real = nominal * fatorDeflacao(indice, l.ano, anoBase)
      const total = totais.get(l.ano)?.total_nominal
      return {
        uf, ano: l.ano, funcao_cod: l.funcao_cod, subfuncao_cod: l.subfuncao_cod ?? null, nivel: l.nivel,
        nominal, real,
        per_capita_nominal: nominal / l.populacao,
        per_capita_real: real / l.populacao,
        pct_despesa_total: ehNulo(total) || total === 0 ? null : (nominal / total) * 100,
      }
    })
}

/**
 * Linhas de subárea de uma função para a tabela: [{subfuncao_cod, nivel, valores: [por ano em `anos`]}].
 * Ordem: maior valor em `anoOrdem` primeiro; "demais" sempre no fim.
 */
export function tabelaSubareasPorAno(subareas, funcao, anos, coluna, anoOrdem) {
  const grupos = agrupar(subareas.filter((l) => l.funcao_cod === funcao), ['nivel', 'subfuncao_cod'])
  const linhas = [...grupos.values()].map((membros) => {
    const porAno = new Map(membros.map((l) => [l.ano, l[coluna]]))
    return { subfuncao_cod: membros[0].subfuncao_cod, nivel: membros[0].nivel, valores: anos.map((a) => porAno.get(a) ?? null) }
  })
  const iOrdem = anos.indexOf(anoOrdem)
  return linhas.sort((a, b) => ehDemais(a.nivel) - ehDemais(b.nivel)
    || (b.valores[iOrdem] ?? -Infinity) - (a.valores[iOrdem] ?? -Infinity)
    || String(a.subfuncao_cod).localeCompare(String(b.subfuncao_cod)))
}

// --- dívida -------------------------------------------------------------------------------

/** Tipos da composição da dívida, na ordem do relatório (divida.json → composicao). */
export const TIPOS_DIVIDA = ['reestruturacao', 'internos', 'externos', 'parcelamentos', 'precatorios', 'outras']

/**
 * Indicadores da dívida por UF e ano, a partir de divida.json → linhas (R$ nominais):
 * pago = juros + amortização; `<campo>_real` a preços de dez/anoBase (estoques são de 31/dez, como o IPCA
 * dez/dez); posicao_dcl_rcl (1 = maior DCL/RCL) e n_ufs. DCL/RCL é a linha oficial do RGF, sem recálculo.
 * Espelha publicacao.exportar.divida_gabarito; o teste compara com gabarito.json → divida.
 */
export function indicadoresDivida(linhas, serieIpca, { anoBase }) {
  const indice = indiceEncadeado(serieIpca)
  const comValores = linhas.map((l) => {
    const fator = fatorDeflacao(indice, l.ano, anoBase)
    const real = (v) => (ehNulo(v) ? null : v * fator)
    const pago = ehNulo(l.juros) || ehNulo(l.amortizacao) ? null : l.juros + l.amortizacao
    return {
      ...l, fator_ipca: fator, pago,
      juros_real: real(l.juros), amortizacao_real: real(l.amortizacao), pago_real: real(pago),
      dc_real: real(l.dc), dcl_real: real(l.dcl), deducoes_real: real(l.deducoes), rcl_real: real(l.rcl),
      limite_real: real(l.limite), alerta_real: real(l.alerta),
      composicao_real: l.composicao ? Object.fromEntries(TIPOS_DIVIDA.map((t) => [t, real(l.composicao[t])])) : null,
    }
  })
  return ranking(comValores, 'dcl_rcl_pct', ['ano']).map(({ dcl_rcl_pct_posicao: posicao, dcl_rcl_pct_n_ufs: n, ...l }) => ({
    ...l, posicao_dcl_rcl: posicao, n_ufs: n,
  }))
}

/**
 * Composição da dívida de uma linha por tipo, do maior para o menor: [{tipo, valor, pct_dc}].
 * campo: 'composicao' (R$ da época) ou 'composicao_real'. pct_dc = participação na dívida consolidada.
 * Composição nula (layout do RGF de 2015–2016, não comparável) → [].
 */
export function composicaoDivida(linha, campo = 'composicao') {
  if (!linha || !linha[campo]) return []
  const total = TIPOS_DIVIDA.reduce((soma, t) => soma + (linha[campo]?.[t] ?? 0), 0)
  return TIPOS_DIVIDA.map((tipo) => ({ tipo, valor: linha[campo]?.[tipo] ?? 0 }))
    .map((c) => ({ ...c, pct_dc: total ? (c.valor / total) * 100 : null }))
    .sort((a, b) => b.valor - a.valor)
}

/**
 * Pago em dívida (juros + amortização) contra o liquidado em saúde (10) e educação (12), na UF e ano:
 * [{id, valor, per_capita}] em R$ corrigidos (`corrigidos`) ou da época. Habitantes: os da despesa.
 * divida: linha de indicadoresDivida; porFuncao: indicadoresDeTodasAsFuncoes.
 */
export function dividaContraAreas(divida, porFuncao, uf, ano, corrigidos = true) {
  const area = (funcao) => porFuncao.get(funcao)?.find((l) => l.uf === uf && l.ano === ano)
  const saude = area('10')
  const educacao = area('12')
  const populacao = saude?.populacao ?? educacao?.populacao ?? null
  const porHab = (v) => (ehNulo(v) || !populacao ? null : v / populacao)
  const pago = divida ? divida[corrigidos ? 'pago_real' : 'pago'] : null
  const daArea = (l) => (l ? l[corrigidos ? 'real' : 'nominal'] : null)
  return [
    { id: 'divida', valor: pago, per_capita: porHab(pago) },
    { id: 'saude', valor: daArea(saude), per_capita: porHab(daArea(saude)) },
    { id: 'educacao', valor: daArea(educacao), per_capita: porHab(daArea(educacao)) },
  ]
}

// --- receita ---------------------------------------------------------------------------------

/** População por UF e ano ("uf|ano" → habitantes), a partir das linhas da despesa. */
export function populacoes(despesa) {
  const mapa = new Map()
  for (const l of despesa) if (!ehNulo(l.populacao)) mapa.set(`${l.uf}|${l.ano}`, l.populacao)
  return mapa
}

/**
 * Indicadores da receita por UF e ano, a partir de receita.json → totais (R$ nominais, líquidos das deduções):
 * receita_liquida (sem intra), receita_liquida_real, per capita (real e da época), % de impostos próprios
 * e de transferências da União, posições (1 = maior) no per capita real e no % de impostos próprios.
 * Espelha publicacao.exportar.receita_gabarito; o teste compara com gabarito.json → receita.
 */
export function indicadoresReceita(totais, serieIpca, { anoBase, populacao }) {
  const indice = indiceEncadeado(serieIpca)
  const linhas = totais.map((t) => {
    const fator = fatorDeflacao(indice, t.ano, anoBase)
    const pop = populacao.get(`${t.uf}|${t.ano}`)
    if (ehNulo(pop) || pop <= 0) throw new Error(`sem população para ${t.uf} ${t.ano}`)
    const real = t.liquida_exceto_intra * fator
    return {
      uf: t.uf, ano: t.ano, populacao: pop, fator_ipca: fator,
      receita_liquida: t.liquida_exceto_intra, receita_liquida_real: real,
      per_capita_nominal: t.liquida_exceto_intra / pop, per_capita_real: real / pop,
      impostos_proprios: t.impostos_proprios, transferencias_uniao: t.transferencias_uniao,
      pct_impostos_proprios: t.liquida_exceto_intra ? (t.impostos_proprios / t.liquida_exceto_intra) * 100 : null,
      pct_transferencias_uniao: t.liquida_exceto_intra ? (t.transferencias_uniao / t.liquida_exceto_intra) * 100 : null,
    }
  })
  return ranking(ranking(linhas, 'per_capita_real', ['ano']), 'pct_impostos_proprios', ['ano']).map((l) => {
    const { per_capita_real_posicao: pPc, per_capita_real_n_ufs: n, pct_impostos_proprios_posicao: pImp,
      pct_impostos_proprios_n_ufs: _nImp, ...resto } = l
    return { ...resto, posicao_per_capita_real: pPc, posicao_pct_impostos: pImp, n_ufs: n }
  })
}

/**
 * Composição da receita líquida de uma UF no ano, por item, sem as intraorçamentárias, do maior para o menor:
 * [{item, valor, pct}] (pct = % da receita líquida). fator: 1 para R$ da época, ou o fator do IPCA.
 */
export function composicaoReceita(linhas, uf, ano, fator = 1) {
  const doAno = linhas.filter((l) => l.uf === uf && l.ano === ano && l.item !== 'intraorcamentarias')
  const total = doAno.reduce((s, l) => s + l.liquida, 0)
  return doAno.map((l) => ({ item: l.item, valor: l.liquida * fator, pct: total ? (l.liquida / total) * 100 : null }))
    .sort((a, b) => b.valor - a.valor)
}

/**
 * Para onde vai um imposto (ex.: 'icms', 'ipva') na UF e ano: arrecadado (bruta), municípios
 * (dedução de transferências constitucionais), FUNDEB, outras deduções e o que fica com o estado (líquida).
 * Valores × fator. null se o item não existe.
 */
export function destinoDoImposto(linhas, uf, ano, item, fator = 1) {
  const l = linhas.find((x) => x.uf === uf && x.ano === ano && x.item === item)
  if (!l) return null
  const v = (campo) => (l[campo] ?? 0) * fator
  return { arrecadado: v('bruta'), municipios: v('ded_transferencias'), fundeb: v('ded_fundeb'), outras: v('ded_outras'), estado: v('liquida') }
}

/**
 * Tabela itens × anos de uma UF (receita líquida): [{item, valores: [por ano]}], na ordem de `ordemItens`.
 * metrica: 'liquida' (R$), 'per_capita' (R$ por habitante) ou 'pct' (% da receita líquida sem intra).
 * corrigidos: valores em R$ de dez/anoBase. Itens sem linha no ano ficam 0 (o item não teve receita).
 */
export function tabelaReceita(linhas, uf, anos, ordemItens, { metrica, corrigidos, serieIpca, anoBase, populacao }) {
  const indice = indiceEncadeado(serieIpca)
  const daUf = linhas.filter((l) => l.uf === uf)
  const totalAno = new Map(anos.map((a) => [a, daUf.filter((l) => l.ano === a && l.item !== 'intraorcamentarias')
    .reduce((s, l) => s + l.liquida, 0)]))
  return ordemItens.map((item) => ({
    item,
    valores: anos.map((ano) => {
      if (!daUf.some((l) => l.ano === ano)) return null
      const v = daUf.find((l) => l.ano === ano && l.item === item)?.liquida ?? 0
      if (metrica === 'pct') return item === 'intraorcamentarias' || !totalAno.get(ano) ? null : (v / totalAno.get(ano)) * 100
      const valor = corrigidos ? v * fatorDeflacao(indice, ano, anoBase) : v
      return metrica === 'per_capita' ? valor / populacao.get(`${uf}|${ano}`) : valor
    }),
  }))
}

/** Ressalvas de uma UF que valem no ano (as com `anos` só nesses exercícios; as sem `anos`, sempre). */
export function ressalvasDoAno(ressalvas, ano) {
  return (ressalvas ?? []).filter((r) => !r.anos || r.anos.includes(ano))
}

// --- petróleo e gás: DCA × ANP (só exibição; nenhum total da DCA muda) -----------------------------

/**
 * A prestação de contas da UF deixa de separar o petróleo no ano? receita.json → petroleo:
 * UF em ufs_nao_separa_na_dca e ano ≥ nao_separa_desde[uf] (sem "desde": todos os anos).
 */
export function naoSeparaPetroleo(petroleo, uf, ano) {
  if (!(petroleo?.ufs_nao_separa_na_dca ?? []).includes(uf)) return false
  const desde = petroleo.nao_separa_desde?.[uf]
  return desde == null || ano >= desde
}

/** Faixa em que a ANP "explica" a linha "Demais receitas patrimoniais" (docs/decisoes.md). */
export const FAIXA_RECONCILIACAO = [0.95, 1.0]

/** Linhas do bloco petróleo (receita.json → petroleo.linhas) de uma UF, por ano: Map ano → linha. */
export function petroleoDaUf(linhas, uf) {
  return new Map((linhas ?? []).filter((l) => l.uf === uf).map((l) => [l.ano, l]))
}

/**
 * Para estado que não separa o petróleo na DCA: a ANP explica "Demais receitas patrimoniais" no ano?
 * {situacao: 'explica' | 'nao_reconcilia' | 'parcial' | 'sem_dado', razao}. razao = ANP / linha.
 * 'explica': ANP de 95% a 100% da linha (a ANP não pode passar da linha que a contém).
 */
export function reconciliacaoPetroleo(linha) {
  if (!linha) return { situacao: 'sem_dado', razao: null }
  if (linha.anp_parcial || ehNulo(linha.anp_total)) return { situacao: 'parcial', razao: null }
  if (!(linha.anp_total > 0) || !(linha.demais_patrimoniais > 0)) return { situacao: 'sem_dado', razao: null }
  const razao = linha.anp_total / linha.demais_patrimoniais
  const [minimo, maximo] = FAIXA_RECONCILIACAO
  return { situacao: razao >= minimo && razao <= maximo ? 'explica' : 'nao_reconcilia', razao }
}

/**
 * Série de um campo do bloco petróleo (Map ano → linha) nos `anos`, × fator do ano (1 para R$ da época).
 * fatorDoAno(ano) → número, ou null se não houver fator (o valor fica nulo). Campo nulo continua nulo.
 */
export function seriePetroleo(porAno, anos, campo, fatorDoAno = () => 1) {
  return anos.map((ano) => {
    const valor = porAno.get(ano)?.[campo]
    const fator = fatorDoAno(ano)
    return ehNulo(valor) || ehNulo(fator) ? null : valor * fator
  })
}

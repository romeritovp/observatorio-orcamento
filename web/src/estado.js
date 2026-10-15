// Estado da tela ↔ URL (parâmetros de busca). Funções puras: recebem a string de busca e
// o que existe nos dados, devolvem o estado validado (ou a string de busca).

export const METRICAS = {
  per_capita: 'Por habitante',
  pct_total: '% do orçamento',
}

/** Valores corrigidos pela inflação (padrão) ou da época. Não se aplica ao % do orçamento. */
export const VALORES = ['corrigidos', 'epoca']

/** Telas do site, na ordem do menu. */
export const VIEWS = {
  estado: 'Por estado', comparar: 'Comparar', pib: 'PIB dos Estados', inovacao: 'Pesquisa e Inovação', educacao: 'Educação',
  metodo: 'Como fazemos',
}

/** Tela aberta quando a URL não diz qual (a "página inicial"). É o único lugar que define isso. */
export const VIEW_PADRAO = 'estado'

/** Nível da explicação na página "Como fazemos" (?nivel=tecnico, ?nivel=formulas); o padrão é o primeiro. */
export const NIVEIS_METODO = { simples: 'Explicação simples', tecnico: 'Explicação técnica', formulas: 'Fórmulas' }

/** Métrica da tabela de receitas (itens × anos) na tela "Por estado". */
export const TABELAS_RECEITA = { liquida: 'Valor', per_capita: 'Por habitante', pct: '% da receita' }

/** Métrica da tabela de áreas × anos na tela "Por estado". */
export const TABELAS = { per_capita: 'Por habitante', pct_total: '% do orçamento', total: 'Valor total' }

/** Métrica da tabela atividades × anos na tela "PIB dos Estados". */
export const TABELAS_PIB = { pct: '% do valor adicionado', valor: 'Valor (R$ da época)' }

/** Atividade com os cards de tendência abertos quando a URL não diz qual (Indústrias de transformação). */
export const ATIVIDADE_PIB_PADRAO = '04'

/** Janela da linha de tendência no gráfico (ids das janelas de estatistica/configuracao.json). */
export const JANELA_PADRAO = 'tudo'

/** Medida da evolução no tempo na tela "Pesquisa e Inovação". 'escore' só vale se meta.json → ibid permitir. */
export const EVOLUCOES_IBID = { posicao: 'Posição no ranking', escore: 'Escore' }

/** Estados da mesma região da UF, sem ela. */
export function paresPadrao(ufs, uf) {
  const regiao = ufs.find((u) => u.uf === uf)?.regiao
  if (!regiao) return []
  return ufs.filter((u) => u.regiao === regiao && u.uf !== uf).map((u) => u.uf)
}

/**
 * Lê o estado da tela da string de busca, validando contra os dados.
 * contexto: { ufs: [{uf, regiao}], anos: [..], areas: [códigos], areaPadrao, ufPadrao }
 * ufPadrao: UF aberta quando a URL não traz `uf` (vem do meta.json, não do código); sem ele, nenhuma.
 * Sem `pares` na URL, os pares são os estados da mesma região do destaque.
 * `areaExplicita`: a área veio da URL (o leitor escolheu). Sem ela, "Comparar" usa `areaPadrao`
 * e "Por estado" usa a maior área do estado no ano.
 * `abertas`: áreas com as subáreas abertas na tabela da tela "Por estado" (?abrir=28,12).
 * Tela "PIB dos Estados" (anos próprios, `anosPib` do meta.json): `anoPib` (?pano=, padrão o último),
 * `desdePib` (?desde=, início do crescimento; padrão o primeiro ano do orçamento, se houver PIB nele
 * e não for o último, senão o primeiro do PIB), `tabelaPib` (?tpib=), `atividadePib` (?ativ=, código de
 * dois dígitos; a tela confere se existe) e `janelaPib` (?jan=, janela da tendência no gráfico).
 * Tela "Pesquisa e Inovação" (anos do IBID, `anosIbid` do meta.json): `anoIbid` (?iano=, padrão o último) e
 * `evolucaoIbid` (?ievo=posicao|escore; a tela só aceita 'escore' se os escores forem comparáveis entre anos).
 * Tela "Educação" (IDEB; `ideb` do meta.json: anos, etapas, redes e padrões): `anoIdeb` (?eano=, padrão o último),
 * `etapaIdeb` (?etapa=), `redeIdeb` (?erede=) e `janelaIdeb` (?ejan=, janela da tendência no gráfico).
 */
export function lerEstado(busca, {
  ufs, anos, areas, areaPadrao, ufPadrao = null, anosPib = [], janelas = [], anosIbid = [], ideb = null, janelasIdeb = [],
}) {
  const p = new URLSearchParams(busca)
  const siglas = new Set(ufs.map((u) => u.uf))

  const view = p.get('view') in VIEWS ? p.get('view') : VIEW_PADRAO
  const areaExplicita = areas.includes(p.get('area'))
  const area = areaExplicita ? p.get('area') : areaPadrao
  const tabela = p.get('tabela') in TABELAS ? p.get('tabela') : 'per_capita'
  const tabelaReceita = p.get('treceita') in TABELAS_RECEITA ? p.get('treceita') : 'liquida'
  const metrica = p.get('metrica') in METRICAS ? p.get('metrica') : 'per_capita'
  const valores = VALORES.includes(p.get('valores')) ? p.get('valores') : 'corrigidos'
  const anoUrl = Number(p.get('ano'))
  const ano = anos.includes(anoUrl) ? anoUrl : Math.max(...anos)
  const ufUrl = p.get('uf')?.toUpperCase()
  // `uf=` vazio na URL = o leitor escolheu nenhum estado; sem o parâmetro, vale a UF padrão
  const uf = siglas.has(ufUrl) ? ufUrl : (ufUrl === '' || !siglas.has(ufPadrao) ? null : ufPadrao)

  const paresUrl = p.get('pares')
  const personalizados = paresUrl !== null
  const pares = personalizados
    ? [...new Set(paresUrl.split(',').map((s) => s.trim().toUpperCase()))].filter((s) => siglas.has(s) && s !== uf)
    : paresPadrao(ufs, uf)

  const nivel = p.get('nivel') in NIVEIS_METODO ? p.get('nivel') : 'simples'

  const abertas = [...new Set((p.get('abrir') ?? '').split(',').map((c) => c.trim()))].filter((c) => areas.includes(c))

  const anoPibUrl = Number(p.get('pano'))
  const anoPib = anosPib.includes(anoPibUrl) ? anoPibUrl : (anosPib.length ? Math.max(...anosPib) : null)
  // "desde" vale qualquer ano do PIB menos o último (não haveria crescimento a medir)
  const desdeValido = (a) => anosPib.includes(a) && a < Math.max(...anosPib)
  const desdeUrl = Number(p.get('desde'))
  const desdePadrao = desdeValido(Math.min(...anos)) ? Math.min(...anos) : (anosPib.length ? Math.min(...anosPib) : null)
  const desdePib = desdeValido(desdeUrl) ? desdeUrl : desdePadrao
  const tabelaPib = p.get('tpib') in TABELAS_PIB ? p.get('tpib') : 'pct'
  const atividadePib = /^\d{2}$/.test(p.get('ativ') ?? '') && p.get('ativ') !== '01' ? p.get('ativ') : ATIVIDADE_PIB_PADRAO
  const janelaPib = janelas.includes(p.get('jan')) ? p.get('jan') : JANELA_PADRAO

  const anoIbidUrl = Number(p.get('iano'))
  const anoIbid = anosIbid.includes(anoIbidUrl) ? anoIbidUrl : (anosIbid.length ? Math.max(...anosIbid) : null)
  const evolucaoIbid = p.get('ievo') in EVOLUCOES_IBID ? p.get('ievo') : 'posicao'

  const anosIdeb = ideb?.anos ?? []
  const anoIdebUrl = Number(p.get('eano'))
  const anoIdeb = anosIdeb.includes(anoIdebUrl) ? anoIdebUrl : (anosIdeb.length ? Math.max(...anosIdeb) : null)
  const etapaIdeb = (ideb?.etapas ?? []).includes(p.get('etapa')) ? p.get('etapa') : (ideb?.etapa_padrao ?? null)
  const redeIdeb = (ideb?.redes ?? []).includes(p.get('erede')) ? p.get('erede') : (ideb?.rede_padrao ?? null)
  const janelaIdeb = janelasIdeb.includes(p.get('ejan')) ? p.get('ejan') : JANELA_PADRAO
  const padroesIdeb = { etapa: ideb?.etapa_padrao ?? null, rede: ideb?.rede_padrao ?? null }

  return {
    view, area, areaExplicita, metrica, valores, ano, uf, pares, paresPersonalizados: personalizados, tabela, abertas, tabelaReceita, nivel,
    anoPib, desdePib, desdePadrao, tabelaPib, atividadePib, janelaPib, anoIbid, evolucaoIbid,
    anoIdeb, etapaIdeb, redeIdeb, janelaIdeb, padroesIdeb,
  }
}

/** Estado → string de busca (só grava o que difere do padrão: view, área escolhida, pares, tabela). */
export function escreverEstado(estado) {
  const p = new URLSearchParams()
  if (estado.view && estado.view !== VIEW_PADRAO) p.set('view', estado.view)
  if (estado.areaExplicita) p.set('area', estado.area)
  p.set('metrica', estado.metrica)
  if (estado.valores !== 'corrigidos') p.set('valores', estado.valores)
  p.set('ano', String(estado.ano))
  p.set('uf', estado.uf ?? '')
  if (estado.paresPersonalizados) p.set('pares', estado.pares.join(','))
  if (estado.tabela && estado.tabela !== 'per_capita') p.set('tabela', estado.tabela)
  if (estado.abertas?.length) p.set('abrir', estado.abertas.join(','))
  if (estado.tabelaReceita && estado.tabelaReceita !== 'liquida') p.set('treceita', estado.tabelaReceita)
  if (estado.nivel && estado.nivel !== 'simples') p.set('nivel', estado.nivel)
  // PIB dos Estados: só na própria tela (os anos não são os do orçamento)
  if (estado.view === 'pib') {
    if (estado.anoPib !== null && estado.anoPib !== undefined) p.set('pano', String(estado.anoPib))
    if (estado.desdePib !== estado.desdePadrao) p.set('desde', String(estado.desdePib))
    if (estado.tabelaPib && estado.tabelaPib !== 'pct') p.set('tpib', estado.tabelaPib)
    if (estado.atividadePib && estado.atividadePib !== ATIVIDADE_PIB_PADRAO) p.set('ativ', estado.atividadePib)
    if (estado.janelaPib && estado.janelaPib !== JANELA_PADRAO) p.set('jan', estado.janelaPib)
  }
  // Educação: só na própria tela (anos do IDEB); etapa, rede e janela só quando diferem do padrão
  if (estado.view === 'educacao') {
    if (estado.anoIdeb !== null && estado.anoIdeb !== undefined) p.set('eano', String(estado.anoIdeb))
    if (estado.etapaIdeb && estado.etapaIdeb !== estado.padroesIdeb?.etapa) p.set('etapa', estado.etapaIdeb)
    if (estado.redeIdeb && estado.redeIdeb !== estado.padroesIdeb?.rede) p.set('erede', estado.redeIdeb)
    if (estado.janelaIdeb && estado.janelaIdeb !== JANELA_PADRAO) p.set('ejan', estado.janelaIdeb)
  }
  // Pesquisa e Inovação: só na própria tela (os anos são os do IBID)
  if (estado.view === 'inovacao') {
    if (estado.anoIbid !== null && estado.anoIbid !== undefined) p.set('iano', String(estado.anoIbid))
    if (estado.evolucaoIbid && estado.evolucaoIbid !== 'posicao') p.set('ievo', estado.evolucaoIbid)
  }
  return `?${p.toString().replaceAll('%2C', ',')}`
}

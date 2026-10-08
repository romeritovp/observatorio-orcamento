// Estado da tela ↔ URL (parâmetros de busca). Funções puras: recebem a string de busca e
// o que existe nos dados, devolvem o estado validado (ou a string de busca).

export const METRICAS = {
  per_capita: 'Por habitante',
  pct_total: '% do orçamento',
}

/** Valores corrigidos pela inflação (padrão) ou da época. Não se aplica ao % do orçamento. */
export const VALORES = ['corrigidos', 'epoca']

/** Telas do site, na ordem do menu. */
export const VIEWS = { estado: 'Por estado', comparar: 'Comparar' }

/** Tela aberta quando a URL não diz qual (a "página inicial"). É o único lugar que define isso. */
export const VIEW_PADRAO = 'estado'

/** Métrica da tabela de receitas (itens × anos) na tela "Por estado". */
export const TABELAS_RECEITA = { liquida: 'Valor', per_capita: 'Por habitante', pct: '% da receita' }

/** Métrica da tabela de áreas × anos na tela "Por estado". */
export const TABELAS = { per_capita: 'Por habitante', pct_total: '% do orçamento', total: 'Valor total' }

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
 */
export function lerEstado(busca, { ufs, anos, areas, areaPadrao, ufPadrao = null }) {
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

  const abertas = [...new Set((p.get('abrir') ?? '').split(',').map((c) => c.trim()))].filter((c) => areas.includes(c))

  return { view, area, areaExplicita, metrica, valores, ano, uf, pares, paresPersonalizados: personalizados, tabela, abertas, tabelaReceita }
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
  return `?${p.toString().replaceAll('%2C', ',')}`
}

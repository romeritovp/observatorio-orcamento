// Estado da tela ↔ URL (parâmetros de busca). Funções puras: recebem a string de busca e
// o que existe nos dados, devolvem o estado validado (ou a string de busca).

export const METRICAS = {
  per_capita: 'Por habitante',
  pct_total: '% do orçamento',
}

/** Valores corrigidos pela inflação (padrão) ou da época. Não se aplica ao % do orçamento. */
export const VALORES = ['corrigidos', 'epoca']

/** Estados da mesma região da UF, sem ela. */
export function paresPadrao(ufs, uf) {
  const regiao = ufs.find((u) => u.uf === uf)?.regiao
  if (!regiao) return []
  return ufs.filter((u) => u.regiao === regiao && u.uf !== uf).map((u) => u.uf)
}

/**
 * Lê o estado da tela da string de busca, validando contra os dados.
 * contexto: { ufs: [{uf, regiao}], anos: [..], areas: [códigos], areaPadrao }
 * Sem `pares` na URL, os pares são os estados da mesma região do destaque.
 */
export function lerEstado(busca, { ufs, anos, areas, areaPadrao }) {
  const p = new URLSearchParams(busca)
  const siglas = new Set(ufs.map((u) => u.uf))

  const area = areas.includes(p.get('area')) ? p.get('area') : areaPadrao
  const metrica = p.get('metrica') in METRICAS ? p.get('metrica') : 'per_capita'
  const valores = VALORES.includes(p.get('valores')) ? p.get('valores') : 'corrigidos'
  const anoUrl = Number(p.get('ano'))
  const ano = anos.includes(anoUrl) ? anoUrl : Math.max(...anos)
  const uf = siglas.has(p.get('uf')?.toUpperCase()) ? p.get('uf').toUpperCase() : null

  const paresUrl = p.get('pares')
  const personalizados = paresUrl !== null
  const pares = personalizados
    ? [...new Set(paresUrl.split(',').map((s) => s.trim().toUpperCase()))].filter((s) => siglas.has(s) && s !== uf)
    : paresPadrao(ufs, uf)

  return { area, metrica, valores, ano, uf, pares, paresPersonalizados: personalizados }
}

/** Estado → string de busca (só grava `pares` quando o leitor mudou o padrão). */
export function escreverEstado(estado) {
  const p = new URLSearchParams()
  p.set('area', estado.area)
  p.set('metrica', estado.metrica)
  if (estado.valores !== 'corrigidos') p.set('valores', estado.valores)
  p.set('ano', String(estado.ano))
  if (estado.uf) p.set('uf', estado.uf)
  if (estado.paresPersonalizados) p.set('pares', estado.pares.join(','))
  return `?${p.toString().replaceAll('%2C', ',')}`
}

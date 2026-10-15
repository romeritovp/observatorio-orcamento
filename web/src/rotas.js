// Rotas do site em caminhos reais, sem biblioteca de roteamento. Funções puras: recebem o caminho e a busca da URL
// e devolvem a rota, ou o contrário. O detalhe de cada tela (ano, área, métrica...) continua nos parâmetros de
// busca, lidos por estado.js; aqui só se decide a tela, a UF e o indicador.
//
//   /                          início
//   /sp                        painel do estado (visão geral)
//   /sp/pib                    um indicador num estado
//   /indicadores/pib           visão nacional do indicador (as 27 UFs)
//   /comparar?ufs=sp,pe&indicador=pib
//   /metodologia               página "Como fazemos"
//
// O site fica numa subpasta (BASE, do config/site.yaml via vite.config.js); os caminhos aqui são relativos a ela.

import { indicadorPorSlug, INDICADORES, ufPorSigla, ufPorSlug } from './navegacao.config.js'

export const BASE = import.meta.env?.BASE_URL ?? '/'
export const INDICADOR_COMPARAR_PADRAO = INDICADORES[0].slug

/** Caminho sem a base, em segmentos: '/orcamento/sp/pib' → ['sp', 'pib']. */
function segmentos(pathname, base = BASE) {
  const semBase = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\/+/, '')
  return semBase.split('/').map((s) => decodeURIComponent(s)).filter(Boolean)
}

/**
 * Rota do caminho: {tipo, uf?, indicador?}. tipo: 'inicio', 'uf' (painel), 'ufIndicador', 'indicador' (nacional),
 * 'comparar', 'metodologia' ou 'naoEncontrada'. uf e indicador vêm como objetos de navegacao.config.js.
 */
export function lerRota(pathname, base = BASE) {
  const s = segmentos(pathname, base)
  if (s.length === 0) return { tipo: 'inicio' }
  if (s.length === 1 && s[0] === 'metodologia') return { tipo: 'metodologia' }
  if (s.length === 1 && s[0] === 'comparar') return { tipo: 'comparar' }
  if (s.length === 2 && s[0] === 'indicadores') {
    const indicador = indicadorPorSlug(s[1])
    return indicador?.disponivel ? { tipo: 'indicador', indicador } : { tipo: 'naoEncontrada' }
  }
  const uf = ufPorSlug(s[0])
  if (uf && s.length === 1) return { tipo: 'uf', uf }
  if (uf && s.length === 2) {
    const indicador = indicadorPorSlug(s[1])
    if (indicador?.disponivel) return { tipo: 'ufIndicador', uf, indicador }
  }
  return { tipo: 'naoEncontrada' }
}

/** Caminho completo (com a base) da rota. */
export function caminho(rota, base = BASE) {
  const partes = {
    inicio: [], metodologia: ['metodologia'], comparar: ['comparar'], naoEncontrada: [],
    uf: [rota.uf?.slug], ufIndicador: [rota.uf?.slug, rota.indicador?.slug],
    indicador: ['indicadores', rota.indicador?.slug],
  }[rota.tipo]
  return `${base}${partes.join('/')}`
}

/** Atalhos para os links dos menus. */
export const caminhoUf = (uf, indicador = null) => caminho(indicador ? { tipo: 'ufIndicador', uf, indicador } : { tipo: 'uf', uf })
export const caminhoIndicador = (indicador) => caminho({ tipo: 'indicador', indicador })

/** Indicador da comparação (?indicador=pib), validado; padrão: o primeiro da configuração. */
export function indicadorDaComparacao(busca) {
  const indicador = indicadorPorSlug(new URLSearchParams(busca).get('indicador'))
  return indicador?.disponivel ? indicador : indicadorPorSlug(INDICADOR_COMPARAR_PADRAO)
}

/** UFs da comparação (?ufs=sp,pe), válidas e sem repetição: [objetos de UF]. */
export function ufsDaComparacao(busca) {
  const lista = (new URLSearchParams(busca).get('ufs') ?? '').split(',').map((s) => ufPorSlug(s.trim())).filter(Boolean)
  return [...new Map(lista.map((u) => [u.sigla, u])).values()]
}

/** Tela (chave de VIEWS em estado.js) que mostra a rota. */
export function viewDaRota(rota, busca = '') {
  switch (rota.tipo) {
    case 'inicio': return 'inicio'
    case 'uf': return 'painel'
    case 'ufIndicador': return rota.indicador.view
    case 'indicador': return rota.indicador.viewNacional
    case 'comparar': return indicadorDaComparacao(busca).viewNacional
    case 'metodologia': return 'metodo'
    default: return 'naoEncontrada'
  }
}

/**
 * Busca no formato que estado.js entende (view e uf como parâmetros), a partir da rota e da busca da URL.
 * Na comparação, ?ufs=sp,pe vira uf=SP e pares=PE (o destaque é o primeiro estado).
 */
export function buscaDoEstado(rota, busca) {
  const p = new URLSearchParams(busca)
  p.set('view', viewDaRota(rota, busca))
  if (rota.tipo === 'uf' || rota.tipo === 'ufIndicador') {
    p.set('uf', rota.uf.sigla)
  } else if (rota.tipo === 'comparar') {
    const ufs = ufsDaComparacao(busca)
    p.set('uf', ufs[0]?.sigla ?? '')
    p.set('pares', ufs.slice(1).map((u) => u.sigla).join(','))
    p.delete('ufs')
    p.delete('indicador')
  } else {
    p.set('uf', '')  // visão nacional, início e metodologia: nenhum estado em destaque
  }
  return `?${p.toString()}`
}

/**
 * Para onde vai uma mudança de estado da tela (ex.: trocar a UF num filtro), mantendo o tipo de página:
 * {rota, busca}. A UF e o indicador vão no caminho; o resto, na busca (escrita por estado.escreverEstado).
 *   - num estado (painel ou indicador): outra UF troca o estado mantendo o indicador; nenhuma UF leva à visão
 *     nacional do indicador (ou ao início, no painel);
 *   - na visão nacional: escolher uma UF leva ao indicador naquele estado;
 *   - na comparação: UF e pares viram ?ufs=.
 */
export function destinoDoEstado(rota, estado, buscaEscrita) {
  const p = new URLSearchParams(buscaEscrita)
  p.delete('view')
  p.delete('uf')
  const uf = ufPorSigla(estado.uf)
  let destino = rota
  if (rota.tipo === 'comparar') {
    p.delete('pares')
    const ufs = [uf, ...(estado.pares ?? []).map(ufPorSigla)].filter(Boolean)
    if (ufs.length) p.set('ufs', ufs.map((u) => u.slug).join(','))
    p.set('indicador', indicadorDaView(estado.view)?.slug ?? INDICADOR_COMPARAR_PADRAO)
  } else if (rota.tipo === 'ufIndicador' || rota.tipo === 'indicador') {
    destino = uf ? { tipo: 'ufIndicador', uf, indicador: rota.indicador } : { tipo: 'indicador', indicador: rota.indicador }
  } else if (rota.tipo === 'uf') {
    destino = uf ? { tipo: 'uf', uf } : { tipo: 'inicio' }
  }
  const texto = p.toString().replaceAll('%2C', ',')
  return { rota: destino, busca: texto ? `?${texto}` : '' }
}

/** Indicador mostrado por uma tela (a visão nacional do orçamento é a tela 'comparar'). */
function indicadorDaView(view) {
  return INDICADORES.find((i) => i.viewNacional === view || i.view === view) ?? null
}

/**
 * URL antiga (?view=pib&uf=RJ&..., antes das rotas em caminho) → URL nova (caminho + a busca restante), ou null se a
 * busca não é de uma URL antiga. Mesma regra do redirect 301 do index.php.
 */
export function urlNovaDeAntiga(busca, hash = '', base = BASE) {
  const p = new URLSearchParams(busca)
  const antigos = ['view', 'uf', 'area', 'metrica', 'ano', 'pares']
  if (!antigos.some((k) => p.has(k))) return null
  const view = p.get('view') ?? 'estado'
  const uf = ufPorSigla(p.get('uf'))
  const resto = new URLSearchParams(p)
  resto.delete('view')
  resto.delete('uf')
  const porView = { pib: 'pib', educacao: 'educacao', inovacao: 'pesquisa-e-inovacao', estado: 'orcamento' }
  let rota
  if (view === 'metodo') {
    rota = { tipo: 'metodologia' }
  } else if (view === 'comparar') {
    if (uf) {
      const pares = (resto.get('pares') ?? '').split(',').map(ufPorSigla).filter(Boolean)
      resto.delete('pares')
      resto.set('ufs', [uf, ...pares].map((u) => u.slug).join(','))
      resto.set('indicador', 'orcamento')
      rota = { tipo: 'comparar' }
    } else {
      rota = { tipo: 'indicador', indicador: indicadorPorSlug('orcamento') }
    }
  } else if (view in porView) {
    const indicador = indicadorPorSlug(porView[view])
    rota = uf ? { tipo: 'ufIndicador', uf, indicador } : (view === 'estado' ? { tipo: 'inicio' } : { tipo: 'indicador', indicador })
  } else {
    rota = { tipo: 'inicio' }
  }
  const texto = resto.toString().replaceAll('%2C', ',')
  return `${caminho(rota, base)}${texto ? `?${texto}` : ''}${hash}`
}

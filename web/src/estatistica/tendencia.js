// Tendência de uma série anual por regressão log-linear: ln(Y_t) = α + β·t + ε_t, β por mínimos quadrados.
// Funções puras: recebem observações [{ano, valor}] e a configuração (configuracao.json) e devolvem um objeto
// novo; nunca alteram a entrada. Método, hipóteses e limitações: docs/decisoes.md e a página "Como fazemos".
//
// Hipóteses de cada resultado:
// - β, taxa anual e R²: descritivos, valem sem hipótese probabilística (resumem a série no período).
// - Erro-padrão, intervalo e valor-p por MQO: erros com média zero, variância constante e independentes entre
//   anos; com poucos anos, também aproximadamente normais (a distribuição t depende disso).
// - Newey–West: dispensa independência e variância constante, mas é assintótico; com 8 a 22 anos o erro-padrão
//   robusto é ele mesmo impreciso. Usado só quando os resíduos indicam autocorrelação, sempre com aviso.

import CONFIGURACAO from './configuracao.json'
import { quiQuadradoValorP, tQuantil, tValorP } from './distribuicoes.js'

export { CONFIGURACAO }

const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v)

/**
 * Separa as observações usáveis das que não entram na regressão, sem alterar a entrada.
 * Ficam de fora (com o motivo): ano inválido, valor ausente ou não numérico, valor ≤ 0 (sem logaritmo) e
 * ano repetido (todas as ocorrências: não há como saber qual é a certa). Devolve {validas, excluidas},
 * validas em ordem de ano.
 */
export function prepararSerie(observacoes) {
  const contagem = new Map()
  for (const o of observacoes) contagem.set(o?.ano, (contagem.get(o?.ano) ?? 0) + 1)
  const validas = []
  const excluidas = []
  for (const o of observacoes) {
    const ano = o?.ano
    const valor = o?.valor
    let motivo = null
    if (!Number.isInteger(ano)) motivo = 'ano inválido'
    else if (contagem.get(ano) > 1) motivo = 'ano repetido'
    else if (valor === null || valor === undefined) motivo = 'valor ausente'
    else if (!ehNumero(valor)) motivo = 'valor não numérico'
    else if (valor <= 0) motivo = 'valor zero ou negativo (sem logaritmo)'
    if (motivo) excluidas.push({ ano, valor, motivo })
    else validas.push({ ano, valor })
  }
  validas.sort((a, b) => a.ano - b.ano)
  return { validas, excluidas }
}

/**
 * Categoria da taxa anual (% ao ano) pelos limites da configuração. A taxa é arredondada a 1e-9 ponto percentual
 * antes da comparação: uma série que cresce exatamente 1% ao ano dá 1,0000000000002% em ponto flutuante e não
 * pode cair na faixa de cima por isso.
 */
export function classificar(taxaAnual, categorias = CONFIGURACAO.categorias) {
  if (!ehNumero(taxaAnual)) return null
  const g = Math.round(taxaAnual * 1e9) / 1e9
  for (const c of categorias) {
    if (c.ate === null || g < c.ate || (c.inclui_limite && g === c.ate)) return { id: c.id, nome: c.nome }
  }
  throw new Error('configuração de categorias sem a última faixa (ate: null)')
}

/** Defasagens do Newey–West: ⌊4·(n/100)^(2/9)⌋, no mínimo 1 (regra usual de Newey e West, 1994). */
export const defasagensNeweyWest = (n) => Math.max(1, Math.floor(4 * (n / 100) ** (2 / 9)))

const taxa = (b) => 100 * (Math.exp(b) - 1)

/**
 * Análise completa de uma série. observacoes: [{ano, valor}] em qualquer ordem; config: configuracao.json.
 * Devolve (taxas em % ao ano; variação acumulada em % entre o primeiro e o último ano válido):
 *   n, anoInicial, anoFinal, excluidas, validas, estimavel,
 *   beta, alfa (ln Y no ano médio), previsto(ano), taxaAnual, variacaoAcumulada, r2,
 *   intermediarios: {anoMedio, yMedio, sxx, sxy, sqr, sqt} (somas da regressão, com o ano centrado),
 *   inferencia: {metodo: 'mqo' | 'newey_west' | null, gl, erroPadrao, t, valorP, icBeta, icTaxa,
 *                erroPadraoMqo, erroPadraoNeweyWest, defasagens, critico, criticoTost, icTost, limitesEquivalencia},
 *   diagnosticos: {autocorrelacaoVerificada, autocorrelacaoSuspeita, rho1, durbinWatson, ljungBox: {q, valorP},
 *                  lacunas: [anos faltando no meio]},
 *   categoria: {id, nome} | null, evidencia: 'positiva' | 'negativa' | 'inconclusiva' | 'insuficiente',
 *   estabilidade: true | false | null (equivalência à manutenção, teste TOST), qualidade, avisos: [texto].
 */
export function analisarTendencia(observacoes, config = CONFIGURACAO) {
  const { validas, excluidas } = prepararSerie(observacoes)
  const n = validas.length
  const avisos = []
  if (excluidas.length) {
    avisos.push(`${excluidas.length} ano(s) fora da conta: ${excluidas.map((e) => `${e.ano} (${e.motivo})`).join('; ')}.`)
  }
  const base = {
    n, excluidas, validas, anoInicial: validas[0]?.ano ?? null, anoFinal: validas[n - 1]?.ano ?? null,
  }
  if (n < 2) {
    return {
      ...base, estimavel: false, beta: null, alfa: null, previsto: () => null, taxaAnual: null, variacaoAcumulada: null,
      r2: null, inferencia: { metodo: null }, diagnosticos: { autocorrelacaoVerificada: false, lacunas: [] }, categoria: null,
      evidencia: 'insuficiente', estabilidade: null, qualidade: 'insuficiente',
      avisos: [...avisos, 'Menos de dois anos com dado: não há tendência a estimar.'],
    }
  }

  // Regressão com o ano centrado (estabilidade numérica; β não muda)
  const anos = validas.map((o) => o.ano)
  const y = validas.map((o) => Math.log(o.valor))
  const anoMedio = anos.reduce((s, a) => s + a, 0) / n
  const x = anos.map((a) => a - anoMedio)
  const yMedio = y.reduce((s, v) => s + v, 0) / n
  const sxx = x.reduce((s, v) => s + v * v, 0)
  const sxy = x.reduce((s, v, i) => s + v * (y[i] - yMedio), 0)
  const beta = sxy / sxx
  const alfa = yMedio
  const residuos = y.map((v, i) => v - (alfa + beta * x[i]))
  const sqr = residuos.reduce((s, r) => s + r * r, 0)
  const sqt = y.reduce((s, v) => s + (v - yMedio) ** 2, 0)
  const ajustePerfeito = sqr <= 1e-24 * Math.max(1, sqt)
  const r2 = sqt <= 1e-24 ? null : 1 - sqr / sqt
  const anoInicial = anos[0]
  const anoFinal = anos[n - 1]
  const lacunas = []
  for (let a = anoInicial + 1; a < anoFinal; a += 1) if (!anos.includes(a)) lacunas.push(a)
  if (lacunas.length) avisos.push(`Anos faltando no meio da série (${lacunas.join(', ')}): a reta usa só os anos com dado.`)
  if (r2 === null) avisos.push('Série constante: R² não se aplica.')

  const resultado = {
    ...base, estimavel: true, beta, alfa, previsto: (ano) => Math.exp(alfa + beta * (ano - anoMedio)),
    // Somas da conta, para a página "Como fazemos" mostrar cada passo (nada é recalculado fora daqui)
    intermediarios: { anoMedio, yMedio, sxx, sxy, sqr, sqt },
    taxaAnual: taxa(beta), variacaoAcumulada: 100 * (Math.exp(beta * (anoFinal - anoInicial)) - 1), r2,
    categoria: classificar(taxa(beta), config.categorias),
  }

  const gl = n - 2
  if (n < config.minimo_observacoes_inferencia) {
    return {
      ...resultado, inferencia: { metodo: null, gl }, diagnosticos: { autocorrelacaoVerificada: false, lacunas },
      evidencia: 'insuficiente', estabilidade: null, qualidade: 'insuficiente',
      avisos: [...avisos, `Só ${n} anos: dá para descrever a direção, mas não para medir a incerteza.`],
    }
  }

  // Diagnósticos dos resíduos (ordem dos anos válidos): autocorrelação de 1ª ordem
  const somaProd = (l) => residuos.slice(l).reduce((s, r, i) => s + r * residuos[i], 0)
  const rho1 = ajustePerfeito ? null : somaProd(1) / sqr
  const durbinWatson = ajustePerfeito ? null : residuos.slice(1).reduce((s, r, i) => s + (r - residuos[i]) ** 2, 0) / sqr
  const autocorrelacaoVerificada = !ajustePerfeito && n >= config.minimo_observacoes_autocorrelacao
  const qLjungBox = rho1 === null ? null : (n * (n + 2) * rho1 * rho1) / (n - 1)
  const pLjungBox = qLjungBox === null ? null : quiQuadradoValorP(qLjungBox, 1)
  const autocorrelacaoSuspeita = autocorrelacaoVerificada && pLjungBox < config.nivel_teste_autocorrelacao
  const diagnosticos = {
    autocorrelacaoVerificada, autocorrelacaoSuspeita, rho1, durbinWatson, ljungBox: { q: qLjungBox, valorP: pLjungBox }, lacunas,
  }

  // Erro-padrão por MQO e por Newey–West (Bartlett, correção n/(n−2), como o statsmodels com use_correction)
  const erroPadraoMqo = Math.sqrt(sqr / gl / sxx)
  const defasagens = defasagensNeweyWest(n)
  let meio = residuos.reduce((s, r, i) => s + r * r * x[i] * x[i], 0)
  for (let l = 1; l <= defasagens; l += 1) {
    const peso = 1 - l / (defasagens + 1)
    let soma = 0
    for (let t = l; t < n; t += 1) soma += residuos[t] * residuos[t - l] * x[t] * x[t - l]
    meio += 2 * peso * soma
  }
  const erroPadraoNeweyWest = Math.sqrt(Math.max(meio, 0) * (n / gl)) / sxx
  const metodo = autocorrelacaoSuspeita ? 'newey_west' : 'mqo'
  const erroPadrao = metodo === 'newey_west' ? erroPadraoNeweyWest : erroPadraoMqo

  const alfaTeste = 1 - config.confianca
  const critico = tQuantil(1 - alfaTeste / 2, gl)
  const icBeta = [beta - critico * erroPadrao, beta + critico * erroPadrao]
  const tEstatistica = erroPadrao > 0 ? beta / erroPadrao : null
  const valorP = tEstatistica === null ? null : tValorP(tEstatistica, gl)

  // Evidência: o intervalo inteiro de um lado do zero. Estabilidade: TOST, intervalo de 1 − 2α dentro da margem.
  const evidencia = icBeta[0] > 0 ? 'positiva' : icBeta[1] < 0 ? 'negativa' : 'inconclusiva'
  const criticoTost = tQuantil(1 - alfaTeste, gl)
  const margem = config.margem_equivalencia_pct_ano / 100
  const [limiteBaixo, limiteAlto] = [Math.log(1 - margem), Math.log(1 + margem)]
  const estabilidade = beta - criticoTost * erroPadrao > limiteBaixo && beta + criticoTost * erroPadrao < limiteAlto

  if (ajustePerfeito) avisos.push('A reta passa exatamente por todos os pontos: não há variação para medir incerteza.')
  if (!autocorrelacaoVerificada && !ajustePerfeito) {
    avisos.push(`Com ${n} anos não dá para verificar se os desvios de um ano influenciam o seguinte; `
      + 'se influenciarem, o intervalo de confiança fica estreito demais.')
  }
  if (autocorrelacaoSuspeita) {
    avisos.push('Os desvios de um ano parecem influenciar os do ano seguinte (autocorrelação). O intervalo usa o '
      + `erro-padrão de Newey–West (${defasagens} defasagem${defasagens > 1 ? 's' : ''}), que corrige isso, mas é impreciso com poucos anos.`)
  }
  if (r2 !== null && r2 < 0.3) avisos.push(`A reta explica pouco da variação (R² = ${r2.toFixed(2).replace('.', ',')}): os anos oscilam muito em torno dela.`)
  if (evidencia === 'inconclusiva' && !estabilidade) {
    avisos.push('Não dá para afirmar que subiu, que caiu nem que ficou estável: os dados são compatíveis com mais de uma leitura.')
  }

  const qualidade = autocorrelacaoSuspeita || !autocorrelacaoVerificada ? 'baixa'
    : n < config.observacoes_qualidade_adequada ? 'moderada' : 'adequada'

  return {
    ...resultado,
    inferencia: {
      metodo, gl, erroPadrao, t: tEstatistica, valorP, icBeta, icTaxa: icBeta.map(taxa),
      erroPadraoMqo, erroPadraoNeweyWest, defasagens, confianca: config.confianca,
      critico, criticoTost, limitesEquivalencia: [limiteBaixo, limiteAlto],
      icTost: [beta - criticoTost * erroPadrao, beta + criticoTost * erroPadrao],
    },
    diagnosticos, evidencia, estabilidade, qualidade, avisos,
  }
}

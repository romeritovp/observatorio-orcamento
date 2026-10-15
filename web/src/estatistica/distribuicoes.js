// Distribuições usadas na inferência da tendência (t de Student e qui-quadrado), em JavaScript puro.
// Funções especiais pelos algoritmos clássicos (Numerical Recipes, cap. 6): ln Γ de Lanczos, beta incompleta
// regularizada por fração contínua e gama incompleta regularizada por série/fração contínua.
// Precisão conferida contra o scipy nos testes (erro relativo < 1e-9 nos casos usados).

const EPS = 1e-15
const MAX_ITER = 500

/** ln Γ(x), x > 0 (aproximação de Lanczos, g = 7). */
export function lnGama(x) {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGama(1 - x)
  const z = x - 1
  let a = c[0]
  const t = z + 7.5
  for (let i = 1; i < 9; i += 1) a += c[i] / (z + i)
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
}

/** Fração contínua da beta incompleta (método de Lentz modificado). */
function fracaoBeta(a, b, x) {
  const minimo = 1e-300
  let c = 1
  let d = 1 - ((a + b) * x) / (a + 1)
  if (Math.abs(d) < minimo) d = minimo
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAX_ITER; m += 1) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < minimo) d = minimo
    c = 1 + aa / c; if (Math.abs(c) < minimo) c = minimo
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1))
    d = 1 + aa * d; if (Math.abs(d) < minimo) d = minimo
    c = 1 + aa / c; if (Math.abs(c) < minimo) c = minimo
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < EPS) return h
  }
  throw new Error('beta incompleta: não convergiu')
}

/** Beta incompleta regularizada I_x(a, b). */
export function betaIncompleta(x, a, b) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const ln = lnGama(a + b) - lnGama(a) - lnGama(b) + a * Math.log(x) + b * Math.log(1 - x)
  return x < (a + 1) / (a + b + 2)
    ? (Math.exp(ln) * fracaoBeta(a, b, x)) / a
    : 1 - (Math.exp(ln) * fracaoBeta(b, a, 1 - x)) / b
}

/** P(T ≤ t) para t de Student com `gl` graus de liberdade. */
export function tAcumulada(t, gl) {
  const x = gl / (gl + t * t)
  const cauda = 0.5 * betaIncompleta(x, gl / 2, 0.5)
  return t >= 0 ? 1 - cauda : cauda
}

/** Valor-p bilateral de uma estatística t. */
export const tValorP = (t, gl) => 2 * (1 - tAcumulada(Math.abs(t), gl))

/** Quantil da t de Student: o t com P(T ≤ t) = p (bisseção sobre a acumulada). */
export function tQuantil(p, gl) {
  if (!(p > 0 && p < 1)) throw new Error(`probabilidade fora de (0, 1): ${p}`)
  if (p < 0.5) return -tQuantil(1 - p, gl)
  let baixo = 0
  let alto = 1
  while (tAcumulada(alto, gl) < p) alto *= 2
  for (let i = 0; i < 200; i += 1) {
    const meio = (baixo + alto) / 2
    if (tAcumulada(meio, gl) < p) baixo = meio
    else alto = meio
    if (alto - baixo < 1e-12 * Math.max(1, alto)) break
  }
  return (baixo + alto) / 2
}

/** Gama incompleta regularizada inferior P(a, x). */
export function gamaIncompleta(a, x) {
  if (x <= 0) return 0
  const lnPrefixo = -x + a * Math.log(x) - lnGama(a)
  if (x < a + 1) {  // série
    let soma = 1 / a
    let termo = soma
    for (let n = 1; n <= MAX_ITER; n += 1) {
      termo *= x / (a + n)
      soma += termo
      if (Math.abs(termo) < Math.abs(soma) * EPS) return soma * Math.exp(lnPrefixo)
    }
    throw new Error('gama incompleta: não convergiu')
  }
  // fração contínua (Lentz) para Q = 1 − P
  const minimo = 1e-300
  let b = x + 1 - a
  let c = 1 / minimo
  let d = 1 / b
  let h = d
  for (let i = 1; i <= MAX_ITER; i += 1) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b; if (Math.abs(d) < minimo) d = minimo
    c = b + an / c; if (Math.abs(c) < minimo) c = minimo
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < EPS) return 1 - Math.exp(lnPrefixo) * h
  }
  throw new Error('gama incompleta: não convergiu')
}

/** Valor-p de uma estatística qui-quadrado com `gl` graus de liberdade: P(X ≥ q). */
export const quiQuadradoValorP = (q, gl) => 1 - gamaIncompleta(gl / 2, q / 2)

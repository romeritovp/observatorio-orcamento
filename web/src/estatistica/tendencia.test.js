// Tendência log-linear: casos construídos à mão e conferência contra o statsmodels/scipy
// (src/testes/referencia_tendencia.json, gerado por src/testes/referencia_tendencia.py).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { quiQuadradoValorP, tQuantil, tValorP } from './distribuicoes.js'
import { analisarTendencia, CONFIGURACAO, classificar, defasagensNeweyWest, prepararSerie } from './tendencia.js'

const REFERENCIA = JSON.parse(readFileSync(new URL('../testes/referencia_tendencia.json', import.meta.url), 'utf-8'))
const ANOS = Array.from({ length: 15 }, (_, i) => 2009 + i)
const serie = (f, anos = ANOS) => anos.map((ano, i) => ({ ano, valor: f(i, ano) }))
const perto = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b))

describe('distribuições: iguais ao scipy', () => {
  const { t_quantil: quantis, t_valor_p: valoresP, qui2_valor_p: qui2 } = REFERENCIA.distribuicoes
  it('quantis da t', () => {
    for (const c of quantis) expect(perto(tQuantil(c.p, c.gl), c.valor), `gl ${c.gl} p ${c.p}`).toBe(true)
  })
  it('valores-p da t e da qui-quadrado', () => {
    for (const c of valoresP) expect(perto(tValorP(c.t, c.gl), c.valor), `gl ${c.gl} t ${c.t}`).toBe(true)
    for (const c of qui2) expect(perto(quiQuadradoValorP(c.q, c.gl), c.valor), `q ${c.q}`).toBe(true)
  })
})

describe('regressão: igual ao statsmodels', () => {
  for (const [nome, { observacoes, esperado: e }] of Object.entries(REFERENCIA.series)) {
    it(nome, () => {
      const r = analisarTendencia(observacoes)
      expect(r.n).toBe(e.n)
      expect(perto(r.beta, e.beta)).toBe(true)
      expect(perto(r.r2, e.r2)).toBe(true)
      expect(perto(r.inferencia.erroPadraoMqo, e.erro_padrao_mqo)).toBe(true)
      expect(perto(r.inferencia.erroPadraoNeweyWest, e.erro_padrao_newey_west)).toBe(true)
      expect(r.inferencia.defasagens).toBe(e.defasagens)
      const nw = r.inferencia.metodo === 'newey_west'
      const [icEsperado, pEsperado] = nw ? [e.ic_beta_newey_west, e.valor_p_newey_west] : [e.ic_beta, e.valor_p]
      expect(perto(r.inferencia.icBeta[0], icEsperado[0])).toBe(true)
      expect(perto(r.inferencia.icBeta[1], icEsperado[1])).toBe(true)
      expect(perto(r.inferencia.valorP, pEsperado, 1e-7)).toBe(true)
      expect(perto(r.diagnosticos.rho1, e.rho1)).toBe(true)
      expect(perto(r.diagnosticos.durbinWatson, e.durbin_watson)).toBe(true)
      expect(perto(r.diagnosticos.ljungBox.q, e.ljung_box_q)).toBe(true)
      expect(perto(r.diagnosticos.ljungBox.valorP, e.ljung_box_p, 1e-7)).toBe(true)
    })
  }
})

describe('casos construídos', () => {
  it('1. crescimento proporcional constante: taxa e acumulado exatos, ajuste perfeito', () => {
    const r = analisarTendencia(serie((i) => 100 * 1.03 ** i))
    expect(r.taxaAnual).toBeCloseTo(3, 10)
    expect(r.variacaoAcumulada).toBeCloseTo(100 * (1.03 ** 14 - 1), 8)  // 2009–2023: 14 anos de diferença
    expect(r.r2).toBeCloseTo(1, 12)
    expect(r.categoria.id).toBe('crescimento_leve')
    expect(r.avisos.join(' ')).toContain('exatamente')
  })

  it('2. queda proporcional constante', () => {
    const r = analisarTendencia(serie((i) => 80 * 0.93 ** i))
    expect(r.taxaAnual).toBeCloseTo(-7, 10)
    expect(r.categoria.id).toBe('queda_acentuada')
  })

  it('3. série constante: manutenção, R² não se aplica, estabilidade demonstrada', () => {
    const r = analisarTendencia(serie(() => 12.5))
    expect(r.taxaAnual).toBeCloseTo(0, 12)
    expect(r.r2).toBeNull()
    expect(r.categoria.id).toBe('manutencao')
    expect(r.evidencia).toBe('inconclusiva')
    expect(r.estabilidade).toBe(true)
  })

  it('4. oscilação em torno de +2% ao ano: crescimento leve com evidência positiva', () => {
    const r = analisarTendencia(REFERENCIA.series.oscilacao.observacoes)
    expect(r.categoria.id).toBe('crescimento_leve')
    expect(r.evidencia).toBe('positiva')
    expect(r.inferencia.icTaxa[0]).toBeGreaterThan(0)  // 9. intervalo exclui zero
  })

  it('5. limites das categorias: −5 e +1 e −1 inclusos na faixa certa, +5 é acentuado', () => {
    expect(classificar(-5).id).toBe('queda_acentuada')
    expect(classificar(-4.999).id).toBe('queda_leve')
    expect(classificar(-1).id).toBe('manutencao')
    expect(classificar(-1.001).id).toBe('queda_leve')
    expect(classificar(1).id).toBe('manutencao')
    expect(classificar(1.0001).id).toBe('crescimento_leve')
    expect(classificar(5).id).toBe('crescimento_acentuado')
    expect(classificar(4.999).id).toBe('crescimento_leve')
    expect(classificar(null)).toBeNull()
    // série exatamente a +1% ao ano: manutenção (limite incluso)
    expect(analisarTendencia(serie((i) => Math.exp(i * Math.log(1.01)))).categoria.id).toBe('manutencao')
  })

  it('6. ausentes, zeros, negativos e anos repetidos ficam de fora, com o motivo; a entrada não muda', () => {
    const entrada = [
      { ano: 2015, valor: 10 }, { ano: 2016, valor: null }, { ano: 2017, valor: 0 }, { ano: 2018, valor: -3 },
      { ano: 2019, valor: 11 }, { ano: 2019, valor: 12 }, { ano: 2020, valor: 'x' }, { ano: 2021.5, valor: 1 },
      { ano: 2022, valor: 12 }, { ano: 2023, valor: 13 }, { ano: 2014, valor: 9 },
    ]
    const copia = structuredClone(entrada)
    const { validas, excluidas } = prepararSerie(entrada)
    expect(validas.map((o) => o.ano)).toEqual([2014, 2015, 2022, 2023])  // ordenadas, sem presumir a ordem
    expect(excluidas.map((e) => e.motivo)).toEqual([
      'valor ausente', 'valor zero ou negativo (sem logaritmo)', 'valor zero ou negativo (sem logaritmo)',
      'ano repetido', 'ano repetido', 'valor não numérico', 'ano inválido',
    ])
    const r = analisarTendencia(entrada)
    expect(entrada).toEqual(copia)
    expect(r.n).toBe(4)
    expect(r.diagnosticos.lacunas).toEqual([2016, 2017, 2018, 2019, 2020, 2021])
    expect(r.avisos.join(' ')).toContain('7 ano(s) fora da conta')
    expect(r.variacaoAcumulada).toBeCloseTo(100 * (Math.exp(r.beta * 9) - 1), 10)  // 2014–2023, não n − 1
  })

  it('7. tamanhos diferentes: 1 ano não estima; 3 anos descreve sem inferência; 4 anos já mede incerteza', () => {
    const um = analisarTendencia([{ ano: 2023, valor: 5 }])
    expect(um.estimavel).toBe(false)
    expect(um.evidencia).toBe('insuficiente')
    const tres = analisarTendencia(serie((i) => 5 + i, [2021, 2022, 2023]))
    expect(tres.taxaAnual).toBeGreaterThan(0)
    expect(tres.evidencia).toBe('insuficiente')
    expect(tres.inferencia.metodo).toBeNull()
    const quatro = analisarTendencia(REFERENCIA.series.quatro_anos.observacoes)
    expect(quatro.inferencia.gl).toBe(2)
    expect(quatro.qualidade).toBe('baixa')
    expect(quatro.diagnosticos.autocorrelacaoVerificada).toBe(false)
    expect(quatro.avisos.join(' ')).toContain('não dá para verificar')
  })

  it('8. autocorrelação: detectada, inferência passa a Newey–West, com aviso', () => {
    const r = analisarTendencia(REFERENCIA.series.autocorrelacao.observacoes)
    expect(r.diagnosticos.autocorrelacaoVerificada).toBe(true)
    expect(r.diagnosticos.autocorrelacaoSuspeita).toBe(true)
    expect(r.inferencia.metodo).toBe('newey_west')
    expect(r.qualidade).toBe('baixa')
    expect(r.avisos.join(' ')).toContain('Newey–West')
    // série sem autocorrelação forte fica no MQO
    expect(analisarTendencia(REFERENCIA.series.oscilacao.observacoes).inferencia.metodo).toBe('mqo')
  })

  it('9 e 10. intervalo que inclui zero e R² baixo: inconclusivo, com avisos', () => {
    const r = analisarTendencia(REFERENCIA.series.r2_baixo.observacoes)
    expect(r.inferencia.icBeta[0]).toBeLessThan(0)
    expect(r.inferencia.icBeta[1]).toBeGreaterThan(0)
    expect(r.evidencia).toBe('inconclusiva')
    expect(r.r2).toBeLessThan(0.3)
    expect(r.avisos.join(' ')).toContain('R²')
  })

  it('manutenção não é presumida: inclinação ~0 com muito ruído não demonstra estabilidade', () => {
    const r = analisarTendencia(REFERENCIA.series.r2_baixo.observacoes)
    expect(r.estabilidade).toBe(false)
    expect(r.avisos.join(' ')).toContain('Não dá para afirmar')
  })

  it('configuração separada: outros limites mudam só a categoria', () => {
    const outra = { ...CONFIGURACAO, categorias: [{ id: 'baixo', nome: 'Baixo', ate: 2.5, inclui_limite: true }, { id: 'alto', nome: 'Alto', ate: null }] }
    const s = serie((i) => 100 * 1.03 ** i)
    expect(analisarTendencia(s, outra).categoria.id).toBe('alto')
    expect(analisarTendencia(s, outra).taxaAnual).toBeCloseTo(analisarTendencia(s).taxaAnual, 12)
  })

  it('defasagens do Newey–West', () => {
    expect([4, 8, 15, 22, 100].map(defasagensNeweyWest)).toEqual([1, 2, 2, 2, 4])
  })
})

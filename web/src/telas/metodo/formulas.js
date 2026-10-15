// Números dos exemplos da versão "Fórmulas" da página "Como fazemos" (marcadores {{formulas....}}).
// Tudo sai dos JSON publicados e das funções de calculos.js (e de estatistica/tendencia.js): nenhuma conta é
// refeita aqui, só se escolhem as linhas do exemplo e se formatam os números. O teste (metodo.test.jsx) confere
// cada exemplo contra o gabarito.json (Python) e contra o statsmodels (src/testes/referencia_tendencia.json).

import {
  conferenciaDclRcl, idebRecalculado, rankingIdeb, serieIdeb, tendenciasDoIdeb, crescimentoAcumulado, indicadoresDaFuncao, indicadoresDivida, indicadoresReceita, mediana, participacaoNoPais,
  participacaoNoVab, populacoes, rebasear, tendenciasDaAtividade, totaisPorUfAno,
} from '../../calculos.js'
import { ATIVIDADE_PIB_PADRAO, lerEstado } from '../../estado.js'
import { CONFIGURACAO as CONFIG_TENDENCIA } from '../../estatistica/tendencia.js'
import { numero, reais } from '../../formatacao.js'

/** Número com `casas` decimais, sinal de menos tipográfico. */
const n = (v, casas) => (v === null || v === undefined ? '–' : numero(v, casas).replace('-', '−'))
/** R$ com centavos, sem abreviar (para refazer a conta). */
const r = (v) => reais(v, true)
// O ano médio (t̄) vai sem separador de milhar: "2012,5", não "2.012,5"
const p = (v, casas = 4) => `${n(v, casas)}%`

const EVIDENCIA = {
  positiva: 'positiva (o intervalo inteiro está acima de zero)',
  negativa: 'negativa (o intervalo inteiro está abaixo de zero)',
  inconclusiva: 'inconclusiva (o intervalo inclui o zero)',
  insuficiente: 'não calculada (anos insuficientes)',
}

/**
 * Valores dos marcadores {{formulas.*}}. dados: arquivos gerais (como carregarDados); pib: pib.json;
 * pibUf: pib/<UF do exemplo>.json; ideb: ideb.json. O exemplo é o da página (meta.json → documentacao.exemplo): UF e
 * área; no IDEB, a etapa e a rede padrão da tela "Educação".
 */
export function valoresDasFormulas(dados, pib, pibUf, ideb) {
  const { meta, ipca, despesa, receita, divida, dicionarios } = dados
  const anoBase = meta.deflacao.ano_base_padrao
  const { uf, funcao_cod: funcao } = meta.documentacao.exemplo
  const ano = Math.max(...meta.anos)

  // Despesa: % do orçamento, posição e mediana do por habitante, variação do total
  const daFuncao = indicadoresDaFuncao(despesa, ipca.serie, { funcao, anoBase })
  const doAno = daFuncao.filter((l) => l.ano === ano)
  const linha = doAno.find((l) => l.uf === uf)
  const maiores = doAno.filter((l) => l.per_capita_real > linha.per_capita_real).sort((a, b) => b.per_capita_real - a.per_capita_real)
  const ordenados = [...doAno].sort((a, b) => a.per_capita_real - b.per_capita_real)
  const meio = Math.floor(ordenados.length / 2)
  const vizinhos = ordenados.slice(Math.max(meio - 1, 0), meio + 2)
    .map((l) => `${ordenados.indexOf(l) + 1}º ${l.uf}: ${r(l.per_capita_real)}`).join('\n')
  const totais = totaisPorUfAno(despesa, ipca.serie, { anoBase })
  const total = totais.find((t) => t.uf === uf && t.ano === ano)
  const totalAnterior = totais.find((t) => t.uf === uf && t.ano === ano - 1)

  // Receita e dívida
  const rec = indicadoresReceita(receita.totais, ipca.serie, { anoBase, populacao: populacoes(despesa) }).find((l) => l.uf === uf && l.ano === ano)
  const div = indicadoresDivida(divida.linhas, ipca.serie, { anoBase }).find((l) => l.uf === uf && l.ano === ano)
  const conf = conferenciaDclRcl(div)

  // PIB: último ano da série do IBGE e o ano inicial padrão da tela
  const anoPib = Math.max(...pib.anos)
  const { desdePib: desde } = lerEstado('?view=pib', { ufs: [], anos: meta.anos, areas: [], areaPadrao: null, anosPib: pib.anos })
  const atividade = ATIVIDADE_PIB_PADRAO
  const nomeAtividade = pib.atividades.find((a) => a.atividade_cod === atividade).nome
  const vab = (cod) => pibUf.find((l) => l.ano === anoPib && l.atividade_cod === cod).vab
  const pctAtividade = participacaoNoVab(pibUf.filter((l) => l.ano === anoPib)).find((x) => x.chave === atividade).pct
  const grupos = Object.fromEntries(pib.atividades.filter((a) => a.grande_setor !== 'total').map((a) => [a.atividade_cod, a.grande_setor]))
  const setor = grupos[atividade]
  const doSetor = pib.atividades.filter((a) => grupos[a.atividade_cod] === setor)
  const pctSetor = participacaoNoVab(pibUf.filter((l) => l.ano === anoPib), grupos).find((x) => x.chave === setor).pct
  const pibDe = (u) => pib.linhas.find((l) => l.uf === u && l.ano === anoPib).pib_corrente
  const volume = (a) => pib.linhas.find((l) => l.uf === uf && l.ano === a).volume_pib_2002_100

  // Tendência: série completa da atividade padrão até o último ano do PIB
  const t = tendenciasDaAtividade(pibUf, uf, atividade, anoPib).find((j) => j.anos === null)
  const tr = t.resultado
  const inf = tr.inferencia
  const im = tr.intermediarios
  const taxa = (b) => 100 * (Math.exp(b) - 1)

  // IDEB: etapa e rede padrão da tela, último ano
  const { etapa_padrao: etapaIdeb, rede_padrao: redeIdeb } = meta.ideb
  const anoIdeb = Math.max(...ideb.anos)
  const conferido = idebRecalculado(ideb, uf, etapaIdeb, redeIdeb, anoIdeb)
  const posIdeb = rankingIdeb(ideb, etapaIdeb, redeIdeb, anoIdeb).find((l) => l.uf === uf)
  const anoIdebAnterior = ideb.anos[ideb.anos.indexOf(anoIdeb) - 1]
  const tendIdeb = tendenciasDoIdeb(ideb, uf, etapaIdeb, redeIdeb, anoIdeb).find((j) => j.anos === null)
  const ETAPA_TEXTO = { anos_iniciais: 'anos iniciais', anos_finais: 'anos finais', medio: 'ensino médio' }

  return {
    ano, ano_anterior: ano - 1,
    ideb: {
      etapa: ETAPA_TEXTO[etapaIdeb] ?? etapaIdeb, rede: redeIdeb, ano: anoIdeb, ano_anterior: anoIdebAnterior,
      n: n(conferido.n, 6), p: n(conferido.p, 6), nxp: n(conferido.calculado, 4), ideb: n(conferido.publicado, 1),
      maiores: posIdeb.posicao - 1, posicao: posIdeb.posicao, n_ufs: posIdeb.n_ufs,
      anterior: n(serieIdeb(ideb, uf, etapaIdeb, redeIdeb, 'ideb').find((x) => x.ano === anoIdebAnterior).valor, 1),
      variacao: n(posIdeb.variacao_pontos, 1),
      inicio: tendIdeb.resultado.anoInicial, edicoes: tendIdeb.resultado.n, taxa: p(tendIdeb.resultado.taxaAnual, 2),
    },
    despesa: {
      liquidado: r(linha.nominal), total: r(linha.total_despesa), pct: p(linha.pct_despesa_total),
      per_capita_real: r(linha.per_capita_real), n_ufs: linha.n_ufs, posicao: linha.posicao_per_capita_real,
      maiores_quantos: maiores.length, maiores: maiores.length ? maiores.map((l) => l.uf).join(', ') : 'nenhuma',
      mediana: r(mediana(doAno.map((l) => l.per_capita_real))), posicao_meio: meio + 1, vizinhos,
      total_real: r(total.total_real), total_real_anterior: r(totalAnterior?.total_real), variacao: p(total.var_real_pct, 2),
    },
    receita: {
      liquida: r(rec.receita_liquida), fator: n(rec.fator_ipca, 6), real: r(rec.receita_liquida_real), populacao: n(rec.populacao),
      per_capita_real: r(rec.per_capita_real), impostos: r(rec.impostos_proprios), pct_impostos: p(rec.pct_impostos_proprios),
      transferencias: r(rec.transferencias_uniao), pct_transferencias: p(rec.pct_transferencias_uniao),
    },
    divida: {
      dc: r(div.dc), deducoes: r(div.deducoes), dcl: r(div.dcl), dcl_calculada: r(conf.dcl),
      denominador: conf.denominador === 'rcl_ajustada' ? 'RCL ajustada' : 'RCL', rcl: r(conf.rcl),
      pct_calculado: p(conf.calculado), pct_publicado: p(conf.publicado, 2),
      juros: r(div.juros), amortizacao: r(div.amortizacao), pago: r(div.pago), fator: n(div.fator_ipca, 6), pago_real: r(div.pago_real),
    },
    pib: {
      ano: anoPib, desde, atividade: nomeAtividade, vab_atividade: r(vab(atividade)), vab_total: r(vab('01')), pct_atividade: p(pctAtividade),
      setor: pib.grandes_setores.find((g) => g.id === setor).nome,
      setor_partes: doSetor.map((a) => `${a.atividade_cod} ${a.nome_curto}: ${r(vab(a.atividade_cod))}`).join('\n'),
      setor_codigos: doSetor.map((a) => a.atividade_cod).join(' + '), pct_setor: p(pctSetor),
      pib_uf: r(pibDe(uf)), pib_pais: r(pibDe(pib.pais)), pct_pais: p(participacaoNoPais(pib.linhas, uf, anoPib, pib.pais)),
      volume_desde: n(volume(desde), 6), volume_fim: n(volume(anoPib), 6),
      rebase: n(rebasear(pib.linhas, uf, 'volume_pib_2002_100', desde, [anoPib])[0].valor, 4),
      crescimento: p(crescimentoAcumulado(pib.linhas, uf, 'volume_pib_2002_100', desde, anoPib)),
    },
    tendencia: {
      atividade: nomeAtividade, inicio: tr.anoInicial, fim: tr.anoFinal, n: tr.n, gl: inf.gl,
      ano_medio: im.anoMedio.toFixed(1).replace('.', ','), sxx: n(im.sxx, 4), sxy: n(im.sxy, 8), y_medio: n(im.yMedio, 8),
      beta: n(tr.beta, 8), taxa: p(tr.taxaAnual), acumulada: p(tr.variacaoAcumulada), anos_periodo: tr.anoFinal - tr.anoInicial,
      sqr: n(im.sqr, 8), sqt: n(im.sqt, 8), r2: n(tr.r2, 6), s2: n(im.sqr / inf.gl, 8),
      ep_mqo: n(inf.erroPadraoMqo, 8), ep_nw: n(inf.erroPadraoNeweyWest, 8), defasagens: inf.defasagens,
      rho1: n(tr.diagnosticos.rho1, 6), dw: n(tr.diagnosticos.durbinWatson, 6),
      q: n(tr.diagnosticos.ljungBox.q, 6), p_lb: n(tr.diagnosticos.ljungBox.valorP, 6),
      nivel_lb: n(CONFIG_TENDENCIA.nivel_teste_autocorrelacao, 2),
      metodo: inf.metodo === 'newey_west' ? 'Newey–West (há indício de autocorrelação)' : 'mínimos quadrados (sem indício de autocorrelação)',
      ep: n(inf.erroPadrao, 8), confianca: `${Math.round(inf.confianca * 100)}%`, critico: n(inf.critico, 6),
      ic_beta_baixo: n(inf.icBeta[0], 8), ic_beta_alto: n(inf.icBeta[1], 8),
      ic_taxa_baixo: p(inf.icTaxa[0]), ic_taxa_alto: p(inf.icTaxa[1]), t: n(inf.t, 6), valor_p: n(inf.valorP, 6),
      evidencia: EVIDENCIA[tr.evidencia], categoria: tr.categoria.nome,
      critico_tost: n(inf.criticoTost, 6), tost_baixo: p(taxa(inf.icTost[0])), tost_alto: p(taxa(inf.icTost[1])),
      margem: n(CONFIG_TENDENCIA.margem_equivalencia_pct_ano, 0),
      estabilidade: tr.estabilidade ? 'demonstrada (o intervalo de 90% está dentro da margem)' : 'não demonstrada (o intervalo de 90% sai da margem)',
    },
  }
}

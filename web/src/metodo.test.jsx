// Página "Como fazemos": textos (src/conteudo/metodo/), links internos, ligações "entenda" das ressalvas
// e o exemplo "Refaça a conta", conferido contra a tela e contra o gabarito.json do Python.
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { dadosDaUf, dadosDoSite, lerArquivo, lerJson } from './testes/publicados.js'

import { conferenciaDclRcl, indicadoresDaFuncao, passosPorHabitante } from './calculos.js'
import { ENTENDA, linkEntenda } from './conteudo/metodo/ligacoes.js'
import { INTRODUCAO, SECOES, lerSecao } from './conteudo/metodo/indice.js'
import { escreverEstado, lerEstado, NIVEIS_METODO } from './estado.js'
import { lerRota } from './rotas.js'
import { numero, reais } from './formatacao.js'
import { ancora, ancorasELinks, lerInline, lerMarkdown, preencher } from './markdown.js'
import Ressalvas from './componentes/Ressalvas.jsx'
import Comparar from './telas/Comparar.jsx'
import Metodo from './telas/Metodo.jsx'
import { valoresDasFormulas } from './telas/metodo/formulas.js'
import { linkDca, valoresDoMetodo } from './telas/metodo/valores.js'

const dados = dadosDoSite()
const gabarito = lerJson('gabarito.json')
const presentes = new Set(dados.despesa.filter((l) => l.nivel === 'funcao').map((l) => l.funcao_cod))
const funcoes = dados.dicionarios.funcoes.filter((f) => presentes.has(f.funcao_cod))
const contexto = { ufs: dados.dicionarios.ufs, anos: dados.meta.anos, areas: funcoes.map((f) => f.funcao_cod), areaPadrao: '10' }
const tela = (Tela, busca) => {
  const estado = lerEstado(busca, contexto)
  return renderToString(<Tela dados={dados} estado={estado} mudar={() => {}} funcoes={funcoes} dadosUf={estado.uf ? dadosDaUf(estado.uf) : undefined} />)
}
const pib = lerArquivo('pib.json')
const pibExemplo = lerArquivo(`pib/${dados.meta.documentacao.exemplo.uf}.json`)
const ideb = lerArquivo('ideb.json')
const valores = { ...valoresDoMetodo(dados), formulas: valoresDasFormulas(dados, pib, pibExemplo, ideb) }
const NIVEIS = Object.keys(NIVEIS_METODO)
// Versões completas (todas as seções); "formulas" só tem as seções com contas
const COMPLETAS = ['simples', 'tecnico']
/** Seções presentes na versão (a introdução vale a técnica quando não tem a versão). */
const textosDoNivel = (nivel) => [INTRODUCAO[nivel] ?? INTRODUCAO.tecnico, ...SECOES.filter((s) => s[nivel]).map((s) => s[nivel])]

/** Âncoras e links da página inteira num nível: seções, títulos dos textos e a abertura. */
function paginaNoNivel(nivel) {
  const ids = [INTRODUCAO.id, ...SECOES.filter((s) => s[nivel]).map((s) => s.id)]
  const links = []
  for (const texto of textosDoNivel(nivel)) {
    const r = ancorasELinks(lerMarkdown(preencher(texto, valores)))
    ids.push(...r.ids)
    links.push(...r.links)
  }
  return { ids, links }
}

/** Todas as ressalvas publicadas (gerais, por função, da receita, por UF, da dívida, do PIB). */
function idsDasRessalvas() {
  const { meta, receita, divida } = dados
  return [
    ...meta.ressalvas, ...Object.values(meta.ressalvas_por_funcao).flat(),
    ...receita.ressalvas, ...Object.values(receita.ressalvas_por_uf).flat(), ...divida.ressalvas,
    ...lerArquivo('pib.json').ressalvas, ...meta.ibid.ressalvas,
    ...ideb.ressalvas, ...Object.values(ideb.ressalvas_por_uf).flat(),
    ...lerArquivo('violencia.json').ressalvas,
  ].map((r) => r.id)
}

describe('leitor de Markdown', () => {
  it('títulos com âncora explícita ou automática, listas, tabela, código e citação', () => {
    const blocos = lerMarkdown([
      '### Despesa liquidada {#termo-liquidado}', '', '#### Por habitante', '', 'Um **negrito**, um *itálico*, `código` e [link](#x).',
      'continua no mesmo parágrafo.', '', '- item um', '  com continuação', '- item dois', '', '1. primeiro', '2. segundo', '',
      '| A | B |', '|---|---|', '| 1 | [y](#y) |', '', '```', 'a × b', '```', '', '> citação com [z](#z)', '', '---',
    ].join('\n'))
    expect(blocos.map((b) => b.tipo)).toEqual(['titulo', 'titulo', 'paragrafo', 'lista', 'lista', 'tabela', 'codigo', 'citacao', 'linha'])
    expect(blocos[0].id).toBe('termo-liquidado')
    expect(blocos[1].id).toBe('por-habitante')
    expect(blocos[3].itens[0]).toEqual([{ tipo: 'texto', texto: 'item um com continuação' }])
    expect(blocos[4].ordenada).toBe(true)
    expect(ancorasELinks(blocos)).toEqual({ ids: ['termo-liquidado', 'por-habitante'], links: ['#x', '#y', '#z'] })
  })

  it('texto corrido: negrito com link dentro', () => {
    expect(lerInline('**ver [aqui](#a)**')).toEqual([{ tipo: 'negrito', filhos: [{ tipo: 'texto', texto: 'ver ' }, { tipo: 'link', href: '#a', filhos: [{ tipo: 'texto', texto: 'aqui' }] }] }])
    expect(ancora('Liquidado (despesa) é ação')).toBe('liquidado-despesa-e-acao')
  })

  it('marcador sem valor é erro; com valor, é trocado', () => {
    expect(preencher('R$ {{a.b}} em {{ano}}', { a: { b: '10' }, ano: 2025 })).toBe('R$ 10 em 2025')
    expect(() => preencher('{{nao.existe}}', {})).toThrow('nao.existe')
    expect(() => preencher('{{a}}', { a: { b: 1 } })).toThrow()
  })

  it('tabela sem a linha |---| é erro', () => {
    expect(() => lerMarkdown('| a | b |\n| 1 | 2 |')).toThrow('tabela')
  })
})

describe('textos da página', () => {
  it('cada seção tem título, âncora e as duas versões; ids únicos', () => {
    expect(SECOES.length).toBe(8)
    const ids = SECOES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of SECOES) for (const nivel of COMPLETAS) expect(s[nivel].length).toBeGreaterThan(200)
    expect(SECOES.filter((s) => s.formulas).map((s) => s.id)).toEqual(['calculos'])
    expect(INTRODUCAO.formulas.length).toBeGreaterThan(100)
    expect(() => lerSecao('# Sem versões {#x}\n\n## simples\n\ntexto')).toThrow('duas versões')
  })

  it('todos os marcadores {{...}} têm valor, nas duas versões', () => {
    for (const nivel of NIVEIS) for (const texto of textosDoNivel(nivel)) expect(() => preencher(texto, valores)).not.toThrow()
  })

  it('todo link interno aponta para uma âncora que existe; âncoras únicas e iguais nas duas versões', () => {
    const porNivel = Object.fromEntries(NIVEIS.map((n) => [n, paginaNoNivel(n)]))
    for (const nivel of NIVEIS) {
      const { ids, links } = porNivel[nivel]
      expect(new Set(ids).size, `âncora repetida na versão ${nivel}`).toBe(ids.length)
      for (const href of links) {
        if (href.startsWith('#')) expect(ids, `${nivel}: ${href}`).toContain(href.slice(1))
        else if (href.startsWith('/')) {
          // página do site, escrita como caminho ("/indicadores/pib"): tem de ser uma rota que existe
          const [caminhoDoLink, alvo] = href.split('#')
          expect(lerRota(caminhoDoLink, '/').tipo, href).not.toBe('naoEncontrada')
          if (alvo && lerRota(caminhoDoLink, '/').tipo === 'metodologia') expect(ids, `${nivel}: ${href}`).toContain(alvo)
        } else expect(href, `link externo sem https: ${href}`).toMatch(/^https:\/\//)
      }
    }
    // Trocar de versão mantém o leitor no mesmo lugar: as âncoras são as mesmas
    expect([...porNivel.tecnico.ids].sort()).toEqual([...porNivel.simples.ids].sort())
    // Na versão "Fórmulas", cada conta da técnica tem a sua fórmula, com a mesma âncora
    for (const id of porNivel.tecnico.ids.filter((x) => x.startsWith('calculo-'))) expect(porNivel.formulas.ids, id).toContain(id)
  })

  it('toda ressalva publicada tem "entenda", e a âncora existe nas duas versões', () => {
    const publicadas = idsDasRessalvas()
    // ibid_escores_entre_anos some do meta.json quando config/ibid.yaml liberar os escores; a ligação continua valendo
    const avisos = ['aviso_estatal', 'sem_info_estatais', 'quebra_dependencia', 'tendencia', 'ibid_escores_entre_anos']
    for (const id of [...publicadas, ...avisos]) expect(ENTENDA, `ressalva sem ligação: ${id}`).toHaveProperty(id)
    // nenhuma ligação sobrando para ressalva que não existe mais
    expect(Object.keys(ENTENDA).sort()).toEqual([...new Set([...publicadas, ...avisos])].sort())
    for (const nivel of COMPLETAS) {  // na versão "Fórmulas", âncora que falta leva à técnica (Metodo.jsx)
      const { ids } = paginaNoNivel(nivel)
      for (const alvo of Object.values(ENTENDA)) expect(ids, `${nivel}: ${alvo}`).toContain(alvo)
    }
  })

  it('as ressalvas renderizadas levam o link "entenda"', () => {
    const html = renderToString(<Ressalvas ressalvas={dados.meta.ressalvas} avisos={[{ id: '1', texto: 'aviso' }]} semInfoEstatais="sem" />)
    for (const r of dados.meta.ressalvas) expect(html).toContain(`href="${linkEntenda(r.id)}"`)
    expect(html).toContain(`href="${linkEntenda('aviso_estatal')}"`)
    expect(html).toContain(`href="${linkEntenda('sem_info_estatais')}"`)
    expect(tela(Comparar, '')).toContain('class="entenda"')
  })
})

describe('Refaça a conta: o exemplo bate com a tela e com o gabarito', () => {
  const exemplo = dados.meta.documentacao.exemplo
  const anoBase = dados.meta.deflacao.ano_base_padrao
  const naTela = (ano) => indicadoresDaFuncao(dados.despesa, dados.ipca.serie, { funcao: exemplo.funcao_cod, anoBase })
    .find((l) => l.uf === exemplo.uf && l.ano === ano)
  const noGabarito = (ano) => gabarito.valores.find((l) => l.uf === exemplo.uf && l.ano === ano && l.funcao_cod === exemplo.funcao_cod)

  it('ano mais recente e primeiro ano: mesmo valor da tela e do Python', () => {
    for (const [ano, chave] of [[Math.max(...dados.meta.anos), 'exemplo'], [Math.min(...dados.meta.anos), 'exemplo_antigo']]) {
      const resultado = valores[chave].resultado_numero
      expect(resultado).toBe(naTela(ano).per_capita_real)
      expect(resultado).toBeCloseTo(noGabarito(ano).per_capita_real, 6)
      expect(valores[chave].resultado_tela).toBe(reais(naTela(ano).per_capita_real))
    }
  })

  it('o número do exemplo é o que a tela Comparar mostra', () => {
    const html = tela(Comparar, `?view=comparar&area=${exemplo.funcao_cod}&uf=${exemplo.uf}`)
    expect(html).toContain(valores.exemplo.resultado_tela.replace(/\s/g, ' '))
  })

  it('passos: o fator é o produto dos multiplicadores do IPCA; ano mais recente tem fator 1', () => {
    const antigo = passosPorHabitante(dados.despesa, dados.ipca.serie,
      { uf: exemplo.uf, funcao: exemplo.funcao_cod, ano: Math.min(...dados.meta.anos), anoBase })
    const produto = antigo.ipca.reduce((p, x) => p * (1 + x.variacao_pct / 100), 1)
    expect(antigo.fator).toBeCloseTo(produto, 12)
    expect(antigo.ipca.map((x) => x.ano)).toEqual(dados.meta.anos.slice(1))
    const recente = passosPorHabitante(dados.despesa, dados.ipca.serie,
      { uf: exemplo.uf, funcao: exemplo.funcao_cod, ano: anoBase, anoBase })
    expect(recente.fator).toBe(1)
    expect(recente.ipca).toEqual([])
    expect(() => passosPorHabitante(dados.despesa, dados.ipca.serie, { uf: 'XX', funcao: '10', ano: anoBase, anoBase })).toThrow()
  })

  it('link da API do SICONFI: anexo, ano e código IBGE da UF', () => {
    const uf = dados.dicionarios.ufs.find((u) => u.uf === exemplo.uf)
    expect(linkDca('https://api/tt', { anexo: 'DCA-Anexo I-E', ano: 2025, codIbge: uf.cod_ibge }))
      .toBe(`https://api/tt/dca?an_exercicio=2025&no_anexo=DCA-Anexo%20I-E&id_ente=${uf.cod_ibge}`)
    expect(valores.exemplo.link_api).toContain(`id_ente=${uf.cod_ibge}`)
  })
})

describe('tela "Como fazemos"', () => {
  it('renderiza as oito seções, o índice e o seletor; o padrão é a explicação simples', () => {
    const html = tela(Metodo, '?view=metodo')
    for (const s of SECOES) {
      expect(html).toContain(`id="${s.id}"`)
      expect(html).toContain(`href="#${s.id}"`)
    }
    expect(html).toContain('aria-pressed="true">Explicação simples')
    expect(html).toContain(valores.exemplo.resultado)
  })

  it('?nivel=tecnico troca o texto da página toda', () => {
    const tecnico = tela(Metodo, '?view=metodo&nivel=tecnico')
    expect(tecnico).toContain('aria-pressed="true">Explicação técnica')
    expect(tecnico).toContain('PercentualDaDCLSobreARCL')
    expect(tela(Metodo, '?view=metodo')).not.toContain('PercentualDaDCLSobreARCL')
  })

  it('nível na URL: lido, validado e gravado só quando não é o padrão', () => {
    expect(lerEstado('?view=metodo&nivel=tecnico', contexto)).toMatchObject({ view: 'metodo', nivel: 'tecnico' })
    expect(lerEstado('?view=metodo&nivel=outro', contexto).nivel).toBe('simples')
    expect(escreverEstado(lerEstado('?view=metodo&nivel=tecnico', contexto))).toContain('nivel=tecnico')
    expect(escreverEstado(lerEstado('?view=metodo', contexto))).not.toContain('nivel=')
  })
})

describe('versão "Fórmulas": exemplos iguais ao cálculo independente', () => {
  const f = valores.formulas
  const { uf, funcao_cod: funcao } = dados.meta.documentacao.exemplo
  const ano = Math.max(...dados.meta.anos)
  const n = (v, casas) => numero(v, casas).replace('-', '−')
  const pct = (v, casas = 4) => `${n(v, casas)}%`
  const doGabarito = (lista, criterio) => lista.find((l) => Object.entries(criterio).every(([k, v]) => l[k] === v))

  it('despesa: % do orçamento, posição, mediana e variação = gabarito.json (Python)', () => {
    const g = doGabarito(gabarito.valores, { uf, ano, funcao_cod: funcao })
    expect(f.despesa.pct).toBe(pct(g.pct_despesa_total))
    expect(f.despesa.per_capita_real).toBe(reais(g.per_capita_real, true))
    expect(f.despesa.posicao).toBe(g.posicao_per_capita_real)
    expect(f.despesa.maiores_quantos).toBe(g.posicao_per_capita_real - 1)
    expect(f.despesa.mediana).toBe(reais(doGabarito(gabarito.medianas, { ano, funcao_cod: funcao }).per_capita_real, true))
    expect(f.despesa.variacao).toBe(pct(doGabarito(gabarito.totais, { uf, ano }).var_real_pct, 2))
  })

  it('receita e dívida = gabarito.json; DCL/RCL recalculado bate com o publicado (duas casas)', () => {
    const rec = doGabarito(gabarito.receita, { uf, ano })
    expect(f.receita.per_capita_real).toBe(reais(rec.per_capita_real, true))
    expect(f.receita.pct_impostos).toBe(pct(rec.pct_impostos_proprios))
    expect(f.receita.pct_transferencias).toBe(pct(rec.pct_transferencias_uniao))
    expect(f.divida.pago_real).toBe(reais(doGabarito(gabarito.divida, { uf, ano }).pago_real, true))
    // Todas as UFs e anos com os campos (o layout de 2015–2016 não traz DC e deduções): diferença só de arredondamento
    const conferidas = dados.divida.linhas.map(conferenciaDclRcl).filter((c) => c && c.publicado !== null && c.calculado !== null)
    expect(conferidas.length).toBeGreaterThan(250)
    for (const c of conferidas) {
      expect(Math.abs(c.calculado - c.publicado)).toBeLessThanOrEqual(0.005 + 1e-9)
      expect(Math.abs(c.diferencaDcl)).toBeLessThan(0.01)
    }
  })

  it('PIB: participações, volume e crescimento = gabarito.json', () => {
    const g = gabarito.pib
    const anoPib = f.pib.ano
    expect(f.pib.pct_atividade).toBe(pct(doGabarito(g.atividades, { uf, ano: anoPib, chave: '04' }).pct))
    expect(f.pib.pct_setor).toBe(pct(doGabarito(g.setores, { uf, ano: anoPib, chave: 'industria' }).pct))
    expect(f.pib.pct_pais).toBe(pct(doGabarito(g.pct_pais, { uf, ano: anoPib }).pct))
    expect(f.pib.rebase).toBe(n(doGabarito(g.rebase, { uf, ano: anoPib, base: f.pib.desde }).valor, 4))
    expect(f.pib.crescimento).toBe(pct(doGabarito(g.crescimento, { uf, inicio: f.pib.desde, fim: anoPib }).crescimento_pct))
  })

  it('IDEB: posição e variação = gabarito.json (Python); N × P confere com o publicado', () => {
    const g = gabarito.ideb.find((l) => l.uf === uf && l.etapa === dados.meta.ideb.etapa_padrao && l.rede === dados.meta.ideb.rede_padrao
      && l.ano === f.ideb.ano)
    expect(f.ideb.posicao).toBe(g.posicao)
    expect(f.ideb.variacao).toBe(n(g.variacao_pontos, 1))
    expect(f.ideb.ideb).toBe(n(g.ideb, 1))
    const calculado = Number(f.ideb.nxp.replace(',', '.'))
    expect(Math.abs(calculado - g.ideb)).toBeLessThanOrEqual(0.1)
  })

  it('tendência = statsmodels (mesma série: src/testes/referencia_tendencia.json → exemplo_metodo)', () => {
    const referencia = JSON.parse(readFileSync(new URL('./testes/referencia_tendencia.json', import.meta.url), 'utf-8')).exemplo_metodo
    const e = referencia.esperado
    expect(referencia.uf).toBe(uf)
    expect(f.tendencia.n).toBe(e.n)
    expect(f.tendencia.beta).toBe(n(e.beta, 8))
    expect(f.tendencia.r2).toBe(n(e.r2, 6))
    expect(f.tendencia.ep_mqo).toBe(n(e.erro_padrao_mqo, 8))
    expect(f.tendencia.ep_nw).toBe(n(e.erro_padrao_newey_west, 8))
    expect(f.tendencia.defasagens).toBe(e.defasagens)
    expect(f.tendencia.rho1).toBe(n(e.rho1, 6))
    expect(f.tendencia.dw).toBe(n(e.durbin_watson, 6))
    expect(f.tendencia.q).toBe(n(e.ljung_box_q, 6))
    expect(f.tendencia.p_lb).toBe(n(e.ljung_box_p, 6))
    const nw = f.tendencia.metodo.startsWith('Newey')
    const [ic, p] = nw ? [e.ic_beta_newey_west, e.valor_p_newey_west] : [e.ic_beta, e.valor_p]
    expect(f.tendencia.ic_beta_baixo).toBe(n(ic[0], 8))
    expect(f.tendencia.ic_beta_alto).toBe(n(ic[1], 8))
    expect(f.tendencia.valor_p).toBe(n(p, 6))
  })
})

describe('tela "Como fazemos", versão "Fórmulas"', () => {
  const telaFormulas = (comPib = true) => renderToString(<Metodo dados={dados} estado={lerEstado('?view=metodo&nivel=formulas', contexto)}
    mudar={() => {}} pib={comPib ? pib : null} pibUf={comPib ? pibExemplo : undefined} ideb={comPib ? ideb : null} />).replaceAll('<!-- -->', '')

  it('só as seções com fórmulas, com a numeração da página inteira e os números do exemplo', () => {
    const html = telaFormulas()
    expect(html).toContain('aria-pressed="true">Fórmulas')
    expect(html).toContain('id="calculos"')
    expect(html).not.toContain('id="fontes"')
    expect(html).toContain('Seção 4')
    expect(html).toContain(valores.formulas.despesa.pct)
    expect(html).toContain('Newey–West')
  })

  it('sem os dados do PIB, avisa que está carregando', () => {
    expect(telaFormulas(false)).toContain('Carregando os dados dos exemplos')
  })

  it('nível na URL', () => {
    expect(lerEstado('?view=metodo&nivel=formulas', contexto).nivel).toBe('formulas')
    expect(escreverEstado(lerEstado('?view=metodo&nivel=formulas', contexto))).toContain('nivel=formulas')
  })
})

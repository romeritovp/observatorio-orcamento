// Página "Como fazemos": textos (src/conteudo/metodo/), links internos, ligações "entenda" das ressalvas
// e o exemplo "Refaça a conta", conferido contra a tela e contra o gabarito.json do Python.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { dadosDaUf, dadosDoSite, lerJson } from './testes/publicados.js'

import { indicadoresDaFuncao, passosPorHabitante } from './calculos.js'
import { ENTENDA, linkEntenda } from './conteudo/metodo/ligacoes.js'
import { INTRODUCAO, SECOES, lerSecao } from './conteudo/metodo/indice.js'
import { escreverEstado, lerEstado, NIVEIS_METODO, VIEWS } from './estado.js'
import { reais } from './formatacao.js'
import { ancora, ancorasELinks, lerInline, lerMarkdown, preencher } from './markdown.js'
import Ressalvas from './componentes/Ressalvas.jsx'
import Comparar from './telas/Comparar.jsx'
import Metodo from './telas/Metodo.jsx'
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
const valores = valoresDoMetodo(dados)
const NIVEIS = Object.keys(NIVEIS_METODO)

/** Âncoras e links da página inteira num nível: seções, títulos dos textos e a abertura. */
function paginaNoNivel(nivel) {
  const ids = [INTRODUCAO.id, ...SECOES.map((s) => s.id)]
  const links = []
  for (const texto of [INTRODUCAO[nivel], ...SECOES.map((s) => s[nivel])]) {
    const r = ancorasELinks(lerMarkdown(preencher(texto, valores)))
    ids.push(...r.ids)
    links.push(...r.links)
  }
  return { ids, links }
}

/** Todas as ressalvas publicadas (gerais, por função, da receita, por UF, da dívida). */
function idsDasRessalvas() {
  const { meta, receita, divida } = dados
  return [
    ...meta.ressalvas, ...Object.values(meta.ressalvas_por_funcao).flat(),
    ...receita.ressalvas, ...Object.values(receita.ressalvas_por_uf).flat(), ...divida.ressalvas,
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
    for (const s of SECOES) for (const nivel of NIVEIS) expect(s[nivel].length).toBeGreaterThan(200)
    expect(() => lerSecao('# Sem versões {#x}\n\n## simples\n\ntexto')).toThrow('duas versões')
  })

  it('todos os marcadores {{...}} têm valor, nas duas versões', () => {
    for (const s of [INTRODUCAO, ...SECOES]) for (const nivel of NIVEIS) expect(() => preencher(s[nivel], valores)).not.toThrow()
  })

  it('todo link interno aponta para uma âncora que existe; âncoras únicas e iguais nas duas versões', () => {
    const porNivel = Object.fromEntries(NIVEIS.map((n) => [n, paginaNoNivel(n)]))
    for (const nivel of NIVEIS) {
      const { ids, links } = porNivel[nivel]
      expect(new Set(ids).size, `âncora repetida na versão ${nivel}`).toBe(ids.length)
      for (const href of links) {
        if (href.startsWith('#')) expect(ids, `${nivel}: ${href}`).toContain(href.slice(1))
        else if (href.startsWith('?')) {
          const [busca, alvo] = href.split('#')
          expect(Object.keys(VIEWS), href).toContain(new URLSearchParams(busca).get('view'))
          if (alvo) expect(ids, `${nivel}: ${href}`).toContain(alvo)
        } else expect(href, `link externo sem https: ${href}`).toMatch(/^https:\/\//)
      }
    }
    // Trocar de versão mantém o leitor no mesmo lugar: as âncoras são as mesmas
    expect([...porNivel.tecnico.ids].sort()).toEqual([...porNivel.simples.ids].sort())
  })

  it('toda ressalva publicada tem "entenda", e a âncora existe nas duas versões', () => {
    const publicadas = idsDasRessalvas()
    const avisos = ['aviso_estatal', 'sem_info_estatais', 'quebra_dependencia']
    for (const id of [...publicadas, ...avisos]) expect(ENTENDA, `ressalva sem ligação: ${id}`).toHaveProperty(id)
    // nenhuma ligação sobrando para ressalva que não existe mais
    expect(Object.keys(ENTENDA).sort()).toEqual([...new Set([...publicadas, ...avisos])].sort())
    for (const nivel of NIVEIS) {
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

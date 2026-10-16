// Navegação: configuração única, rotas em caminho (e os redirects das URLs antigas), componentes do cabeçalho e
// as páginas novas (início, painel do estado), renderizadas com os dados publicados.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { dadosDoSite, lerArquivo } from './testes/publicados.js'
import { escreverEstado, lerEstado, VIEWS } from './estado.js'
import {
  buscarUf, doNome, EIXOS, indicadorPorSlug, INDICADORES, INDICADORES_POR_EIXO, REGIOES, tituloDoIndicador, ufPorSlug, UFS, UFS_POR_REGIAO,
} from './navegacao.config.js'
import {
  BASE, buscaDoEstado, caminho, caminhoIndicador, caminhoUf, destinoDoEstado, lerRota, urlNovaDeAntiga, viewDaRota,
} from './rotas.js'
import Header from './componentes/navegacao/Header.jsx'
import MegaMenuIndicadores from './componentes/navegacao/MegaMenuIndicadores.jsx'
import SubheaderUF from './componentes/navegacao/SubheaderUF.jsx'
import DrawerMobile from './componentes/navegacao/DrawerMobile.jsx'
import Inicio from './telas/Inicio.jsx'
import PainelUF from './telas/PainelUF.jsx'

const sp = ufPorSlug('sp')
const pib = indicadorPorSlug('pib')
const html = (el) => renderToString(el).replaceAll('<!-- -->', '')

describe('configuração única da navegação', () => {
  it('27 UFs, vindas do dicionarios.json (ufs.csv), com slug, região e artigo; 5 regiões na ordem', () => {
    expect(UFS).toHaveLength(27)
    expect(UFS.map((u) => u.sigla).sort()).toEqual(lerArquivo('dicionarios.json').ufs.map((u) => u.uf).sort())
    expect(UFS_POR_REGIAO.map((r) => r.regiao)).toEqual(REGIOES)
    expect(UFS_POR_REGIAO.flatMap((r) => r.ufs)).toHaveLength(27)
    expect(sp).toMatchObject({ sigla: 'SP', slug: 'sp', nome: 'São Paulo', regiao: 'Sudeste' })
  })

  it('indicadores: slugs únicos, eixo existente, tela existente; o mapa do index.php é o mesmo', () => {
    expect(new Set(INDICADORES.map((i) => i.slug)).size).toBe(INDICADORES.length)
    for (const i of INDICADORES) {
      expect(EIXOS.map((e) => e.slug), i.slug).toContain(i.eixo)
      expect(Object.keys(VIEWS), i.slug).toContain(i.view)
      expect(Object.keys(VIEWS), i.slug).toContain(i.viewNacional)
      expect(i.descricaoCurta.length, i.slug).toBeGreaterThan(10)
    }
    expect(INDICADORES_POR_EIXO.map((g) => g.eixo.nome)).toEqual(['Finanças públicas', 'Economia', 'Social', 'Segurança pública', 'Ciência'])
    // publicacao/og.py → compartilhar.json: o PHP escolhe os textos de prévia por estes slugs
    expect(Object.keys(lerArquivo('compartilhar.json').indicadores).sort()).toEqual(INDICADORES.map((i) => i.slug).sort())
  })

  it('título "O [Indicador] de [UF]" com a preposição certa', () => {
    const t = (slug, uf) => tituloDoIndicador(indicadorPorSlug(slug), ufPorSlug(uf))
    expect(t('orcamento', 'sp')).toBe('O Orçamento de São Paulo')
    expect(t('educacao', 'ba')).toBe('A Educação da Bahia')
    expect(t('pib', 'ce')).toBe('O PIB do Ceará')
    expect(t('pesquisa-e-inovacao', 'pe')).toBe('A Pesquisa e Inovação de Pernambuco')
    expect(t('orcamento', 'rj')).toBe('O Orçamento do Rio de Janeiro')
    expect(doNome(ufPorSlug('df'))).toBe('do Distrito Federal')
  })

  it('busca de UF por nome (sem acento) ou sigla', () => {
    expect(buscarUf('pern')[0].sigla).toBe('PE')
    expect(buscarUf('PE')[0].sigla).toBe('PE')
    expect(buscarUf('para').map((u) => u.sigla).slice(0, 3)).toEqual(['PA', 'PB', 'PR'])  // Pará, Paraíba, Paraná
    expect(buscarUf('sao')[0].sigla).toBe('SP')
    expect(buscarUf('')).toEqual([])
    expect(buscarUf('xyz')).toEqual([])
  })
})

describe('rotas em caminho', () => {
  it('lê e monta os caminhos (com a base do site)', () => {
    const casos = [
      ['', { tipo: 'inicio' }], ['sp', { tipo: 'uf', uf: sp }], ['sp/pib', { tipo: 'ufIndicador', uf: sp, indicador: pib }],
      ['indicadores/pib', { tipo: 'indicador', indicador: pib }], ['comparar', { tipo: 'comparar' }], ['metodologia', { tipo: 'metodologia' }],
    ]
    for (const [relativo, rota] of casos) {
      expect(lerRota(`${BASE}${relativo}`), relativo).toEqual(rota)
      expect(caminho(rota), relativo).toBe(`${BASE}${relativo}`)
    }
    expect(lerRota(`${BASE}SP/pib/`)).toEqual({ tipo: 'ufIndicador', uf: sp, indicador: pib })  // maiúscula e barra no fim
    for (const ruim of ['zz', 'sp/xyz', 'indicadores/xyz', 'sp/pib/extra', 'indicadores']) {
      expect(lerRota(`${BASE}${ruim}`).tipo, ruim).toBe('naoEncontrada')
    }
  })

  it('tela de cada rota e o estado que as telas recebem (UF do caminho; comparação por ?ufs=)', () => {
    expect(viewDaRota(lerRota(`${BASE}sp`))).toBe('painel')
    expect(viewDaRota(lerRota(`${BASE}sp/orcamento`))).toBe('estado')
    expect(viewDaRota(lerRota(`${BASE}indicadores/orcamento`))).toBe('comparar')
    expect(viewDaRota({ tipo: 'comparar' }, '?indicador=educacao')).toBe('educacao')
    const p = new URLSearchParams(buscaDoEstado({ tipo: 'comparar' }, '?ufs=sp,pe,xx,sp&indicador=pib&pano=2022'))
    expect([p.get('view'), p.get('uf'), p.get('pares'), p.get('pano'), p.has('ufs')]).toEqual(['pib', 'SP', 'PE', '2022', false])
    expect(new URLSearchParams(buscaDoEstado(lerRota(`${BASE}indicadores/pib`), '?pano=2023')).get('uf')).toBe('')
  })

  it('trocar a UF mantém o indicador; tirar a UF leva à visão nacional; na nacional, escolher UF leva ao estado', () => {
    const contexto = { ufs: lerArquivo('dicionarios.json').ufs, anos: [2025], areas: ['10'], areaPadrao: '10' }
    const estadoDe = (rota, busca) => lerEstado(buscaDoEstado(rota, busca), contexto)
    const ir = (rota, busca, mudancas) => {
      const novo = { ...estadoDe(rota, busca), ...mudancas }
      const d = destinoDoEstado(rota, novo, escreverEstado(novo))
      return `${caminho(d.rota)}${d.busca}`
    }
    const naUf = lerRota(`${BASE}sp/pib`)
    expect(ir(naUf, '', { uf: 'PE' })).toMatch(new RegExp(`^${BASE}pe/pib\\?`))
    expect(ir(naUf, '', { uf: null })).toMatch(new RegExp(`^${BASE}indicadores/pib\\?`))
    expect(ir(lerRota(`${BASE}indicadores/pib`), '', { uf: 'RJ' })).toMatch(new RegExp(`^${BASE}rj/pib\\?`))
    expect(ir(lerRota(`${BASE}sp`), '', { uf: null })).toMatch(new RegExp(`^${BASE}\\?`))
    const comparar = ir({ tipo: 'comparar' }, '?ufs=sp,pe&indicador=orcamento', { pares: ['PE', 'BA'], paresPersonalizados: true })
    expect(comparar).toContain(`${BASE}comparar?`)
    expect(comparar).toContain('ufs=sp,pe,ba')
    expect(comparar).toContain('indicador=orcamento')
  })

  it('URLs antigas (?view=...) viram as novas, com o resto da busca e a âncora', () => {
    expect(urlNovaDeAntiga('')).toBeNull()
    expect(urlNovaDeAntiga('?uf=RJ&ano=2024')).toBe(`${BASE}rj/orcamento?ano=2024`)
    expect(urlNovaDeAntiga('?view=pib&uf=SP&pano=2023')).toBe(`${BASE}sp/pib?pano=2023`)
    expect(urlNovaDeAntiga('?view=educacao')).toBe(`${BASE}indicadores/educacao`)
    expect(urlNovaDeAntiga('?view=inovacao&uf=pe')).toBe(`${BASE}pe/pesquisa-e-inovacao`)
    expect(urlNovaDeAntiga('?view=comparar&area=10&uf=PE&pares=RN,PB')).toBe(`${BASE}comparar?area=10&ufs=pe,rn,pb&indicador=orcamento`)
    expect(urlNovaDeAntiga('?view=comparar&area=10')).toBe(`${BASE}indicadores/orcamento?area=10`)
    expect(urlNovaDeAntiga('?view=metodo&nivel=tecnico', '#limite-ideb-2021')).toBe(`${BASE}metodologia?nivel=tecnico#limite-ideb-2021`)
    expect(urlNovaDeAntiga('?uf=')).toBe(BASE)
  })
})

describe('componentes do cabeçalho', () => {
  it('barra principal: Estados e Indicadores com aria-expanded e aria-controls, item ativo com aria-current', () => {
    const naUf = html(<Header rota={lerRota(`${BASE}sp/pib`)} onIr={() => {}} />)
    expect(naUf).toContain('aria-label="Principal"')
    expect(naUf).toMatch(/id="menu-estados-botao" aria-expanded="false" aria-controls="menu-estados-painel" aria-current="page"/)
    expect(naUf).toMatch(/id="menu-indicadores-botao" aria-expanded="false" aria-controls="menu-indicadores-painel"(?! aria-current)/)
    expect(naUf).toContain('aria-label="Mudar para o tema escuro"')
    expect(naUf).toContain('role="combobox"')
    const nacional = html(<Header rota={lerRota(`${BASE}indicadores/pib`)} onIr={() => {}} />)
    expect(nacional).toMatch(/id="menu-indicadores-botao" aria-expanded="false" aria-controls="menu-indicadores-painel" aria-current="page"/)
    expect(html(<Header rota={{ tipo: 'metodologia' }} onIr={() => {}} />)).toMatch(/href="[^"]*metodologia" aria-current="page">Metodologia/)
  })

  it('mega-menu: colunas por eixo; indicador indisponível esmaecido, com "em breve", sem link', () => {
    const grupos = [{ eixo: { slug: 'social', nome: 'Social' }, indicadores: [
      INDICADORES.find((i) => i.slug === 'educacao'),
      { slug: 'saude', nome: 'Saúde', eixo: 'social', descricaoCurta: 'Indicadores de saúde', disponivel: false },
    ] }]
    const menu = html(<MegaMenuIndicadores grupos={grupos} />)
    expect(menu).toContain(`href="${caminhoIndicador(indicadorPorSlug('educacao'))}"`)
    expect(menu).toContain('aria-disabled="true"')
    expect(menu).toContain('em breve')
    expect(menu).not.toContain(`${BASE}indicadores/saude`)
  })

  it('subcabeçalho da UF: abas mantêm a UF, aba ativa pela rota, seletor com a UF atual', () => {
    const sub = html(<SubheaderUF uf={sp} indicador={pib} onIr={() => {}} />)
    expect(sub).toContain(`href="${caminhoUf(sp)}">Visão geral`)
    expect(sub).toContain(`href="${caminhoUf(sp, pib)}" aria-current="page">PIB`)
    for (const i of INDICADORES) expect(sub).toContain(`href="${caminhoUf(sp, i)}"`)
    expect(sub).toMatch(/<option value="sp" selected="">São Paulo<\/option>/)
    expect(sub).toContain('aria-label="Indicadores de São Paulo"')
  })

  it('gaveta do celular: diálogo com Estados por região, Indicadores por eixo, Comparar e Metodologia', () => {
    expect(html(<DrawerMobile aberto={false} rota={{ tipo: 'inicio' }} onFechar={() => {}} />)).toBe('')
    const g = html(<DrawerMobile aberto rota={lerRota(`${BASE}ba`)} onFechar={() => {}} />)
    expect(g).toContain('role="dialog" aria-modal="true"')
    for (const r of REGIOES) expect(g).toContain(`<summary>${r}</summary>`)
    for (const e of INDICADORES_POR_EIXO) expect(g).toContain(e.eixo.nome)
    expect(g).toMatch(/Comparar<\/a>/)
    expect(g).toContain(`href="${caminhoUf(ufPorSlug('ba'))}" aria-current="page"`)
  })
})

describe('páginas novas', () => {
  const dados = dadosDoSite()
  it('início: as duas entradas (estados por região e indicadores por eixo)', () => {
    const inicio = html(<Inicio />)
    for (const u of UFS) expect(inicio).toContain(`href="${caminhoUf(u)}"`)
    for (const i of INDICADORES) expect(inicio).toContain(`href="${caminhoIndicador(i)}"`)
  })

  it('painel do estado: um cartão por indicador, com o número principal, para as 27 UFs', () => {
    const pibJson = lerArquivo('pib.json')
    const ibid = lerArquivo('ibid.json')
    const ideb = lerArquivo('ideb.json')
    const violencia = lerArquivo('violencia.json')
    for (const uf of UFS) {
      const painel = html(<PainelUF dados={dados} uf={uf} pib={pibJson} ibid={ibid} ideb={ideb} violencia={violencia} />)
      expect(painel, uf.sigla).toContain(`${uf.nome}: visão geral`)
      for (const i of INDICADORES) expect(painel, `${uf.sigla} ${i.slug}`).toContain(`href="${caminhoUf(uf, i)}"`)
      expect(painel, uf.sigla).not.toContain('Carregando')
    }
    expect(html(<PainelUF dados={dados} uf={sp} />)).toContain('Carregando')  // PIB, IBID, IDEB e violência ainda chegando
    expect(html(<PainelUF dados={dados} uf={sp} pib={pibJson} ibid={ibid} ideb={ideb} violencia={violencia} />)).toContain('Ver o PIB de São Paulo')
  })
})

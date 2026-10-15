// Teste de fumaça: as duas telas renderizam com os dados publicados (public/data/), sem erro.
// Não confere contas (isso é do calculos.test.js); confere que os textos esperados aparecem.
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { dadosDaUf, dadosDoSite, lerArquivo } from './testes/publicados.js'

import { JANELAS_IDEB, JANELAS_TENDENCIA } from './calculos.js'
import { lerEstado } from './estado.js'
import Comparar from './telas/Comparar.jsx'
import Educacao from './telas/Educacao.jsx'
import PesquisaInovacao from './telas/PesquisaInovacao.jsx'
import PibEstados from './telas/PibEstados.jsx'
import PorEstado from './telas/PorEstado.jsx'

const dados = dadosDoSite()
const presentes = new Set(dados.despesa.filter((l) => l.nivel === 'funcao').map((l) => l.funcao_cod))
const funcoes = dados.dicionarios.funcoes.filter((f) => presentes.has(f.funcao_cod))
const contexto = {
  ufs: dados.dicionarios.ufs, anos: dados.meta.anos, areas: funcoes.map((f) => f.funcao_cod), areaPadrao: '10', anosPib: dados.meta.pib.anos,
  janelas: JANELAS_TENDENCIA.map((j) => j.id), anosIbid: dados.meta.ibid.anos,
  ideb: dados.meta.ideb, janelasIdeb: JANELAS_IDEB.map((j) => j.id),
}
const tela = (Tela, busca) => {
  const estado = lerEstado(busca, contexto)
  return renderToString(<Tela dados={dados} estado={estado} mudar={() => {}} funcoes={funcoes} dadosUf={estado.uf ? dadosDaUf(estado.uf) : undefined} />)
}

describe('telas renderizam com os dados publicados', () => {
  it('Comparar, com e sem estado em destaque', () => {
    expect(tela(Comparar, '')).toContain('Comparar estados')
    const sp = tela(Comparar, '?area=26&uf=SP&ano=2024')
    expect(sp).toContain('Metrô')  // aviso de quebra de série
  })

  it('Por estado: sem estado escolhido pede um estado', () => {
    expect(tela(PorEstado, '?view=estado')).toContain('Escolha um estado')
  })

  it('Por estado: título, resumo, composição, série, tabela e estatais', { timeout: 120000 }, () => {
    const pe = tela(PorEstado, '?view=estado&uf=PE&ano=2024')
    expect(pe).toContain('As contas de Pernambuco')
    expect(pe).toContain('Despesa total em 2024')
    expect(pe).toContain('/27')  // selo de posição
    expect(pe).toContain('Baixar CSV')
    expect(pe).toContain('Estatais não dependentes')
    expect(pe).toContain('COMPESA')
    expect(pe).toContain('https://tesouro.github.io/empresas-estados/v2025/')
    expect(tela(PorEstado, '?view=estado&uf=RJ&ano=2020')).toContain('As contas do Rio de Janeiro')
  })

  it('Por estado: quatro partes na ordem receitas, despesas, dívidas, estatais, com âncoras', () => {
    const pe = tela(PorEstado, '?view=estado&uf=PE&ano=2024')
    const ids = ['receitas', 'despesas', 'dividas', 'estatais']
    for (const id of ids) {
      expect(pe).toContain(`href="#${id}"`)
      expect(pe).toContain(`id="${id}"`)
    }
    const posicoes = ids.map((id) => pe.indexOf(`id="${id}"`))
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes)
    expect(pe).toContain('Parte 4')
    expect(pe).toContain('Além do orçamento, o estado controla empresas.')
    expect(pe.indexOf('Estatais não dependentes')).toBeGreaterThan(pe.indexOf('id="estatais"'))
  })

  it('Por estado: Parte 1, receitas: resumo, composição, destino dos impostos, série, tabela e ressalvas', () => {
    const pe = tela(PorEstado, '?view=estado&uf=PE&ano=2024')
    expect(pe).toContain('De onde vem o dinheiro')
    expect(pe).toContain('De impostos próprios')
    expect(pe).toContain('Para onde vão os impostos')
    expect(pe).toContain('ficou com o estado')
    expect(pe).toContain('para o FUNDEB')
    expect(pe).toMatch(/Em 2024, a (receita|despesa) de PE/)
    expect(pe).toContain('Códigos novos a partir de 2022')
    expect(pe).toContain('Lei Complementar nº 194')
    expect(pe).toContain('Empréstimo não é arrecadação')
    expect(pe).not.toContain('Petróleo separado até 2017; não separado a partir de 2018')
    const rj = tela(PorEstado, '?view=estado&uf=RJ&ano=2024&treceita=pct')
    expect(rj).toContain('Petróleo separado até 2017; não separado a partir de 2018') // ressalva só do RJ (e do DF)
    expect(tela(PorEstado, '?view=estado&uf=MG&ano=2022')).toContain('Petróleo não localizado em 2022')
    expect(tela(PorEstado, '?view=estado&uf=MG&ano=2024')).not.toContain('Petróleo não localizado em 2022')
    expect(rj).toContain('% da receita líquida sem intraorçamentárias')
  })

  it('Por estado: subáreas só das áreas abertas na URL, com "Demais subfunções" e a nota de soma', () => {
    const fechada = tela(PorEstado, '?view=estado&uf=PE&ano=2024')
    expect(fechada).not.toContain('soma das subáreas')
    expect(fechada).toContain('aria-expanded="false"')
    const aberta = tela(PorEstado, '?view=estado&uf=PE&ano=2024&abrir=10,12&tabela=pct_total')
    expect(aberta.match(/soma das subáreas = total da área/g)).toHaveLength(2)
    expect(aberta).toContain('Demais subfunções')
    expect(aberta).toContain('Assistência Hospitalar e Ambulatorial')
    expect(aberta).toContain('o % também é sobre o orçamento total')
  })

  it('Por estado: Parte 3, as dívidas, com âncora, resumo, limites, composição, comparação e ressalvas', () => {
    const rj = tela(PorEstado, '?view=estado&uf=RJ&ano=2024')
    expect(rj).toContain('href="#dividas"')
    expect(rj).toContain('As dívidas do estado')
    expect(rj.indexOf('id="dividas"')).toBeLessThan(rj.indexOf('id="estatais"'))
    expect(rj).toContain('limite 200%')
    expect(rj).toContain('Reestruturação (com a União)')
    expect(rj).toContain('O relatório separa a dívida por tipo, não por credor.')
    expect(rj).toMatch(/Em 2024, o RJ pagou R\$ [\d,]+ bi em juros e amortização da dívida, contra R\$ [\d,]+ bi em saúde/)
    expect(rj).toContain('Pagar pouco não é dever pouco')
    expect(rj).toContain('2020: pagamentos à União suspensos')
    expect(rj).toContain('Previdência fora da conta')
    expect(rj).toContain('A dívida do RJ')
  })

  it('Por estado: petróleo e gás com DCA e ANP; RJ reconcilia em 2024, não em 2021, e 2025 é parcial', () => {
    const sp = tela(PorEstado, '?view=estado&uf=SP&ano=2024')
    expect(sp).toContain('Petróleo e gás — prestação de contas (DCA')
    expect(sp).toContain('Royalties repassados ao estado — ANP')
    expect(sp).not.toContain('dos quais')
    expect(tela(PorEstado, '?view=estado&uf=RJ&ano=2024&valores=epoca')).toMatch(/Demais receitas patrimoniais: R\$ 25,9 bi, dos quais R\$ 25,6 bi são royalties/)
    expect(tela(PorEstado, '?view=estado&uf=RJ&ano=2021')).toContain('não se reconciliam neste ano')
    const rj25 = tela(PorEstado, '?view=estado&uf=RJ&ano=2025')
    expect(rj25).toContain('não há total para comparar')
    expect(rj25).toContain('2025: só royalties (parcial')
  })

  it('Por estado: ressalva da outorga da Cedae só no RJ, de 2021 a 2025', () => {
    for (const ano of [2021, 2024]) expect(tela(PorEstado, `?view=estado&uf=RJ&ano=${ano}`)).toContain('concessão da Cedae')
    expect(tela(PorEstado, '?view=estado&uf=RJ&ano=2020')).not.toContain('concessão da Cedae')
    expect(tela(PorEstado, '?view=estado&uf=SP&ano=2024')).not.toContain('concessão da Cedae')
  })

  it('Por estado: área escolhida, valores da época e tabela em % ', () => {
    const html = tela(PorEstado, '?view=estado&uf=PI&ano=2024&area=25&valores=epoca&tabela=pct_total')
    expect(html).toContain('Gaspisa')  // quebra de série na área escolhida
    expect(html).toContain('em R$ da época')
    expect(html).toContain('% do orçamento estadual (não muda com a inflação)')
  })

  it('Por estado: cada ano usa a edição do exercício (Sabesp em SP de 2019 a 2023, não em 2024); sem edição, sem informação', { timeout: 300000 }, () => {
    const SEM = 'Sem informação de estatais para este ano.'
    for (const ano of [2019, 2020, 2021, 2022, 2023]) expect(tela(PorEstado, `?view=estado&uf=SP&ano=${ano}`), String(ano)).toContain('SABESP')
    expect(tela(PorEstado, '?view=estado&uf=SP&ano=2024')).not.toContain('SABESP')
    const antes = tela(PorEstado, '?view=estado&uf=SP&ano=2018')
    expect(antes).not.toContain('SABESP')
    expect(antes).toContain(SEM)
    // UF ausente da edição: AP em 2019 e 2020, MA em 2019 (empresas sem CNPJ)
    expect(tela(PorEstado, '?view=estado&uf=AP&ano=2020')).toContain(SEM)
    expect(tela(PorEstado, '?view=estado&uf=MA&ano=2019')).toContain(SEM)
    expect(tela(PorEstado, '?view=estado&uf=AP&ano=2021')).not.toContain(SEM)
  })

  it('Por estado: setor e situação herdados marcados (†) na edição do exercício 2019', () => {
    const html = tela(PorEstado, '?view=estado&uf=SP&ano=2019')
    expect(html).toContain('class="herdado"')
    expect(html).toContain('Setor e situação vêm da edição do exercício')
    expect(tela(PorEstado, '?view=estado&uf=SP&ano=2021')).not.toContain('class="herdado"')
  })

  it('Por estado: sem os dados da UF, avisa que está carregando (nada de conta pela metade)', () => {
    const estado = lerEstado('?view=estado&uf=RJ', contexto)
    const html = renderToString(<PorEstado dados={dados} estado={estado} mudar={() => {}} funcoes={funcoes} />)
    expect(html).toContain('Carregando os dados do estado')
    expect(html).not.toContain('id="receitas"')
  })
})

describe('PIB dos Estados', () => {
  const pib = lerArquivo('pib.json')
  const telaPib = (busca, { comPib = true, comUf = true } = {}) => {
    const estado = lerEstado(busca, contexto)
    return renderToString(<PibEstados dados={dados} estado={estado} mudar={() => {}}
      pib={comPib ? pib : null} pibUf={comUf && estado.uf ? lerArquivo(`pib/${estado.uf}.json`) : undefined} />)
      .replaceAll('<!-- -->', '')
  }

  it('sem pib.json, avisa que está carregando; sem estado, mostra o ranking e pede um estado', () => {
    expect(telaPib('?view=pib&uf=RJ', { comPib: false })).toContain('Carregando os dados do PIB')
    const sem = telaPib('?view=pib&uf=')
    expect(sem).toContain('Escolha um estado')
    expect(sem).toContain('SP · São Paulo')
  })

  it('resumo, frase, setores no ano e na série, crescimento, participação, tabela e ressalvas', () => {
    const rj = telaPib('?view=pib&uf=RJ&pano=2023')
    expect(rj).toContain('O PIB do Rio de Janeiro')
    expect(rj).toContain('PIB em 2023')
    expect(rj).toMatch(/Em 2023, o RJ respondeu por [\d,]+% do PIB do país, a 2ª maior economia entre 27 estados/)
    expect(rj).toContain('O peso de cada setor na economia do RJ')
    expect(rj).toContain('2002–2023')  // série histórica dos setores
    expect(rj).toContain('Indústrias extrativas')
    expect(rj).toContain('Crescimento da economia, 2015–2023')  // desde padrão: primeiro ano do orçamento
    expect(rj).toContain('Todos os estados, 2023')
    expect(rj).toContain('As atividades da economia do RJ')
    expect(rj).toContain('Baixar CSV')
    for (const r of pib.ressalvas) expect(rj).toContain(r.titulo)
    expect(rj).toContain('href="?view=metodo#')
  })

  it('tendência: Indústria de transformação por padrão, quatro cards, linhas da tabela clicáveis (menos o total)', () => {
    const rj = telaPib('?view=pib&uf=RJ&pano=2023')
    expect(rj).toContain('Tendência: Indústria de transformação do RJ')
    for (const rotulo of ['Últimos 3 anos · 2020–2023', 'Últimos 5 anos · 2018–2023', 'Últimos 10 anos · 2013–2023', 'Série completa · 2002–2023']) {
      expect(rj).toContain(rotulo)
    }
    expect(rj).toMatch(/ao ano/)
    expect(rj).toContain('Ver os detalhes estatísticos')
    expect(rj).toContain('href="?view=metodo#calculo-tendencia"')
    expect(rj.match(/class="escolher-linha"/g)).toHaveLength(12)
    expect(rj).toContain('aria-pressed="true">Indústrias de transformação')
    // outra atividade e outra janela pela URL
    const ext = telaPib('?view=pib&uf=RJ&ativ=03&jan=5')
    expect(ext).toContain('Tendência: Indústrias extrativas do RJ')
    expect(ext).toMatch(/tendência 2018–2023:/)
    // código inexistente volta à padrão
    expect(telaPib('?view=pib&uf=RJ&ativ=99')).toContain('Tendência: Indústria de transformação do RJ')
  })

  it('tendência com dados problemáticos (AC, extrativas: VAB ≤ 0 em 2013 e 2022) avisa os anos excluídos', () => {
    const ac = telaPib('?view=pib&uf=AC&ativ=03')
    expect(ac).toContain('fora da conta')
    expect(ac).toContain('2022 (valor zero ou negativo')
  })

  it('ano inicial, ano e tabela em valor vindos da URL; atividades ainda carregando', () => {
    const html = telaPib('?view=pib&uf=AC&pano=2010&desde=2002&tpib=valor')
    expect(html).toContain('Crescimento 2002–2010')
    expect(html).toContain('Crescimento da economia, 2002–2023')
    expect(html).toContain('Valor adicionado, em R$ da época.')
    expect(telaPib('?view=pib&uf=AC', { comUf: false })).toContain('Carregando as atividades do estado')
  })
})

describe('Pesquisa e Inovação', () => {
  const ibid = lerArquivo('ibid.json')
  const ensinoSuperior = lerArquivo('despesa_ensino_superior.json')
  const telaIbid = (busca, { comIbid = true, meta = dados.meta } = {}) => renderToString(
    <PesquisaInovacao dados={{ ...dados, meta }} estado={lerEstado(busca, contexto)} mudar={() => {}}
      ibid={comIbid ? ibid : null} ensinoSuperior={comIbid ? ensinoSuperior : null} />,
  ).replaceAll('<!-- -->', '')
  /** Rótulos visíveis da dispersão (texto dentro dos grupos de ponto). */
  const rotulosDaDispersao = (html) => [...html.matchAll(/<g class="ponto [^"]*">(.*?)<\/g>/g)]
    .map((m) => m[1].match(/<text[^>]*>([A-Z]{2})<\/text>/)?.[1]).filter(Boolean).sort()

  it('sem ibid.json, avisa que está carregando; sem estado, mostra o ranking, a dispersão e pede um estado', () => {
    expect(telaIbid('?view=inovacao&uf=RJ', { comIbid: false })).toContain('Carregando os dados do IBID')
    const sem = telaIbid('?view=inovacao&uf=')
    expect(sem).toContain('Escolha um estado')
    expect(sem).toContain('Ranking das 27 UFs, 2025')
    expect(sem).toContain('Contexto × Resultado, 2025')
    expect(sem).not.toContain('Os sete pilares')
  })

  it('as sete partes, na ordem pedida, com a UF destacada e a fonte', () => {
    const rj = telaIbid('?view=inovacao&uf=RJ')
    const partes = ['O Índice Brasil de Inovação e Desenvolvimento', 'Ranking das 27 UFs, 2025', 'Evolução da posição no ranking, 2014–2025',
      'Os sete pilares do RJ, 2025', 'Contexto × Resultado, 2025', 'Gasto do estado em pesquisa e posição no IBID', ibid.fonte.arquivo_sha256]
    const posicoes = partes.map((p) => rj.indexOf(p))
    expect(posicoes.every((p) => p >= 0), partes.filter((_, i) => posicoes[i] < 0).join(' | ')).toBe(true)
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes)
    expect(rj).toContain('<tr class="destaque"><td>4º</td><td class="estado">RJ · Rio de Janeiro</td>')
    expect(rj).toMatch(/Rio de Janeiro está em 4º lugar em 2025; em 2014, estava em 2º/)
    expect(rj).toContain('Sudeste (escore da região, INPI)')
    expect(rj).toContain('Estado típico (mediana das UFs, calculada pelo Observatório)')
    expect(rj).toContain('estar abaixo do Brasil não significa estar abaixo da maioria dos estados')
    expect(rj).toContain('C&amp;T + Ensino Superior: por habitante')
    expect(rj).toContain('Ensino Superior: % do orçamento')
    expect(rj).toContain('Posição em C&amp;T + Ensino Superior por habitante')
    expect(rj).toContain(ibid.fonte.url)
    for (const r of dados.meta.ibid.ressalvas) expect(rj).toContain(r.titulo)
  })

  it('regra de método: com escores não comparáveis, evolução só por posição, sem escolha de escore', () => {
    expect(dados.meta.ibid.escores_comparaveis_entre_anos).toBe(false)
    const rj = telaIbid('?view=inovacao&uf=RJ&ievo=escore')  // a URL pede escore; a configuração não deixa
    expect(rj).toContain('Evolução da posição no ranking')
    expect(rj).not.toContain('Medida da evolução')
    expect(rj).toContain('Escores só se comparam dentro do mesmo ano')
    // liberada a configuração (um único ponto: meta.json → ibid, de config/ibid.yaml), a série de escores aparece
    const liberado = { ...dados.meta, ibid: { ...dados.meta.ibid, escores_comparaveis_entre_anos: true, ressalvas: dados.meta.ibid.ressalvas.filter((r) => r.id !== 'ibid_escores_entre_anos') } }
    const comEscore = telaIbid('?view=inovacao&uf=RJ&ievo=escore', { meta: liberado })
    expect(comEscore).toContain('Evolução do escore')
    expect(comEscore).toContain('aria-label="Medida da evolução"')
  })

  it('ano sem despesa estadual (2014): avisa e mantém a série dos anos comuns', () => {
    const html = telaIbid('?view=inovacao&uf=SP&iano=2014')
    expect(html).toContain('Ranking das 27 UFs, 2014')
    expect(html).toContain('Não há despesa estadual para 2014')
    expect(html).toMatch(/gasto em pesquisa e IBID, 2015–2025/)
  })

  it('dispersão: rótulo só na UF destacada e nas comparadas; os outros pontos só com dica', () => {
    expect(rotulosDaDispersao(telaIbid('?view=inovacao&uf=RJ'))).toEqual(['ES', 'MG', 'RJ', 'SP'])
    expect(rotulosDaDispersao(telaIbid('?view=inovacao&uf=RJ&pares=AC'))).toEqual(['AC', 'RJ'])
    expect(rotulosDaDispersao(telaIbid('?view=inovacao&uf='))).toEqual([])
    expect(telaIbid('?view=inovacao&uf=RJ').match(/class="alvo"/g)).toHaveLength(27)  // todos tocáveis
  })

  it('Ensino Superior ausente vira zero marcado (SE não declara a 364 em 2015–2024; RO em toda a série)', () => {
    const se = telaIbid('?view=inovacao&uf=SE&iano=2020')
    expect(se).toMatch(/Sem Ensino Superior \(364\) declarado em 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024: entra como zero/)
    expect(se).toContain('sem Ensino Superior (364) declarado')
    expect(telaIbid('?view=inovacao&uf=SP&iano=2025')).not.toContain('Sem Ensino Superior (364) declarado em')
  })

  it('funciona com qualquer UF selecionada (27), com e sem estados para comparar', () => {
    for (const { uf, nome } of dados.dicionarios.ufs) {
      const html = telaIbid(`?view=inovacao&uf=${uf}`)
      expect(html, uf).toContain(`Os sete pilares`)
      expect(html, uf).toContain(`${uf} · ${nome}`)
      expect(html, uf).toContain(`está em ${ibid.ufs[uf].ranking.geral['2025']}º lugar em 2025`)
      expect(telaIbid(`?view=inovacao&uf=${uf}&pares=`), uf).toContain('Os sete pilares')
    }
  })
})

describe('Educação (IDEB)', () => {
  const ideb = lerArquivo('ideb.json')
  const telaIdeb = (busca, { comIdeb = true, comUf = true } = {}) => {
    const estado = lerEstado(busca, contexto)
    return renderToString(<Educacao dados={dados} estado={estado} mudar={() => {}} ideb={comIdeb ? ideb : null}
      idebUf={comUf && estado.uf ? lerArquivo(`ideb/${estado.uf}.json`) : undefined} />).replaceAll('<!-- -->', '')
  }

  it('sem ideb.json, avisa; sem estado, mostra o ranking e pede um estado; abre no ensino médio, rede estadual', () => {
    expect(telaIdeb('?view=educacao&uf=RS', { comIdeb: false })).toContain('Carregando os dados do IDEB')
    const sem = telaIdeb('?view=educacao&uf=')
    expect(sem).toContain('Escolha um estado')
    expect(sem).toContain('IDEB das 27 UFs em 2025: ensino médio, rede estadual')
  })

  it('resumo, frase, série, tendência, ranking, aprovação por série, Saeb, ressalvas e fonte (RS, valores de controle)', () => {
    const rs = telaIdeb('?view=educacao&uf=RS')
    for (const texto of ['A educação do Rio Grande do Sul', 'IDEB em 2025', 'Variação sobre 2023', 'IDEB, 2005–2025',
      'Tendência do IDEB do RS', 'Aprovação por série em 2025', 'Notas do Saeb, 2005–2025', 'Antes de comparar', ideb.fonte.arquivos[0].sha256]) {
      expect(rs, texto).toContain(texto)
    }
    expect(rs).toMatch(/Em 2025, o IDEB do ensino médio na rede estadual do RS foi 4,7, o \d+º maior entre 27 estados \(Brasil: [\d,]+\)\. Em 2023, era 3,9: subiu 0,8 ponto\./)
    expect(rs).toContain('<tr class="destaque">')
    expect(rs).toContain('1ª série')
    expect(rs).toContain('Ensino médio: Saeb amostral até 2017')
    expect(rs).toContain('2021: pandemia')
    expect(rs).toContain('href="?view=metodo#limite-ideb-2021"')
    expect(rs).not.toContain('Rede estadual nos anos iniciais')  // ressalva só dos anos iniciais
    expect(telaIdeb('?view=educacao&uf=RS&etapa=anos_iniciais')).toMatch(/foi 6,4/)
    expect(telaIdeb('?view=educacao&uf=RS&etapa=anos_finais')).toMatch(/foi 5,4/)
  })

  it('rede que a etapa não tem (pública no ensino médio): avisa em vez de mostrar números', () => {
    const html = telaIdeb('?view=educacao&uf=RS&erede=publica')
    expect(html).toContain('não traz a rede pública do ensino médio por estado')
    expect(html).not.toContain('IDEB das 27 UFs')
  })

  it('lacuna real: RR, rede estadual, anos iniciais, sem IDEB desde 2017; DF com a nota da rede distrital', () => {
    const rr = telaIdeb('?view=educacao&uf=RR&etapa=anos_iniciais')
    expect(rr).toContain('sem IDEB neste ano')
    expect(rr).toContain('Rede estadual nos anos iniciais')
    expect(telaIdeb('?view=educacao&uf=DF')).toContain('Rede distrital')
  })

  it('funciona com qualquer UF (27), nas três etapas, com o arquivo da UF ainda carregando', { timeout: 300000 }, () => {
    for (const { uf, nome } of dados.dicionarios.ufs) {
      for (const etapa of ['anos_iniciais', 'anos_finais', 'medio']) {
        const html = telaIdeb(`?view=educacao&uf=${uf}&etapa=${etapa}`)
        expect(html, `${uf} ${etapa}`).toContain(`${uf} · ${nome}`)
        expect(html, `${uf} ${etapa}`).toContain('Tendência do IDEB')
      }
      expect(telaIdeb(`?view=educacao&uf=${uf}`, { comUf: false }), uf).toContain('Carregando a aprovação por série')
    }
  })
})

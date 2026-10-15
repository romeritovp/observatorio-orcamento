import { describe, expect, it } from 'vitest'

import { escreverEstado, lerEstado, paresPadrao } from './estado.js'
import { csv, iniciaisMaiusculas, listaDeAnos, nomeEmpresa, nomeParaExibir, pct, pctComSinal, reais, reaisCompacto } from './formatacao.js'
import { artigoEmpresa, artigoSigla, avisoEstatal, deUf, doEstado, fraseDivida, fraseReconciliacaoPetroleo, fraseResultado, frasePib, avisoQuebraSerie, emUf, fonteDasQuebras, fraseResumo, notaSemGasto, porUf, sujeito } from './textos.js'

const UFS = [
  { uf: 'AA', regiao: 'Norte' }, { uf: 'BB', regiao: 'Norte' },
  { uf: 'CC', regiao: 'Norte' }, { uf: 'DD', regiao: 'Sul' },
]
const CONTEXTO = { ufs: UFS, anos: [2023, 2024], areas: ['10', '12'], areaPadrao: '10' }

describe('estado na URL', () => {
  it('padrões quando a URL está vazia', () => {
    expect(lerEstado('', CONTEXTO)).toEqual({
      view: 'estado', area: '10', areaExplicita: false, metrica: 'per_capita', valores: 'corrigidos', ano: 2024,
      uf: null, pares: [], paresPersonalizados: false, tabela: 'per_capita', abertas: [], tabelaReceita: 'liquida', nivel: 'simples',
      anoPib: null, desdePib: null, desdePadrao: null, tabelaPib: 'pct', atividadePib: '04', janelaPib: 'tudo',
      anoIbid: null, evolucaoIbid: 'posicao',
      anoIdeb: null, etapaIdeb: null, redeIdeb: null, janelaIdeb: 'tudo', padroesIdeb: { etapa: null, rede: null },
    })
  })

  it('PIB dos Estados: anos próprios (pano, desde), tabela (tpib), gravados só nessa tela', () => {
    const comPib = { ...CONTEXTO, anosPib: [2020, 2021, 2022, 2023] }
    expect(lerEstado('?view=pib', comPib)).toMatchObject({ view: 'pib', anoPib: 2023, desdePib: 2020, tabelaPib: 'pct' })
    // desde padrão: primeiro ano do orçamento quando há PIB nele
    expect(lerEstado('?view=pib', { ...comPib, anos: [2021, 2022, 2024] }).desdePib).toBe(2021)
    const estado = lerEstado('?view=pib&uf=aa&pano=2021&desde=2022&tpib=valor', comPib)
    expect(estado).toMatchObject({ uf: 'AA', anoPib: 2021, desdePib: 2022, tabelaPib: 'valor' })
    expect(escreverEstado(estado)).toBe('?view=pib&metrica=per_capita&ano=2024&uf=AA&pano=2021&desde=2022&tpib=valor')
    expect(lerEstado(escreverEstado(estado), comPib)).toEqual(estado)
    // inválidos: ano fora da série, desde no último ano (não há crescimento a medir), tabela desconhecida
    expect(lerEstado('?view=pib&pano=1990&desde=2023&tpib=x', comPib)).toMatchObject({ anoPib: 2023, desdePib: 2020, tabelaPib: 'pct' })
    expect(escreverEstado(lerEstado('?view=pib', comPib))).not.toContain('desde=')
    expect(escreverEstado({ ...estado, view: 'estado' })).not.toMatch(/pano|desde|tpib/)
  })

  it('Educação: ano, etapa, rede e janela do IDEB, padrões do meta.json, gravados só nessa tela', () => {
    const ideb = { anos: [2021, 2023, 2025], etapas: ['anos_iniciais', 'medio'], redes: ['estadual', 'total'], etapa_padrao: 'medio', rede_padrao: 'estadual' }
    const comIdeb = { ...CONTEXTO, ideb, janelasIdeb: ['6', '10', 'tudo'] }
    expect(lerEstado('?view=educacao', comIdeb)).toMatchObject({ view: 'educacao', anoIdeb: 2025, etapaIdeb: 'medio', redeIdeb: 'estadual', janelaIdeb: 'tudo' })
    const estado = lerEstado('?view=educacao&uf=aa&eano=2021&etapa=anos_iniciais&erede=total&ejan=6', comIdeb)
    expect(estado).toMatchObject({ uf: 'AA', anoIdeb: 2021, etapaIdeb: 'anos_iniciais', redeIdeb: 'total', janelaIdeb: '6' })
    expect(escreverEstado(estado)).toContain('eano=2021&etapa=anos_iniciais&erede=total&ejan=6')
    expect(lerEstado(escreverEstado(estado), comIdeb)).toEqual(estado)
    expect(lerEstado('?view=educacao&eano=2020&etapa=x&erede=municipal&ejan=3', comIdeb))
      .toMatchObject({ anoIdeb: 2025, etapaIdeb: 'medio', redeIdeb: 'estadual', janelaIdeb: 'tudo' })
    expect(escreverEstado(lerEstado('?view=educacao', comIdeb))).not.toMatch(/etapa=|erede=|ejan=/)  // padrões fora da URL
    expect(escreverEstado({ ...estado, view: 'estado' })).not.toMatch(/eano|etapa|erede|ejan/)
  })

  it('Pesquisa e Inovação: ano do IBID (iano, padrão o último) e medida da evolução (ievo), só nessa tela', () => {
    const comIbid = { ...CONTEXTO, anosIbid: [2014, 2015, 2025] }
    expect(lerEstado('?view=inovacao', comIbid)).toMatchObject({ view: 'inovacao', anoIbid: 2025, evolucaoIbid: 'posicao' })
    const estado = lerEstado('?view=inovacao&uf=aa&iano=2014&ievo=escore', comIbid)
    expect(estado).toMatchObject({ uf: 'AA', anoIbid: 2014, evolucaoIbid: 'escore' })
    expect(escreverEstado(estado)).toContain('iano=2014&ievo=escore')
    expect(lerEstado(escreverEstado(estado), comIbid)).toEqual(estado)
    expect(lerEstado('?view=inovacao&iano=1999&ievo=x', comIbid)).toMatchObject({ anoIbid: 2025, evolucaoIbid: 'posicao' })
    expect(escreverEstado({ ...estado, view: 'estado' })).not.toMatch(/iano|ievo/)
  })

  it('PIB dos Estados: atividade da tendência (ativ, padrão 04) e janela do gráfico (jan)', () => {
    const comPib = { ...CONTEXTO, anosPib: [2020, 2021, 2022, 2023], janelas: ['3', '5', '10', 'tudo'] }
    expect(lerEstado('?view=pib', comPib)).toMatchObject({ atividadePib: '04', janelaPib: 'tudo' })
    const estado = lerEstado('?view=pib&ativ=07&jan=5', comPib)
    expect(estado).toMatchObject({ atividadePib: '07', janelaPib: '5' })
    expect(escreverEstado(estado)).toContain('ativ=07&jan=5')
    expect(lerEstado(escreverEstado(estado), comPib)).toEqual(estado)
    // total (01), texto e janela desconhecida voltam ao padrão; o padrão não vai para a URL
    expect(lerEstado('?view=pib&ativ=01&jan=7', comPib)).toMatchObject({ atividadePib: '04', janelaPib: 'tudo' })
    expect(lerEstado('?view=pib&ativ=xx', comPib).atividadePib).toBe('04')
    expect(escreverEstado(lerEstado('?view=pib', comPib))).not.toMatch(/ativ|jan=/)
  })

  it('pares padrão: mesma região, sem o destaque', () => {
    expect(paresPadrao(UFS, 'BB')).toEqual(['AA', 'CC'])
    expect(lerEstado('?uf=bb', CONTEXTO).pares).toEqual(['AA', 'CC'])
  })

  it('valida valores e ignora o que não existe', () => {
    const estado = lerEstado('?area=99&metrica=x&ano=1990&uf=ZZ&pares=AA,ZZ,aa', CONTEXTO)
    expect(estado).toMatchObject({ area: '10', metrica: 'per_capita', ano: 2024, uf: null, pares: ['AA'] })
  })

  it('ida e volta pela URL', () => {
    const estado = lerEstado('?area=12&metrica=pct_total&valores=epoca&ano=2023&uf=DD&pares=AA,BB', CONTEXTO)
    expect(estado).toMatchObject({ area: '12', metrica: 'pct_total', valores: 'epoca', ano: 2023, uf: 'DD', pares: ['AA', 'BB'] })
    expect(escreverEstado(estado)).toBe('?area=12&metrica=pct_total&valores=epoca&ano=2023&uf=DD&pares=AA,BB')
    expect(lerEstado(escreverEstado(estado), CONTEXTO)).toEqual(estado)
  })

  it('valores da época vão na URL; corrigidos é o padrão', () => {
    expect(lerEstado('?valores=epoca', CONTEXTO).valores).toBe('epoca')
    expect(lerEstado('?valores=xyz', CONTEXTO).valores).toBe('corrigidos')
    expect(escreverEstado(lerEstado('?valores=epoca&uf=AA', CONTEXTO))).toContain('valores=epoca')
    expect(escreverEstado(lerEstado('?uf=AA', CONTEXTO))).not.toContain('valores')
  })

  it('view, área escolhida e tabela na URL', () => {
    const estado = lerEstado('?view=comparar&uf=aa&tabela=total', CONTEXTO)
    expect(estado).toMatchObject({ view: 'comparar', uf: 'AA', tabela: 'total', areaExplicita: false })
    expect(escreverEstado(estado)).toBe('?view=comparar&metrica=per_capita&ano=2024&uf=AA&tabela=total')
    expect(escreverEstado({ ...estado, view: 'estado' })).not.toContain('view=') // a padrão não vai na URL
    expect(lerEstado('?view=xyz&tabela=xyz', CONTEXTO)).toMatchObject({ view: 'estado', tabela: 'per_capita' })
    expect(escreverEstado(lerEstado('?area=12', CONTEXTO))).toContain('area=12')
    expect(escreverEstado(lerEstado('?area=99', CONTEXTO))).not.toContain('area')
  })

  it('áreas abertas na URL: válidas, sem repetição, na ordem', () => {
    const estado = lerEstado('?view=estado&uf=AA&abrir=12,99,10,12', CONTEXTO)
    expect(estado.abertas).toEqual(['12', '10'])
    expect(escreverEstado(estado)).toContain('abrir=12,10')
    expect(lerEstado(escreverEstado(estado), CONTEXTO)).toEqual(estado)
    expect(escreverEstado(lerEstado('?uf=AA', CONTEXTO))).not.toContain('abrir')
  })

  it('UF padrão vem do contexto (meta.json); uf= vazio é "nenhum estado"', () => {
    const comPadrao = { ...CONTEXTO, ufPadrao: 'DD' }
    expect(lerEstado('', comPadrao).uf).toBe('DD')
    expect(lerEstado('?uf=aa', comPadrao).uf).toBe('AA')
    expect(lerEstado('?uf=', comPadrao).uf).toBeNull()
    expect(lerEstado(escreverEstado(lerEstado('?uf=', comPadrao)), comPadrao).uf).toBeNull() // ida e volta
    expect(lerEstado('', { ...CONTEXTO, ufPadrao: 'ZZ' }).uf).toBeNull() // padrão inválido é ignorado
    expect(lerEstado('', CONTEXTO).uf).toBeNull()
  })

  it('métrica da tabela de receitas na URL', () => {
    expect(lerEstado('?treceita=pct', CONTEXTO).tabelaReceita).toBe('pct')
    expect(lerEstado('?treceita=xyz', CONTEXTO).tabelaReceita).toBe('liquida')
    expect(escreverEstado(lerEstado('?treceita=per_capita&uf=AA', CONTEXTO))).toContain('treceita=per_capita')
    expect(escreverEstado(lerEstado('?uf=AA', CONTEXTO))).not.toContain('treceita')
  })

  it('não grava pares padrão na URL', () => {
    expect(escreverEstado(lerEstado('?uf=AA', CONTEXTO))).not.toContain('pares')
  })
})

describe('textos e formatação', () => {
  it('frase do exemplo', () => {
    expect(fraseResumo({
      ano: 2025, uf: 'XX', artigo: 'o', area: 'Saúde', metrica: 'per_capita',
      valor: 645.56, posicao: 27, nUfs: 27, mediana: 992.71,
    })).toBe('Em 2025, o XX ficou em 27º entre 27 estados no gasto em saúde por habitante: R$ 646, contra a mediana de R$ 993.')
  })

  it('frase em % e sem artigo', () => {
    expect(fraseResumo({
      ano: 2024, uf: 'YY', artigo: null, area: 'Segurança Pública', metrica: 'pct_total',
      valor: 10.129, posicao: 3, nUfs: 27, mediana: 15.34,
    })).toBe('Em 2024, YY ficou em 3º entre 27 estados na parcela do orçamento gasta em segurança pública: 10,1%, contra a mediana de 15,3%.')
    expect(sujeito('ZZ', 'a')).toBe('a ZZ')
    expect([porUf('XX', 'o'), porUf('YY', 'a'), porUf('ZZ', null)]).toEqual(['pelo XX', 'pela YY', 'por ZZ'])
  })

  it('frase em valores da época e de UF sem gasto declarado', () => {
    const base = { ano: 2025, uf: 'XX', artigo: 'o', area: 'Saneamento', metrica: 'per_capita', posicao: 25, nUfs: 27, mediana: 12.4 }
    expect(fraseResumo({ ...base, valores: 'epoca', valor: 10 })).toBe(
      'Em 2025, o XX ficou em 25º entre 27 estados no gasto em saneamento por habitante, em valores da época: R$ 10, contra a mediana de R$ 12.')
    expect(fraseResumo({ ...base, valor: 0, semGasto: true })).toBe(
      'Em 2025, o XX não declarou gasto em saneamento e ficou em 25º entre 27 estados no gasto em saneamento por habitante: R$ 0, contra a mediana de R$ 12.')
    expect(fraseResumo({ ...base, metrica: 'pct_total', valores: 'epoca', valor: 1, mediana: 2 })).not.toContain('época')
  })

  it('nota dos estados sem gasto declarado', () => {
    expect(notaSemGasto([], 2025)).toBeNull()
    expect(notaSemGasto(['ZZ'], 2025)).toBe('1 estado não declarou gasto nesta área em 2025: ZZ.')
    expect(notaSemGasto(['YY', 'XX'], 2024)).toBe('2 estados não declararam gasto nesta área em 2024: XX, YY.')
  })

  it('reais compactos', () => {
    expect(reaisCompacto(1_234_000_000)).toBe('R$ 1,2 bi')
    expect(reaisCompacto(10_726_347_712)).toBe('R$ 10,7 bi')
    expect(reaisCompacto(850_300_000)).toBe('R$ 850 mi')
    expect(reaisCompacto(85_300_000, false)).toBe('85,3 mi')
    expect(reaisCompacto(0)).toBe('R$ 0')
  })

  it('formatação pt-BR', () => {
    expect(reais(992.71)).toBe('R$ 993')
    expect(reais(1234.5, true)).toBe('R$ 1.234,50')
    expect(pct(15.34)).toBe('15,3%')
    expect(pct(0.114)).toBe('0,11%')
    expect(pct(0)).toBe('0,0%')
    expect(pct(0.0012)).toBe('0,0012%')
    expect(reais(null)).toBe('–')
  })

  it('lista de anos em ordem, com "e" antes do último', () => {
    expect(listaDeAnos([2024, 2021, 2023, 2022])).toBe('2021, 2022, 2023 e 2024')
    expect(listaDeAnos([2023, 2024])).toBe('2023 e 2024')
    expect(listaDeAnos([2024])).toBe('2024')
  })

  it('CSV com ponto e vírgula, vírgula decimal e BOM', () => {
    expect(csv([['passo', 'valor'], ['real; ajustado', 1.5]])).toBe('﻿passo;valor\r\n"real; ajustado";1,5\r\n')
  })
})

describe('aviso de estatal', () => {
  it('"No", "Na" ou "Em" conforme o artigo da UF', () => {
    expect(emUf('RJ', 'o')).toBe('No RJ')
    expect(emUf('BA', 'a')).toBe('Na BA')
    expect(emUf('SP', '')).toBe('Em SP')
  })

  it('texto do aviso', () => {
    expect(avisoEstatal({ uf: 'RJ', artigo: 'o', sigla: 'CEDAE', empresa: 'Companhia Estadual de Águas e Esgotos' }))
      .toBe('No RJ, CEDAE (Companhia Estadual de Águas e Esgotos) atua nesta área como estatal não dependente: '
        + 'a operação dela não aparece nestas contas.')
  })
})

describe('nome de empresa para exibição', () => {
  const UFS_SIGLAS = ['PE', 'RJ', 'MS']

  it('tira o " - SIGLA" repetido do fim (sem olhar acento, aceitando /UF)', () => {
    expect(nomeEmpresa('Companhia Estadual de Águas e Esgotos - CEDAE', 'CEDAE')).toBe('Companhia Estadual de Águas e Esgotos')
    expect(nomeEmpresa('COMPANHIA DE ÁGUA E ESGOTO DE RONDÔNIA- CAERD', 'CAERD')).toBe('Companhia de Água e Esgoto de Rondônia')
    expect(nomeEmpresa('COMPANHIA DE TERMINAIS DO PIAUÍ - PORTO PIAUÍ', 'PORTO PIAUI')).toBe('Companhia de Terminais do Piauí')
    expect(nomeEmpresa('CENTRAIS DE ABASTECIMENTO S/A - CEASA/MS', 'CEASA', UFS_SIGLAS)).toBe('Centrais de Abastecimento S/A')
    // sigla no começo não é sufixo repetido
    expect(nomeEmpresa('SUAPE - COMPLEXO PORTUARIO', 'SUAPE')).toBe('SUAPE - Complexo Portuario')
  })

  it('maiúsculas viram iniciais maiúsculas; de/da/do/e minúsculas; siglas como estão', () => {
    expect(nomeEmpresa('COMPANHIA PERNAMBUCANA DE SANEAMENTO', 'COMPESA')).toBe('Companhia Pernambucana de Saneamento')
    expect(nomeEmpresa('IMPRENSA OFICIAL DO ESTADO DO RIO DE JANEIRO', 'IOERJ')).toBe('Imprensa Oficial do Estado do Rio de Janeiro')
    expect(nomeEmpresa('LABORATÓRIO FARMACÊUTICO DO ESTADO DE PE GOV. MIGUEL ARRAES S/A', 'LAFEPE', UFS_SIGLAS))
      .toBe('Laboratório Farmacêutico do Estado de PE Gov. Miguel Arraes S/A')
    expect(nomeEmpresa('AGUAS E ESGOTOS DO PIAUÍ SA', 'AGESPISA')).toBe('Aguas e Esgotos do Piauí SA')
    expect(nomeEmpresa('PORTO DO RECIFE S/A', 'PORTO DO RECIFE')).toBe('Porto do Recife S/A')
    expect(nomeEmpresa('PORTOS RS - AUTORIDADE PORTUÁRIA', 'PORTOS-RS', ['RS'])).toBe('Portos RS - Autoridade Portuária')
  })

  it('nome com minúsculas só perde o sufixo; nome sem sufixo nem maiúsculas fica igual', () => {
    expect(nomeEmpresa('Empresa Gaúcha de Rodovias', 'EGR')).toBe('Empresa Gaúcha de Rodovias')
  })
})

describe('aviso de quebra de série', () => {
  it('passou a dependente: frase cautelosa, atribuída à fonte', () => {
    expect(avisoQuebraSerie({ ano: 2024, sigla: 'Gaspisa', empresa: 'Companhia de Gás do Piauí', uf: 'PI', sentido: 'passou_a_dependente' }))
      .toBe('Segundo o Tesouro Nacional, em 2024 a Gaspisa (Companhia de Gás do Piauí, PI) passou a constar como estatal dependente. '
        + 'A partir desse ano, seus gastos devem entrar nestas contas, o que pode afetar a comparação com anos anteriores.')
  })

  it('deixou de ser dependente: frase equivalente', () => {
    expect(avisoQuebraSerie({ ano: 2024, sigla: 'BEA', empresa: 'Banco do Estado', uf: 'AA', sentido: 'deixou_de_ser_dependente' }))
      .toBe('Segundo o Tesouro Nacional, em 2024 o BEA (Banco do Estado, AA) deixou de constar como estatal dependente. '
        + 'A partir desse ano, seus gastos devem sair destas contas, o que pode afetar a comparação com anos anteriores.')
  })

  it('artigo e plural pela primeira palavra do nome', () => {
    expect(artigoEmpresa('Companhia do Metropolitano')).toBe('a')
    expect(artigoEmpresa('Laboratório Farmacêutico')).toBe('o')
    expect(artigoEmpresa('Centrais de Abastecimento')).toBe('as')
    expect(artigoSigla('Metrô', 'Companhia do Metropolitano de São Paulo')).toBe('o')
    expect(artigoSigla('Gaspisa', 'Companhia de Gás do Piauí')).toBe('a')
    expect(avisoQuebraSerie({ ano: 2024, sigla: 'Metrô', empresa: 'Companhia do Metropolitano de São Paulo', uf: 'SP', sentido: 'passou_a_dependente' }))
      .toContain('em 2024 o Metrô (Companhia do Metropolitano de São Paulo, SP) passou a constar')
    expect(avisoQuebraSerie({ ano: 2024, sigla: 'CEASA', empresa: 'Centrais de Abastecimento', uf: 'AA', sentido: 'passou_a_dependente' }))
      .toContain('as CEASA (Centrais de Abastecimento, AA) passaram a constar')
  })

  it('linha de fonte sem repetir edições', () => {
    const m = { ano: 2024, ano_anterior: 2023 }
    expect(fonteDasQuebras('Tesouro Nacional, Raio X', [m, m])).toBe('Fonte: Tesouro Nacional, Raio X, edições 2023 e 2024.')
  })
})

describe('nome para exibir (estatais.json)', () => {
  it('correção manual vale como está', () => {
    expect(nomeParaExibir({ sigla: 'GASPISA', empresa: 'COMPANHIA DE GAS DO PIAUI - GASPISA', sigla_exibicao: 'Gaspisa',
      nome_exibicao: 'Companhia de Gás do Piauí', nome_manual: true })).toEqual({ sigla: 'Gaspisa', nome: 'Companhia de Gás do Piauí' })
  })

  it('sem correção: limpa a versão escolhida entre as edições', () => {
    expect(nomeParaExibir({ sigla: 'CDHU', empresa: 'X', sigla_exibicao: 'CDHU',
      nome_exibicao: 'COMPANHIA DE DESENVOLVIMENTO HABITACIONAL DO ESTADO DE SÃO PAULO', nome_manual: false }))
      .toEqual({ sigla: 'CDHU', nome: 'Companhia de Desenvolvimento Habitacional do Estado de São Paulo' })
  })

  it('sem campos de exibição: usa o original', () => {
    expect(nomeParaExibir({ sigla: 'CEDAE', empresa: 'Companhia Estadual de Águas e Esgotos - CEDAE' }))
      .toEqual({ sigla: 'CEDAE', nome: 'Companhia Estadual de Águas e Esgotos' })
  })
})

describe('tela Por estado: textos', () => {
  it('preposição com o nome do estado', () => {
    expect(doEstado('Rio de Janeiro', 'o')).toBe('do Rio de Janeiro')
    expect(doEstado('Bahia', 'a')).toBe('da Bahia')
    expect(doEstado('Pernambuco', null)).toBe('de Pernambuco')
  })

  it('variação com sinal e setor com iniciais maiúsculas', () => {
    expect(pctComSinal(3.21)).toBe('+3,2%')
    expect(pctComSinal(-1.5)).toBe('−1,5%')
    expect(pctComSinal(null)).toBe('–')
    expect(iniciaisMaiusculas('INFORMÁTICA E TECNOLOGIA DA INFORMAÇÃO')).toBe('Informática e Tecnologia da Informação')
    expect(iniciaisMaiusculas('GÁS E DERIVADOS')).toBe('Gás e Derivados')
  })
})

describe('dívida: textos', () => {
  it('frase da dívida contra saúde e educação', () => {
    expect(fraseDivida({ ano: 2024, uf: 'RJ', artigo: 'o', pago: 5.4e9, saude: 10.29e9, educacao: 12.1e9 }))
      .toBe('Em 2024, o RJ pagou R$ 5,4 bi em juros e amortização da dívida, contra R$ 10,3 bi em saúde e R$ 12,1 bi em educação.')
    expect(fraseDivida({ ano: 2024, uf: 'RJ', pago: null })).toBeNull()
    expect(deUf('RJ', 'o')).toBe('do RJ')
    expect(deUf('SP', null)).toBe('de SP')
  })
})

describe('receita: textos', () => {
  it('sobra, falta e empate', () => {
    expect(fraseResultado({ ano: 2024, uf: 'RJ', artigo: 'o', receita: 98.3e9, despesa: 99.3e9 }))
      .toBe('Em 2024, a despesa do RJ (R$ 99,3 bi) superou a receita (R$ 98,3 bi) em R$ 1,0 bi: faltou dinheiro.')
    expect(fraseResultado({ ano: 2024, uf: 'SP', artigo: null, receita: 10e9, despesa: 8e9 })).toContain('sobrou dinheiro')
    expect(fraseResultado({ ano: 2024, uf: 'SP', receita: 10e9, despesa: 10.001e9 })).toContain('praticamente empataram')
    expect(fraseResultado({ ano: 2024, uf: 'SP', receita: null, despesa: 1 })).toBeNull()
  })
})

describe('petróleo: frases', () => {
  it('explica e não reconcilia', () => {
    expect(fraseReconciliacaoPetroleo({ situacao: 'explica', demais: 25.9e9, anp: 25.6e9 }))
      .toBe('Demais receitas patrimoniais: R$ 25,9 bi, dos quais R$ 25,6 bi são royalties e participação especial repassados ao estado, segundo a ANP.')
    expect(fraseReconciliacaoPetroleo({ situacao: 'nao_reconcilia', demais: 19.4e9, anp: 21.7e9 }))
      .toContain('não se reconciliam neste ano')
    expect(fraseReconciliacaoPetroleo({ situacao: 'parcial', demais: 1, anp: 1 })).toBeNull()
  })
})

describe('frase do PIB', () => {
  const base = { ano: 2023, uf: 'RJ', artigo: 'o', pctPais: 10.94, posicao: 2, nUfs: 27, desde: 2015 }
  it('participação, posição e crescimento do estado e do país', () => {
    expect(frasePib({ ...base, crescimentoUf: 5.12, crescimentoPais: -1.5 })).toBe(
      'Em 2023, o RJ respondeu por 10,9% do PIB do país, a 2ª maior economia entre 27 estados. '
      + 'De 2015 a 2023, a economia do RJ cresceu 5,1% em volume (sem o efeito dos preços); a do país encolheu 1,5%.')
  })
  it('sem crescimento (ano inicial igual ao ano), só a participação; sem participação, nada', () => {
    expect(frasePib({ ...base, desde: 2023, crescimentoUf: null, crescimentoPais: null })).toBe(
      'Em 2023, o RJ respondeu por 10,9% do PIB do país, a 2ª maior economia entre 27 estados.')
    expect(frasePib({ ...base, pctPais: null })).toBeNull()
  })
})

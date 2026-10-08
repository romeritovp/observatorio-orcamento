import { describe, expect, it } from 'vitest'

import { escreverEstado, lerEstado, paresPadrao } from './estado.js'
import { csv, nomeEmpresa, nomeParaExibir, pct, reais, reaisCompacto } from './formatacao.js'
import { artigoEmpresa, artigoSigla, avisoEstatal, avisoQuebraSerie, emUf, fonteDasQuebras, fraseResumo, notaSemGasto, porUf, sujeito } from './textos.js'

const UFS = [
  { uf: 'AA', regiao: 'Norte' }, { uf: 'BB', regiao: 'Norte' },
  { uf: 'CC', regiao: 'Norte' }, { uf: 'DD', regiao: 'Sul' },
]
const CONTEXTO = { ufs: UFS, anos: [2023, 2024], areas: ['10', '12'], areaPadrao: '10' }

describe('estado na URL', () => {
  it('padrões quando a URL está vazia', () => {
    expect(lerEstado('', CONTEXTO)).toEqual({
      area: '10', metrica: 'per_capita', valores: 'corrigidos', ano: 2024, uf: null, pares: [], paresPersonalizados: false,
    })
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

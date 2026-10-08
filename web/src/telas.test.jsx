// Teste de fumaça: as duas telas renderizam com os dados publicados (public/data/), sem erro.
// Não confere contas (isso é do calculos.test.js); confere que os textos esperados aparecem.
import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { lerEstado } from './estado.js'
import Comparar from './telas/Comparar.jsx'
import PorEstado from './telas/PorEstado.jsx'

const lerJson = (nome) => JSON.parse(readFileSync(new URL(`../public/data/${nome}`, import.meta.url), 'utf-8'))
const dados = Object.fromEntries(['meta', 'dicionarios', 'ipca', 'despesa', 'estatais', 'divida', 'receita'].map((n) => [n, lerJson(`${n}.json`)]))
const presentes = new Set(dados.despesa.filter((l) => l.nivel === 'funcao').map((l) => l.funcao_cod))
const funcoes = dados.dicionarios.funcoes.filter((f) => presentes.has(f.funcao_cod))
const contexto = { ufs: dados.dicionarios.ufs, anos: dados.meta.anos, areas: funcoes.map((f) => f.funcao_cod), areaPadrao: '10' }
const tela = (Tela, busca) => renderToString(
  <Tela dados={dados} estado={lerEstado(busca, contexto)} mudar={() => {}} funcoes={funcoes} />)

describe('telas renderizam com os dados publicados', () => {
  it('Comparar, com e sem estado em destaque', () => {
    expect(tela(Comparar, '')).toContain('Comparar estados')
    const sp = tela(Comparar, '?area=26&uf=SP&ano=2024')
    expect(sp).toContain('Metrô')  // aviso de quebra de série
  })

  it('Por estado: sem estado escolhido pede um estado', () => {
    expect(tela(PorEstado, '?view=estado')).toContain('Escolha um estado')
  })

  it('Por estado: título, resumo, composição, série, tabela e estatais', () => {
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
    expect(pe).not.toContain('Royalties do petróleo não identificáveis')
    const rj = tela(PorEstado, '?view=estado&uf=RJ&ano=2024&treceita=pct')
    expect(rj).toContain('Royalties do petróleo não identificáveis') // ressalva só do RJ
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

  it('Por estado: área escolhida, valores da época e tabela em % ', () => {
    const html = tela(PorEstado, '?view=estado&uf=PI&ano=2024&area=25&valores=epoca&tabela=pct_total')
    expect(html).toContain('Gaspisa')  // quebra de série na área escolhida
    expect(html).toContain('em R$ da época')
    expect(html).toContain('% do orçamento estadual (não muda com a inflação)')
  })

  it('Por estado: edição 2023 das estatais para anos até 2023 (Sabesp aparece em SP)', () => {
    expect(tela(PorEstado, '?view=estado&uf=SP&ano=2022')).toContain('SABESP')
    expect(tela(PorEstado, '?view=estado&uf=SP&ano=2024')).not.toContain('SABESP')
  })
})

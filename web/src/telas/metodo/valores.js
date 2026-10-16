// Valores dos marcadores {{...}} dos textos da página "Como fazemos" (src/conteudo/metodo/).
// Tudo vem dos JSON publicados e das funções de calculos.js: nenhum número é escrito à mão nos textos.

import { passosPorHabitante } from '../../calculos.js'
import { CONFIGURACAO as CONFIG_TENDENCIA } from '../../estatistica/tendencia.js'
import { data, listaDeAnos, numero, reais } from '../../formatacao.js'
import { doEstado } from '../../textos.js'

const fatorTexto = (v) => numero(v, 4)
const pctTexto = (v) => `${numero(v, 2)}%`

/** Link da API do SICONFI que devolve a DCA (um anexo) de um ente num ano. */
export function linkDca(api, { anexo, ano, codIbge }) {
  const busca = new URLSearchParams({ an_exercicio: String(ano), no_anexo: anexo, id_ente: codIbge })
  return `${api}/dca?${busca.toString().replaceAll('+', '%20')}`
}

/** Passos de um ano do exemplo, já formatados para o texto. */
function passosFormatados(dados, exemplo, ano) {
  const { despesa, ipca, meta, dicionarios } = dados
  const anoBase = meta.deflacao.ano_base_padrao
  const p = passosPorHabitante(despesa, ipca.serie, { uf: exemplo.uf, funcao: exemplo.funcao_cod, ano, anoBase })
  const uf = dicionarios.ufs.find((u) => u.uf === exemplo.uf)
  const multiplicadores = p.ipca.map((x) => fatorTexto(1 + x.variacao_pct / 100))
  return {
    ano,
    link_api: linkDca(meta.documentacao.fontes.siconfi.api, { anexo: exemplo.anexo, ano, codIbge: uf.cod_ibge }),
    valor: reais(p.valor, true),
    populacao: numero(p.populacao),
    // Anos de inflação aplicados (depois do ano do gasto, até o ano base), em tabela Markdown
    anos_ipca: p.ipca.length ? `${p.ipca[0].ano} a ${p.ipca[p.ipca.length - 1].ano}` : 'nenhum',
    tabela_ipca: p.ipca.length
      ? ['| Ano | IPCA no ano (dez a dez) | Multiplicador |', '|---|---|---|',
        ...p.ipca.map((x, i) => `| ${x.ano} | ${pctTexto(x.variacao_pct)} | ${multiplicadores[i]} |`)].join('\n')
      : '| Ano | IPCA no ano | Multiplicador |\n|---|---|---|\n| — | nenhum ano a corrigir | 1 |',
    produto_ipca: multiplicadores.length ? multiplicadores.join(' × ') : '1',
    fator: fatorTexto(p.fator),
    real: reais(p.real, true),
    resultado: reais(p.porHabitante, true),
    resultado_tela: reais(p.porHabitante),
    resultado_numero: p.porHabitante,
  }
}

/**
 * Marcadores dos textos: {anos, fontes, exemplo, exemplo_antigo, estatais}. `exemplo` é o ano mais
 * recente (o da tela de abertura); `exemplo_antigo`, o primeiro ano da série, em que a correção pela
 * inflação aparece por inteiro.
 */
export function valoresDoMetodo(dados) {
  const { meta, dicionarios, estatais } = dados
  const doc = meta.documentacao
  const anos = meta.anos
  const exemplo = doc.exemplo
  const uf = dicionarios.ufs.find((u) => u.uf === exemplo.uf)
  const funcao = dicionarios.funcoes.find((f) => f.funcao_cod === exemplo.funcao_cod)
  const f = doc.fontes
  const parte = (sigla) => data(f.siconfi.partes.find((p) => p.sigla === sigla)?.extraido_em)
  return {
    anos: { primeiro: anos[0], ultimo: anos[anos.length - 1], quantos: anos.length, ano_base: meta.deflacao.ano_base_padrao },
    fontes: {
      siconfi: {
        pagina: f.siconfi.pagina_oficial, documentacao_api: f.siconfi.documentacao_api, api: f.siconfi.api,
        extraido_em: data(f.siconfi.extraido_em), dca: parte('DCA'), rgf: parte('RGF'), rreo: parte('RREO'),
      },
      anp: { pagina: f.anp.pagina_oficial, extraido_em: data(f.anp.extraido_em) },
      estatais: {
        pagina: f.tesouro_estatais.pagina_oficial, repositorio: f.tesouro_estatais.documentacao_api,
        commit: f.tesouro_estatais.commit, versao_de: data(`${f.tesouro_estatais.versao_de}T00:00:00Z`),
        edicoes: listaDeAnos(estatais.edicoes),
      },
      ideb: {
        pagina: f.inep_ideb.pagina_oficial, edicao: f.inep_ideb.edicao, primeiro: f.inep_ideb.anos[0], ultimo: f.inep_ideb.anos[1],
        extraido_em: data(`${f.inep_ideb.extraido_em}T12:00:00Z`),
      },
      fbsp: f.fbsp_anuario && {
        pagina: f.fbsp_anuario.pagina_oficial, primeira_edicao: f.fbsp_anuario.edicoes[0], ultima_edicao: f.fbsp_anuario.edicoes[1],
        primeiro: f.fbsp_anuario.anos[0], ultimo: f.fbsp_anuario.anos[1],
        quebras: f.fbsp_anuario.quebras_taxa.map((a) => `${a - 1} e ${a}`).join(' e entre '),
      },
      ibid: {
        pagina: f.inpi_ibid.pagina_oficial, planilha: f.inpi_ibid.planilha, sha256: f.inpi_ibid.arquivo_sha256,
        primeiro: f.inpi_ibid.anos[0], ultimo: f.inpi_ibid.anos[1], extraido_em: data(`${f.inpi_ibid.extraido_em}T12:00:00Z`),
      },
      pib: {
        pagina: f.ibge_contas_regionais.pagina_oficial, arquivos: f.ibge_contas_regionais.arquivos,
        edicao: f.ibge_contas_regionais.edicao, primeiro: f.ibge_contas_regionais.anos[0],
        ultimo: f.ibge_contas_regionais.anos[1], extraido_em: data(f.ibge_contas_regionais.extraido_em),
      },
      ipca: {
        pagina: f.ibge_ipca.pagina_oficial, documentacao_api: f.ibge_ipca.documentacao_api,
        consulta: f.ibge_ipca.consulta, extraido_em: data(`${f.ibge_ipca.extraido_em}T00:00:00Z`),
      },
    },
    tendencia: {
      confianca: `${Math.round(CONFIG_TENDENCIA.confianca * 100)}%`, margem: numero(CONFIG_TENDENCIA.margem_equivalencia_pct_ano),
      minimo_inferencia: CONFIG_TENDENCIA.minimo_observacoes_inferencia,
      minimo_autocorrelacao: CONFIG_TENDENCIA.minimo_observacoes_autocorrelacao,
      nivel_autocorrelacao: numero(CONFIG_TENDENCIA.nivel_teste_autocorrelacao, 2),
    },
    exemplo: {
      uf: exemplo.uf, nome_uf: uf.nome, do_uf: doEstado(uf.nome, uf.artigo), cod_ibge: uf.cod_ibge,
      funcao_cod: exemplo.funcao_cod, area: funcao.funcao_nome, area_minuscula: funcao.funcao_nome.toLocaleLowerCase('pt-BR'),
      conta: `${exemplo.funcao_cod} - ${funcao.funcao_nome}`, coluna: exemplo.coluna, anexo: exemplo.anexo,
      ...passosFormatados(dados, exemplo, anos[anos.length - 1]),
    },
    exemplo_antigo: passosFormatados(dados, exemplo, anos[0]),
  }
}

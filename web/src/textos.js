// Textos gerados a partir dos dados: factuais, sem adjetivos.

import { valorDaMetrica } from './formatacao.js'

/** "o RJ", "a BA", "SP" (artigo vem de dicionarios.json). */
export function sujeito(uf, artigo) {
  return artigo ? `${artigo} ${uf}` : uf
}

/** "pelo RJ", "pela BA", "por SP". */
export function porUf(uf, artigo) {
  if (artigo === 'o') return `pelo ${uf}`
  if (artigo === 'a') return `pela ${uf}`
  return `por ${uf}`
}

/** "No RJ", "Na BA", "Em SP" (início de frase). */
export function emUf(uf, artigo) {
  if (artigo === 'o') return `No ${uf}`
  if (artigo === 'a') return `Na ${uf}`
  return `Em ${uf}`
}

/** Aviso de estatal não dependente na área: a operação dela fica fora das contas do estado. */
export function avisoEstatal({ uf, artigo, sigla, empresa }) {
  return `${emUf(uf, artigo)}, ${sigla} (${empresa}) atua nesta área como estatal não dependente: `
    + 'a operação dela não aparece nestas contas.'
}

// Primeira palavra do nome → artigo; o resto é feminino ("a Companhia", "a Empresa", "a Agência")
const ARTIGO_POR_PALAVRA = {
  banco: 'o', instituto: 'o', laboratório: 'o', porto: 'o', trem: 'o', centro: 'o', departamento: 'o',
  serviço: 'o', complexo: 'o', parque: 'o', metrô: 'o', portos: 'os', centrais: 'as', águas: 'as', aguas: 'as',
}

const artigoDaPalavra = (texto) => ARTIGO_POR_PALAVRA[texto.trim().split(/\s+/)[0].toLocaleLowerCase('pt-BR')]

/** Artigo do nome da empresa pela primeira palavra: "a", "o", "as" ou "os". */
export function artigoEmpresa(nome) {
  return artigoDaPalavra(nome) ?? 'a'
}

/** Artigo para a sigla: a própria sigla quando é palavra conhecida ("o Metrô"), senão o do nome ("a Gaspisa"). */
export function artigoSigla(sigla, nome) {
  return artigoDaPalavra(sigla) ?? artigoEmpresa(nome)
}

/**
 * Aviso de quebra de série: descreve a classificação da fonte, sem afirmar o efeito na despesa.
 * sentido: "passou_a_dependente" ou "deixou_de_ser_dependente"; sigla e empresa já prontos para exibição.
 * Ex.: "... em 2024 a Gaspisa (Companhia de Gás do Piauí, PI) passou a constar ..."
 */
export function avisoQuebraSerie({ ano, sigla, empresa, uf, sentido }) {
  const artigo = artigoSigla(sigla, empresa)
  const plural = artigo.endsWith('s')
  const passou = sentido === 'passou_a_dependente'
  const verbo = passou ? (plural ? 'passaram a constar' : 'passou a constar') : (plural ? 'deixaram de constar' : 'deixou de constar')
  const efeito = passou ? 'devem entrar nestas contas' : 'devem sair destas contas'
  return `Segundo o Tesouro Nacional, em ${ano} ${artigo} ${sigla} (${empresa}, ${uf}) ${verbo} como estatal dependente. `
    + `A partir desse ano, seus gastos ${efeito}, o que pode afetar a comparação com anos anteriores.`
}

/** "Fonte: <fonte>, edições 2023 e 2024." (cada par de edições uma vez só). */
export function fonteDasQuebras(fonteCurta, mudancas) {
  const pares = [...new Set(mudancas.map((m) => `${m.ano_anterior} e ${m.ano}`))]
  return `Fonte: ${fonteCurta}, edições ${pares.join('; ')}.`
}

/** Nome da área em minúsculas para o meio da frase ("saúde", "segurança pública"). */
export const areaNaFrase = (nome) => nome.toLocaleLowerCase('pt-BR')

/**
 * Ex.: "Em 2025, o RJ ficou em 27º entre 27 estados no gasto em saúde por habitante:
 * R$ 646, contra a mediana de R$ 993."
 * valores: 'corrigidos' (padrão) ou 'epoca' (acrescenta "em valores da época").
 * semGasto: a UF não declarou gasto na área (entra com 0).
 */
export function fraseResumo({ ano, uf, artigo, area, metrica, valores = 'corrigidos', valor, posicao, nUfs, mediana, semGasto }) {
  const quem = sujeito(uf, artigo)
  const nomeArea = areaNaFrase(area)
  if (valor === null || valor === undefined || posicao === null || posicao === undefined) {
    return `Não há dado de ${uf} em ${ano} para ${nomeArea}.`
  }
  const epoca = metrica !== 'pct_total' && valores === 'epoca' ? ', em valores da época' : ''
  const medida = metrica === 'pct_total'
    ? `na parcela do orçamento gasta em ${nomeArea}`
    : `no gasto em ${nomeArea} por habitante${epoca}`
  const mediaTexto = `contra a mediana de ${valorDaMetrica(mediana, metrica)}`
  if (semGasto) {
    return `Em ${ano}, ${quem} não declarou gasto em ${nomeArea} e ficou em ${posicao}º entre ${nUfs} estados `
      + `${medida}: ${valorDaMetrica(0, metrica)}, ${mediaTexto}.`
  }
  return `Em ${ano}, ${quem} ficou em ${posicao}º entre ${nUfs} estados ${medida}: `
    + `${valorDaMetrica(valor, metrica)}, ${mediaTexto}.`
}

/** "3 estados não declararam gasto nesta área em 2025: AP, RR, SE." (null se nenhum) */
export function notaSemGasto(ufs, ano) {
  if (ufs.length === 0) return null
  const lista = [...ufs].sort().join(', ')
  return ufs.length === 1
    ? `1 estado não declarou gasto nesta área em ${ano}: ${lista}.`
    : `${ufs.length} estados não declararam gasto nesta área em ${ano}: ${lista}.`
}

// Textos gerados a partir dos dados: factuais, sem adjetivos.

import { numero, pct, pctComSinal, reaisCompacto, valorDaMetrica } from './formatacao.js'

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

/** "do RJ", "da BA", "de SP". */
export function deUf(uf, artigo) {
  if (artigo === 'o') return `do ${uf}`
  if (artigo === 'a') return `da ${uf}`
  return `de ${uf}`
}

/** "do Rio de Janeiro", "da Bahia", "de São Paulo" (nome do estado com a preposição certa). */
export function doEstado(nome, artigo) {
  if (artigo === 'o') return `do ${nome}`
  if (artigo === 'a') return `da ${nome}`
  return `de ${nome}`
}

/** "No RJ", "Na BA", "Em SP" (início de frase). */
export function emUf(uf, artigo) {
  if (artigo === 'o') return `No ${uf}`
  if (artigo === 'a') return `Na ${uf}`
  return `Em ${uf}`
}

/** Aviso de estatal não dependente na área: a operação dela fica fora das contas do estado. */
export const SEM_INFO_ESTATAIS = 'Sem informação de estatais para este ano.'

/** "Gaspisa (Companhia de Gás do Piauí)"; sem sigla (edições antigas), só o nome. */
export const siglaENome = (sigla, nome) => (sigla ? `${sigla} (${nome})` : nome)

export function avisoEstatal({ uf, artigo, sigla, empresa }) {
  return `${emUf(uf, artigo)}, ${siglaENome(sigla, empresa)} atua nesta área como estatal não dependente: `
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
  return (sigla && artigoDaPalavra(sigla)) ?? artigoEmpresa(nome)
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
  const quem = sigla ? `${sigla} (${empresa}, ${uf})` : `${empresa} (${uf})`
  return `Segundo o Tesouro Nacional, em ${ano} ${artigo} ${quem} ${verbo} como estatal dependente. `
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

/**
 * "Em 2024, o RJ pagou R$ 5,4 bi em juros e amortização da dívida, contra R$ 10,3 bi em saúde
 * e R$ 12,1 bi em educação." (valores já na unidade escolhida; null se faltar o pago)
 */
export function fraseDivida({ ano, uf, artigo, pago, saude, educacao }) {
  if (pago === null || pago === undefined) return null
  return `Em ${ano}, ${sujeito(uf, artigo)} pagou ${reaisCompacto(pago)} em juros e amortização da dívida, `
    + `contra ${reaisCompacto(saude)} em saúde e ${reaisCompacto(educacao)} em educação.`
}

/**
 * "Em 2024, a receita do RJ (R$ 98,3 bi) superou a despesa (R$ 99,3 bi)..." — sobra ou falta no ano.
 * receita e despesa já na unidade escolhida; null se faltar algum dos dois.
 */
export function fraseResultado({ ano, uf, artigo, receita, despesa }) {
  if (receita === null || receita === undefined || despesa === null || despesa === undefined) return null
  const diferenca = receita - despesa
  const de = deUf(uf, artigo)
  if (Math.abs(diferenca) < 0.0005 * Math.max(receita, despesa)) {
    return `Em ${ano}, a receita ${de} (${reaisCompacto(receita)}) e a despesa (${reaisCompacto(despesa)}) praticamente empataram.`
  }
  return diferenca > 0
    ? `Em ${ano}, a receita ${de} (${reaisCompacto(receita)}) superou a despesa (${reaisCompacto(despesa)}) em ${reaisCompacto(diferenca)}: sobrou dinheiro.`
    : `Em ${ano}, a despesa ${de} (${reaisCompacto(despesa)}) superou a receita (${reaisCompacto(receita)}) em ${reaisCompacto(-diferenca)}: faltou dinheiro.`
}

/**
 * Petróleo de estado que não separa na DCA, conforme reconciliacaoPetroleo:
 * 'explica' → "Demais receitas patrimoniais: R$ X bi, dos quais R$ Y bi são royalties e participação especial
 * repassados ao estado, segundo a ANP."; 'nao_reconcilia' → os dois valores e a nota; outros → null.
 */
export function fraseReconciliacaoPetroleo({ situacao, demais, anp }) {
  if (situacao === 'explica') {
    return `Demais receitas patrimoniais: ${reaisCompacto(demais)}, dos quais ${reaisCompacto(anp)} são royalties e `
      + 'participação especial repassados ao estado, segundo a ANP.'
  }
  if (situacao === 'nao_reconcilia') {
    return `Demais receitas patrimoniais (prestação de contas): ${reaisCompacto(demais)}. Royalties e participação especial `
      + `repassados ao estado (ANP): ${reaisCompacto(anp)}. Os valores da ANP e da prestação de contas não se reconciliam neste ano.`
  }
  return null
}

/**
 * Frase do PIB: "Em 2023, o RJ respondeu por 10,9% do PIB do país, o 2º maior entre 27 estados. De 2015 a 2023,
 * a economia do RJ cresceu 5,1% descontada a inflação; a do país, 12,0%." Partes sem dado ficam de fora.
 */
export function frasePib({ ano, uf, artigo, pctPais, posicao, nUfs, desde, crescimentoUf, crescimentoPais }) {
  if (pctPais === null || pctPais === undefined) return null
  const verbo = (v) => (v >= 0 ? `cresceu ${pct(v)}` : `encolheu ${pct(-v)}`)
  const partes = [`Em ${ano}, ${sujeito(uf, artigo)} respondeu por ${pct(pctPais)} do PIB do país`
    + (posicao ? `, a ${posicao}ª maior economia entre ${nUfs} estados.` : '.')]
  if (crescimentoUf !== null && crescimentoUf !== undefined && desde < ano) {
    partes.push(`De ${desde} a ${ano}, a economia ${deUf(uf, artigo)} ${verbo(crescimentoUf)} em volume (sem o efeito dos preços)`
      + (crescimentoPais === null || crescimentoPais === undefined ? '.' : `; a do país ${verbo(crescimentoPais)}.`))
  }
  return partes.join(' ')
}

/** "+2,1% ao ano" (taxa anual de tendência). */
export const taxaAoAno = (v) => (v === null || v === undefined ? '–' : `${pctComSinal(v)} ao ano`)

/**
 * O que os dados permitem afirmar sobre a tendência (resultado de estatistica/tendencia.js), em linguagem simples.
 * Separa a evidência (o intervalo de confiança) da intensidade (a categoria, mostrada à parte).
 * margem: margem de equivalência da configuração (% ao ano), para o texto da estabilidade.
 */
export function textoEvidencia(r, margem = 1) {
  const ic = r.inferencia?.icTaxa
  const intervalo = ic ? `${pctComSinal(ic[0])} a ${pctComSinal(ic[1])} ao ano` : null
  const nivel = `${Math.round((r.inferencia?.confianca ?? 0.95) * 100)}%`
  if (r.evidencia === 'insuficiente') return 'Poucos anos para medir a incerteza: só a direção.'
  if (r.evidencia === 'positiva') return `Alta confirmada pelos dados (intervalo de ${nivel}: ${intervalo}).`
  if (r.evidencia === 'negativa') return `Queda confirmada pelos dados (intervalo de ${nivel}: ${intervalo}).`
  if (r.estabilidade) return `Estabilidade confirmada: a variação fica entre −${margem}% e +${margem}% ao ano (intervalo: ${intervalo}).`
  return `Direção incerta: o intervalo de ${nivel} vai de ${intervalo}.`
}

/** "Rio de Janeiro está em 4º lugar em 2025; em 2014, estava em 2º no índice geral, entre 27 estados." */
export function fraseRankingIbid({ nome, ano, atual, anoInicial, inicial }) {
  if (atual === null || atual === undefined) return null
  const agora = `${nome} está em ${atual}º lugar em ${ano}`
  const antes = inicial === null || inicial === undefined || ano === anoInicial ? ''
    : atual === inicial ? `, como em ${anoInicial}` : `; em ${anoInicial}, estava em ${inicial}º`
  return `${agora}${antes} no índice geral do IBID, entre 27 estados.`
}

/** "+0,8 ponto", "−0,1 ponto", "0,0 ponto" (variação do IDEB entre edições). */
export function pontosComSinal(v) {
  if (v === null || v === undefined) return '–'
  const arredondado = Math.round(v * 10) / 10
  const sinal = arredondado > 0 ? '+' : arredondado < 0 ? '−' : ''
  return `${sinal}${Math.abs(arredondado).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${Math.abs(arredondado) > 1 ? 'pontos' : 'ponto'}`
}

/**
 * "Em 2025, o IDEB do ensino médio na rede estadual do RS foi 4,7, o 5º maior entre 27 estados (Brasil: 4,2).
 * Em 2023, era 3,9: subiu 0,8 ponto." Partes sem dado ficam de fora; sem IDEB no ano, null.
 */
export function fraseIdeb({ uf, artigo, etapa, rede, ano, ideb, posicao, nUfs, brasil, anoAnterior, anterior }) {
  if (ideb === null || ideb === undefined) return null
  const um = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  let frase = `Em ${ano}, o IDEB ${etapa} na ${rede} ${deUf(uf, artigo)} foi ${um(ideb)}`
  if (posicao) frase += `, o ${posicao}º maior entre ${nUfs} estados`
  frase += brasil === null || brasil === undefined ? '.' : ` (Brasil: ${um(brasil)}).`
  if (anterior !== null && anterior !== undefined) {
    const d = Math.round((ideb - anterior) * 10) / 10
    frase += ` Em ${anoAnterior}, era ${um(anterior)}: ${d > 0 ? `subiu ${pontosComSinal(d).slice(1)}` : d < 0 ? `caiu ${pontosComSinal(d).slice(1)}` : 'ficou igual'}.`
  }
  return frase
}

/**
 * Frase da tela "Violência": o número de mortes no último ano, a variação desde o primeiro e a posição pela taxa.
 * variacaoUf e variacaoBrasil em % (índice − 100); posicao 1 = maior taxa.
 */
export function fraseViolencia({ uf, artigo, ano, mortes, primeiroAno, variacaoUf, variacaoBrasil, posicao, nUfs, taxa }) {
  if (mortes === null || mortes === undefined) return null
  const variou = (v) => (v === null || v === undefined ? null : v >= 0 ? `aumentou ${pct(v)}` : `caiu ${pct(-v)}`)
  const partes = [`Em ${ano}, ${sujeito(uf, artigo)} registrou ${numero(mortes)} mortes violentas intencionais.`]
  if (variou(variacaoUf)) {
    partes.push(`Desde ${primeiroAno}, o número ${variou(variacaoUf)}${variou(variacaoBrasil) ? `; no Brasil, ${variou(variacaoBrasil)}` : ''}.`)
  }
  if (posicao) partes.push(`Pela taxa (${numero(taxa, 1)} por 100 mil habitantes), é o ${posicao}º de ${nUfs} estados (1º = maior taxa).`)
  return partes.join(' ')
}

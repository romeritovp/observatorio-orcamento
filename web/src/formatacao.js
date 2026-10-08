// Formatação para exibição (pt-BR) e geração de CSV. Não faz contas sobre os dados.

const reaisInteiros = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const reaisCentavos = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

const semNulo = (valor, formatar) => (valor === null || valor === undefined || Number.isNaN(valor) ? '–' : formatar(valor))

/** "R$ 646" (sem centavos) ou "R$ 645,56" com centavos. */
export const reais = (valor, centavos = false) =>
  semNulo(valor, (v) => (centavos ? reaisCentavos : reaisInteiros).format(v).replace(/ /g, ' '))

/** Total em reais, compacto: "R$ 1,2 bi", "R$ 850,3 mi", "R$ 12 mil". `prefixo` false omite "R$ ". */
export function reaisCompacto(valor, prefixo = true) {
  return semNulo(valor, (v) => {
    const escalas = [[1e9, 'bi'], [1e6, 'mi'], [1e3, 'mil']]
    const [divisor, sufixo] = escalas.find(([d]) => Math.abs(v) >= d) ?? [1, '']
    const casas = divisor === 1 || Math.abs(v / divisor) >= 100 ? 0 : 1
    const numeroTexto = (v / divisor).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
    return `${prefixo ? 'R$ ' : ''}${numeroTexto}${sufixo ? ` ${sufixo}` : ''}`
  })
}

/** "10,1%"; abaixo de 1%, pelo menos dois algarismos significativos ("0,11%", "0,0012%"), para não parecer zero. */
export const pct = (valor, casas = 1) =>
  semNulo(valor, (v) => {
    const pequeno = v !== 0 && Math.abs(v) < 1
    const c = pequeno ? Math.min(4, Math.max(casas, 2, 1 - Math.floor(Math.log10(Math.abs(v))))) : casas
    return `${v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c })}%`
  })

export const numero = (valor, casas = 0) =>
  semNulo(valor, (v) => (casas === 0 ? inteiro.format(v) : v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  })))

/** Valor da métrica escolhida já formatado. */
export const valorDaMetrica = (valor, metrica) => (metrica === 'pct_total' ? pct(valor) : reais(valor))

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
const FORMAS_SOCIETARIAS = new Set(['SA', 'S/A', 'S.A', 'S.A.'])

/** Tira acentos letra a letra, sem mudar o tamanho do texto (para comparar e achar posições). */
const semAcento = (texto) => [...texto].map((c) => c.normalize('NFD')[0]).join('')

/**
 * Nome de empresa para exibição (o dado original não muda):
 * 1. tira o " - SIGLA" do fim quando repete a sigla ("Companhia ... - CEDAE" → "Companhia ..."),
 *    sem olhar acentos e aceitando "/UF" depois da sigla ("- CEASA/MS");
 * 2. nome todo em maiúsculas vira iniciais maiúsculas, com de/da/do/das/dos/e em minúsculas e
 *    siglas como estão: a sigla da empresa, siglas de UF (`siglasUfs`), palavras sem vogal (CTC)
 *    e formas societárias (SA, S/A, S.A.).
 * Nome que já tem minúsculas só perde o sufixo.
 */
export function nomeEmpresa(empresa, sigla = '', siglasUfs = []) {
  const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let nome = empresa.trim()
  if (sigla) {
    const sufixo = new RegExp(`\\s*[-–]\\s*${escapar(semAcento(sigla.trim()))}(/[A-Z]{2})?\\s*$`, 'i')
    const achado = semAcento(nome).match(sufixo)
    if (achado) nome = nome.slice(0, achado.index).trim()
  }
  if (/[a-zà-ú]/.test(nome)) return nome

  const manter = new Set([...siglasUfs, ...(sigla.includes(' ') ? [] : [sigla])].map((s) => s.toUpperCase()))
  return nome.split(' ').map((palavra, i) => {
    const minuscula = palavra.toLocaleLowerCase('pt-BR')
    if (i > 0 && MINUSCULAS.has(minuscula)) return minuscula
    if (manter.has(palavra) || FORMAS_SOCIETARIAS.has(palavra) || !/[AEIOUÁÉÍÓÚÂÊÔÃÕ]/.test(palavra)) return palavra
    return minuscula.replace(/(^|-)(\p{L})/gu, (_, antes, letra) => antes + letra.toLocaleUpperCase('pt-BR'))
  }).join(' ')
}

/**
 * Sigla e nome de uma empresa do estatais.json para exibir. A correção manual (nome_manual)
 * vale como está; senão limpa nome_exibicao (a versão com acentos entre as edições) com nomeEmpresa.
 */
export function nomeParaExibir(empresa, siglasUfs = []) {
  const sigla = empresa.sigla_exibicao ?? empresa.sigla
  const nome = empresa.nome_exibicao ?? empresa.empresa
  if (empresa.nome_manual) return { sigla, nome }
  return { sigla, nome: nomeEmpresa(nome, empresa.sigla, siglasUfs) }
}

/** Data ISO → "08/10/2026". */
export const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '–')

/**
 * CSV para Excel em português: separador ";", vírgula decimal, números sem arredondar.
 * linhas: array de arrays (a primeira é o cabeçalho).
 */
export function csv(linhas) {
  const celula = (valor) => {
    if (valor === null || valor === undefined) return ''
    const texto = typeof valor === 'number' ? String(valor).replace('.', ',') : String(valor)
    return /[;"\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto
  }
  return `﻿${linhas.map((l) => l.map(celula).join(';')).join('\r\n')}\r\n`
}

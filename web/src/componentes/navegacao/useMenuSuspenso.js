import { useCallback, useEffect, useRef, useState } from 'react'

/** Links e botões focáveis dentro de um elemento, na ordem da página. */
export const focaveis = (el) => [...(el?.querySelectorAll('a[href], button:not([disabled]), input, select') ?? [])]

/**
 * Comportamento comum dos menus suspensos: abre e fecha por clique (não só ao passar o mouse), fecha com Esc (e devolve
 * o foco ao botão) e com clique fora. As setas percorrem os itens do painel; seta para baixo no botão abre e foca o
 * primeiro item. Devolve {aberto, abrir, fechar, alternar, raiz, botao, painel, teclaNoBotao, teclaNoPainel}.
 */
export function useMenuSuspenso() {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef(null)
  const botao = useRef(null)
  const painel = useRef(null)
  const fechar = useCallback((devolverFoco = false) => {
    setAberto(false)
    if (devolverFoco) botao.current?.focus()
  }, [])

  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAberto(false) }
    const esc = (e) => { if (e.key === 'Escape') fechar(true) }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto, fechar])

  const focar = (indice) => {
    const itens = focaveis(painel.current)
    if (itens.length) itens[(indice + itens.length) % itens.length].focus()
  }
  const teclaNoBotao = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAberto(true)
      requestAnimationFrame(() => focar(0))
    }
  }
  const teclaNoPainel = (e) => {
    const itens = focaveis(painel.current)
    const atual = itens.indexOf(document.activeElement)
    const passos = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    if (e.key in passos) {
      e.preventDefault()
      focar(atual + passos[e.key])
    } else if (e.key === 'Home') {
      e.preventDefault()
      focar(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focar(itens.length - 1)
    }
  }
  return { aberto, abrir: () => setAberto(true), fechar, alternar: () => setAberto((a) => !a), raiz, botao, painel, teclaNoBotao, teclaNoPainel }
}

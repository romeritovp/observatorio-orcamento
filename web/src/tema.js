// Tema da página: claro por padrão; escuro só quando o leitor escolhe.
// É preferência de quem lê (não muda a visão dos dados), por isso fica no navegador e não na URL.

const CHAVE = 'tema'
export const TEMAS = ['claro', 'escuro']

/** Tema guardado no navegador, ou 'claro' (armazenamento pode estar bloqueado). */
export function lerTema() {
  try {
    return localStorage.getItem(CHAVE) === 'escuro' ? 'escuro' : 'claro'
  } catch {
    return 'claro'
  }
}

/** Aplica o tema na página (atributo data-theme do <html>) e guarda a escolha. */
export function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
  try {
    localStorage.setItem(CHAVE, tema)
  } catch {
    // sem armazenamento: o tema vale só até recarregar
  }
}

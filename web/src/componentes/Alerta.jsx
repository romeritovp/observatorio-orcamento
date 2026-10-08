// Bloco de alerta (ex.: "Antes de comparar"): caixa com fundo próprio, borda forte e ícone de atenção.
// Nivel: o elemento do título ('h2' ou 'h3'), conforme a hierarquia da tela.
export default function Alerta({ titulo, Nivel = 'h2', children }) {
  return (
    <aside className="secao alerta" aria-label={titulo}>
      <div className="alerta-cabecalho">
        <svg className="alerta-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
        <Nivel>{titulo}</Nivel>
      </div>
      {children}
    </aside>
  )
}

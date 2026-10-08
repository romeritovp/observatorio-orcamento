// Índice das partes da tela "Por estado": cartões com número, ícone, nome e o que a parte responde.
// São âncoras comuns (#id): funcionam sem JavaScript e não mudam o estado da tela.

const traco = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

// Ícones simples, no mesmo traço dos ícones da navegação
const ICONES = {
  // dinheiro entrando
  receitas: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...traco}>
      <path d="M12 3v11" /><path d="m7.5 9.5 4.5 4.5 4.5-4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  ),
  // dinheiro saindo
  despesas: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...traco}>
      <path d="M12 14V3" /><path d="m7.5 7.5 4.5-4.5 4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  ),
  // balança da dívida
  dividas: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...traco}>
      <path d="M12 3v18" /><path d="M8 21h8" /><path d="M5 7h14" /><path d="M5 7l-3 6a3.5 3.5 0 0 0 6 0z" />
      <path d="M19 7l-3 6a3.5 3.5 0 0 0 6 0z" />
    </svg>
  ),
  // prédio de empresa
  estatais: (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...traco}>
      <path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" /><path d="M15 9h3a2 2 0 0 1 2 2v10" /><path d="M2 21h20" />
      <path d="M8 7h3M8 11h3M8 15h3" />
    </svg>
  ),
}

/** partes: [{id, rotulo, descricao}] na ordem da página; o ícone vem pelo id. */
export default function IndicePartes({ partes }) {
  return (
    <nav className="indice-partes" aria-label="Partes da página">
      <ol>
        {partes.map((p, i) => (
          <li key={p.id}>
            <a href={`#${p.id}`}>
              <span className="indice-icone">{ICONES[p.id]}</span>
              <span className="indice-texto">
                <span className="indice-numero">Parte {i + 1}</span>
                <strong>{p.rotulo}</strong>
                <span className="indice-descricao">{p.descricao}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

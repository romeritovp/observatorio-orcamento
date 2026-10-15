import { caminhoIndicador } from '../../rotas.js'
import { INDICADORES_POR_EIXO } from '../../navegacao.config.js'

// Indicadores em colunas por eixo, com nome e descrição curta; cada um leva à visão nacional (/indicadores/pib).
// Indicador com disponivel: false aparece esmaecido, com o selo "em breve", e não é clicável.
export default function MegaMenuIndicadores({ atual, aoEscolher, grupos = INDICADORES_POR_EIXO }) {
  return (
    <div className="mega-menu">
      {grupos.map(({ eixo, indicadores }) => (
        <div key={eixo.slug} className="mega-menu-eixo">
          <h3>{eixo.nome}</h3>
          <ul>
            {indicadores.map((i) => (
              <li key={i.slug}>
                {i.disponivel ? (
                  <a href={caminhoIndicador(i)} aria-current={i.slug === atual ? 'page' : undefined} onClick={aoEscolher}>
                    <span className="nome">{i.nome}</span>
                    <span className="descricao">{i.descricaoCurta}</span>
                  </a>
                ) : (
                  <span className="indisponivel" aria-disabled="true">
                    <span className="nome">{i.nome} <span className="selo-em-breve">em breve</span></span>
                    <span className="descricao">{i.descricaoCurta}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

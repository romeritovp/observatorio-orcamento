import { caminhoUf } from '../../rotas.js'
import { UFS_POR_REGIAO } from '../../navegacao.config.js'

// As 27 UFs em grade, agrupadas por região; cada uma leva ao painel do estado (/sp).
// atual: sigla da UF da página (destacada); aoEscolher: chamado ao clicar (fecha o menu).
export default function PainelEstados({ atual, aoEscolher }) {
  return (
    <div className="painel-estados">
      {UFS_POR_REGIAO.map(({ regiao, ufs }) => (
        <div key={regiao} className="painel-estados-regiao">
          <h3>{regiao}</h3>
          <ul>
            {ufs.map((uf) => (
              <li key={uf.sigla}>
                <a href={caminhoUf(uf)} aria-current={uf.sigla === atual ? 'page' : undefined} onClick={aoEscolher}>
                  <span className="sigla">{uf.sigla}</span> {uf.nome}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

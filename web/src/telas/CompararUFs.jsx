import { INDICADORES } from '../navegacao.config.js'

// Comparação entre estados (/comparar?ufs=sp,pe&indicador=pib): escolhe o indicador e mostra a tela dele com o
// primeiro estado em destaque e os demais como comparados ("Comparar com" nos filtros da própria tela).
// indicador: o da URL; onTrocar(slug): troca o indicador mantendo os estados; children: a tela do indicador.
export default function CompararUFs({ indicador, onTrocar, children }) {
  return (
    <>
      <div className="faixa-comparar">
        <div className="faixa-comparar-interna">
          <p className="parte-rotulo">Comparar estados</p>
          <label className="campo">
            <span>Indicador</span>
            <select value={indicador.slug} onChange={(e) => onTrocar(e.target.value)}>
              {INDICADORES.map((i) => <option key={i.slug} value={i.slug} disabled={!i.disponivel}>{i.nome}</option>)}
            </select>
          </label>
          <p className="nota">Escolha o estado em destaque e os estados comparados nos filtros abaixo; a URL guarda a escolha para compartilhar.</p>
        </div>
      </div>
      {children}
    </>
  )
}

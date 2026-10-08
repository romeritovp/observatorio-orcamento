import { valorDaMetrica } from '../formatacao.js'
import Legenda, { SIMBOLO_ESTATAL } from './Legenda.jsx'

// Ranking dos estados em barras horizontais, já na ordem de posição (recebida pronta).
// Estados sem gasto declarado aparecem com 0, no fim. Tocar numa barra põe o estado em destaque.
// comEstatal: Set de UFs com estatal não dependente na área (marcadas com um símbolo).
export default function Ranking({ linhas, coluna, colunaPosicao, metrica, destaque, pares, mediana, nomes, nota, comEstatal = new Set(), onEscolherUf }) {
  const maximo = Math.max(...linhas.map((l) => l[coluna] ?? 0)) || 1
  const posicaoMediana = `${(mediana / maximo) * 100}%`

  return (
    <div>
      <Legenda uf={destaque} temPares={pares.length > 0} temEstatal={linhas.some((l) => comEstatal.has(l.uf))} />
      <div className="rotulo-mediana" aria-hidden="true">
        <span style={{ left: posicaoMediana }}>mediana {valorDaMetrica(mediana, metrica)}</span>
      </div>
      <ol className="ranking numeros">
        {linhas.map((l) => {
          const classe = l.uf === destaque ? 'destaque' : pares.includes(l.uf) ? 'par' : ''
          const largura = l[coluna] === null ? 0 : (l[coluna] / maximo) * 100
          return (
            <li key={l.uf} className={classe}>
              <button
                type="button" className="linha-ranking" onClick={() => onEscolherUf(l.uf)}
                aria-label={`${l[colunaPosicao] ?? '–'}º ${nomes[l.uf]}: ${valorDaMetrica(l[coluna], metrica)}${l.sem_gasto_declarado ? ', sem gasto declarado nesta área' : ''}${comEstatal.has(l.uf) ? ', tem estatal não dependente nesta área' : ''}`}
                aria-current={l.uf === destaque ? 'true' : undefined}
              >
                <span className="pos">{l[colunaPosicao] ?? '–'}º</span>
                <span className="uf">
                  {l.uf}
                  {comEstatal.has(l.uf) && <span className="simbolo-estatal" aria-hidden="true" title="Tem estatal não dependente nesta área">{SIMBOLO_ESTATAL}</span>}
                </span>
                <span className="trilho">
                  <span className="barra" style={{ width: `${largura}%` }} />
                  {l.sem_gasto_declarado && <span className="sem-gasto-rotulo">sem gasto declarado</span>}
                  <span className="marca-mediana" style={{ left: posicaoMediana }} />
                </span>
                <span className="valor">{valorDaMetrica(l[coluna], metrica)}</span>
              </button>
            </li>
          )
        })}
      </ol>
      {nota && <p className="nota nota-ranking">{nota}</p>}
    </div>
  )
}

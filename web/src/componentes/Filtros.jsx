import { METRICAS } from '../estado.js'

// Filtros, nesta ordem: área, estado em destaque, métrica, ano; depois valores (inflação) e pares.
export default function Filtros({ estado, ufs, anos, anoBase, funcoes, regioes, paresPadrao, onMudar }) {
  const alternarPar = (uf) => {
    const pares = estado.pares.includes(uf) ? estado.pares.filter((p) => p !== uf) : [...estado.pares, uf]
    onMudar({ pares, paresPersonalizados: true })
  }
  const semInflacao = estado.metrica === 'pct_total'

  return (
    <div className="filtros">
      <label className="campo">
        <span>Área</span>
        <select value={estado.area} onChange={(e) => onMudar({ area: e.target.value })}>
          {funcoes.map((f) => <option key={f.funcao_cod} value={f.funcao_cod}>{f.funcao_nome}</option>)}
        </select>
      </label>

      <label className="campo">
        <span>Estado em destaque</span>
        <select
          value={estado.uf ?? ''}
          onChange={(e) => onMudar({ uf: e.target.value || null, paresPersonalizados: false })}
        >
          <option value="">Escolha…</option>
          {ufs.map((u) => <option key={u.uf} value={u.uf}>{u.uf} · {u.nome}</option>)}
        </select>
      </label>

      <div className="campo">
        <span id="rotulo-metrica">Métrica</span>
        <div className="alternador" role="group" aria-labelledby="rotulo-metrica">
          {Object.entries(METRICAS).map(([m, nome]) => (
            <button key={m} type="button" aria-pressed={estado.metrica === m} onClick={() => onMudar({ metrica: m })}>
              {nome}
            </button>
          ))}
        </div>
      </div>

      <label className="campo">
        <span>Ano</span>
        <select value={estado.ano} onChange={(e) => onMudar({ ano: Number(e.target.value) })}>
          {[...anos].reverse().map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>

      <div className="campo inflacao">
        <span id="rotulo-valores">Valores</span>
        <div className={`alternador${semInflacao ? ' desativado' : ''}`} role="group" aria-labelledby="rotulo-valores">
          <button type="button" disabled={semInflacao} aria-pressed={!semInflacao && estado.valores === 'corrigidos'}
            onClick={() => onMudar({ valores: 'corrigidos' })}>
            Valores corrigidos pela inflação (dez/{anoBase})
          </button>
          <button type="button" disabled={semInflacao} aria-pressed={!semInflacao && estado.valores === 'epoca'}
            onClick={() => onMudar({ valores: 'epoca' })}>
            Valores da época
          </button>
        </div>
        {semInflacao && <p className="nota">O percentual não muda com a inflação.</p>}
      </div>

      {estado.uf && (
        <details className="pares campo-largo">
          <summary>
            Comparar com: <strong>{estado.pares.length ? estado.pares.join(', ') : 'nenhum'}</strong>
            <span className="nota">{estado.paresPersonalizados ? '(escolhidos)' : '(mesma região)'} · alterar</span>
          </summary>
          <div className="pares-regioes">
            {regioes.map((regiao) => (
              <div key={regiao}>
                <h3>{regiao}</h3>
                <div className="fichas">
                  {ufs.filter((u) => u.regiao === regiao).map((u) => (
                    <button
                      key={u.uf} type="button" className="ficha" title={u.nome}
                      aria-pressed={estado.pares.includes(u.uf)} disabled={u.uf === estado.uf}
                      onClick={() => alternarPar(u.uf)}
                    >
                      {u.uf}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {estado.paresPersonalizados && (
              <p><button type="button" className="link" onClick={() => onMudar({ pares: paresPadrao, paresPersonalizados: false })}>
                Voltar aos estados da mesma região
              </button></p>
            )}
          </div>
        </details>
      )}
    </div>
  )
}

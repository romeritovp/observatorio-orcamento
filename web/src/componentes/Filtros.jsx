import { METRICAS } from '../estado.js'

// Campos de filtro, reaproveitados pelas duas telas. Cada um só exibe e avisa a mudança.

export function CampoArea({ estado, funcoes, onMudar }) {
  return (
    <label className="campo">
      <span>Área</span>
      <select value={estado.area} onChange={(e) => onMudar({ area: e.target.value, areaExplicita: true })}>
        {funcoes.map((f) => <option key={f.funcao_cod} value={f.funcao_cod}>{f.funcao_nome}</option>)}
      </select>
    </label>
  )
}

export function CampoEstado({ estado, ufs, rotulo = 'Estado em destaque', onMudar }) {
  const regioes = ufs.reduce((acc, uf) => {
    if (!acc[uf.regiao]) {
      acc[uf.regiao] = []
    }

    acc[uf.regiao].push(uf)

    return acc
  }, {})

  return (
    <label className="campo">
      <span>{rotulo}</span>

      <select
        value={estado.uf ?? ''}
        onChange={(e) =>
          onMudar({
            uf: e.target.value || null,
            paresPersonalizados: false
          })
        }
      >
        <option value="">Escolha…</option>

        {Object.entries(regioes).map(([regiao, estados]) => (
          <optgroup key={regiao} label={regiao}>
            {[...estados]
              .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
              .map((u) => (
                <option key={u.uf} value={u.uf}>
                  {u.uf} · {u.nome}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

export function CampoMetrica({ estado, onMudar }) {
  return (
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
  )
}

export function CampoAno({ estado, anos, onMudar }) {
  return (
    <label className="campo">
      <span>Ano</span>
      <select value={estado.ano} onChange={(e) => onMudar({ ano: Number(e.target.value) })}>
        {[...anos].reverse().map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </label>
  )
}

/** Valores corrigidos × da época. `desativado`: a medida não muda com a inflação (% do orçamento). */
export function CampoValores({ estado, anoBase, desativado = false, onMudar }) {
  return (
    <div className="campo inflacao">
      <span id="rotulo-valores">Valores</span>
      <div className={`alternador${desativado ? ' desativado' : ''}`} role="group" aria-labelledby="rotulo-valores">
        <button type="button" disabled={desativado} aria-pressed={!desativado && estado.valores === 'corrigidos'}
          onClick={() => onMudar({ valores: 'corrigidos' })}>
          Valores corrigidos pela inflação (dez/{anoBase})
        </button>
        <button type="button" disabled={desativado} aria-pressed={!desativado && estado.valores === 'epoca'}
          onClick={() => onMudar({ valores: 'epoca' })}>
          Valores da época
        </button>
      </div>
      {desativado && <p className="nota">O percentual não muda com a inflação.</p>}
    </div>
  )
}

function CampoPares({ estado, ufs, regioes, paresPadrao, onMudar }) {
  const alternarPar = (uf) => {
    const pares = estado.pares.includes(uf) ? estado.pares.filter((p) => p !== uf) : [...estado.pares, uf]
    onMudar({ pares, paresPersonalizados: true })
  }
  return (
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
  )
}

// Tela "Comparar", nesta ordem: área, estado em destaque, métrica, ano; depois valores (inflação) e pares.
export default function Filtros({ estado, ufs, anos, anoBase, funcoes, regioes, paresPadrao, onMudar }) {
  return (
    <div className="filtros">
      <CampoArea estado={estado} funcoes={funcoes} onMudar={onMudar} />
      <CampoEstado estado={estado} ufs={ufs} onMudar={onMudar} />
      <CampoMetrica estado={estado} onMudar={onMudar} />
      <CampoAno estado={estado} anos={anos} onMudar={onMudar} />
      <CampoValores estado={estado} anoBase={anoBase} desativado={estado.metrica === 'pct_total'} onMudar={onMudar} />
      {estado.uf && <CampoPares estado={estado} ufs={ufs} regioes={regioes} paresPadrao={paresPadrao} onMudar={onMudar} />}
    </div>
  )
}

// Tela "Por estado": estado, ano e valores, com o mesmo comportamento.
export function FiltrosEstado({ estado, ufs, anos, anoBase, onMudar }) {
  return (
    <div className="filtros filtros-estado">
      <CampoEstado estado={estado} ufs={ufs} rotulo="Estado" onMudar={onMudar} />
      <CampoAno estado={estado} anos={anos} onMudar={onMudar} />
      <CampoValores estado={estado} anoBase={anoBase} onMudar={onMudar} />
    </div>
  )
}

// Tela "PIB dos Estados": estado, ano, ano inicial do crescimento e estados para comparar (anos do PIB, não os do orçamento).
export function FiltrosPib({ estado, ufs, anos, regioes, paresPadrao, onMudar }) {
  return (
    <div className="filtros filtros-pib">
      <CampoEstado estado={estado} ufs={ufs} rotulo="Estado" onMudar={onMudar} />
      <label className="campo">
        <span>Ano</span>
        <select value={estado.anoPib} onChange={(e) => onMudar({ anoPib: Number(e.target.value) })}>
          {[...anos].reverse().map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label className="campo">
        <span>Crescimento desde</span>
        <select value={estado.desdePib} onChange={(e) => onMudar({ desdePib: Number(e.target.value) })}>
          {anos.slice(0, -1).reverse().map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      {estado.uf && <CampoPares estado={estado} ufs={ufs} regioes={regioes} paresPadrao={paresPadrao} onMudar={onMudar} />}
    </div>
  )
}

// Tela "Pesquisa e Inovação": estado, ano (do IBID) e estados para comparar.
export function FiltrosInovacao({ estado, ufs, anos, regioes, paresPadrao, onMudar }) {
  return (
    <div className="filtros filtros-inovacao">
      <CampoEstado estado={estado} ufs={ufs} rotulo="Estado" onMudar={onMudar} />
      <label className="campo">
        <span>Ano</span>
        <select value={estado.anoIbid ?? ''} onChange={(e) => onMudar({ anoIbid: Number(e.target.value) })}>
          {[...anos].reverse().map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      {estado.uf && <CampoPares estado={estado} ufs={ufs} regioes={regioes} paresPadrao={paresPadrao} onMudar={onMudar} />}
    </div>
  )
}

// Tela "Educação": estado, ano (do IDEB), etapa, rede e estados para comparar. etapas e redes: [{id, nome}];
// redesDisponiveis: as que existem na etapa (as outras ficam desativadas).
export function FiltrosEducacao({ estado, ufs, anos, etapas, redes, redesDisponiveis, regioes, paresPadrao, onMudar }) {
  return (
    <div className="filtros filtros-educacao">
      <CampoEstado estado={estado} ufs={ufs} rotulo="Estado" onMudar={onMudar} />
      <label className="campo">
        <span>Ano</span>
        <select value={estado.anoIdeb ?? ''} onChange={(e) => onMudar({ anoIdeb: Number(e.target.value) })}>
          {[...anos].reverse().map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label className="campo">
        <span>Etapa</span>
        <select value={estado.etapaIdeb ?? ''} onChange={(e) => onMudar({ etapaIdeb: e.target.value })}>
          {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </label>
      <label className="campo">
        <span>Rede</span>
        <select value={estado.redeIdeb ?? ''} onChange={(e) => onMudar({ redeIdeb: e.target.value })}>
          {redes.map((r) => <option key={r.id} value={r.id} disabled={!redesDisponiveis.includes(r.id)}>{r.nome}</option>)}
        </select>
      </label>
      {estado.uf && <CampoPares estado={estado} ufs={ufs} regioes={regioes} paresPadrao={paresPadrao} onMudar={onMudar} />}
    </div>
  )
}

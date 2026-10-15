import { useRef } from 'react'

import { pct, reaisCompacto } from '../formatacao.js'
import { marcasEixo } from './desenho.js'
import { useLargura } from './useLargura.js'

const MARGEM = { topo: 22, base: 26, lados: 4 }

// Barras verticais empilhadas por ano. pontos: [{ano, partes: {id: valor}}]; partes: [{id, rotulo, classe}]
// (de baixo para cima). O total vai escrito em cima de cada barra; ano sem dado fica vazio.
// percentual: partes em % que somam 100 (composição): escala fixa de 0 a 100, sem o total escrito,
// "–" no ano vazio e o % de cada parte na descrição acessível.
export default function BarrasEmpilhadas({ pontos, partes, anoSelecionado, percentual = false }) {
  const ref = useRef(null)
  const largura = useLargura(ref)
  const altura = 230
  const total = (p) => (partes.every((pt) => p.partes[pt.id] === null || p.partes[pt.id] === undefined)
    ? null : partes.reduce((s, pt) => s + Math.max(p.partes[pt.id] ?? 0, 0), 0))
  const fatia = (largura - MARGEM.lados * 2) / pontos.length
  const larguraBarra = Math.min(fatia * 0.62, 56)
  const topo = percentual ? 100 : marcasEixo(Math.max(...pontos.map((p) => total(p) ?? 0), 0)).at(-1)
  const formatar = percentual ? (v) => pct(v) : (v) => reaisCompacto(v)
  // Muitos anos em tela estreita: rótulo a cada `passo` anos (≥ 36 px entre rótulos), contado do último
  const passo = Math.max(1, Math.ceil(36 / fatia))
  const rotularAno = (i) => (pontos.length - 1 - i) % passo === 0
  const altPx = (v) => (v / topo) * (altura - MARGEM.base - MARGEM.topo)
  const base = altura - MARGEM.base
  const comPrefixo = fatia >= 64

  return (
    <div>
      <ul className="legenda">
        {partes.map((pt) => <li key={pt.id}><span className={`amostra ${pt.classe}`} />{pt.rotulo}</li>)}
      </ul>
      <div className="grafico" ref={ref}>
        <svg className="barras-total barras-empilhadas numeros" width={largura} height={altura} role="img"
          aria-label={pontos.map((p) => `${p.ano}: ${partes.map((pt) => `${pt.rotulo} ${formatar(p.partes[pt.id])}`).join(', ')}`).join('; ')}>
          <line x1={0} x2={largura} y1={base} y2={base} stroke="var(--texto-3)" strokeWidth="1" />
          {pontos.map((p, i) => {
            const cx = MARGEM.lados + fatia * (i + 0.5)
            let acumulado = 0
            const t = total(p)
            return (
              <g key={p.ano} opacity={p.ano === anoSelecionado ? 1 : 0.8}>
                {partes.map((pt) => {
                  const v = Math.max(p.partes[pt.id] ?? 0, 0)
                  const y = base - altPx(acumulado + v)
                  acumulado += v
                  return <rect key={pt.id} className={pt.classe} x={cx - larguraBarra / 2} y={y} width={larguraBarra} height={altPx(v)} />
                })}
                {(!percentual || t === null) && (
                  <text className="valor-barra" x={cx} y={base - altPx(t ?? 0) - 6} textAnchor="middle">
                    {t === null ? (percentual ? '–' : 'sem dado') : reaisCompacto(t, comPrefixo)}
                  </text>
                )}
                {rotularAno(i) && (
                  <text className="eixo-ano" x={cx} y={altura - 8} textAnchor="middle"
                    fontWeight={p.ano === anoSelecionado ? 700 : 400}>{p.ano}</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

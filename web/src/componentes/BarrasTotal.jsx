import { useRef } from 'react'

import { reaisCompacto } from '../formatacao.js'
import { marcasEixo } from './desenho.js'
import { useLargura } from './useLargura.js'

const MARGEM = { topo: 22, base: 26, lados: 4 }

// Barras verticais: total gasto pelo estado em destaque, ano a ano, em R$ da época (nominal).
// Não obedece ao seletor de inflação nem à métrica. pontos: [{ano, valor, semGasto}]
export default function BarrasTotal({ pontos, anoSelecionado }) {
  const ref = useRef(null)
  const largura = useLargura(ref)
  const altura = 220
  const fatia = (largura - MARGEM.lados * 2) / pontos.length
  const larguraBarra = Math.min(fatia * 0.62, 56)
  const topo = marcasEixo(Math.max(...pontos.map((p) => p.valor ?? 0), 0)).at(-1)
  const y = (v) => altura - MARGEM.base - (v / topo) * (altura - MARGEM.base - MARGEM.topo)
  const comPrefixo = fatia >= 64

  return (
    <div className="grafico" ref={ref}>
      <svg className="barras-total numeros" width={largura} height={altura} role="img"
        aria-label={pontos.map((p) => `${p.ano}: ${reaisCompacto(p.valor)}`).join('; ')}>
        <line x1={0} x2={largura} y1={y(0)} y2={y(0)} stroke="var(--texto-3)" strokeWidth="1" />
        {pontos.map((p, i) => {
          const cx = MARGEM.lados + fatia * (i + 0.5)
          const valor = p.valor ?? 0
          return (
            <g key={p.ano}>
              <rect x={cx - larguraBarra / 2} y={y(valor)} width={larguraBarra} height={Math.max(y(0) - y(valor), 0)}
                rx="3" fill="var(--destaque)" opacity={p.ano === anoSelecionado ? 1 : 0.78} />
              <text className="valor-barra" x={cx} y={y(valor) - 6} textAnchor="middle">
                {p.semGasto ? 'sem gasto' : reaisCompacto(p.valor, comPrefixo)}
              </text>
              <text className="eixo-ano" x={cx} y={altura - 8} textAnchor="middle"
                fontWeight={p.ano === anoSelecionado ? 700 : 400}>{p.ano}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

import { useRef, useState } from 'react'

import { marcasEixo } from './desenho.js'
import { useLargura } from './useLargura.js'

const MARGEM = { topo: 16, direita: 16, base: 44, esquerda: 56 }

// Dispersão de pontos com as medianas dos dois eixos tracejadas (quadrantes). Só desenha.
// pontos: [{id, x, y, rotulo, tipo: 'destaque' | 'par' | 'outro', dica: [linhas]}]; só destaque e pares têm rótulo
// visível; os demais mostram `dica` (nome e valores) ao passar o mouse ou tocar (toque de novo fecha). mediana: {x, y};
// eixos: {x: rotulo, y: rotulo}; quadrantes: {superiorEsquerdo, inferiorDireito} (textos curtos, opcionais);
// formatar(v) → texto dos eixos e da descrição acessível.
export default function Dispersao({ pontos, mediana, eixos, quadrantes = {}, formatar }) {
  const ref = useRef(null)
  const largura = useLargura(ref)
  const [dica, setDica] = useState(null)
  const altura = largura < 520 ? 320 : 380
  const area = { x0: MARGEM.esquerda, x1: largura - MARGEM.direita, y0: altura - MARGEM.base, y1: MARGEM.topo }
  const validos = pontos.filter((p) => p.x !== null && p.y !== null)
  const marcasX = marcasEixo(Math.max(...validos.map((p) => p.x), 0))
  const marcasY = marcasEixo(Math.max(...validos.map((p) => p.y), 0))
  const x = (v) => area.x0 + (v / marcasX.at(-1)) * (area.x1 - area.x0)
  const y = (v) => area.y0 - (v / marcasY.at(-1)) * (area.y0 - area.y1)
  // Destaque e pares por cima dos demais
  const ordem = { outro: 0, par: 1, destaque: 2 }
  const desenho = [...validos].sort((a, b) => ordem[a.tipo] - ordem[b.tipo])

  return (
    <div className="grafico dispersao" ref={ref}>
      <svg width={largura} height={altura} role="img"
        aria-label={`${eixos.x} × ${eixos.y}: ${validos.map((p) => `${p.rotulo} ${formatar(p.x)} e ${formatar(p.y)}`).join('; ')}`}>
        <g className="eixo">
          {marcasY.map((m) => (
            <g key={`y${m}`}>
              <line className={m === 0 ? 'base' : 'grade'} x1={area.x0} x2={area.x1} y1={y(m)} y2={y(m)} />
              <text x={area.x0 - 8} y={y(m)} dy="0.32em" textAnchor="end">{formatar(m)}</text>
            </g>
          ))}
          {marcasX.map((m) => (
            <text key={`x${m}`} x={x(m)} y={area.y0 + 16} textAnchor="middle">{formatar(m)}</text>
          ))}
          <text x={(area.x0 + area.x1) / 2} y={altura - 6} textAnchor="middle" className="titulo-eixo">{eixos.x} →</text>
          <text x={14} y={(area.y0 + area.y1) / 2} textAnchor="middle" className="titulo-eixo"
            transform={`rotate(-90 14 ${(area.y0 + area.y1) / 2})`}>{eixos.y} →</text>
        </g>
        {mediana.x !== null && <line className="mediana-dispersao" x1={x(mediana.x)} x2={x(mediana.x)} y1={area.y1} y2={area.y0} />}
        {mediana.y !== null && <line className="mediana-dispersao" x1={area.x0} x2={area.x1} y1={y(mediana.y)} y2={y(mediana.y)} />}
        {quadrantes.superiorEsquerdo && <text className="quadrante" x={area.x0 + 6} y={area.y1 + 12}>{quadrantes.superiorEsquerdo}</text>}
        {quadrantes.inferiorDireito && <text className="quadrante" x={area.x1 - 6} y={area.y0 - 8} textAnchor="end">{quadrantes.inferiorDireito}</text>}
        {desenho.map((p) => (
          <g key={p.id} className={`ponto ${p.tipo}${dica === p.id ? ' ativo' : ''}`}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setDica(p.id)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setDica(null)}
            onPointerDown={(e) => e.pointerType !== 'mouse' && setDica((atual) => (atual === p.id ? null : p.id))}>
            <circle className="alvo" cx={x(p.x)} cy={y(p.y)} r={12} />
            <circle cx={x(p.x)} cy={y(p.y)} r={p.tipo === 'destaque' ? 6 : 4} />
            {p.tipo !== 'outro' && <text x={x(p.x) + 7} y={y(p.y)} dy="0.32em">{p.rotulo}</text>}
          </g>
        ))}
      </svg>
      {(() => {
        const p = validos.find((q) => q.id === dica)
        if (!p) return null
        return (
          <div className="dica numeros" role="status"
            style={{ left: Math.min(Math.max(x(p.x) - 80, 0), Math.max(largura - 170, 0)), top: Math.max(y(p.y) - 78, 0) }}>
            {(p.dica ?? [p.rotulo]).map((l, i) => (i === 0 ? <strong key={l}>{l}</strong> : <div key={l}>{l}</div>))}
          </div>
        )
      })()}
    </div>
  )
}

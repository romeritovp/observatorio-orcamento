import { useRef, useState } from 'react'

import { valorDaMetrica } from '../formatacao.js'
import { afastar, marcasEixo } from './desenho.js'
import Legenda from './Legenda.jsx'
import { useLargura } from './useLargura.js'

const MARGEM = { topo: 12, direita: 92, base: 28, esquerda: 58 }

// Linhas no tempo: destaque (cor), pares (cinza) e mediana (cinza escuro). Toque/passe o
// mouse para ver os valores do ano. series: [{id, rotulo, tipo, pontos: [{ano, valor}]}]
// quebras: anos com mudança de classificação (linha tracejada entre o ano anterior e o ano).
export default function Evolucao({ series, anos, metrica, anoSelecionado, destaque, quebras = [] }) {
  const ref = useRef(null)
  const largura = useLargura(ref)
  const [anoDica, setAnoDica] = useState(null)

  const altura = largura < 520 ? 250 : 300
  const area = { x0: MARGEM.esquerda, x1: largura - MARGEM.direita, y0: altura - MARGEM.base, y1: MARGEM.topo }
  const valores = series.flatMap((s) => s.pontos.map((p) => p.valor)).filter((v) => v !== null)
  const marcas = marcasEixo(Math.max(...valores, 0))
  const topo = marcas[marcas.length - 1]
  const x = (ano) => area.x0 + ((ano - anos[0]) / Math.max(anos.length - 1, 1)) * (area.x1 - area.x0)
  const y = (v) => area.y0 - (v / topo) * (area.y0 - area.y1)

  const caminho = (pontos) => pontos.filter((p) => p.valor !== null)
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.ano).toFixed(1)},${y(p.valor).toFixed(1)}`).join('')

  // Rótulos no fim das linhas, afastados para não se sobreporem. Com mais de 4 pares, só o
  // destaque e a mediana ganham rótulo; os pares aparecem no toque e na tabela.
  const MAXIMO_PARES_ROTULADOS = 4
  const rotular = (s) => s.tipo !== 'par' || series.filter((x) => x.tipo === 'par').length <= MAXIMO_PARES_ROTULADOS
  const finais = series.map((s) => (rotular(s) ? [...s.pontos].reverse().find((p) => p.valor !== null) : undefined))
  const comRotulo = finais.map((p, i) => [p, i]).filter(([p]) => p)
  const yAfastados = afastar(comRotulo.map(([p]) => y(p.valor)), 14)
  const yRotulos = Object.fromEntries(comRotulo.map(([, i], k) => [i, yAfastados[k]]))

  const escolherAno = (evento) => {
    const caixa = ref.current.getBoundingClientRect()
    const px = evento.clientX - caixa.left
    const proximo = anos.reduce((melhor, a) => (Math.abs(x(a) - px) < Math.abs(x(melhor) - px) ? a : melhor), anos[0])
    setAnoDica(proximo)
  }

  const ordemDica = anoDica === null ? [] : series
    .map((s) => ({ ...s, valor: s.pontos.find((p) => p.ano === anoDica)?.valor ?? null }))
    .sort((a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity))

  const estilo = { destaque: { stroke: 'var(--destaque)', width: 3 }, par: { stroke: 'var(--barra-par)', width: 1.5 },
    mediana: { stroke: 'var(--mediana)', width: 2 } }

  return (
    <div>
      <Legenda uf={destaque} temPares={series.some((s) => s.tipo === 'par')} linha />
      <div className="grafico" ref={ref} onPointerMove={escolherAno} onPointerDown={escolherAno} onPointerLeave={() => setAnoDica(null)}>
        <svg width={largura} height={altura} role="img" aria-label="Evolução no tempo">
          <g className="eixo">
            {marcas.map((m) => (
              <g key={m}>
                <line className={m === 0 ? 'base' : 'grade'} x1={area.x0} x2={area.x1} y1={y(m)} y2={y(m)} />
                <text x={area.x0 - 8} y={y(m)} dy="0.32em" textAnchor="end">{metrica === 'pct_total' ? `${m.toLocaleString('pt-BR')}%` : valorDaMetrica(m, metrica)}</text>
              </g>
            ))}
            {anos.map((a, i) => (largura >= 420 || i % 2 === 0 || a === anos[anos.length - 1]) && (
              <text key={a} x={x(a)} y={area.y0 + 18} textAnchor="middle"
                fontWeight={a === anoSelecionado ? 700 : 400}>{a}</text>
            ))}
          </g>
          {[...new Set(quebras)].filter((a) => anos.includes(a) && a > anos[0]).map((a) => {
            const xq = (x(a - 1) + x(a)) / 2
            return (
              <g key={`quebra-${a}`} className="quebra">
                <line x1={xq} x2={xq} y1={area.y1} y2={area.y0} />
                <text x={xq} y={area.y1} dy="0.9em" textAnchor="middle">mudança de classificação</text>
              </g>
            )
          })}
          {anoDica !== null && <line x1={x(anoDica)} x2={x(anoDica)} y1={area.y1} y2={area.y0} stroke="var(--texto-3)" strokeWidth="1" />}
          {series.map((s) => (
            <path key={s.id} d={caminho(s.pontos)} fill="none" stroke={estilo[s.tipo].stroke}
              strokeWidth={estilo[s.tipo].width} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {series.filter((s) => s.tipo === 'destaque').flatMap((s) => s.pontos.filter((p) => p.valor !== null).map((p) => (
            <circle key={p.ano} cx={x(p.ano)} cy={y(p.valor)} r={p.ano === anoSelecionado ? 5.5 : 3.5}
              fill="var(--destaque)" stroke="var(--fundo)" strokeWidth="2" />
          )))}
          {series.map((s, i) => finais[i] && (
            <text key={s.id} x={area.x1 + 8} y={yRotulos[i]} dy="0.32em" fontSize="12"
              fontWeight={s.tipo === 'destaque' ? 700 : 400}
              fill={s.tipo === 'par' ? 'var(--texto-3)' : 'var(--texto)'}>{s.rotulo}</text>
          ))}
        </svg>
        {anoDica !== null && (
          <div className="dica numeros" style={{ left: Math.min(Math.max(x(anoDica) - 80, 0), Math.max(largura - 170, 0)) }}>
            <strong>{anoDica}</strong>
            {ordemDica.map((s) => (
              <div key={s.id} className={`item ${s.tipo}`}>
                <span>{s.rotulo}</span><span>{valorDaMetrica(s.valor, metrica)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="dados-tabela">
        <summary>Ver os números em tabela</summary>
        <div className="rolagem">
          <table className="tabela numeros">
            <thead><tr><th>Ano</th>{series.map((s) => <th key={s.id}>{s.rotulo}</th>)}</tr></thead>
            <tbody>
              {anos.map((a) => (
                <tr key={a}>
                  <td>{a}</td>
                  {series.map((s) => <td key={s.id}>{valorDaMetrica(s.pontos.find((p) => p.ano === a)?.valor ?? null, metrica)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

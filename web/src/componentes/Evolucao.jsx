import { useRef, useState } from 'react'

import { valorDaMetrica } from '../formatacao.js'
import { afastar, marcasEixo } from './desenho.js'
import Legenda from './Legenda.jsx'
import { useLargura } from './useLargura.js'

const MARGEM = { topo: 12, direita: 92, base: 28, esquerda: 58 }

// Linhas no tempo: destaque (cor), pares (cinza) e mediana (cinza escuro). Toque/passe o
// mouse para ver os valores do ano. series: [{id, rotulo, tipo, pontos: [{ano, valor}]}]
// quebras: anos com mudança de classificação (linha tracejada entre o ano anterior e o ano).
// compacto: versão menor para gráficos lado a lado (sem a tabela de números embaixo).
// referencias: linhas horizontais tracejadas fixas, ex.: [{valor: 200, rotulo: 'limite 200%'}].
// legenda: itens próprios [{classe, rotulo}] no lugar da legenda padrão (destaque, pares, mediana).
// escala (opcional): {min, max, marcas, invertido} fixa o eixo vertical; invertido põe o min no topo (posição
// em ranking: 1º em cima). Sem ela, o eixo vai de 0 ao maior valor.
// rotuloQuebra: texto das linhas de quebra. anoProvisorio: ano ainda sujeito a revisão (ponto vazado do destaque,
// com o aviso no gráfico e na tabela).
export default function Evolucao({
  series, anos, metrica, anoSelecionado, destaque, quebras = [], compacto = false, referencias = [], legenda, escala,
  rotuloQuebra = 'mudança de classificação', anoProvisorio = null,
}) {
  const ref = useRef(null)
  const largura = useLargura(ref)
  const [anoDica, setAnoDica] = useState(null)

  const margem = compacto ? { ...MARGEM, direita: 60, esquerda: 54 } : MARGEM
  const altura = compacto ? 210 : largura < 520 ? 250 : 300
  const area = { x0: margem.esquerda, x1: largura - margem.direita, y0: altura - margem.base, y1: margem.topo }
  const valores = series.flatMap((s) => s.pontos.map((p) => p.valor)).filter((v) => v !== null)
  const marcas = escala?.marcas ?? marcasEixo(Math.max(...valores, ...referencias.map((r) => r.valor), 0))
  const minimo = escala?.min ?? 0
  const topo = escala?.max ?? marcas[marcas.length - 1]
  // Posição pelo tempo (vale para séries anuais e bienais, como o IDEB): do primeiro ao último ano
  const x = (ano) => area.x0 + ((ano - anos[0]) / Math.max(anos[anos.length - 1] - anos[0], 1)) * (area.x1 - area.x0)
  const fracao = (v) => (v - minimo) / (topo - minimo)
  const y = (v) => (escala?.invertido ? area.y1 + fracao(v) * (area.y0 - area.y1) : area.y0 - fracao(v) * (area.y0 - area.y1))

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

  // Rótulos de ano no eixo: a cada `passoAnos` (≥ 36 px entre eles), contados do último ano
  const passoAnos = Math.max(1, Math.ceil(36 / ((area.x1 - area.x0) / Math.max(anos.length - 1, 1))))

  const escolherAno = (evento) => {
    const caixa = ref.current.getBoundingClientRect()
    const px = evento.clientX - caixa.left
    const proximo = anos.reduce((melhor, a) => (Math.abs(x(a) - px) < Math.abs(x(melhor) - px) ? a : melhor), anos[0])
    setAnoDica(proximo)
  }

  const ordemDica = anoDica === null ? [] : series
    .map((s) => ({ ...s, valor: s.pontos.find((p) => p.ano === anoDica)?.valor ?? null }))
    .sort((a, b) => {  // o "melhor" primeiro: maior valor, ou menor posição no eixo invertido; sem valor por último
      const v = (s) => s.valor ?? (escala?.invertido ? Infinity : -Infinity)
      return escala?.invertido ? v(a) - v(b) : v(b) - v(a)
    })

  const estilo = { destaque: { stroke: 'var(--destaque)', width: 3 }, par: { stroke: 'var(--barra-par)', width: 1.5 },
    mediana: { stroke: 'var(--mediana)', width: 2 } }

  return (
    <div>
      {legenda
        ? <ul className="legenda">{legenda.map((l) => <li key={l.rotulo}><span className={`amostra ${l.classe}`} />{l.rotulo}</li>)}</ul>
        : <Legenda uf={destaque} temPares={series.some((s) => s.tipo === 'par')} linha />}
      <div className="grafico" ref={ref} onPointerMove={escolherAno} onPointerDown={escolherAno} onPointerLeave={() => setAnoDica(null)}>
        <svg width={largura} height={altura} role="img" aria-label="Evolução no tempo">
          <g className="eixo">
            {marcas.map((m) => (
              <g key={m}>
                <line className={m === minimo && !escala?.invertido ? 'base' : 'grade'} x1={area.x0} x2={area.x1} y1={y(m)} y2={y(m)} />
                <text x={area.x0 - 8} y={y(m)} dy="0.32em" textAnchor="end">{metrica === 'pct_total' ? `${m.toLocaleString('pt-BR')}%` : metrica === 'indice' ? m.toLocaleString('pt-BR') : valorDaMetrica(m, metrica)}</text>
              </g>
            ))}
            {anos.map((a, i) => (anos.length - 1 - i) % passoAnos === 0 && (
              <text key={a} x={x(a)} y={area.y0 + 18} textAnchor="middle"
                fontWeight={a === anoSelecionado ? 700 : 400}>{a}</text>
            ))}
          </g>
          {referencias.map((r) => (
            <g key={`ref-${r.valor}`} className="referencia">
              <line x1={area.x0} x2={area.x1} y1={y(r.valor)} y2={y(r.valor)} />
              <text x={area.x0 + 4} y={y(r.valor)} dy="-0.35em">{r.rotulo}</text>
            </g>
          ))}
          {[...new Set(quebras)].filter((a) => anos.includes(a) && a > anos[0]).map((a) => {
            const xq = (x(a - 1) + x(a)) / 2
            return (
              <g key={`quebra-${a}`} className="quebra">
                <line x1={xq} x2={xq} y1={area.y1} y2={area.y0} />
                <text x={xq} y={area.y1} dy="0.9em" textAnchor="middle">{rotuloQuebra}</text>
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
              fill={p.ano === anoProvisorio ? 'var(--fundo)' : 'var(--destaque)'}
              stroke={p.ano === anoProvisorio ? 'var(--destaque)' : 'var(--fundo)'} strokeWidth="2" />
          )))}
          {series.filter((s) => s.tipo === 'destaque').map((s) => s.pontos.find((p) => p.ano === anoProvisorio && p.valor !== null))
            .filter(Boolean).map((p) => (
              <text key={`provisorio-${p.ano}`} className="provisorio" x={x(p.ano)} y={y(p.valor)} dy="-1.1em" textAnchor="end"
                fontSize="11">sujeito a revisão</text>
            ))}
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
      {!compacto && <details className="dados-tabela">
        <summary>Ver os números em tabela</summary>
        <div className="rolagem">
          <table className="tabela numeros">
            <thead><tr><th>Ano</th>{series.map((s) => <th key={s.id}>{s.rotulo}</th>)}</tr></thead>
            <tbody>
              {anos.map((a) => (
                <tr key={a}>
                  <td>{a}{a === anoProvisorio ? ' (sujeito a revisão)' : ''}</td>
                  {series.map((s) => <td key={s.id}>{valorDaMetrica(s.pontos.find((p) => p.ano === a)?.valor ?? null, metrica)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>}
    </div>
  )
}

import { useMemo } from 'react'

import { indicadoresDaFuncao, medianaPorAno, ordenarPorPosicao, ufsComEstatalNaArea } from '../calculos.js'
import { paresPadrao } from '../estado.js'
import { fraseResumo, notaSemGasto, porUf } from '../textos.js'
import Alerta from '../componentes/Alerta.jsx'
import BarrasTotal from '../componentes/BarrasTotal.jsx'
import Evolucao from '../componentes/Evolucao.jsx'
import Filtros from '../componentes/Filtros.jsx'
import Frase from '../componentes/Frase.jsx'
import NotasQuebra from '../componentes/NotasQuebra.jsx'
import Ranking from '../componentes/Ranking.jsx'
import Ressalvas from '../componentes/Ressalvas.jsx'
import Rodape from '../componentes/Rodape.jsx'
import TabelaEstados from '../componentes/TabelaEstados.jsx'
import { avisosDaArea } from './avisos.js'

// Tela "Comparar": uma área, todos os estados.

// Coluna e posição usadas por cada combinação de métrica e valores
function colunasDaVisao(metrica, valores) {
  if (metrica === 'pct_total') return { valor: 'pct_despesa_total', posicao: 'posicao_pct_despesa_total' }
  if (valores === 'epoca') return { valor: 'per_capita_nominal', posicao: 'posicao_per_capita_nominal' }
  return { valor: 'per_capita_real', posicao: 'posicao_per_capita_real' }
}

export default function Comparar({ dados, estado, mudar, funcoes }) {
  const { meta, dicionarios, ipca, despesa, estatais } = dados
  const ufs = dicionarios.ufs
  const anoBase = meta.deflacao.ano_base_padrao

  // Contas: todas em calculos.js
  const indicadores = useMemo(
    () => indicadoresDaFuncao(despesa, ipca.serie, { funcao: estado.area, anoBase }),
    [despesa, ipca.serie, estado.area, anoBase],
  )
  const coluna = colunasDaVisao(estado.metrica, estado.valores)
  const medianas = useMemo(() => medianaPorAno(indicadores, coluna.valor), [indicadores, coluna.valor])
  const doAno = useMemo(
    () => ordenarPorPosicao(indicadores.filter((l) => l.ano === estado.ano), coluna.posicao),
    [indicadores, estado.ano, coluna.posicao],
  )

  const nomeArea = funcoes.find((f) => f.funcao_cod === estado.area)?.funcao_nome ?? ''
  const nomes = Object.fromEntries(ufs.map((u) => [u.uf, u.nome]))
  const medianaAno = medianas.find((m) => m.ano === estado.ano)
  const linhaUf = doAno.find((l) => l.uf === estado.uf)
  const infoUf = ufs.find((u) => u.uf === estado.uf)
  const semGasto = doAno.filter((l) => l.sem_gasto_declarado).map((l) => l.uf)

  const frase = estado.uf ? fraseResumo({
    ano: estado.ano, uf: estado.uf, artigo: infoUf?.artigo, area: nomeArea, metrica: estado.metrica,
    valores: estado.valores, valor: linhaUf?.[coluna.valor] ?? null, posicao: linhaUf?.[coluna.posicao] ?? null,
    nUfs: doAno.length, mediana: medianaAno?.mediana, semGasto: linhaUf?.sem_gasto_declarado,
  }) : null

  const linhaDe = (uf, ano) => indicadores.find((l) => l.uf === uf && l.ano === ano)
  const serie = (uf) => meta.anos.map((ano) => ({ ano, valor: linhaDe(uf, ano)?.[coluna.valor] ?? null }))
  const series = estado.uf ? [
    ...estado.pares.map((uf) => ({ id: uf, rotulo: uf, tipo: 'par', pontos: serie(uf) })),
    { id: 'mediana', rotulo: 'mediana', tipo: 'mediana', pontos: medianas.map((m) => ({ ano: m.ano, valor: m.mediana })) },
    { id: estado.uf, rotulo: estado.uf, tipo: 'destaque', pontos: serie(estado.uf) },
  ] : []
  const totaisNominais = estado.uf ? meta.anos.map((ano) => {
    const l = linhaDe(estado.uf, ano)
    return { ano, valor: l?.nominal ?? null, semGasto: l?.sem_gasto_declarado ?? false }
  }) : []

  // Estatais: só avisos, nenhum valor muda. Edição mais próxima do ano da tela.
  const comEstatal = useMemo(
    () => ufsComEstatalNaArea(estatais, estado.area, estado.ano), [estatais, estado.area, estado.ano])
  const avisos = avisosDaArea({
    estatais, uf: estado.uf, artigo: infoUf?.artigo, area: estado.area, ano: estado.ano, anos: meta.anos,
    siglasUfs: ufs.map((u) => u.uf),
  })

  const fonte = meta.fontes.find((f) => f.fonte_dado === 'siconfi_dca')
  const unidade = estado.metrica === 'pct_total' ? '% do orçamento estadual'
    : estado.valores === 'epoca' ? 'gasto por habitante, em R$ da época'
      : `gasto por habitante, em R$ de dez/${anoBase}`

  return (
    <main className="pagina">
      <header className="cabecalho">
        <h1>Comparar estados</h1>
        <p>Quanto cada governo estadual gasta em cada área, segundo as contas que entrega ao Tesouro Nacional.</p>
      </header>

      <Filtros
        estado={estado} ufs={ufs} anos={meta.anos} anoBase={anoBase} funcoes={funcoes}
        regioes={[...new Set(ufs.map((u) => u.regiao))]} paresPadrao={paresPadrao(ufs, estado.uf)} onMudar={mudar}
      />

      <Frase texto={frase} />

      <div className="graficos">
        <section className="secao">
          <h2>{nomeArea}: {unidade} · {estado.ano}</h2>
          <Ranking
            linhas={doAno} coluna={coluna.valor} colunaPosicao={coluna.posicao} metrica={estado.metrica}
            destaque={estado.uf} pares={estado.pares} mediana={medianaAno?.mediana} nomes={nomes}
            nota={notaSemGasto(semGasto, estado.ano)} comEstatal={comEstatal}
            onEscolherUf={(uf) => mudar({ uf, paresPersonalizados: estado.paresPersonalizados && uf !== estado.uf })}
          />
        </section>

        <div className="coluna-direita">
          <section className="secao">
            <h2>Evolução, {meta.anos[0]}–{meta.anos[meta.anos.length - 1]}</h2>
            {estado.uf
              ? <Evolucao
                  series={series} anos={meta.anos} metrica={estado.metrica} anoSelecionado={estado.ano} destaque={estado.uf}
                  quebras={avisos.anosQuebra}
                />
              : <p className="aviso">Escolha um estado para ver a evolução dele, dos pares e da mediana.</p>}
            <NotasQuebra avisos={avisos.avisosQuebra} fonte={avisos.fonteQuebras} />
          </section>

          {estado.uf && (
            <section className="secao">
              <h2>Valor total gasto {porUf(estado.uf, infoUf?.artigo)} em {nomeArea.toLocaleLowerCase('pt-BR')}, em R$ da época</h2>
              <BarrasTotal pontos={totaisNominais} anoSelecionado={estado.ano} />
              <p className="nota">Valores sem correção pela inflação, como aparecem nas contas oficiais.</p>
            </section>
          )}
        </div>
      </div>

      <section className="secao">
        <TabelaEstados
          linhas={doAno} destaque={estado.uf} ano={estado.ano} nomeArea={nomeArea} metrica={estado.metrica}
          valores={estado.valores} anoBase={anoBase} nomes={nomes} fonteCurta={fonte?.nome_curto ?? ''}
        />
      </section>

      <Alerta titulo="Antes de comparar">
        <Ressalvas
          ressalvas={meta.ressalvas} daArea={meta.ressalvas_por_funcao?.[estado.area] ?? []} nomeArea={nomeArea}
          avisos={avisos.avisosEstatais} fonteAvisos={avisos.fonteEstatais} semInfoEstatais={avisos.semInfoEstatais}
        />
      </Alerta>

      <Rodape fonte={fonte} estatais={estatais} />
    </main>
  )
}

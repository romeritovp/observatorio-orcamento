import {
  aprovacaoPorSerie, rankingIdeb, ressalvasDoIdeb, serieIdeb, tendenciasDoIdeb,
} from '../calculos.js'
import { paresPadrao } from '../estado.js'
import { CONFIGURACAO as CONFIG_TENDENCIA } from '../estatistica/tendencia.js'
import { data, numero, pct, pctComSinal } from '../formatacao.js'
import { deUf, doEstado, fraseIdeb, pontosComSinal, taxaAoAno, textoEvidencia } from '../textos.js'
import Alerta from '../componentes/Alerta.jsx'
import BarrasHorizontais from '../componentes/BarrasHorizontais.jsx'
import CartoesTendencia from '../componentes/CartoesTendencia.jsx'
import Evolucao from '../componentes/Evolucao.jsx'
import { FiltrosEducacao } from '../componentes/Filtros.jsx'
import Frase from '../componentes/Frase.jsx'
import Resumo from '../componentes/Resumo.jsx'
import Ressalvas from '../componentes/Ressalvas.jsx'
import TabelaUfs from '../componentes/TabelaUfs.jsx'

// Nomes curtos para os filtros e os textos (os ids vêm do meta.json → ideb, antes de o arquivo chegar)
const ETAPAS = {
  anos_iniciais: { nome: 'Anos iniciais (1º ao 5º ano)', frase: 'dos anos iniciais do fundamental', serie: (s) => `${s}º ano` },
  anos_finais: { nome: 'Anos finais (6º ao 9º ano)', frase: 'dos anos finais do fundamental', serie: (s) => `${s}º ano` },
  medio: { nome: 'Ensino médio', frase: 'do ensino médio', serie: (s) => `${s}ª série` },
}
const REDES = {
  estadual: { nome: 'Estadual', frase: 'rede estadual' }, publica: { nome: 'Pública', frase: 'rede pública' },
  privada: { nome: 'Privada', frase: 'rede privada' }, total: { nome: 'Total (todas as redes)', frase: 'soma das redes' },
}
const um = (v) => numero(v, 1)
const dois = (v) => numero(v, 2)
const posicao = (v) => (v === null || v === undefined ? '–' : `${v}º`)
const BRASIL = 'brasil'

// Tela "Educação": o IDEB (Inep) por estado, etapa e rede. ideb: ideb.json (geral, sem metas); idebUf: ideb/<UF>.json
// (aprovação por série). Ambos sob demanda (App.jsx). Contas em calculos.js; aqui só colunas e textos.
export default function Educacao({ dados, estado, mudar, ideb, idebUf, erroIdeb }) {
  const ufs = dados.dicionarios.ufs
  const { uf } = estado
  const infoUf = ufs.find((u) => u.uf === uf)
  const config = dados.meta.ideb ?? { anos: [], etapas: [], redes: [] }
  const etapa = estado.etapaIdeb
  const rede = estado.redeIdeb
  const nomeEtapa = ETAPAS[etapa]?.nome ?? etapa
  const nomeRede = REDES[rede]?.nome ?? rede
  // Redes que existem na etapa (o ensino médio das UFs não tem a rede pública na planilha do Inep)
  const redesDisponiveis = ideb ? [...new Set(Object.values(ideb.ufs).flatMap((d) => Object.keys(d.etapas[etapa] ?? {})))] : config.redes

  const cabecalho = (
    <>
      <header className="cabecalho">
        <h1>{infoUf ? `A educação ${doEstado(infoUf.nome, infoUf.artigo)}` : 'A educação nos estados'}</h1>
        <p>
          O IDEB, índice do Inep, junta o aprendizado (as notas do Saeb em matemática e língua portuguesa) e o fluxo
          escolar (a aprovação) num número de 0 a 10, medido a cada dois anos. A tela abre no ensino médio da rede
          estadual, a principal responsabilidade dos governos estaduais; troque a etapa e a rede nos filtros.
        </p>
      </header>
      <FiltrosEducacao estado={estado} ufs={ufs} anos={config.anos} regioes={[...new Set(ufs.map((u) => u.regiao))]}
        etapas={config.etapas.map((id) => ({ id, nome: ETAPAS[id]?.nome ?? id }))}
        redes={config.redes.map((id) => ({ id, nome: REDES[id]?.nome ?? id }))}
        redesDisponiveis={redesDisponiveis} paresPadrao={paresPadrao(ufs, uf)} onMudar={mudar} />
    </>
  )
  if (!ideb) {
    return (
      <main className="pagina">
        {cabecalho}
        <p className="aviso">{erroIdeb ? `Não foi possível carregar os dados do IDEB: ${erroIdeb}` : 'Carregando os dados do IDEB…'}</p>
      </main>
    )
  }

  const ano = estado.anoIdeb ?? Math.max(...ideb.anos)
  const iAno = ideb.anos.indexOf(ano)
  const anoAnterior = iAno > 0 ? ideb.anos[iAno - 1] : null
  const pares = estado.pares.filter((p) => p !== uf)
  const temRede = redesDisponiveis.includes(rede)
  const rodape = (
    <footer className="rodape">
      <p>
        Fonte: {ideb.fonte.orgao}, {ideb.fonte.nome}, edição {ideb.fonte.edicao} (formulação original de 2007).{' '}
        <a href={ideb.fonte.pagina}>Página de resultados</a>
        {ideb.fonte.arquivos.map((a) => <span key={a.url}> · <a href={a.url}>{a.planilha}</a></span>)}. Dados extraídos
        em {data(`${ideb.fonte.extraido_em}T12:00:00Z`)}; SHA-256 dos arquivos: {ideb.fonte.arquivos.map((a) => (
          <code key={a.sha256} className="sha">{a.sha256} </code>))}
        (MD5 das planilhas conferido com o publicado pelo Inep).
      </p>
      <p>
        Conferências da edição: os valores de controle de {ideb.anos.at(-1)} batem
        ({ideb.conferencia.controles_2025.filter((c) => c.ok).length} de {ideb.conferencia.controles_2025.length}), e o IDEB
        recalculado como N × P confere com o publicado em {numero(ideb.conferencia.n_x_p.conferidos)} casos (tolerância de ±0,1).
        Metas do IDEB não aparecem: não são resultado.
      </p>
    </footer>
  )
  const alerta = (
    <Alerta titulo="Antes de comparar" Nivel="h3">
      <Ressalvas ressalvas={ressalvasDoIdeb(ideb, uf, etapa, rede)} />
    </Alerta>
  )

  if (!temRede) {
    return (
      <main className="pagina">
        {cabecalho}
        <p className="frase vazia">A planilha do Inep não traz a {REDES[rede]?.frase ?? rede} {ETAPAS[etapa]?.frase} por estado. Escolha outra rede.</p>
        {rodape}
      </main>
    )
  }

  // Ranking das 27 UFs no ano (etapa e rede escolhidas)
  const ranking = rankingIdeb(ideb, etapa, rede, ano)
  const tabelaRanking = (
    <section className="secao">
      <TabelaUfs
        titulo={`IDEB das 27 UFs em ${ano}: ${nomeEtapa.toLocaleLowerCase('pt-BR')}, rede ${nomeRede.toLocaleLowerCase('pt-BR')}`}
        linhas={ranking} destaque={uf} pares={pares} nomeArquivo={`ideb_${etapa}_${rede}_${ano}.csv`}
        colunas={[
          { id: 'posicao', titulo: 'Posição', valor: (l) => l.posicao, formatar: posicao },
          { id: 'estado', titulo: 'Estado', valor: (l) => `${l.uf} · ${l.nome}`, formatar: (v) => v, classe: 'estado' },
          { id: 'ideb', titulo: 'IDEB', valor: (l) => l.ideb, formatar: um },
          { id: 'variacao', titulo: anoAnterior ? `Variação sobre ${anoAnterior}` : 'Variação', valor: (l) => l.variacao_pontos, formatar: pontosComSinal },
          { id: 'n', titulo: 'Aprendizado (N, 0 a 10)', valor: (l) => l.nota_padronizada, formatar: dois },
          { id: 'p', titulo: 'Fluxo (P, 0 a 1)', valor: (l) => l.rendimento, formatar: dois },
          { id: 'mat', titulo: 'Saeb matemática', valor: (l) => l.saeb_matematica, formatar: um },
          { id: 'port', titulo: 'Saeb língua portuguesa', valor: (l) => l.saeb_portugues, formatar: um },
        ]}
        nota="IDEB = N × P, como publicado pelo Inep. Posição: 1º = maior IDEB; estados sem dado no ano ficam sem posição, no fim."
      />
    </section>
  )

  if (!uf) {
    return (
      <main className="pagina">
        {cabecalho}
        <p className="frase vazia">Escolha um estado para ver a série histórica, a tendência e a aprovação por série.</p>
        {tabelaRanking}
        {alerta}
        {rodape}
      </main>
    )
  }

  // Resumo do ano
  const daUf = ranking.find((l) => l.uf === uf)
  const brasil = serieIdeb(ideb, BRASIL, etapa, rede, 'ideb')
  const brasilNoAno = brasil[iAno]?.valor ?? null
  const aprovacaoTotal = serieIdeb(ideb, uf, etapa, rede, 'aprovacao')[iAno]?.valor ?? null
  const resumo = [
    { id: 'ideb', rotulo: `IDEB em ${ano}`, valor: um(daUf?.ideb),
      detalhe: daUf?.posicao ? `${daUf.posicao}º de ${daUf.n_ufs} estados; Brasil: ${um(brasilNoAno)}` : 'sem IDEB neste ano' },
    { id: 'variacao', rotulo: anoAnterior ? `Variação sobre ${anoAnterior}` : 'Variação', valor: pontosComSinal(daUf?.variacao_pontos),
      detalhe: 'em pontos do IDEB (edição anterior)' },
    { id: 'n', rotulo: 'Aprendizado (N)', valor: dois(daUf?.nota_padronizada), detalhe: 'notas do Saeb padronizadas, de 0 a 10' },
    { id: 'p', rotulo: 'Fluxo (P)', valor: dois(daUf?.rendimento),
      detalhe: aprovacaoTotal === null ? 'de 0 a 1, a partir da aprovação' : `de 0 a 1; aprovação de ${pct(aprovacaoTotal)}` },
  ]
  const frase = fraseIdeb({
    uf, artigo: infoUf?.artigo, etapa: ETAPAS[etapa]?.frase, rede: REDES[rede]?.frase, ano, ideb: daUf?.ideb, posicao: daUf?.posicao,
    nUfs: daUf?.n_ufs, brasil: brasilNoAno, anoAnterior, anterior: anoAnterior ? serieIdeb(ideb, uf, etapa, rede, 'ideb')[iAno - 1].valor : null,
  })

  // Série histórica: a UF, os comparados e o Brasil
  const serie = (territorio, indicador, tipo, rotulo = territorio) => ({ id: territorio, rotulo, tipo, pontos: serieIdeb(ideb, territorio, etapa, rede, indicador) })
  const series = (indicador) => [serie(BRASIL, indicador, 'mediana', 'Brasil'), ...pares.map((p) => serie(p, indicador, 'par')), serie(uf, indicador, 'destaque')]
  const legenda = [
    { classe: 'destaque', rotulo: uf }, ...(pares.length ? [{ classe: 'par', rotulo: `comparados (${pares.join(', ')})` }] : []),
    { classe: 'linha-mediana', rotulo: 'Brasil' },
  ]

  // Tendência do IDEB (regressão sobre ln IDEB): um card por janela
  const janelas = tendenciasDoIdeb(ideb, uf, etapa, rede, ano)
  const rotuloJanela = (j) => (j.anos === null ? 'Série completa' : `Últimos ${j.anos} anos`)
  const cartoes = janelas.map((j) => {
    const r = j.resultado
    return {
      id: j.id, rotulo: `${rotuloJanela(j)} · ${j.inicio}–${j.fim}`, valor: taxaAoAno(r.taxaAnual), categoria: r.categoria?.nome ?? null,
      linhas: r.estimavel ? [
        textoEvidencia(r, CONFIG_TENDENCIA.margem_equivalencia_pct_ano),
        `${r.n} edições · acumulado: ${pctComSinal(r.variacaoAcumulada)}`,
        ...(r.qualidade === 'baixa' ? ['Leitura frágil: poucas edições ou desvios encadeados.'] : []),
      ] : ['Edições insuficientes para estimar.'],
    }
  })
  const escolhida = janelas.find((j) => j.id === estado.janelaIdeb) ?? janelas.at(-1)
  const rt = escolhida.resultado
  const anosAteAno = ideb.anos.filter((a) => a <= ano)
  const seriesTendencia = [
    { id: 'tendencia', rotulo: 'tendência', tipo: 'mediana',
      pontos: anosAteAno.map((a) => ({ ano: a, valor: rt.estimavel && a >= escolhida.inicio ? rt.previsto(a) : null })) },
    { id: uf, rotulo: uf, tipo: 'destaque', pontos: serieIdeb(ideb, uf, etapa, rede, 'ideb').filter((p) => p.ano <= ano) },
  ]

  // Aprovação por série no ano (arquivo da UF)
  const porSerie = idebUf ? aprovacaoPorSerie(idebUf, ideb.anos, etapa, rede, ano) : null

  return (
    <main className="pagina">
      {cabecalho}

      <section className="secao">
        <h3 className="titulo-secao">{ano}, em resumo: {nomeEtapa.toLocaleLowerCase('pt-BR')}, rede {nomeRede.toLocaleLowerCase('pt-BR')}</h3>
        <Resumo itens={resumo} />
        <Frase texto={frase} />
      </section>

      <hr className="intra-section" />

      <section className="secao">
        <h3 className="titulo-secao">IDEB, {ideb.anos[0]}–{ideb.anos.at(-1)}</h3>
        <Evolucao series={series('ideb')} anos={ideb.anos} metrica="indice" anoSelecionado={ano} destaque={uf} legenda={legenda} />
        <div className="pequenos-multiplos">
          <div>
            <h4>Aprendizado (N) <span className="nota">(0 a 10)</span></h4>
            <Evolucao series={series('nota_padronizada')} anos={ideb.anos} metrica="indice" anoSelecionado={ano} destaque={uf} legenda={legenda} compacto />
          </div>
          <div>
            <h4>Fluxo (P) <span className="nota">(0 a 1)</span></h4>
            <Evolucao series={series('rendimento')} anos={ideb.anos} metrica="escore" anoSelecionado={ano} destaque={uf} legenda={legenda} compacto />
          </div>
        </div>
        <p className="nota">
          IDEB = aprendizado (N) × fluxo (P). Um IDEB maior pode vir de mais aprendizado ou de mais aprovação; os dois
          gráficos menores mostram de onde veio. Em 2021, a aprovação foi inflada pela pandemia.
        </p>
      </section>

      <hr className="intra-section" />

      <section className="secao" id="tendencia-ideb">
        <h3 className="titulo-secao">Tendência do IDEB {deUf(uf, infoUf?.artigo)}</h3>
        <p className="nota">
          Variação proporcional média por ano, de uma reta ajustada aos logaritmos do IDEB (mesmo método da tela PIB dos
          Estados). O IDEB sai a cada dois anos: poucas edições dão leituras frágeis. Toque num card para ver a reta.
        </p>
        <CartoesTendencia itens={cartoes} selecionado={escolhida.id} onEscolher={(j) => mudar({ janelaIdeb: j })} />
        <Evolucao series={seriesTendencia} anos={anosAteAno} metrica="indice" anoSelecionado={ano} destaque={uf} compacto legenda={[
          { classe: 'destaque', rotulo: `IDEB ${deUf(uf, infoUf?.artigo)}` },
          { classe: 'linha-mediana', rotulo: `tendência ${escolhida.inicio}–${escolhida.fim}: ${taxaAoAno(rt.taxaAnual)}` },
        ]} />
      </section>

      <hr className="intra-section" />

      {tabelaRanking}

      <hr className="intra-section" />

      <section className="secao">
        <h3 className="titulo-secao">Aprovação por {etapa === 'medio' ? 'série' : 'ano'} em {ano}</h3>
        {porSerie === null ? <p className="aviso">Carregando a aprovação por série…</p>
          : porSerie.every((s) => s.valor === null) ? <p className="nota">Sem aprovação por série neste ano.</p> : (
            <BarrasHorizontais rotuloAcessivel={`Aprovação por série, ${ano}`} itens={[
              { id: 'total', rotulo: 'Total da etapa', valor: aprovacaoTotal, texto: pct(aprovacaoTotal), destaque: true },
              ...porSerie.map((s) => ({ id: s.serie, rotulo: ETAPAS[etapa].serie(s.serie), valor: s.valor, texto: pct(s.valor) })),
            ]} />
          )}
        <p className="nota">Taxa de aprovação, em %. A reprovação e o abandono se concentram onde a barra é menor.</p>
      </section>

      <hr className="intra-section" />

      <section className="secao">
        <h3 className="titulo-secao">Notas do Saeb, {ideb.anos[0]}–{ideb.anos.at(-1)}</h3>
        <div className="pequenos-multiplos">
          <div>
            <h4>Matemática</h4>
            <Evolucao series={series('saeb_matematica')} anos={ideb.anos} metrica="indice" anoSelecionado={ano} destaque={uf} legenda={legenda} compacto />
          </div>
          <div>
            <h4>Língua portuguesa</h4>
            <Evolucao series={series('saeb_portugues')} anos={ideb.anos} metrica="indice" anoSelecionado={ano} destaque={uf} legenda={legenda} compacto />
          </div>
        </div>
        <p className="nota">Proficiência na escala do Saeb de cada etapa: não compare notas de etapas diferentes.</p>
      </section>

      {alerta}
      {rodape}
    </main>
  )
}

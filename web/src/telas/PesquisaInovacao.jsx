import { useMemo } from 'react'

import {
  cruzamentoPesquisa, dispersaoIbid, indicadoresDaFuncao, indicadoresDaSubfuncao, pilaresComparados, rankingIbid, serieIbid,
} from '../calculos.js'
import { tituloDaPagina } from '../navegacao.config.js'
import { EVOLUCOES_IBID, paresPadrao } from '../estado.js'
import { data, numero, pct, reais } from '../formatacao.js'
import { deUf, doEstado, fraseRankingIbid } from '../textos.js'
import Alerta from '../componentes/Alerta.jsx'
import BarrasComparadas from '../componentes/BarrasComparadas.jsx'
import Dispersao from '../componentes/Dispersao.jsx'
import Evolucao from '../componentes/Evolucao.jsx'
import { FiltrosInovacao } from '../componentes/Filtros.jsx'
import Frase from '../componentes/Frase.jsx'
import Ressalvas from '../componentes/Ressalvas.jsx'
import TabelaAnos from '../componentes/TabelaAnos.jsx'
import TabelaUfs from '../componentes/TabelaUfs.jsx'

const FUNCAO_CIENCIA_TECNOLOGIA = '19'
// Ensino Superior: subfunção 364 dentro de Educação (função 12), onde aparecem as universidades estaduais
const ENSINO_SUPERIOR = { funcao: '12', subfuncao: '364' }
const escore = (v) => numero(v, 3)
const posicao = (v) => (v === null || v === undefined ? '–' : `${v}º`)
// Eixo da posição no ranking: 1º no topo
const ESCALA_POSICAO = { min: 1, max: 27, marcas: [1, 5, 10, 15, 20, 27], invertido: true }

// Tela "Pesquisa e Inovação": o IBID (INPI) das UFs e a despesa estadual em Ciência e Tecnologia (função 19).
// ibid: ibid.json; ensinoSuperior: despesa_ensino_superior.json (App.jsx, sob demanda). Comparabilidade dos escores entre anos: meta.json → ibid (config/ibid.yaml):
// enquanto não for confirmada, a evolução no tempo é só por posição, e escores só se comparam no mesmo ano.
export default function PesquisaInovacao({ dados, estado, mudar, ibid, ensinoSuperior, erroIbid }) {
  const { meta, dicionarios, despesa, ipca } = dados
  const ufs = dicionarios.ufs
  const { uf } = estado
  const infoUf = ufs.find((u) => u.uf === uf)
  const config = meta.ibid ?? { anos: [], escores_comparaveis_entre_anos: false, ressalvas: [] }
  const anoBase = meta.deflacao.ano_base_padrao
  const nomeFuncao = dicionarios.funcoes.find((f) => f.funcao_cod === FUNCAO_CIENCIA_TECNOLOGIA)?.funcao_nome ?? 'Ciência e Tecnologia'

  // Despesa em C&T: mesmas contas das outras telas (deflator, população, base do % do orçamento)
  const cienciaTecnologia = useMemo(
    () => indicadoresDaFuncao(despesa, ipca.serie, { funcao: FUNCAO_CIENCIA_TECNOLOGIA, anoBase }), [despesa, ipca.serie, anoBase])
  const ensino = useMemo(() => (ensinoSuperior
    ? indicadoresDaSubfuncao(despesa, ensinoSuperior, ipca.serie, { ...ENSINO_SUPERIOR, anoBase }) : null), [despesa, ensinoSuperior, ipca.serie, anoBase])
  const nomeEnsinoSuperior = dicionarios.subfuncoes.find((f) => f.subfuncao_cod === ENSINO_SUPERIOR.subfuncao)?.subfuncao_nome ?? 'Ensino Superior'

  const cabecalho = (
    <>
      <header className="cabecalho">
        <h1>{tituloDaPagina('pesquisa-e-inovacao', uf, 'Pesquisa e inovação nos estados')}</h1>
        <p>
          O Índice Brasil de Inovação e Desenvolvimento (IBID), publicado pelo INPI (Instituto Nacional da Propriedade
          Industrial), compara as 27 UFs em dois grupos de indicadores. O <strong>Contexto</strong> mede as condições para
          inovar: instituições, capital humano, infraestrutura, economia e ambiente de negócios. O <strong>Resultado</strong> mede
          o que efetivamente se produz: conhecimento e tecnologia e economia criativa. Os escores vão de 0 a 1 (maior é
          melhor); no ranking, o 1º é o melhor.
        </p>
      </header>
      <FiltrosInovacao estado={estado} ufs={ufs} anos={config.anos} regioes={[...new Set(ufs.map((u) => u.regiao))]}
        paresPadrao={paresPadrao(ufs, uf)} onMudar={mudar} />
    </>
  )
  if (!ibid || !ensino) {
    return (
      <main className="pagina">
        {cabecalho}
        <p className="aviso">{erroIbid ? `Não foi possível carregar os dados do IBID: ${erroIbid}` : 'Carregando os dados do IBID…'}</p>
      </main>
    )
  }

  const ano = estado.anoIbid ?? Math.max(...ibid.anos)
  const pares = estado.pares.filter((p) => p !== uf)
  const nomeUf = Object.fromEntries(Object.entries(ibid.ufs).map(([u, d]) => [u, d.nome]))
  const ressalvas = <Alerta titulo="Antes de comparar" Nivel="h3"><Ressalvas ressalvas={config.ressalvas} /></Alerta>
  const rodape = (
    <footer className="rodape">
      <p>
        Fonte: {ibid.fonte.orgao}, {ibid.fonte.nome}. <a href={ibid.fonte.url}>Planilha da série histórica</a>
        {config.pagina_oficial && <> · <a href={config.pagina_oficial}>página do índice</a></>}.
        Dados extraídos em {data(`${ibid.fonte.extraido_em}T12:00:00Z`)}. SHA-256 do arquivo: <code className="sha">{ibid.fonte.arquivo_sha256}</code>.
        {ibid.conferencia.ranking_oficial_vs_escore === 'ok' && ' O ranking oficial confere com a ordenação dos escores em todos os anos.'}
      </p>
      <p>Despesa em {nomeFuncao} (função 19) e em {nomeEnsinoSuperior} (subfunção 364, Educação): SICONFI/Tesouro Nacional (Declaração de Contas Anuais, Anexo I-E), liquidada, sem intraorçamentárias; IPCA (IBGE).</p>
    </footer>
  )

  // 2. Ranking das 27 UFs no ano
  const ranking = rankingIbid(ibid, ano)
  const tabelaRanking = (
    <section className="secao">
      <TabelaUfs
        titulo={`Ranking das 27 UFs, ${ano}`} linhas={ranking} destaque={uf} pares={pares}
        nomeArquivo={`ibid_ranking_${ano}.csv`}
        colunas={[
          { id: 'posicao', titulo: 'Posição', valor: (l) => l.posicao, formatar: posicao },
          { id: 'estado', titulo: 'Estado', valor: (l) => `${l.uf} · ${l.nome}`, formatar: (v) => v, classe: 'estado' },
          { id: 'geral', titulo: 'Escore geral', valor: (l) => l.geral, formatar: escore },
          { id: 'contexto', titulo: 'Contexto', valor: (l) => l.contexto, formatar: escore },
          { id: 'posicao_contexto', titulo: 'Posição no Contexto', valor: (l) => l.posicao_contexto, formatar: posicao },
          { id: 'resultado', titulo: 'Resultado', valor: (l) => l.resultado, formatar: escore },
          { id: 'posicao_resultado', titulo: 'Posição no Resultado', valor: (l) => l.posicao_resultado, formatar: posicao },
        ]}
        nota="Escores de 0 a 1 (maior é melhor) e posições como publicados pelo INPI. Escores só se comparam dentro do mesmo ano."
      />
    </section>
  )

  // 5. Contexto × Resultado no ano
  const disp = dispersaoIbid(ibid, ano)
  const tipo = (u) => (u === uf ? 'destaque' : pares.includes(u) ? 'par' : 'outro')
  const dispersao = (
    <section className="secao">
      <h3 className="titulo-secao">Contexto × Resultado, {ano}</h3>
      <p className="nota">
        Cada ponto é um estado. À direita, mais condições para inovar; acima, mais resultado. As linhas tracejadas são as
        medianas dos 27 estados (o estado típico): abaixo e à direita ficam os que têm condições e convertem menos; acima e
        à esquerda, os que produzem mais do que as condições sugerem. Só o estado escolhido e os comparados têm rótulo;
        passe o mouse ou toque num ponto para ver os outros.
      </p>
      <Dispersao
        pontos={disp.pontos.map((p) => ({
          id: p.uf, x: p.contexto, y: p.resultado, rotulo: p.uf, tipo: tipo(p.uf),
          dica: [`${p.uf} · ${p.nome}`, `Contexto: ${escore(p.contexto)}`, `Resultado: ${escore(p.resultado)}`],
        }))}
        mediana={{ x: disp.medianaContexto, y: disp.medianaResultado }} eixos={{ x: 'Contexto', y: 'Resultado' }}
        quadrantes={{ superiorEsquerdo: 'menos condições, mais resultado', inferiorDireito: 'mais condições, menos resultado' }}
        formatar={(v) => numero(v, 2)}
      />
    </section>
  )

  if (!uf) {
    return (
      <main className="pagina">
        {cabecalho}
        <p className="frase vazia">Escolha um estado para ver a evolução, os pilares e o gasto do estado em pesquisa.</p>
        {tabelaRanking}
        <hr className="intra-section" />
        {dispersao}
        {ressalvas}
        {rodape}
      </main>
    )
  }

  // 3. Evolução: posição no ranking (escore só se os escores forem comparáveis entre anos)
  const medida = config.escores_comparaveis_entre_anos && estado.evolucaoIbid === 'escore' ? 'escore' : 'posicao'
  const serie = (u, tipoSerie) => ({ id: u, rotulo: u, tipo: tipoSerie, pontos: serieIbid(ibid, u, 'geral', medida) })
  const evolucao = [...pares.map((p) => serie(p, 'par')), serie(uf, 'destaque')]
  const atual = ibid.ufs[uf].ranking.geral[String(ano)]
  const primeiro = ibid.ufs[uf].ranking.geral[String(ibid.anos[0])]

  // 4. Pilares contra a região e o Brasil
  const pilares = pilaresComparados(ibid, uf, infoUf.regiao, ano)
  const nomeRegiao = ibid.agregados[Object.keys(ibid.agregados).find((k) => ibid.agregados[k].nome === infoUf.regiao)]?.nome ?? infoUf.regiao
  const nomeSubindice = Object.fromEntries(ibid.dimensoes.map((d) => [d.id, d.nome.replace('IBID – ', '')]))

  // 6. Cruzamento com o orçamento: C&T (função 19), Ensino Superior (12.364) e a soma, só nos anos das duas fontes
  const cruzamento = cruzamentoPesquisa(cienciaTecnologia, ensino, ibid)
  const anosComuns = [...new Set(cruzamento.map((l) => l.ano))].sort((a, b) => a - b)
  const daUf = new Map(cruzamento.filter((l) => l.uf === uf).map((l) => [l.ano, l]))
  const linhaDaUf = (id, rotulo, campo, formatar) => ({ id, rotulo, valores: anosComuns.map((a) => daUf.get(a)?.[campo] ?? null), formatar })
  const doAno = cruzamento.filter((l) => l.ano === ano).sort((a, b) => (a.posicao_ibid ?? Infinity) - (b.posicao_ibid ?? Infinity))
  const emReais = `R$ de dez/${anoBase}`
  const porHab = (v) => reais(v, true)
  const pct2 = (v) => pct(v, 2)
  const SOMA = 'C&T + Ensino Superior'
  const semEnsino = anosComuns.filter((a) => daUf.get(a)?.es_sem_gasto)
  const observacao = (l) => [l.ct_sem_gasto ? 'sem C&T declarada' : '', l.es_sem_gasto ? 'sem Ensino Superior (364) declarado' : '']
    .filter(Boolean).join('; ')

  return (
    <main className="pagina">
      {cabecalho}

      {tabelaRanking}

      <hr className="intra-section" />

      <section className="secao">
        <h3 className="titulo-secao">Evolução {medida === 'posicao' ? 'da posição no ranking' : 'do escore'}, {ibid.anos[0]}–{ibid.anos.at(-1)}</h3>
        {config.escores_comparaveis_entre_anos && (
          <div className="alternador alternador-pequeno" role="group" aria-label="Medida da evolução">
            {Object.entries(EVOLUCOES_IBID).map(([m, nome]) => (
              <button key={m} type="button" aria-pressed={medida === m} onClick={() => mudar({ evolucaoIbid: m })}>{nome}</button>
            ))}
          </div>
        )}
        <Frase texto={fraseRankingIbid({ nome: nomeUf[uf], ano, atual, anoInicial: ibid.anos[0], inicial: primeiro })} />
        <Evolucao series={evolucao} anos={ibid.anos} metrica={medida} anoSelecionado={ano} destaque={uf}
          escala={medida === 'posicao' ? ESCALA_POSICAO : undefined} legenda={[
            { classe: 'destaque', rotulo: uf }, ...(pares.length ? [{ classe: 'par', rotulo: `comparados (${pares.join(', ')})` }] : []),
          ]} />
        <p className="nota">
          {medida === 'posicao'
            ? 'Posição no índice geral (1º = melhor), no topo do gráfico. A comparação entre anos é feita só pela posição: os escores podem ser recalculados a cada ano.'
            : 'Escore geral, de 0 a 1.'} Para comparar com outros estados, use "Comparar com" nos filtros.
        </p>
      </section>

      <hr className="intra-section" />

      <section className="secao">
        <h3 className="titulo-secao">Os sete pilares {deUf(uf, infoUf.artigo)}, {ano}</h3>
        <BarrasComparadas
          rotuloAcessivel={`Pilares do IBID, ${ano}`} maximo={1} formatar={escore}
          series={[
            { id: 'uf', rotulo: nomeUf[uf], classe: 'destaque' },
            { id: 'regiao', rotulo: `${nomeRegiao} (escore da região, INPI)`, classe: 'par' },
            { id: 'brasil', rotulo: 'Brasil (escore do país, INPI)', classe: 'mediana' },
            { id: 'tipico', rotulo: 'Estado típico (mediana das UFs, calculada pelo Observatório)', classe: 'tipico' },
          ]}
          itens={pilares.map((p) => ({ id: p.dimensao, rotulo: `${p.nome} · ${nomeSubindice[p.pai]}`, valores: p }))}
        />
        <p className="nota">
          Escores de 0 a 1 no mesmo ano. Os escores da região e do Brasil são os do INPI, calculados para o território como
          um todo, e não a média dos estados: o do Brasil fica acima da maioria das UFs. Por isso, estar abaixo do Brasil não
          significa estar abaixo da maioria dos estados; para isso, compare com o estado típico (a mediana das 27 UFs, calculada
          pelo Observatório a partir dos escores do INPI).
        </p>
      </section>

      <hr className="intra-section" />

      {dispersao}

      <hr className="intra-section" />

      <section className="secao">
        <h3 className="titulo-secao">Gasto do estado em pesquisa e posição no IBID</h3>
        <p className="nota">
          Duas despesas separadas e a soma delas: {nomeFuncao} (função {FUNCAO_CIENCIA_TECNOLOGIA}), onde ficam as fundações de
          amparo à pesquisa, e {nomeEnsinoSuperior} (subfunção {ENSINO_SUPERIOR.subfuncao}, dentro de Educação), onde aparecem as
          universidades estaduais. Despesa liquidada, sem intraorçamentárias, com as mesmas contas das outras telas: valores
          corrigidos pela inflação até dezembro de {anoBase}, população das contas anuais e % do orçamento estadual. Só os anos
          que existem nas duas fontes ({anosComuns[0]}–{anosComuns.at(-1)}).
        </p>
        <TabelaAnos
          titulo={`${nomeUf[uf]}: gasto em pesquisa e IBID, ${anosComuns[0]}–${anosComuns.at(-1)}`}
          nota={`Por habitante em ${emReais}.${semEnsino.length ? ` Sem ${nomeEnsinoSuperior} (364) declarado em ${semEnsino.join(', ')}: entra como zero.` : ''}`}
          linhas={[
            linhaDaUf('ct_pc', `${nomeFuncao}: por habitante`, 'ct_per_capita_real', porHab),
            linhaDaUf('ct_pct', `${nomeFuncao}: % do orçamento`, 'ct_pct', pct2),
            linhaDaUf('es_pc', `${nomeEnsinoSuperior}: por habitante`, 'es_per_capita_real', porHab),
            linhaDaUf('es_pct', `${nomeEnsinoSuperior}: % do orçamento`, 'es_pct', pct2),
            linhaDaUf('soma_pc', `${SOMA}: por habitante`, 'soma_per_capita_real', porHab),
            linhaDaUf('soma_pct', `${SOMA}: % do orçamento`, 'soma_pct', pct2),
            linhaDaUf('posicao_soma', `Posição em ${SOMA} por habitante`, 'posicao_soma', posicao),
            linhaDaUf('posicao_ibid', 'Posição no IBID (geral)', 'posicao_ibid', posicao),
          ]}
          anos={anosComuns} anoSelecionado={ano} nomeArquivo={`pesquisa_ibid_${uf}.csv`}
        />
        {doAno.length > 0 ? (
          <div className="secao"><TabelaUfs
            titulo={`Os 27 estados em ${ano}, na ordem do IBID`} linhas={doAno} destaque={uf} pares={pares}
            nomeArquivo={`pesquisa_ibid_${ano}.csv`}
            colunas={[
              { id: 'posicao_ibid', titulo: 'Posição no IBID', valor: (l) => l.posicao_ibid, formatar: posicao },
              { id: 'estado', titulo: 'Estado', valor: (l) => `${l.uf} · ${nomeUf[l.uf]}`, formatar: (v) => v, classe: 'estado' },
              { id: 'ct', titulo: `${nomeFuncao} por habitante (${emReais})`, valor: (l) => l.ct_per_capita_real, formatar: (v) => numero(v, 2) },
              { id: 'es', titulo: `${nomeEnsinoSuperior} por habitante (${emReais})`, valor: (l) => l.es_per_capita_real, formatar: (v) => numero(v, 2) },
              { id: 'soma', titulo: `${SOMA} por habitante (${emReais})`, valor: (l) => l.soma_per_capita_real, formatar: (v) => numero(v, 2) },
              { id: 'soma_pct', titulo: `${SOMA}: % do orçamento`, valor: (l) => l.soma_pct, formatar: pct2 },
              { id: 'posicao_soma', titulo: `Posição em ${SOMA} por habitante`, valor: (l) => l.posicao_soma, formatar: posicao },
              { id: 'obs', titulo: 'Observação', valor: observacao, formatar: (v) => v, classe: 'obs' },
            ]}
            nota="Despesa não declarada no ano entra como zero, marcada na observação, como nas outras telas."
          /></div>
        ) : (
          <p className="nota">Não há despesa estadual para {ano}: a série do orçamento vai de {anosComuns[0]} a {anosComuns.at(-1)}.</p>
        )}
      </section>

      {ressalvas}
      {rodape}
    </main>
  )
}

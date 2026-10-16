import { indiceMvi, pctMdipNasMvi, rankingMvi, serieMvi } from '../calculos.js'
import { tituloDaPagina } from '../navegacao.config.js'
import { numero, pct, pctComSinal } from '../formatacao.js'
import { deUf, fraseViolencia } from '../textos.js'
import Alerta from '../componentes/Alerta.jsx'
import BarrasHorizontais from '../componentes/BarrasHorizontais.jsx'
import Evolucao from '../componentes/Evolucao.jsx'
import { FiltrosViolencia } from '../componentes/Filtros.jsx'
import Frase from '../componentes/Frase.jsx'
import Resumo from '../componentes/Resumo.jsx'
import Ressalvas, { Entenda } from '../componentes/Ressalvas.jsx'

// Tela "Violência": mortes violentas intencionais (MVI) por estado, do Anuário Brasileiro de Segurança Pública (FBSP).
// violencia: violencia.json (todas as UFs e o Brasil), sob demanda (App.jsx). O destaque é o número de mortes; a taxa
// por 100 mil fica em segundo plano, porque muda de base de população entre edições (violencia.quebras_taxa).
// Contas em calculos.js; aqui só colunas e textos.
export default function Violencia({ dados, estado, mudar, violencia, erroViolencia }) {
  const ufs = dados.dicionarios.ufs
  const { uf } = estado
  const infoUf = ufs.find((u) => u.uf === uf)

  const cabecalho = (
    <>
      <header className="cabecalho">
        <h1>{tituloDaPagina('violencia', uf, 'A violência nos estados')}</h1>
        <p>
          Mortes violentas intencionais: homicídios, latrocínios, lesões corporais seguidas de morte e mortes por
          intervenção policial, segundo o Anuário Brasileiro de Segurança Pública, que reúne os registros das secretarias
          de segurança de cada estado.
        </p>
      </header>
      <FiltrosViolencia estado={estado} ufs={ufs} onMudar={mudar} />
    </>
  )
  if (!violencia) {
    return (
      <main className="pagina">
        {cabecalho}
        <p className="aviso">{erroViolencia ? `Não foi possível carregar os dados de violência: ${erroViolencia}` : 'Carregando os dados de violência…'}</p>
      </main>
    )
  }

  const { linhas, anos, pais, ultimo_ano: ano, quebras_taxa: quebras } = violencia
  const primeiro = anos[0]
  const nome = Object.fromEntries(violencia.territorios.map((t) => [t.uf, t.nome]))
  const ranking = rankingMvi(linhas, ano, pais)
  const edicoes = `edições ${violencia.edicoes[0]} a ${violencia.edicoes[violencia.edicoes.length - 1]}`
  const rodape = (
    <footer className="rodape">
      <p>
        Fonte: {violencia.fonte}, {edicoes} (<a href={violencia.pagina}>página do Anuário</a>). Para cada ano vale a edição
        mais recente que o traz; {ano} saiu numa edição só e está sujeito a revisão.
      </p>
    </footer>
  )
  const graficoRanking = (
    <>
      <BarrasHorizontais rotuloAcessivel={`Taxa de mortes violentas intencionais por 100 mil habitantes, ${ano}`}
        itens={ranking.map((l) => ({
          id: l.uf, rotulo: `${l.uf} · ${nome[l.uf]}`, valor: l.taxa,
          texto: `${numero(l.taxa, 1)} (${numero(l.numero)} mortes)`, destaque: l.uf === uf,
        }))} />
      <p className="nota">
        Mortes por 100 mil habitantes em {ano} (1º = maior taxa). Para comparar estados no mesmo ano, a taxa vale: todas
        vêm da mesma edição do Anuário, com a mesma base de população. {ano} está sujeito a revisão. <Entenda id="mvi_sujeito_a_revisao" />
      </p>
    </>
  )
  const ressalvas = (
    <Alerta titulo="Antes de usar estes números" Nivel="h3">
      <Ressalvas ressalvas={violencia.ressalvas} />
    </Alerta>
  )

  // Visão nacional: o total do Brasil na série e o ranking das 27 UFs no último ano
  if (!uf) {
    return (
      <main className="pagina">
        {cabecalho}
        <section className="secao">
          <h3 className="titulo-secao">Mortes violentas intencionais no Brasil, {primeiro}–{ano}</h3>
          <Evolucao series={[{ id: pais, rotulo: nome[pais], tipo: 'destaque', pontos: serieMvi(linhas, pais, anos) }]}
            anos={anos} metrica="contagem" anoSelecionado={ano} destaque={nome[pais]} anoProvisorio={ano}
            legenda={[{ classe: 'destaque', rotulo: `${nome[pais]}, número de mortes` }]} />
          <p className="nota">
            Soma dos 27 estados, como publicada no Anuário. Cada ano vem da edição mais recente que o traz (o ano anterior
            costuma ser revisado para cima). <Entenda id="mvi_edicao_mais_recente" />
          </p>
        </section>
        <hr className="intra-section" />
        <section className="secao">
          <h3 className="titulo-secao">Os estados pela taxa de mortes violentas intencionais, {ano}</h3>
          {graficoRanking}
        </section>
        <hr className="intra-section" />
        <LetalidadePolicial violencia={violencia} ufs={ufs} nome={nome} />
        <p className="frase vazia">Escolha um estado para ver a série dele e a comparação com a região e o Brasil.</p>
        {ressalvas}
        {rodape}
      </main>
    )
  }

  // Página do estado
  const regiao = infoUf?.regiao
  const membrosRegiao = ufs.filter((u) => u.regiao === regiao).map((u) => u.uf)
  const linhaUf = linhas.find((l) => l.uf === uf && l.ano === ano)
  const posicao = ranking.find((l) => l.uf === uf)
  const indice = (membros) => indiceMvi(linhas, membros, primeiro, anos)
  const variacao = (membros) => {
    const v = indice(membros).find((p) => p.ano === ano)?.valor
    return v === null || v === undefined ? null : v - 100
  }
  const variacaoUf = variacao([uf])
  const variacaoBrasil = variacao([pais])
  const variacaoRegiao = variacao(membrosRegiao)

  const resumo = [
    { id: 'numero', rotulo: `Mortes violentas intencionais em ${ano}`, valor: numero(linhaUf?.mvi_numero),
      detalhe: `sujeito a revisão (primeira publicação, edição ${linhaUf?.edicao_fonte})` },
    { id: 'variacao', rotulo: `Variação ${primeiro}–${ano}`, valor: pctComSinal(variacaoUf),
      detalhe: `no número de mortes; ${regiao}: ${pctComSinal(variacaoRegiao)}; Brasil: ${pctComSinal(variacaoBrasil)}` },
    { id: 'posicao', rotulo: `Posição pela taxa, ${ano}`, valor: posicao?.posicao ? `${posicao.posicao}º de ${posicao.n_ufs}` : '–',
      detalhe: `${numero(posicao?.taxa, 1)} mortes por 100 mil habitantes (1º = maior taxa)` },
  ]
  const frase = fraseViolencia({
    uf, artigo: infoUf?.artigo, ano, mortes: linhaUf?.mvi_numero, primeiroAno: primeiro, variacaoUf, variacaoBrasil,
    posicao: posicao?.posicao, nUfs: posicao?.n_ufs, taxa: posicao?.taxa,
  })
  const revisoes = linhas.filter((l) => l.uf === uf).sort((a, b) => a.ano - b.ano)

  return (
    <main className="pagina">
      {cabecalho}

      <section className="secao">
        <h3 className="titulo-secao">{ano}, em resumo</h3>
        <Resumo itens={resumo} />
        <Frase texto={frase} />
      </section>

      <hr className="intra-section" />

      <section className="secao">
        <h3 className="titulo-secao">Mortes violentas intencionais {deUf(uf, infoUf?.artigo)}, {primeiro}–{ano}</h3>
        <Evolucao series={[{ id: uf, rotulo: uf, tipo: 'destaque', pontos: serieMvi(linhas, uf, anos) }]}
          anos={anos} metrica="contagem" anoSelecionado={ano} destaque={uf} anoProvisorio={ano}
          legenda={[{ classe: 'destaque', rotulo: `${uf}, número de mortes` }]} />
        <p className="nota">
          Número de vítimas. Cada ano vem da edição mais recente do Anuário que o traz; {ano} saiu numa edição só e pode
          mudar na próxima. <Entenda id="mvi_edicao_mais_recente" />
        </p>
        <details className="dados-tabela">
          <summary>Ver as revisões entre edições</summary>
          <div className="rolagem">
            <table className="tabela numeros">
              <thead>
                <tr><th scope="col">Ano</th><th scope="col">Primeira publicação</th><th scope="col">Valor usado</th><th scope="col">Revisão</th></tr>
              </thead>
              <tbody>
                {revisoes.map((l) => (
                  <tr key={l.ano}>
                    <th scope="row">{l.ano}{l.ano === violencia.ano_sujeito_a_revisao ? ' (sujeito a revisão)' : ''}</th>
                    <td>{numero(l.mvi_numero_primeira_publicacao)} (edição {l.edicao_primeira_publicacao})</td>
                    <td>{numero(l.mvi_numero)} (edição {l.edicao_fonte})</td>
                    <td>{l.edicao_fonte === l.edicao_primeira_publicacao ? '–' : `${l.revisao_numero > 0 ? '+' : ''}${numero(l.revisao_numero)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <hr className="intra-section" />

      <section className="secao">
        <h3 className="titulo-secao">Comparação com a região {regiao} e o Brasil ({primeiro} = 100)</h3>
        <Evolucao series={[
          { id: 'brasil', rotulo: nome[pais], tipo: 'mediana', pontos: indice([pais]) },
          { id: 'regiao', rotulo: regiao, tipo: 'par', pontos: indice(membrosRegiao) },
          { id: uf, rotulo: uf, tipo: 'destaque', pontos: indice([uf]) },
        ]} anos={anos} metrica="indice" anoSelecionado={ano} destaque={uf} anoProvisorio={ano} legenda={[
          { classe: 'destaque', rotulo: uf }, { classe: 'par', rotulo: `${regiao} (soma dos estados)` },
          { classe: 'linha-mediana', rotulo: nome[pais] },
        ]} />
        <p className="nota">
          Número de mortes com {primeiro} = 100: abaixo de 100, menos mortes que em {primeiro}; acima, mais. Compara a
          evolução de territórios de tamanhos diferentes sem depender da população.
        </p>
      </section>

      <hr className="intra-section" />

      <section className="secao">
        <h3 className="titulo-secao">Todos os estados pela taxa, {ano}</h3>
        {graficoRanking}
      </section>

      <hr className="intra-section" />

      <LetalidadePolicial violencia={violencia} ufs={ufs} nome={nome} uf={uf} infoUf={infoUf} />

      <hr className="intra-section" />

      <section className="secao secundaria">
        <h4>A taxa por 100 mil habitantes, {primeiro}–{ano}</h4>
        <Evolucao series={[
          { id: 'brasil', rotulo: nome[pais], tipo: 'mediana', pontos: serieMvi(linhas, pais, anos, 'mvi_taxa') },
          { id: uf, rotulo: uf, tipo: 'destaque', pontos: serieMvi(linhas, uf, anos, 'mvi_taxa') },
        ]} anos={anos} metrica="taxa" anoSelecionado={ano} destaque={uf} quebras={quebras} rotuloQuebra="mudança de base"
          anoProvisorio={ano} compacto legenda={[
            { classe: 'destaque', rotulo: `${uf}, por 100 mil habitantes` }, { classe: 'linha-mediana', rotulo: nome[pais] },
          ]} />
        <p className="nota">
          Atenção: entre {quebras.map((a) => `${a - 1} e ${a}`).join(' e entre ')} a taxa muda de base de população (Censo
          2022 e, depois, estimativas novas do IBGE), e sobe ou cai também por isso. Para a evolução no tempo, use o número
          de mortes. <Entenda id="mvi_quebra_taxa" />
        </p>
      </section>

      {ressalvas}
      {rodape}
    </main>
  )
}

// Letalidade policial: mortes decorrentes de intervenção policial (MDIP, polícias civil e militar, em serviço e fora),
// que estão dentro das MVI. Número (destaque), % das MVI (UF, região e Brasil: não depende da população) e ranking das
// UFs pela taxa no último ano. Sem `uf`, a visão nacional: o Brasil e o ranking.
function LetalidadePolicial({ violencia, ufs, nome, uf = null, infoUf = null }) {
  const { linhas, anos, pais, ultimo_ano: ano } = violencia
  const primeiro = anos[0]
  const ranking = rankingMvi(linhas, ano, pais, 'mdip')
  const pctDe = (membros) => pctMdipNasMvi(linhas, membros, anos)
  const territorio = uf ?? pais
  const regiao = infoUf?.regiao
  const membrosRegiao = ufs.filter((u) => u.regiao === regiao).map((u) => u.uf)
  const pctUltimo = (membros) => pctDe(membros).find((p) => p.ano === ano)?.valor ?? null
  const linha = linhas.find((l) => l.uf === territorio && l.ano === ano)
  const posicao = uf ? ranking.find((l) => l.uf === uf) : null
  const pctPorUf = Object.fromEntries(ranking.map((l) => [l.uf, pctUltimo([l.uf])]))
  const deQuem = uf ? deUf(uf, infoUf?.artigo) : 'no Brasil'

  const resumo = [
    { id: 'mdip', rotulo: `Mortes por intervenção policial em ${ano}`, valor: numero(linha?.mdip_numero),
      detalhe: `sujeito a revisão (primeira publicação, edição ${linha?.mdip_edicao_fonte})` },
    { id: 'pct', rotulo: `% das mortes violentas, ${ano}`, valor: pct(pctUltimo([territorio])),
      detalhe: uf ? `${regiao}: ${pct(pctUltimo(membrosRegiao))}; Brasil: ${pct(pctUltimo([pais]))}` : 'mortes por intervenção policial / MVI' },
    ...(posicao ? [{ id: 'posicao', rotulo: `Posição pela taxa, ${ano}`, valor: posicao.posicao ? `${posicao.posicao}º de ${posicao.n_ufs}` : '–',
      detalhe: `${numero(posicao.taxa, 1)} mortes por intervenção policial por 100 mil habitantes (1º = maior taxa)` }] : []),
  ]
  const seriesPct = uf ? [
    { id: 'brasil', rotulo: nome[pais], tipo: 'mediana', pontos: pctDe([pais]) },
    { id: 'regiao', rotulo: regiao, tipo: 'par', pontos: pctDe(membrosRegiao) },
    { id: uf, rotulo: uf, tipo: 'destaque', pontos: pctDe([uf]) },
  ] : [{ id: pais, rotulo: nome[pais], tipo: 'destaque', pontos: pctDe([pais]) }]
  const legendaPct = uf ? [
    { classe: 'destaque', rotulo: uf }, { classe: 'par', rotulo: `${regiao} (soma dos estados)` }, { classe: 'linha-mediana', rotulo: nome[pais] },
  ] : [{ classe: 'destaque', rotulo: `${nome[pais]}, % das MVI` }]

  return (
    <section className="secao" id="letalidade-policial">
      <h3 className="titulo-secao">Letalidade policial {deQuem}, {primeiro}–{ano}</h3>
      <p className="nota">
        Mortes decorrentes de intervenção policial: pessoas mortas por policiais civis e militares, em serviço e fora de
        serviço. Elas já estão dentro das mortes violentas intencionais. <Entenda id="mdip_dentro_das_mvi" />
      </p>
      <Resumo itens={resumo} />
      <div className="lado-a-lado">
        <div>
          <h4>Número de mortes por intervenção policial</h4>
          <Evolucao series={[{ id: territorio, rotulo: uf ?? nome[pais], tipo: 'destaque', pontos: serieMvi(linhas, territorio, anos, 'mdip_numero') }]}
            anos={anos} metrica="contagem" anoSelecionado={ano} destaque={uf ?? nome[pais]} anoProvisorio={ano} compacto
            legenda={[{ classe: 'destaque', rotulo: `${uf ?? nome[pais]}, número de mortes` }]} />
        </div>
        <div>
          <h4>% das mortes violentas intencionais</h4>
          <Evolucao series={seriesPct} anos={anos} metrica="pct_total" anoSelecionado={ano} destaque={uf ?? nome[pais]}
            anoProvisorio={ano} compacto legenda={legendaPct} />
        </div>
      </div>
      <p className="nota">
        O % é a parte das mortes violentas intencionais causada por intervenção policial (soma das mortes por intervenção
        policial / soma das MVI): não depende da população e compara estados e anos sem a mudança de base da taxa.
      </p>
      <h4>Todos os estados pela taxa de mortes por intervenção policial, {ano}</h4>
      <BarrasHorizontais rotuloAcessivel={`Taxa de mortes por intervenção policial por 100 mil habitantes, ${ano}`}
        itens={ranking.map((l) => ({
          id: l.uf, rotulo: `${l.uf} · ${nome[l.uf]}`, valor: l.taxa,
          texto: `${numero(l.taxa, 1)} (${numero(l.numero)}; ${pct(pctPorUf[l.uf])} das MVI)`, destaque: l.uf === uf,
        }))} />
      <p className="nota">
        Mortes por intervenção policial por 100 mil habitantes em {ano} (1º = maior taxa), com o número e o % das mortes
        violentas intencionais. {ano} está sujeito a revisão.
      </p>
    </section>
  )
}

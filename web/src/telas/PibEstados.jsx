import {
  crescimentoAcumulado, participacaoNoPais, participacaoNoVab, participacoesNoPais, rebasear, setoresPorAno, tabelaPib,
  tendenciasDaAtividade,
} from '../calculos.js'
import { tituloDaPagina } from '../navegacao.config.js'
import { ATIVIDADE_PIB_PADRAO, paresPadrao, TABELAS_PIB } from '../estado.js'
import { CONFIGURACAO as CONFIG_TENDENCIA } from '../estatistica/tendencia.js'
import { data, numero, pct, pctComSinal, reaisCompacto } from '../formatacao.js'
import { deUf, doEstado, frasePib, taxaAoAno, textoEvidencia } from '../textos.js'
import Alerta from '../componentes/Alerta.jsx'
import CartoesTendencia from '../componentes/CartoesTendencia.jsx'
import BarrasEmpilhadas from '../componentes/BarrasEmpilhadas.jsx'
import BarrasHorizontais from '../componentes/BarrasHorizontais.jsx'
import Evolucao from '../componentes/Evolucao.jsx'
import { FiltrosPib } from '../componentes/Filtros.jsx'
import Frase from '../componentes/Frase.jsx'
import Resumo from '../componentes/Resumo.jsx'
import Ressalvas, { Entenda } from '../componentes/Ressalvas.jsx'
import TabelaAnos from '../componentes/TabelaAnos.jsx'

const VOLUME = 'volume_pib_2002_100'

// Tela "PIB dos Estados": o tamanho e a composição da economia de cada estado (IBGE, Contas Regionais).
// pib: pib.json (todas as UFs e o país); pibUf: pib/<UF>.json (atividades da UF). Ambos chegam sob demanda
// (App.jsx); enquanto não chegam, a tela avisa. Contas em calculos.js; aqui só colunas e textos.
export default function PibEstados({ dados, estado, mudar, pib, pibUf, erroPib }) {
  const ufs = dados.dicionarios.ufs
  const { uf } = estado
  const infoUf = ufs.find((u) => u.uf === uf)
  const anos = pib?.anos ?? dados.meta.pib?.anos ?? []

  const cabecalho = (
    <>
      <header className="cabecalho">
        <h1>{tituloDaPagina('pib', uf, 'O PIB dos estados')}</h1>
        <p>
          O tamanho da economia de cada estado e o que ela produz, segundo o IBGE. É a régua para ler as contas do
          governo estadual: o PIB mede tudo o que se produz no estado, não só o que passa pelo governo.
        </p>
      </header>
      <FiltrosPib estado={estado} ufs={ufs} anos={anos} regioes={[...new Set(ufs.map((u) => u.regiao))]}
        paresPadrao={paresPadrao(ufs, uf)} onMudar={mudar} />
    </>
  )
  if (!pib) {
    return (
      <main className="pagina">
        {cabecalho}
        <p className="aviso">{erroPib ? `Não foi possível carregar os dados do PIB: ${erroPib}` : 'Carregando os dados do PIB…'}</p>
      </main>
    )
  }

  const { anoPib: ano, desdePib: desde } = estado
  const nomeUf = Object.fromEntries(pib.territorios.map((t) => [t.uf, t.nome]))
  const rodape = (
    <footer className="rodape">
      <p>
        Fonte: {pib.fonte}, <a href={pib.pagina}>arquivos da edição</a>. Dados extraídos em {data(pib.extraido_em)}.
        Valores em R$ da época (a fonte publica em R$ milhão); crescimento pelo índice de volume, sem o efeito dos preços.
      </p>
    </footer>
  )

  // Participação de todas as UFs no PIB do país, no ano (ranking; vale com ou sem estado escolhido)
  const noPais = participacoesNoPais(pib.linhas, ano, pib.pais)
  const ranking = (
    <BarrasHorizontais rotuloAcessivel={`Participação no PIB do país, ${ano}`} itens={noPais.map((l) => ({
      id: l.uf, rotulo: `${l.uf} · ${nomeUf[l.uf]}`, valor: l.pct, texto: pct(l.pct), destaque: l.uf === uf,
    }))} />
  )
  if (!uf) {
    return (
      <main className="pagina">
        {cabecalho}
        <p className="frase vazia">Escolha um estado para ver a economia dele.</p>
        <section className="secao">
          <h3 className="titulo-secao">Participação de cada estado no PIB do país, {ano}</h3>
          {ranking}
        </section>
        {rodape}
      </main>
    )
  }

  const linhaUf = pib.linhas.find((l) => l.uf === uf && l.ano === ano)
  const posicao = noPais.find((l) => l.uf === uf)
  const crescimento = (territorio) => (desde < ano ? crescimentoAcumulado(pib.linhas, territorio, VOLUME, desde, ano) : null)
  const crescimentoUf = crescimento(uf)
  const crescimentoPais = crescimento(pib.pais)

  // 1. Resumo do ano
  const resumo = [
    { id: 'pib', rotulo: `PIB em ${ano}`, valor: reaisCompacto(linhaUf?.pib_corrente), detalhe: 'em R$ da época' },
    { id: 'pais', rotulo: 'Participação no PIB do país', valor: pct(posicao?.pct),
      detalhe: posicao?.posicao ? `${posicao.posicao}º de ${posicao.n_ufs} estados (1º = maior)` : null },
    { id: 'crescimento', rotulo: `Crescimento ${desde}–${ano}`, valor: pctComSinal(crescimentoUf),
      detalhe: desde < ano ? `em volume, sem o efeito dos preços; país: ${pctComSinal(crescimentoPais)}`
        : `escolha um ano inicial anterior a ${ano}` },
  ]
  const frase = frasePib({
    ano, uf, artigo: infoUf?.artigo, pctPais: posicao?.pct, posicao: posicao?.posicao, nUfs: posicao?.n_ufs,
    desde, crescimentoUf, crescimentoPais,
  })

  // 3. Crescimento: volume do PIB com o ano inicial = 100 (UF, pares e o país)
  const anosDesde = anos.filter((a) => a >= desde)
  const pares = estado.pares.filter((p) => p !== uf)
  const serieVolume = (territorio, tipo, rotulo = territorio) => ({
    id: territorio, rotulo, tipo, pontos: rebasear(pib.linhas, territorio, VOLUME, desde, anosDesde),
  })
  const seriesVolume = [
    serieVolume(pib.pais, 'mediana', nomeUf[pib.pais]), ...pares.map((p) => serieVolume(p, 'par')), serieVolume(uf, 'destaque'),
  ]

  // 4. Participação no PIB do país ao longo do tempo (UF e pares)
  const serieNoPais = (territorio, tipo) => ({
    id: territorio, rotulo: territorio, tipo, pontos: anos.map((a) => ({ ano: a, valor: participacaoNoPais(pib.linhas, territorio, a, pib.pais) })),
  })
  const legenda = [
    { classe: 'destaque', rotulo: uf }, ...(pares.length ? [{ classe: 'par', rotulo: `pares (${pares.join(', ')})` }] : []),
  ]

  return (
    <main className="pagina">
      {cabecalho}

      <section className="secao">
        <h3 className="titulo-secao">{ano}, em resumo</h3>
        <Resumo itens={resumo} />
        <Frase texto={frase} />
      </section>

      <hr className="intra-section" />

      {pibUf ? <PesoDosSetores pib={pib} linhas={pibUf} uf={uf} infoUf={infoUf} ano={ano} anos={anos} />
        : <p className="aviso">{erroPib ? `Não foi possível carregar as atividades do estado: ${erroPib}` : 'Carregando as atividades do estado…'}</p>}

      <hr className="intra-section" />

      <section className="secao">
        <h3 className="titulo-secao">Crescimento da economia, {desde}–{anos[anos.length - 1]}</h3>
        <Evolucao series={seriesVolume} anos={anosDesde} metrica="indice" anoSelecionado={ano} destaque={uf} legenda={[
          ...legenda, { classe: 'linha-mediana', rotulo: nomeUf[pib.pais] },
        ]} />
        <p className="nota">
          Índice de volume do PIB, {desde} = 100: quanto a economia produziu a mais (ou a menos) que em {desde}, sem o
          efeito dos preços. Acima de 100, cresceu; abaixo, encolheu. Mude o ano inicial no filtro "Crescimento desde".
        </p>
      </section>

      <hr className="intra-section" />

      <section className="secao">
        <h3 className="titulo-secao">Participação no PIB do país</h3>
        <div className="lado-a-lado">
          <div>
            <h4>{uf}, {anos[0]}–{anos[anos.length - 1]}</h4>
            <Evolucao series={[...pares.map((p) => serieNoPais(p, 'par')), serieNoPais(uf, 'destaque')]} anos={anos}
              metrica="pct_total" anoSelecionado={ano} destaque={uf} legenda={legenda} compacto />
          </div>
          <div>
            <h4>Todos os estados, {ano}</h4>
            {ranking}
          </div>
        </div>
        <p className="nota">PIB do estado / PIB do país no mesmo ano, a preços da época (o % não depende da inflação).</p>
      </section>

      {pibUf && (() => {
        // Atividade da tendência: a da URL, se existir no dicionário; senão, a padrão
        const atividade = pib.atividades.some((a) => a.atividade_cod === estado.atividadePib && a.grande_setor !== 'total')
          ? estado.atividadePib : ATIVIDADE_PIB_PADRAO
        return (
          <>
            <section className="secao">
              <TabelaPib pib={pib} linhas={pibUf} uf={uf} infoUf={infoUf} ano={ano} anos={anos}
                metrica={estado.tabelaPib} onMudarMetrica={(m) => mudar({ tabelaPib: m })}
                atividade={atividade} onEscolherAtividade={(a) => mudar({ atividadePib: a })} />
            </section>
            <TendenciaAtividade pib={pib} linhas={pibUf} uf={uf} infoUf={infoUf} ano={ano} anos={anos}
              atividade={atividade} janela={estado.janelaPib} onEscolherJanela={(j) => mudar({ janelaPib: j })} />
          </>
        )
      })()}

      <Alerta titulo="Antes de usar o PIB" Nivel="h3">
        <Ressalvas ressalvas={pib.ressalvas} />
      </Alerta>

      {rodape}
    </main>
  )
}

// 2. Peso dos grandes setores e das atividades no valor adicionado: o ano escolhido e a série inteira
function PesoDosSetores({ pib, linhas, uf, infoUf, ano, anos }) {
  const grupos = Object.fromEntries(pib.atividades.filter((a) => a.grande_setor !== 'total')
    .map((a) => [a.atividade_cod, a.grande_setor]))
  const setores = pib.grandes_setores.map((s) => ({ id: s.id, rotulo: s.nome, classe: `setor-${s.id}` }))
  const serie = setoresPorAno(linhas, uf, anos, grupos)
  const doAno = serie.find((p) => p.ano === ano)?.partes ?? {}
  const nomesCurtos = Object.fromEntries(pib.atividades.map((a) => [a.atividade_cod, a.nome_curto]))
  const atividades = participacaoNoVab(linhas.filter((l) => l.uf === uf && l.ano === ano))
    .sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity))
  return (
    <section className="secao">
      <h3 className="titulo-secao">O peso de cada setor na economia {deUf(uf, infoUf?.artigo)}</h3>
      <div className="lado-a-lado">
        <div>
          <h4>Em {ano}</h4>
          <BarrasHorizontais rotuloAcessivel={`Grandes setores, ${ano}`} itens={setores.map((s) => ({
            id: s.id, rotulo: s.rotulo, valor: doAno[s.id], texto: pct(doAno[s.id]),
          }))} />
          <h4 className="subtitulo-atividades">As atividades em {ano}</h4>
          <BarrasHorizontais rotuloAcessivel={`Atividades, ${ano}`} itens={atividades.map((a) => ({
            id: a.chave, rotulo: nomesCurtos[a.chave], valor: a.pct, texto: pct(a.pct),
          }))} />
        </div>
        <div>
          <h4>{anos[0]}–{anos[anos.length - 1]}</h4>
          <BarrasEmpilhadas pontos={serie} partes={setores} anoSelecionado={ano} percentual />
        </div>
      </div>
      <p className="nota">
        % do valor adicionado (o que cada setor produz, descontado o que consome de outros), a preços da época.
        A administração pública inclui os três níveis de governo e não é a despesa do estado. <Entenda id="pib_administracao_publica" />
      </p>
    </section>
  )
}

// 5. Tabela atividades × anos: % do valor adicionado ou valor em R$ da época
function TabelaPib({ pib, linhas, uf, infoUf, ano, anos, metrica, onMudarMetrica, atividade, onEscolherAtividade }) {
  const nomes = Object.fromEntries(pib.atividades.map((a) => [a.atividade_cod, a.nome]))
  const ordem = pib.atividades.map((a) => a.atividade_cod)
  const formatar = metrica === 'valor' ? (v) => reaisCompacto(v) : (v) => pct(v)
  const tabela = tabelaPib(linhas, uf, anos, ordem, metrica)
  return (
    <TabelaAnos
      titulo={`As atividades da economia ${deUf(uf, infoUf?.artigo)}, ${anos[0]}–${anos[anos.length - 1]}`}
      nota={`${metrica === 'valor' ? 'Valor adicionado, em R$ da época.' : '% do valor adicionado total (não muda com a inflação).'}`
        + ' Toque numa atividade para ver a tendência dela.'}
      linhas={tabela.map((l) => ({
        id: l.atividade_cod, rotulo: nomes[l.atividade_cod], valores: l.valores, formatar, escolhivel: l.nivel !== 'total',
      }))}
      anos={anos} anoSelecionado={ano} metricas={TABELAS_PIB} metrica={metrica} onMudarMetrica={onMudarMetrica}
      selecionada={atividade} onEscolher={onEscolherAtividade}
      nomeArquivo={`pib_atividades_${uf}_${metrica}.csv`}
    />
  )
}

// 6. Tendência da participação da atividade no valor adicionado: um card por janela (estatistica/tendencia.js),
// o gráfico com os valores e a reta da janela escolhida, e os detalhes estatísticos
function TendenciaAtividade({ pib, linhas, uf, infoUf, ano, anos, atividade, janela, onEscolherJanela }) {
  const nome = pib.atividades.find((a) => a.atividade_cod === atividade)?.nome_curto ?? atividade
  const janelas = tendenciasDaAtividade(linhas, uf, atividade, ano)
  const margem = CONFIG_TENDENCIA.margem_equivalencia_pct_ano
  const rotuloJanela = (j) => (j.anos === null ? 'Série completa' : `Últimos ${j.anos} anos`)
  const cartoes = janelas.map((j) => {
    const r = j.resultado
    return {
      id: j.id, rotulo: `${rotuloJanela(j)} · ${j.inicio}–${j.fim}`, valor: taxaAoAno(r.taxaAnual),
      categoria: r.categoria?.nome ?? null,
      linhas: r.estimavel ? [
        textoEvidencia(r, margem),
        `Acumulado no período: ${pctComSinal(r.variacaoAcumulada)}${r.r2 === null ? '' : ` · R² ${numero(r.r2, 2)}`}`,
        ...(r.qualidade === 'baixa' ? ['Leitura frágil: veja os avisos nos detalhes.'] : []),
      ] : ['Anos insuficientes para estimar.'],
    }
  })
  const escolhida = janelas.find((j) => j.id === janela) ?? janelas[janelas.length - 1]
  const r = escolhida.resultado
  const naJanela = (a) => a >= escolhida.inicio && a <= escolhida.fim && r.estimavel
  const series = [
    { id: 'tendencia', rotulo: 'tendência', tipo: 'mediana', pontos: anos.map((a) => ({ ano: a, valor: naJanela(a) ? r.previsto(a) : null })) },
    { id: uf, rotulo: uf, tipo: 'destaque', pontos: janelas[janelas.length - 1].observacoes.map((o) => ({ ano: o.ano, valor: o.valor })) },
  ]
  const anosGrafico = anos.filter((a) => a <= ano)

  // Detalhes: uma coluna por janela, textos já formatados
  const ic = (x) => (x.inferencia?.icTaxa ? `${pctComSinal(x.inferencia.icTaxa[0])} a ${pctComSinal(x.inferencia.icTaxa[1])}` : '–')
  const metodo = { mqo: 'mínimos quadrados', newey_west: 'Newey–West' }
  const detalhes = [
    ['Anos usados', (x) => String(x.n)],
    ['Taxa anual estimada', (x) => taxaAoAno(x.taxaAnual)],
    ['Variação acumulada estimada', (x) => pctComSinal(x.variacaoAcumulada)],
    [`Intervalo de ${Math.round(CONFIG_TENDENCIA.confianca * 100)}% da taxa`, ic],
    ['Valor-p (inclinação = 0)', (x) => (x.inferencia?.valorP === null || x.inferencia?.valorP === undefined ? '–' : numero(x.inferencia.valorP, 3))],
    ['R²', (x) => (x.r2 === null || x.r2 === undefined ? '–' : numero(x.r2, 2))],
    ['Erro-padrão usado', (x) => (x.inferencia?.metodo ? metodo[x.inferencia.metodo] : '–')],
    ['Autocorrelação dos resíduos (ρ₁; Ljung–Box p)', (x) => (x.diagnosticos?.autocorrelacaoVerificada
      ? `${numero(x.diagnosticos.rho1, 2)}; p = ${numero(x.diagnosticos.ljungBox.valorP, 3)}` : 'não verificável')],
    ['Durbin–Watson', (x) => (x.diagnosticos?.durbinWatson === null || x.diagnosticos?.durbinWatson === undefined ? '–' : numero(x.diagnosticos.durbinWatson, 2))],
    ['Qualidade da leitura', (x) => x.qualidade],
  ]
  return (
    <section className="secao" id="tendencia">
      <h3 className="titulo-secao">Tendência: {nome} {deUf(uf, infoUf?.artigo)}</h3>
      <p className="nota">
        Peso da atividade no valor adicionado do estado. A taxa anual vem de uma reta ajustada aos logaritmos da série
        (a variação proporcional média por ano); o intervalo mostra a incerteza dessa estimativa. Toque num card para
        ver a reta no gráfico. <Entenda id="tendencia" />
      </p>
      <CartoesTendencia itens={cartoes} selecionado={escolhida.id} onEscolher={onEscolherJanela} />
      <div className="secao">
        <Evolucao series={series} anos={anosGrafico} metrica="pct_total" anoSelecionado={ano} destaque={uf} compacto legenda={[
          { classe: 'destaque', rotulo: `${nome}, % do valor adicionado` },
          { classe: 'linha-mediana', rotulo: `tendência ${escolhida.inicio}–${escolhida.fim}: ${taxaAoAno(r.taxaAnual)}` },
        ]} />
        {r.inferencia?.icTaxa && (
          <p className="nota">
            Intervalo de {Math.round(CONFIG_TENDENCIA.confianca * 100)}% da taxa: {ic(r)} ao ano. Uma reta com qualquer taxa
            nesse intervalo também é compatível com os dados.
          </p>
        )}
      </div>
      <details className="dados-tabela detalhes-tendencia">
        <summary>Ver os detalhes estatísticos</summary>
        <div className="rolagem">
          <table className="tabela numeros">
            <thead><tr><th scope="col">Medida</th>{janelas.map((j) => <th key={j.id} scope="col">{rotuloJanela(j)}<br />{j.inicio}–{j.fim}</th>)}</tr></thead>
            <tbody>
              {detalhes.map(([rotulo, valor]) => (
                <tr key={rotulo}><th scope="row">{rotulo}</th>{janelas.map((j) => <td key={j.id}>{valor(j.resultado)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        {janelas.filter((j) => j.resultado.avisos.length).map((j) => (
          <div key={j.id}>
            <h4>{rotuloJanela(j)} ({j.inicio}–{j.fim})</h4>
            <ul>{j.resultado.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        ))}
      </details>
    </section>
  )
}

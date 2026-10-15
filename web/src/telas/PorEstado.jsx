import { useMemo } from 'react'

import {
  composicaoDoAno, estataisDoEstado, indicadoresSobDemanda, indicadoresDivida, indicadoresReceita, populacoes, medianaPorAno, serieDaUf, subareasDaUf,
  tabelaAreasPorAno, tabelaSubareasPorAno, totaisPorUfAno,
} from '../calculos.js'
import { pct, pctComSinal, reais, reaisCompacto } from '../formatacao.js'
import { doEstado, porUf } from '../textos.js'
import Alerta from '../componentes/Alerta.jsx'
import BarrasTotal from '../componentes/BarrasTotal.jsx'
import Composicao from '../componentes/Composicao.jsx'
import Evolucao from '../componentes/Evolucao.jsx'
import { FiltrosEstado } from '../componentes/Filtros.jsx'
import ListaEstatais from '../componentes/ListaEstatais.jsx'
import NotasQuebra from '../componentes/NotasQuebra.jsx'
import Resumo from '../componentes/Resumo.jsx'
import Ressalvas from '../componentes/Ressalvas.jsx'
import Rodape from '../componentes/Rodape.jsx'
import TabelaAreas from '../componentes/TabelaAreas.jsx'
import { avisosDaArea } from './avisos.js'
import ParteDividas from './ParteDividas.jsx'
import ParteReceitas from './ParteReceitas.jsx'
import IndicePartes from '../componentes/IndicePartes.jsx'

// Tela "Por estado": as contas de um estado, em quatro partes (receitas, despesas, dívidas, estatais). Contas em calculos.js; aqui só se escolhem colunas e textos.
// dadosUf: arquivos da UF em destaque (dados.js → carregarDadosDaUf); enquanto não chegam, a tela avisa.
export default function PorEstado({ dados, estado, mudar, funcoes, dadosUf, erroUf }) {
  const { meta, dicionarios, ipca, despesa, estatais, divida, receita } = dados
  const ufs = dicionarios.ufs
  const anoBase = meta.deflacao.ano_base_padrao
  const { uf, ano } = estado
  const infoUf = ufs.find((u) => u.uf === uf)
  const nomesFuncoes = Object.fromEntries(funcoes.map((f) => [f.funcao_cod, f.funcao_nome]))
  const fonte = meta.fontes.find((f) => f.fonte_dado === 'siconfi_dca')

  // Indicadores por função calculados por partes, sob demanda e memorizados (mesmas contas do cálculo completo):
  // o ano escolhido (posições), a área escolhida (série e mediana) e a UF (tabela). Trocar de ano ou de área
  // calcula só a parte nova; voltar a uma já vista não recalcula.
  const sobDemanda = useMemo(() => indicadoresSobDemanda(despesa, ipca.serie, { anoBase }), [despesa, ipca.serie, anoBase])
  const totais = useMemo(() => totaisPorUfAno(despesa, ipca.serie, { anoBase }), [despesa, ipca.serie, anoBase])
  const populacao = useMemo(() => populacoes(despesa), [despesa])
  const indReceita = useMemo(
    () => indicadoresReceita(receita.totais, ipca.serie, { anoBase, populacao }), [receita, ipca.serie, anoBase, populacao])
  const indDivida = useMemo(() => indicadoresDivida(divida.linhas, ipca.serie, { anoBase }), [divida, ipca.serie, anoBase])
  // Subáreas: as funções da UF (arquivo geral) + as subfunções (arquivo da UF)
  const subareas = useMemo(
    () => (uf && dadosUf ? subareasDaUf([...despesa.filter((l) => l.uf === uf), ...dadosUf.despesa], ipca.serie, { uf, anoBase }) : []),
    [despesa, dadosUf, ipca.serie, uf, anoBase])

  const titulo = infoUf ? `As contas ${doEstado(infoUf.nome, infoUf.artigo)}` : 'As contas de cada estado'
  const cabecalho = (
    <>
      <header className="cabecalho">
        <h1>{titulo}</h1>
        <p>De onde vem e para onde vai o dinheiro do governo estadual, o que ele deve e as empresas que controla, segundo as contas que entrega ao Tesouro Nacional.</p>
      </header>
      <FiltrosEstado estado={estado} ufs={ufs} anos={meta.anos} anoBase={anoBase} onMudar={mudar} />
    </>
  )
  if (!uf) {
    return (
      <main className="pagina">
        {cabecalho}
        <p className="frase vazia">Escolha um estado para ver as contas dele.</p>
        <Rodape fonte={fonte} estatais={estatais} />
      </main>
    )
  }

  if (!dadosUf) {
    return (
      <main className="pagina">
        {cabecalho}
        <p className="aviso">{erroUf ? `Não foi possível carregar os dados do estado: ${erroUf}` : 'Carregando os dados do estado…'}</p>
      </main>
    )
  }
  const receitaDaUf = { ...receita, linhas: dadosUf.receitaLinhas }
  const estataisDaUf = {
    ...estatais, lista_por_edicao: Object.fromEntries(Object.entries(dadosUf.estatais).map(([e, lista]) => [e, { [uf]: lista }])),
  }

  // Colunas conforme os valores (corrigidos × da época); o % do orçamento não muda com a inflação
  const corrigidos = estado.valores === 'corrigidos'
  const colPerCapita = corrigidos ? 'per_capita_real' : 'per_capita_nominal'
  const colTotal = corrigidos ? 'real' : 'nominal'
  const emReais = corrigidos ? `em R$ de dez/${anoBase}` : 'em R$ da época'

  // 1. Resumo do ano
  const total = totais.find((t) => t.uf === uf && t.ano === ano)
  const variacao = total?.[corrigidos ? 'var_real_pct' : 'var_nominal_pct'] ?? null
  const resumo = [
    { id: 'total', rotulo: `Despesa total em ${ano}`, valor: reaisCompacto(total?.[corrigidos ? 'total_real' : 'total_nominal']),
      detalhe: `${emReais}, sem intraorçamentárias` },
    { id: 'habitante', rotulo: 'Por habitante', valor: reais(total?.[corrigidos ? 'per_capita_real' : 'per_capita_nominal']),
      detalhe: emReais },
    { id: 'variacao', rotulo: `Variação sobre ${ano - 1}`, valor: pctComSinal(variacao),
      detalhe: variacao === null ? `sem ${ano - 1} na série`
        : corrigidos ? 'descontada a inflação' : 'sem descontar a inflação' },
  ]

  // 2. Composição do ano e área selecionada (padrão: a maior)
  const doAno = sobDemanda.doAno(ano)
  const composicao = composicaoDoAno(doAno, uf, ano)
  const area = estado.areaExplicita && doAno.has(estado.area) ? estado.area : composicao[0]?.funcao_cod
  const nomeArea = nomesFuncoes[area] ?? ''
  const escolherArea = (funcao) => mudar({ area: funcao, areaExplicita: true })

  // 3. Série histórica da área: por habitante e % com a mediana nacional; total em R$ da época
  const linhasArea = area ? sobDemanda.daFuncao(area) : []
  const daUf = new Map(serieDaUf(linhasArea, uf).map((l) => [l.ano, l]))
  const serieComMediana = (coluna) => {
    const medianas = medianaPorAno(linhasArea, coluna)
    return [
      { id: 'mediana', rotulo: 'mediana', tipo: 'mediana', pontos: medianas.map((m) => ({ ano: m.ano, valor: m.mediana })) },
      { id: uf, rotulo: uf, tipo: 'destaque', pontos: meta.anos.map((a) => ({ ano: a, valor: daUf.get(a)?.[coluna] ?? null })) },
    ]
  }
  const totaisNominais = meta.anos.map((a) => ({
    ano: a, valor: daUf.get(a)?.nominal ?? null, semGasto: daUf.get(a)?.sem_gasto_declarado ?? false,
  }))
  const avisos = avisosDaArea({
    estatais, uf, artigo: infoUf?.artigo, area, ano, anos: meta.anos, siglasUfs: ufs.map((u) => u.uf),
  })

  // 4. Tabela áreas × anos
  const metricaTabela = {
    per_capita: { coluna: colPerCapita, formatar: (v) => reais(v), unidade: `Gasto por habitante, ${emReais}.` },
    pct_total: { coluna: 'pct_despesa_total', formatar: (v) => pct(v), unidade: '% do orçamento estadual (não muda com a inflação).' },
    total: { coluna: colTotal, formatar: (v) => reaisCompacto(v), unidade: `Valor total gasto, ${emReais}.` },
  }[estado.tabela]
  const tabela = tabelaAreasPorAno(sobDemanda.daUf(uf), uf, meta.anos, metricaTabela.coluna, composicao.map((l) => l.funcao_cod))
  const subareasDaTabela = new Map(tabela.map((l) => [
    l.funcao_cod, tabelaSubareasPorAno(subareas, l.funcao_cod, meta.anos, metricaTabela.coluna, ano)]))
  const nomesSub = Object.fromEntries(dicionarios.subfuncoes.map((s) => [s.subfuncao_cod, s.subfuncao_nome]))
  const alternarArea = (funcao) => mudar({
    abertas: estado.abertas.includes(funcao) ? estado.abertas.filter((f) => f !== funcao) : [...estado.abertas, funcao],
  })

  return (
    <main className="pagina">
      {cabecalho}

      <IndicePartes partes={[
        { id: 'receitas', rotulo: 'Receitas', descricao: 'De onde vem o dinheiro' },
        { id: 'despesas', rotulo: 'Despesas', descricao: 'Para onde vai o dinheiro' },
        { id: 'dividas', rotulo: 'Dívidas', descricao: 'Quanto deve e quanto paga' },
        { id: 'estatais', rotulo: 'Estatais', descricao: 'As empresas que controla' },
      ]} />

      <hr className="divisor-partes" />

      <div className="parte" id="receitas">
        <ParteReceitas
          receita={receitaDaUf} indicadores={indReceita} despesaTotais={totais} uf={uf} infoUf={infoUf} ano={ano} anos={meta.anos}
          corrigidos={corrigidos} emReais={emReais} anoBase={anoBase} serieIpca={ipca.serie} populacao={populacao}
          metricaTabela={estado.tabelaReceita} onMudarMetricaTabela={(m) => mudar({ tabelaReceita: m })}
        />
      </div>

      <hr className="divisor-partes" />

      <div className="parte" id="despesas">
        <header className="parte-cabecalho">
          <p className="parte-rotulo">Parte 2</p>
          <h2>Para onde vai o dinheiro</h2>
          <p className="parte-intro">Em que áreas o governo estadual gasta: despesa liquidada, sem intraorçamentárias.</p>
        </header>

        <hr class="intra-section"/>

        <section className="secao">
          <h3 className="titulo-secao">{ano}, em resumo</h3>
          <Resumo itens={resumo} />
        </section>

        <hr class="intra-section"/>

        <section className="secao">
          <h3 className="titulo-secao">Composição do orçamento em {ano}</h3>
          <p className="nota">
            % do orçamento estadual por área e valor gasto ({emReais}). O selo mostra a posição {porUf(uf, infoUf?.artigo)} na
            área entre os {composicao[0]?.n_ufs ?? 27} estados, no % do orçamento. Toque numa área para ver a série dela.
          </p>
          <Composicao linhas={composicao} colunaValor={colTotal} nomes={nomesFuncoes} selecionada={area} onEscolher={escolherArea} />
        </section>

        <hr class="intra-section"/>

        <section className="secao">
          <h3 className="titulo-secao">{nomeArea}: {meta.anos[0]}–{meta.anos[meta.anos.length - 1]}</h3>
          <div className="pequenos-multiplos">
            <div>
              <h4>Por habitante <span className="nota">({emReais})</span></h4>
              <Evolucao series={serieComMediana(colPerCapita)} anos={meta.anos} metrica="per_capita" anoSelecionado={ano}
                destaque={uf} quebras={avisos.anosQuebra} compacto />
            </div>
            <div>
              <h4>% do orçamento</h4>
              <Evolucao series={serieComMediana('pct_despesa_total')} anos={meta.anos} metrica="pct_total" anoSelecionado={ano}
                destaque={uf} quebras={avisos.anosQuebra} compacto />
            </div>
            <div>
              <h4>Valor total <span className="nota">(R$ da época)</span></h4>
              <BarrasTotal pontos={totaisNominais} anoSelecionado={ano} />
              <p className="nota">Sem correção pela inflação, como aparece nas contas oficiais.</p>
            </div>
          </div>
          <NotasQuebra avisos={avisos.avisosQuebra} fonte={avisos.fonteQuebras} />
          {(avisos.avisosEstatais.length > 0 || avisos.semInfoEstatais || (meta.ressalvas_por_funcao?.[area] ?? []).length > 0) && (
            <Ressalvas
              ressalvas={[]} daArea={meta.ressalvas_por_funcao?.[area] ?? []} nomeArea={nomeArea}
              avisos={avisos.avisosEstatais} fonteAvisos={avisos.fonteEstatais} semInfoEstatais={avisos.semInfoEstatais}
            />
          )}
        </section>

        <hr class="intra-section"/>

        <section className="secao">
          <TabelaAreas
            linhas={tabela} subareas={subareasDaTabela} anos={meta.anos} nomes={nomesFuncoes} nomesSub={nomesSub}
            metrica={estado.tabela} formatar={metricaTabela.formatar} abertas={estado.abertas} onAlternarArea={alternarArea}
            titulo={`Todas as áreas, ${meta.anos[0]}–${meta.anos[meta.anos.length - 1]}`} unidade={metricaTabela.unidade}
            destaqueArea={area} anoSelecionado={ano}
            nomeArquivo={`areas_${uf}_${estado.tabela}${estado.tabela === 'pct_total' ? '' : `_${estado.valores}`}.csv`}
            onMudarMetrica={(tabelaNova) => mudar({ tabela: tabelaNova })}
          />
        </section>

        <Alerta titulo="Antes de comparar as despesas" Nivel="h3">
          <Ressalvas ressalvas={meta.ressalvas} nomeArea={nomeArea} />
        </Alerta>
      </div>

      <hr className="divisor-partes" />

      <div className="parte" id="dividas">
        <ParteDividas
          divida={indDivida} notaComposicao={divida.nota_composicao} notaComposicaoAntiga={divida.nota_composicao_antiga} ressalvas={divida.ressalvas} porFuncao={doAno}
          limites={{ limite: divida.limite_legal_pct, alerta: divida.alerta_legal_pct }}
          uf={uf} infoUf={infoUf} ano={ano} anos={meta.anos} corrigidos={corrigidos} emReais={emReais} anoBase={anoBase}
        />
      </div>

      <hr className="divisor-partes" />

      <div className="parte" id="estatais">
        <header className="parte-cabecalho">
          <p className="parte-rotulo">Parte 4</p>
          <h2>As empresas do estado</h2>
          <p className="parte-intro">
            Além do orçamento, o estado controla empresas. Algumas dependem dele para funcionar e já estão nas contas
            das partes anteriores; outras se sustentam sozinhas e ficam fora delas.
          </p>
        </header>
        <ListaEstatais
          lista={estataisDoEstado(estataisDaUf, uf, ano)} nomesFuncoes={nomesFuncoes} siglasUfs={ufs.map((u) => u.uf)}
          fonteCurta={estatais.fonte_curta}
        />
      </div>

      <Rodape fonte={fonte} estatais={estatais} divida={divida} receita={receita} />
    </main>
  )
}

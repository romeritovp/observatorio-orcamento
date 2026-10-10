import {
  composicaoReceita, destinoDoImposto, medianaPorAno, petroleoDaUf, reconciliacaoPetroleo, ressalvasDoAno, seriePetroleo, naoSeparaPetroleo,
  tabelaReceita,
} from '../calculos.js'
import { TABELAS_RECEITA } from '../estado.js'
import { pct, reais, reaisCompacto } from '../formatacao.js'
import { deUf, fraseReconciliacaoPetroleo, fraseResultado } from '../textos.js'
import Alerta from '../componentes/Alerta.jsx'
import BarraDestino from '../componentes/BarraDestino.jsx'
import BarrasHorizontais from '../componentes/BarrasHorizontais.jsx'
import Evolucao from '../componentes/Evolucao.jsx'
import Frase from '../componentes/Frase.jsx'
import Resumo from '../componentes/Resumo.jsx'
import Ressalvas from '../componentes/Ressalvas.jsx'
import TabelaAnos from '../componentes/TabelaAnos.jsx'

// Parte 1 da tela "Por estado": de onde vem o dinheiro. Contas em calculos.js; aqui só colunas e textos.
// receita: receita.json; indicadores: indicadoresReceita (todas as UFs e anos); despesaTotais: totaisPorUfAno.
export default function ParteReceitas({ receita, indicadores, despesaTotais, uf, infoUf, ano, anos, corrigidos, emReais,
  anoBase, serieIpca, populacao, metricaTabela, onMudarMetricaTabela }) {
  const nomes = Object.fromEntries(receita.itens.map((i) => [i.item, i.nome]))
  const linha = indicadores.find((l) => l.uf === uf && l.ano === ano)
  const cabecalho = (
    <header className="parte-cabecalho">
      <p className="parte-rotulo">Parte 1</p>
      <h2>De onde vem o dinheiro</h2>
      <p className="parte-intro">
        Quanto o estado arrecadou no ano, de quais fontes, e quanto dos impostos ficou com ele depois de repassar a parte
        dos municípios e do FUNDEB. Valores líquidos dessas deduções, sem as receitas intraorçamentárias.
      </p>
    </header>
  )
  if (!linha) return <>{cabecalho}<p className="frase vazia">Não há receita declarada {deUf(uf, infoUf?.artigo)} para {ano}.</p></>

  const fator = corrigidos ? linha.fator_ipca : 1
  const sufixo = corrigidos ? 'real' : 'nominal'

  // 1. Resumo
  const resumo = [
    { id: 'total', rotulo: `Receita em ${ano}`, valor: reaisCompacto(corrigidos ? linha.receita_liquida_real : linha.receita_liquida),
      detalhe: `líquida, sem intraorçamentárias, ${emReais}` },
    { id: 'habitante', rotulo: 'Por habitante', valor: reais(linha[`per_capita_${sufixo}`]),
      detalhe: `${linha.posicao_per_capita_real}º de ${linha.n_ufs} estados (1º = maior)` },
    { id: 'impostos', rotulo: 'De impostos próprios', valor: pct(linha.pct_impostos_proprios),
      detalhe: `${linha.posicao_pct_impostos}º de ${linha.n_ufs} estados (1º = mais impostos próprios)` },
    { id: 'uniao', rotulo: 'De transferências da União', valor: pct(linha.pct_transferencias_uniao),
      detalhe: 'FPE, SUS, complementação do FUNDEB, convênios e outras' },
  ]

  // 2. Composição por item
  const composicao = composicaoReceita(receita.linhas, uf, ano, fator).filter((c) => c.valor !== 0).map((c) => ({
    id: c.item, rotulo: nomes[c.item], valor: c.valor, texto: `${reaisCompacto(c.valor)} · ${pct(c.pct)}`,
  }))

  // 3. Para onde vão os impostos
  const destinos = [['icms', 'ICMS'], ['ipva', 'IPVA']].map(([item, titulo]) => {
    const d = destinoDoImposto(receita.linhas, uf, ano, item, fator)
    return d && d.arrecadado > 0 ? { item, titulo, d } : null
  }).filter(Boolean)

  // 4. Série: receita e despesa por habitante, com a mediana da receita
  const daUf = new Map(indicadores.filter((l) => l.uf === uf).map((l) => [l.ano, l]))
  const despesaUf = new Map(despesaTotais.filter((t) => t.uf === uf).map((t) => [t.ano, t]))
  const series = [
    { id: 'mediana', rotulo: 'mediana', tipo: 'mediana',
      pontos: medianaPorAno(indicadores, `per_capita_${sufixo}`).map((m) => ({ ano: m.ano, valor: m.mediana })) },
    { id: 'despesa', rotulo: 'despesa', tipo: 'par', pontos: anos.map((a) => ({ ano: a, valor: despesaUf.get(a)?.[`per_capita_${sufixo}`] ?? null })) },
    { id: 'receita', rotulo: 'receita', tipo: 'destaque', pontos: anos.map((a) => ({ ano: a, valor: daUf.get(a)?.[`per_capita_${sufixo}`] ?? null })) },
  ]
  const despesaAno = despesaUf.get(ano)
  const frase = fraseResultado({
    ano, uf, artigo: infoUf?.artigo, receita: corrigidos ? linha.receita_liquida_real : linha.receita_liquida,
    despesa: despesaAno ? despesaAno[corrigidos ? 'total_real' : 'total_nominal'] : null,
  })

  // 5. Petróleo e gás: prestação de contas (DCA) × repasses da ANP, lado a lado. Nenhum total da DCA muda.
  const petroleo = receita.petroleo ?? {}
  const petroUf = petroleoDaUf(petroleo.linhas, uf)
  const naoSepara = naoSeparaPetroleo(petroleo, uf, ano)
  const naoSeparaEmAlgumAno = anos.some((a) => naoSeparaPetroleo(petroleo, uf, a))
  const fatorDoAno = (a) => (corrigidos ? daUf.get(a)?.fator_ipca ?? null : 1)
  const serieP = (campo) => seriePetroleo(petroUf, anos, campo, fatorDoAno)
  const linhasPetroleo = [
    { id: 'dca', rotulo: 'Petróleo e gás — prestação de contas (DCA, Tesouro Nacional; bruta, inclui o FEP)', valores: serieP('dca_petroleo') },
    ...(naoSeparaEmAlgumAno ? [{ id: 'demais', rotulo: 'Demais receitas patrimoniais — prestação de contas (DCA, Tesouro Nacional)', valores: serieP('demais_patrimoniais') }] : []),
    { id: 'royalties', rotulo: 'Royalties repassados ao estado — ANP', valores: serieP('anp_royalties') },
    { id: 'pe', rotulo: 'Participação especial repassada ao estado — ANP', valores: serieP('anp_participacao_especial') },
    { id: 'anp', rotulo: 'Total ANP (royalties + participação especial)', valores: serieP('anp_total') },
  ].map((l) => ({ ...l, formatar: reaisCompacto }))
  const temPetroleo = linhasPetroleo.some((l) => l.id !== 'demais' && l.valores.some((v) => v))
  const ultimoPe = petroleo.ultimo_ano_participacao_especial
  const anosParciais = anos.filter((a) => ultimoPe && a > ultimoPe)
  const reconciliacao = reconciliacaoPetroleo(petroUf.get(ano))
  const frasePetroleo = naoSepara ? fraseReconciliacaoPetroleo({
    situacao: reconciliacao.situacao,
    demais: (petroUf.get(ano)?.demais_patrimoniais ?? 0) * fator,
    anp: (petroUf.get(ano)?.anp_total ?? 0) * fator,
  }) : null

  // 6. Tabela
  const ordem = receita.itens.map((i) => i.item)
  const tabela = tabelaReceita(receita.linhas, uf, anos, ordem, {
    metrica: metricaTabela, corrigidos, serieIpca, anoBase, populacao,
  }).filter((l) => l.valores.some((v) => v)) // itens que o estado nunca teve não entram
  const formatar = { liquida: reaisCompacto, per_capita: (v) => reais(v), pct: (v) => pct(v) }[metricaTabela]
  const notaTabela = { liquida: `Receita líquida das deduções, ${emReais}.`, per_capita: `Por habitante, ${emReais}.`,
    pct: '% da receita líquida sem intraorçamentárias (não muda com a inflação).' }[metricaTabela]

  return (
    <>
      {cabecalho}

      <hr class="intra-section"/>

      <section className="secao">
        <h3 className="titulo-secao">{ano}, em resumo</h3>
        <Resumo itens={resumo} />
      </section>

      <hr class="intra-section"/>

      <section className="secao">
        <h3 className="titulo-secao">Composição da receita em {ano}</h3>
        <BarrasHorizontais itens={composicao} rotuloAcessivel="Receita por fonte" />
        <p className="nota">Receita líquida das deduções, {emReais}; o % é sobre a receita do ano.</p>
      </section>
      
      <hr class="intra-section"/>
      
      {destinos.length > 0 && (
        <section className="secao">
       
          <h3 className="titulo-secao">Para onde vão os impostos, {ano}</h3>
          <div className="lado-a-lado">
            {destinos.map(({ item, titulo, d }) => (
              <BarraDestino key={item} titulo={titulo} total={d.arrecadado} partes={[
                { id: 'municipios', rotulo: 'para os municípios', valor: d.municipios, classe: 'destino-municipios' },
                { id: 'fundeb', rotulo: 'para o FUNDEB', valor: d.fundeb, classe: 'destino-fundeb' },
                { id: 'outras', rotulo: 'outras deduções', valor: d.outras, classe: 'destino-outras' },
                { id: 'estado', rotulo: 'ficou com o estado', valor: d.estado, classe: 'destino-estado' },
              ]} />
            ))}
          </div>
          <p className="nota">O que vai para o FUNDEB volta em parte ao estado, conforme o número de alunos ("FUNDEB, retorno" na composição). Valores {emReais}.</p>
        </section>
      )}

      <hr class="intra-section"/>

      <section className="secao">
        <h3 className="titulo-secao">Receita e despesa por habitante, {anos[0]}–{anos[anos.length - 1]}</h3>
        <Frase texto={frase} />
        <Evolucao series={series} anos={anos} metrica="per_capita" anoSelecionado={ano} destaque={uf} legenda={[
          { classe: 'destaque', rotulo: `receita ${deUf(uf, infoUf?.artigo)}` },
          { classe: 'par', rotulo: `despesa ${deUf(uf, infoUf?.artigo)}` },
          { classe: 'linha-mediana', rotulo: 'mediana da receita dos estados' },
        ]} />
        <p className="nota">Receita líquida e despesa liquidada, sem intraorçamentárias, por habitante, {emReais}. Receita acima da despesa: o ano fechou com sobra.</p>
      </section>

      <hr class="intra-section"/>

      <section className="secao">
        <h3 className="titulo-secao">Petróleo e gás</h3>
        {naoSepara && (
          <p className="nota">
            A prestação de contas {deUf(uf, infoUf?.artigo)} não separa o petróleo
            {petroleo.nao_separa_desde?.[uf] ? ` a partir de ${petroleo.nao_separa_desde[uf]} (até ${petroleo.nao_separa_desde[uf] - 1}, separava)` : ''}: royalties e participação especial ficam em
            "Demais receitas patrimoniais". Ao lado, os repasses ao estado segundo a ANP.
          </p>
        )}
        {frasePetroleo && <Frase texto={frasePetroleo} />}
        {naoSepara && reconciliacao.situacao === 'parcial' && (
          <p className="nota">Em {ano}, a ANP ainda não publicou a participação especial em dados abertos: não há total para comparar.</p>
        )}
        {temPetroleo || naoSeparaEmAlgumAno ? (
          <TabelaAnos
            titulo={`Petróleo e gás ${deUf(uf, infoUf?.artigo)}: prestação de contas e ANP, ${anos[0]}–${anos[anos.length - 1]}`}
            nota={`Duas fontes, lado a lado, ${emReais}. A prestação de contas inclui o FEP (Fundo Especial do Petróleo, `
              + 'distribuído pelo Tesouro); a ANP mostra só royalties e participação especial repassados ao estado, por ano de caixa, '
              + `sem os municípios.${anosParciais.length ? ` ${anosParciais.join(', ')}: só royalties (parcial; a participação especial `
                + `em dados abertos vai até ${ultimoPe}).` : ''}`}
            linhas={linhasPetroleo} anos={anos} anoSelecionado={ano}
            nomeArquivo={`petroleo_${uf}_${corrigidos ? 'corrigidos' : 'epoca'}.csv`}
          />
        ) : (
          <p className="nota">Sem receita de petróleo e gás na prestação de contas nem repasses registrados pela ANP no período.</p>
        )}
      </section>

      <section className="secao">
        <TabelaAnos
          titulo={`De onde vem o dinheiro ${deUf(uf, infoUf?.artigo)}, ${anos[0]}–${anos[anos.length - 1]}`} nota={notaTabela}
          linhas={tabela.map((l) => ({ id: l.item, rotulo: nomes[l.item], valores: l.valores, formatar }))}
          anos={anos} anoSelecionado={ano} metricas={TABELAS_RECEITA} metrica={metricaTabela} onMudarMetrica={onMudarMetricaTabela}
          nomeArquivo={`receita_${uf}_${metricaTabela}${metricaTabela === 'pct' ? '' : `_${corrigidos ? 'corrigidos' : 'epoca'}`}.csv`}
        />
      </section>

      <Alerta titulo="Antes de comparar as receitas" Nivel="h3">
        <Ressalvas ressalvas={[...ressalvasDoAno(receita.ressalvas_por_uf?.[uf], ano), ...receita.ressalvas]} />
      </Alerta>
    </>
  )
}

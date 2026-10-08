import { composicaoDivida, dividaContraAreas, medianaPorAno } from '../calculos.js'
import { pct, reais, reaisCompacto } from '../formatacao.js'
import { deUf, fraseDivida, porUf } from '../textos.js'
import Alerta from '../componentes/Alerta.jsx'
import BarrasEmpilhadas from '../componentes/BarrasEmpilhadas.jsx'
import BarrasHorizontais from '../componentes/BarrasHorizontais.jsx'
import Evolucao from '../componentes/Evolucao.jsx'
import Frase from '../componentes/Frase.jsx'
import Resumo from '../componentes/Resumo.jsx'
import Ressalvas from '../componentes/Ressalvas.jsx'
import TabelaAnos from '../componentes/TabelaAnos.jsx'

const NOMES_TIPOS = {
  reestruturacao: 'Reestruturação (com a União)',
  internos: 'Empréstimos e financiamentos internos',
  externos: 'Empréstimos e financiamentos externos',
  parcelamentos: 'Parcelamentos (tributos, previdência)',
  precatorios: 'Precatórios vencidos e não pagos',
  outras: 'Outras dívidas',
}

// Parte 3 da tela "Por estado": as dívidas do estado. Contas em calculos.js (indicadoresDivida e cia.);
// aqui só se escolhem colunas e textos. divida: indicadoresDivida (todas as UFs e anos).
export default function ParteDividas({ divida, notaComposicao, ressalvas, limites, porFuncao, uf, infoUf, ano, anos, corrigidos,
  emReais, anoBase }) {
  const sufixo = corrigidos ? '_real' : ''
  const linha = divida.find((l) => l.uf === uf && l.ano === ano)
  const daUf = new Map(divida.filter((l) => l.uf === uf).map((l) => [l.ano, l]))

  const cabecalho = (
    <header className="parte-cabecalho">
      <p className="parte-rotulo">Parte 3</p>
      <h2>As dívidas do estado</h2>
      <p className="parte-intro">
        Quanto o estado deve, quanto isso pesa sobre a receita e quanto pagou de juros e amortização, segundo os
        relatórios entregues ao Tesouro Nacional.
      </p>
    </header>
  )
  if (!linha) {
    return <>{cabecalho}<p className="frase vazia">Não há relatório de dívida {porUf(uf, infoUf?.artigo)} para {ano}.</p></>
  }

  // 1. Resumo
  const resumo = [
    { id: 'dcl', rotulo: `Quanto deve (fim de ${ano})`, valor: reaisCompacto(linha[`dcl${sufixo}`]),
      detalhe: `dívida consolidada líquida, ${emReais}` },
    { id: 'pct', rotulo: 'Em relação à receita', valor: pct(linha.dcl_rcl_pct),
      detalhe: `da receita corrente líquida (limite: ${limites.limite}%)` },
    { id: 'posicao', rotulo: 'Posição entre os estados', valor: linha.posicao_dcl_rcl ? `${linha.posicao_dcl_rcl}º de ${linha.n_ufs}` : '–',
      detalhe: '1º = maior dívida em relação à receita' },
    { id: 'pago', rotulo: `Pagou em ${ano}`, valor: reaisCompacto(linha[`pago${sufixo}`]),
      detalhe: `juros e amortização, ${emReais}` },
  ]

  // 2. Dívida sobre a receita, com a mediana nacional e os limites
  const medianas = medianaPorAno(divida, 'dcl_rcl_pct')
  const series = [
    { id: 'mediana', rotulo: 'mediana', tipo: 'mediana', pontos: medianas.map((m) => ({ ano: m.ano, valor: m.mediana })) },
    { id: uf, rotulo: uf, tipo: 'destaque', pontos: anos.map((a) => ({ ano: a, valor: daUf.get(a)?.dcl_rcl_pct ?? null })) },
  ]

  // 3. Composição por tipo
  const composicao = composicaoDivida(linha, corrigidos ? 'composicao_real' : 'composicao').map((c) => ({
    id: c.tipo, rotulo: NOMES_TIPOS[c.tipo], valor: c.valor, texto: `${reaisCompacto(c.valor)} · ${pct(c.pct_dc)}`,
  }))

  // 4. Pago por ano
  const pagos = anos.map((a) => ({
    ano: a, partes: { amortizacao: daUf.get(a)?.[`amortizacao${sufixo}`] ?? null, juros: daUf.get(a)?.[`juros${sufixo}`] ?? null },
  }))

  // 5. Dívida × saúde × educação
  const [pagoDivida, saude, educacao] = dividaContraAreas(linha, porFuncao, uf, ano, corrigidos)
  const comparacao = (campo, formatar) => [
    { id: 'divida', rotulo: 'Dívida (juros e amortização)', valor: pagoDivida[campo], texto: formatar(pagoDivida[campo]), destaque: true },
    { id: 'saude', rotulo: 'Saúde', valor: saude[campo], texto: formatar(saude[campo]) },
    { id: 'educacao', rotulo: 'Educação', valor: educacao[campo], texto: formatar(educacao[campo]) },
  ]
  const frase = fraseDivida({ ano, uf, artigo: infoUf?.artigo, pago: pagoDivida.valor, saude: saude.valor, educacao: educacao.valor })

  // 6. Tabela
  const serie = (campo) => anos.map((a) => daUf.get(a)?.[campo] ?? null)
  const linhasTabela = [
    { id: 'dc', rotulo: `Dívida consolidada (${emReais})`, valores: serie(`dc${sufixo}`), formatar: reaisCompacto },
    { id: 'deducoes', rotulo: `Deduções (${emReais})`, valores: serie(`deducoes${sufixo}`), formatar: reaisCompacto },
    { id: 'dcl', rotulo: `Dívida consolidada líquida (${emReais})`, valores: serie(`dcl${sufixo}`), formatar: reaisCompacto },
    { id: 'rcl', rotulo: `Receita corrente líquida (${emReais})`, valores: serie(`rcl${sufixo}`), formatar: reaisCompacto },
    { id: 'dcl_rcl', rotulo: 'DCL / RCL (%)', valores: serie('dcl_rcl_pct'), formatar: (v) => pct(v) },
    { id: 'posicao', rotulo: 'Posição (1º = maior DCL/RCL)', valores: serie('posicao_dcl_rcl'), formatar: (v) => (v ? `${v}º` : '–') },
    { id: 'limite', rotulo: `Limite declarado no relatório (${emReais})`, valores: serie(`limite${sufixo}`), formatar: reaisCompacto },
    { id: 'juros', rotulo: `Juros e encargos pagos (${emReais})`, valores: serie(`juros${sufixo}`), formatar: reaisCompacto },
    { id: 'amortizacao', rotulo: `Amortização paga (${emReais})`, valores: serie(`amortizacao${sufixo}`), formatar: reaisCompacto },
  ]

  return (
    <>
      {cabecalho}

      <section className="secao">
        <h3 className="titulo-secao">{ano}, em resumo</h3>
        <Resumo itens={resumo} />
      </section>

      <section className="secao">
        <h3 className="titulo-secao">Dívida sobre a receita, {anos[0]}–{anos[anos.length - 1]}</h3>
        <p className="nota">Dívida consolidada líquida em % da receita corrente líquida, com a mediana dos estados.</p>
        <Evolucao series={series} anos={anos} metrica="pct_total" anoSelecionado={ano} destaque={uf}
          referencias={[{ valor: limites.limite, rotulo: `limite ${limites.limite}%` }, { valor: limites.alerta, rotulo: `alerta ${limites.alerta}%` }]} />
      </section>

      <section className="secao">
        <h3 className="titulo-secao">Com quem é a dívida, fim de {ano}</h3>
        <BarrasHorizontais itens={composicao} rotuloAcessivel="Dívida consolidada por tipo" />
        <p className="nota">{notaComposicao} Valores {emReais}; o % é sobre a dívida consolidada.</p>
      </section>

      <section className="secao">
        <h3 className="titulo-secao">Quanto foi pago, {anos[0]}–{anos[anos.length - 1]}</h3>
        <BarrasEmpilhadas pontos={pagos} anoSelecionado={ano} partes={[
          { id: 'amortizacao', rotulo: 'amortização', classe: 'parte-amortizacao' },
          { id: 'juros', rotulo: 'juros e encargos', classe: 'parte-juros' },
        ]} />
        <p className="nota">Despesa liquidada com juros e amortização da dívida, {emReais}.</p>
      </section>

      <section className="secao">
        <h3 className="titulo-secao">Dívida, saúde e educação em {ano}</h3>
        <Frase texto={frase} />
        <div className="lado-a-lado">
          <div>
            <h4>Total <span className="nota">({emReais})</span></h4>
            <BarrasHorizontais itens={comparacao('valor', reaisCompacto)} rotuloAcessivel="Total pago e gasto" />
          </div>
          <div>
            <h4>Por habitante <span className="nota">({emReais})</span></h4>
            <BarrasHorizontais itens={comparacao('per_capita', (v) => reais(v))} rotuloAcessivel="Por habitante" />
          </div>
        </div>
      </section>

      <Alerta titulo="Antes de comparar as dívidas" Nivel="h3">
        <Ressalvas ressalvas={ressalvas} />
      </Alerta>

      <section className="secao">
        <TabelaAnos
          titulo={`A dívida ${deUf(uf, infoUf?.artigo)}, ${anos[0]}–${anos[anos.length - 1]}`}
          nota={`Estoques no fim de cada ano (RGF, 3º quadrimestre); pagamentos liquidados no ano (DCA). Base dos índices: dez/${anoBase}.`}
          linhas={linhasTabela} anos={anos} anoSelecionado={ano}
          nomeArquivo={`divida_${uf}_${corrigidos ? 'corrigidos' : 'epoca'}.csv`}
        />
      </section>
    </>
  )
}

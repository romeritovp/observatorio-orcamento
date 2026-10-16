import { useMemo } from 'react'

import { participacoesNoPais, rankingIbid, rankingIdeb, rankingMvi, totaisPorUfAno } from '../calculos.js'
import { INDICADORES, tituloDoIndicador } from '../navegacao.config.js'
import { pct, reais, reaisCompacto, numero } from '../formatacao.js'
import { caminhoUf } from '../rotas.js'

const minusculaInicial = (t) => t.charAt(0).toLocaleLowerCase('pt-BR') + t.slice(1)

// Painel do estado (/sp): a visão geral, um cartão por indicador da configuração, com o número principal do último
// ano e o link para a página do indicador. Indicador sem resumo próprio mostra só a descrição curta.
// Os arquivos do PIB, do IBID, do IDEB e da violência chegam sob demanda (App.jsx); enquanto não chegam, o cartão avisa.
export default function PainelUF({ dados, uf, pib, ibid, ideb, violencia }) {
  const { meta, despesa, ipca } = dados
  const anoBase = meta.deflacao.ano_base_padrao
  const totais = useMemo(() => totaisPorUfAno(despesa, ipca.serie, { anoBase }), [despesa, ipca.serie, anoBase])

  const resumos = {
    orcamento: () => {
      const ano = Math.max(...meta.anos)
      const t = totais.find((l) => l.uf === uf.sigla && l.ano === ano)
      return t && { valor: reaisCompacto(t.total_real), detalhe: `despesa em ${ano}; ${reais(t.per_capita_real)} por habitante (R$ de dez/${anoBase})` }
    },
    pib: () => {
      if (!pib) return null
      const ano = Math.max(...pib.anos)
      const l = participacoesNoPais(pib.linhas, ano, pib.pais).find((x) => x.uf === uf.sigla)
      const valor = pib.linhas.find((x) => x.uf === uf.sigla && x.ano === ano)?.pib_corrente
      return l && { valor: reaisCompacto(valor), detalhe: `PIB em ${ano}; ${pct(l.pct)} do país, ${l.posicao}º de ${l.n_ufs} estados` }
    },
    educacao: () => {
      if (!ideb) return null
      const { etapa_padrao: etapa, rede_padrao: rede } = meta.ideb
      const ano = Math.max(...ideb.anos)
      const l = rankingIdeb(ideb, etapa, rede, ano).find((x) => x.uf === uf.sigla)
      return l?.ideb != null && { valor: numero(l.ideb, 1), detalhe: `IDEB ${ano}, ensino médio da rede estadual; ${l.posicao}º de ${l.n_ufs} estados` }
    },
    'pesquisa-e-inovacao': () => {
      if (!ibid) return null
      const ano = Math.max(...ibid.anos)
      const l = rankingIbid(ibid, ano).find((x) => x.uf === uf.sigla)
      return l && { valor: `${l.posicao}º`, detalhe: `no índice de inovação do INPI (IBID) em ${ano}, entre 27 estados` }
    },
    violencia: () => {
      if (!violencia) return null
      const ano = violencia.ultimo_ano
      const l = rankingMvi(violencia.linhas, ano, violencia.pais).find((x) => x.uf === uf.sigla)
      return l && { valor: numero(l.numero), detalhe: `mortes violentas intencionais em ${ano} (sujeito a revisão); `
        + `${numero(l.taxa, 1)} por 100 mil, ${l.posicao}º de ${l.n_ufs} estados pela taxa (1º = maior)` }
    },
  }

  return (
    <main className="pagina">
      <header className="cabecalho">
        <h1>{uf.nome}: visão geral</h1>
        <p>Os indicadores do estado num lugar só. Escolha um para ver a série, a comparação com os outros estados e as ressalvas.</p>
      </header>
      <ul className="cartoes-painel">
        {INDICADORES.map((i) => {
          const r = i.disponivel && resumos[i.slug] ? resumos[i.slug]() : null
          const carregando = i.disponivel && resumos[i.slug] && r === null
          return (
            <li key={i.slug} className={`cartao-painel${i.disponivel ? '' : ' indisponivel'}`}>
              <h2>{i.nome}</h2>
              {r ? <><p className="valor numeros">{r.valor}</p><p className="nota">{r.detalhe}</p></>
                : carregando ? <p className="nota">Carregando…</p> : <p className="nota">{i.descricaoCurta}</p>}
              {i.disponivel ? <a href={caminhoUf(uf, i)}>Ver {minusculaInicial(tituloDoIndicador(i, uf))} →</a>
                : <span className="selo-em-breve">em breve</span>}
            </li>
          )
        })}
      </ul>
    </main>
  )
}

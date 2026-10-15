import { useCallback, useEffect, useMemo, useState } from 'react'

import { JANELAS_IDEB, JANELAS_TENDENCIA } from './calculos.js'
import {
  carregarDados, carregarDadosDaUf, carregarEnsinoSuperior, carregarIbid, carregarIdeb, carregarIdebDaUf, carregarPib, carregarPibDaUf,
} from './dados.js'
import { escreverEstado, lerEstado, paresPadrao } from './estado.js'
import { indicadorPorSlug, tituloDoIndicador } from './navegacao.config.js'
import { BASE, buscaDoEstado, caminho, destinoDoEstado, indicadorDaComparacao, lerRota, urlNovaDeAntiga, viewDaRota } from './rotas.js'
import Header from './componentes/navegacao/Header.jsx'
import SubheaderUF from './componentes/navegacao/SubheaderUF.jsx'
import Comparar from './telas/Comparar.jsx'
import CompararUFs from './telas/CompararUFs.jsx'
import Educacao from './telas/Educacao.jsx'
import Inicio from './telas/Inicio.jsx'
import Metodo from './telas/Metodo.jsx'
import NaoEncontrada from './telas/NaoEncontrada.jsx'
import PainelUF from './telas/PainelUF.jsx'
import PesquisaInovacao from './telas/PesquisaInovacao.jsx'
import PibEstados from './telas/PibEstados.jsx'
import PorEstado from './telas/PorEstado.jsx'

const AREA_PADRAO = '10'
const NOME_SITE = 'Observatório dos Orçamentos'
const TELAS = {
  inicio: Inicio, painel: PainelUF, estado: PorEstado, comparar: Comparar, pib: PibEstados, inovacao: PesquisaInovacao,
  educacao: Educacao, metodo: Metodo, naoEncontrada: NaoEncontrada,
}

/** URL atual, com URLs antigas (?view=...) trocadas pela nova sem recarregar (o index.php faz o 301 no servidor). */
function urlAtual() {
  const { pathname, search, hash } = window.location
  if (lerRota(pathname).tipo === 'inicio') {
    const nova = urlNovaDeAntiga(search, hash)
    if (nova) window.history.replaceState(null, '', nova)
  }
  return { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash }
}

/** Link interno (mesma origem, dentro da base, que não é arquivo: data/, og/, .json...). */
function hrefInterno(link) {
  if (!link || link.target === '_blank' || link.hasAttribute('download')) return null
  const url = new URL(link.getAttribute('href'), window.location.href)
  if (url.origin !== window.location.origin || !url.pathname.startsWith(BASE)) return null
  if (/\.[a-z0-9]+$/i.test(url.pathname) || /\/(data|og|assets)\//.test(url.pathname)) return null
  // âncora na própria página: deixa o navegador rolar
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return null
  return `${url.pathname}${url.search}${url.hash}`
}

/** Título da aba do navegador para a rota. */
function tituloDaRota(rota, busca) {
  const partes = {
    inicio: 'as contas dos estados', metodologia: 'Metodologia', naoEncontrada: 'Página não encontrada',
    uf: rota.uf?.nome, ufIndicador: rota.indicador && tituloDoIndicador(rota.indicador, rota.uf),
    indicador: rota.indicador && `${rota.indicador.nome}: os 27 estados`,
    comparar: `Comparar estados: ${indicadorDaComparacao(busca).nome}`,
  }
  return rota.tipo === 'inicio' ? `${NOME_SITE}: ${partes.inicio}` : `${partes[rota.tipo]} · ${NOME_SITE}`
}

export default function App() {
  const [url, setUrl] = useState(urlAtual)
  const rota = useMemo(() => lerRota(url.pathname), [url.pathname])
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)

  // Trocar de página sem recarregar: empilha no histórico (o Voltar volta) ou substitui
  const navegar = useCallback((destino, { substituir = false } = {}) => {
    window.history[substituir ? 'replaceState' : 'pushState'](null, '', destino)
    setUrl({ pathname: window.location.pathname, search: window.location.search, hash: window.location.hash })
  }, [])

  useEffect(() => {
    const voltar = () => setUrl({ pathname: window.location.pathname, search: window.location.search, hash: window.location.hash })
    window.addEventListener('popstate', voltar)
    // Links internos (menus, "entenda", cartões): sem recarregar os dados
    const clicar = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      const destino = hrefInterno(e.target.closest?.('a[href]'))
      if (!destino) return
      e.preventDefault()
      navegar(destino)
    }
    document.addEventListener('click', clicar)
    return () => {
      window.removeEventListener('popstate', voltar)
      document.removeEventListener('click', clicar)
    }
  }, [navegar])

  // Arquivos gerais na abertura; o da UF da URL começa a baixar junto (sem esperar por eles)
  useEffect(() => {
    const inicial = lerRota(window.location.pathname)
    const view = viewDaRota(inicial, window.location.search)
    const sigla = inicial.uf?.sigla
    if (view === 'estado' && sigla) carregarDadosDaUf(sigla).catch(() => {})
    if (view === 'inovacao' || view === 'painel') Promise.all([carregarIbid(), carregarEnsinoSuperior()]).catch(() => {})
    if (view === 'educacao' || view === 'painel') carregarIdeb().catch(() => {})
    if (view === 'pib' || view === 'painel') carregarPib().catch(() => {})
    carregarDados().then(setDados).catch((e) => setErro(e.message))
  }, [])

  useEffect(() => { document.title = tituloDaRota(rota, url.search) }, [rota, url.search])

  return (
    <>
      <Header rota={rota} onIr={navegar} />
      {(rota.tipo === 'uf' || rota.tipo === 'ufIndicador') && (
        <SubheaderUF uf={rota.uf} indicador={rota.tipo === 'ufIndicador' ? rota.indicador : null} onIr={navegar} />
      )}
      {erro || !dados ? (
        <main className="pagina">
          <p className="aviso">{erro ? `Não foi possível carregar os dados: ${erro}` : 'Carregando os dados…'}</p>
        </main>
      ) : <Site dados={dados} rota={rota} url={url} navegar={navegar} />}
    </>
  )
}

// Estado da tela (lido da URL: a rota dá a tela e a UF; a busca, o resto) e a tela escolhida.
function Site({ dados, rota, url, navegar }) {
  const { meta, dicionarios, despesa } = dados
  const ufs = dicionarios.ufs

  // Só as funções que existem nos dados, em ordem de nome
  const funcoes = useMemo(() => {
    const presentes = new Set(despesa.filter((l) => l.nivel === 'funcao').map((l) => l.funcao_cod))
    return dicionarios.funcoes.filter((f) => presentes.has(f.funcao_cod))
      .sort((a, b) => a.funcao_nome.localeCompare(b.funcao_nome, 'pt-BR'))
  }, [despesa, dicionarios.funcoes])

  const contexto = useMemo(() => ({
    ufs, anos: meta.anos, areas: funcoes.map((f) => f.funcao_cod), areaPadrao: AREA_PADRAO, ufPadrao: meta.uf_padrao,
    anosPib: meta.pib?.anos ?? [], janelas: JANELAS_TENDENCIA.map((j) => j.id), anosIbid: meta.ibid?.anos ?? [],
    ideb: meta.ideb ?? null, janelasIdeb: JANELAS_IDEB.map((j) => j.id),
  }), [ufs, meta.anos, funcoes, meta.uf_padrao, meta.pib, meta.ibid, meta.ideb])

  const estado = useMemo(() => ({
    ...lerEstado(buscaDoEstado(rota, url.search), contexto),
    // a UF vem do caminho nas páginas de um estado: os filtros das telas não repetem o seletor de estado
    ufNoCaminho: rota.tipo === 'uf' || rota.tipo === 'ufIndicador',
  }), [rota, url.search, contexto])

  // Mudança pedida por uma tela (filtro, aba, tabela...): grava na URL; trocar de página entra no histórico
  const mudar = useCallback((mudancas) => {
    const novo = { ...estado, ...mudancas }
    if ('uf' in mudancas && !novo.paresPersonalizados) novo.pares = paresPadrao(ufs, novo.uf)
    novo.pares = novo.pares.filter((p) => p !== novo.uf)
    const destino = destinoDoEstado(rota, novo, escreverEstado(novo))
    const caminhoNovo = caminho(destino.rota)
    navegar(`${caminhoNovo}${destino.busca}`, { substituir: caminhoNovo === url.pathname })
  }, [estado, rota, ufs, navegar, url.pathname])

  // Dados da UF em destaque (subfunções, linhas da receita, lista de estatais), só para a tela do orçamento
  const [porUf, setPorUf] = useState({})
  const [erroUf, setErroUf] = useState(null)
  useEffect(() => {
    if (estado.view !== 'estado' || !estado.uf || porUf[estado.uf]) return
    carregarDadosDaUf(estado.uf)
      .then((d) => setPorUf((atual) => ({ ...atual, [estado.uf]: d })))
      .catch((e) => setErroUf(e.message))
  }, [estado.view, estado.uf, porUf])

  // PIB: pib.json (todas as UFs) e pib/<UF>.json; também no painel e na versão "Fórmulas" (UF do exemplo)
  const [pib, setPib] = useState(null)
  const [pibUf, setPibUf] = useState({})
  const [erroPib, setErroPib] = useState(null)
  const formulas = estado.view === 'metodo' && estado.nivel === 'formulas'
  const ufPib = formulas ? meta.documentacao?.exemplo?.uf : estado.uf
  useEffect(() => {
    if (estado.view !== 'pib' && estado.view !== 'painel' && !formulas) return
    if (!pib) carregarPib().then(setPib).catch((e) => setErroPib(e.message))
    if (estado.view !== 'painel' && ufPib && !pibUf[ufPib]) {
      carregarPibDaUf(ufPib)
        .then((linhas) => setPibUf((atual) => ({ ...atual, [ufPib]: linhas })))
        .catch((e) => setErroPib(e.message))
    }
  }, [estado.view, formulas, ufPib, pib, pibUf])

  // Pesquisa e Inovação: ibid.json e despesa_ensino_superior.json (também no painel)
  const [inovacao, setInovacao] = useState(null)
  const [erroIbid, setErroIbid] = useState(null)
  useEffect(() => {
    if ((estado.view !== 'inovacao' && estado.view !== 'painel') || inovacao) return
    Promise.all([carregarIbid(), carregarEnsinoSuperior()])
      .then(([ibid, ensinoSuperior]) => setInovacao({ ibid, ensinoSuperior }))
      .catch((e) => setErroIbid(e.message))
  }, [estado.view, inovacao])

  // Educação: ideb.json e ideb/<UF>.json (também no painel e na versão "Fórmulas", com a UF do exemplo)
  const [idebGeral, setIdebGeral] = useState(null)
  const [idebUf, setIdebUf] = useState({})
  const [erroIdeb, setErroIdeb] = useState(null)
  const ufIdeb = formulas ? meta.documentacao?.exemplo?.uf : estado.uf
  useEffect(() => {
    if (estado.view !== 'educacao' && estado.view !== 'painel' && !formulas) return
    if (!idebGeral) carregarIdeb().then(setIdebGeral).catch((e) => setErroIdeb(e.message))
    if (estado.view !== 'painel' && ufIdeb && !idebUf[ufIdeb]) {
      carregarIdebDaUf(ufIdeb).then((d) => setIdebUf((atual) => ({ ...atual, [ufIdeb]: d }))).catch((e) => setErroIdeb(e.message))
    }
  }, [estado.view, formulas, ufIdeb, idebGeral, idebUf])

  // Nova página começa do topo, salvo quando a URL aponta uma âncora (a tela rola até ela)
  useEffect(() => { if (!window.location.hash) window.scrollTo(0, 0) }, [url.pathname])

  const Tela = TELAS[estado.view] ?? NaoEncontrada
  const tela = (
    <Tela dados={dados} estado={estado} mudar={mudar} funcoes={funcoes} dadosUf={porUf[estado.uf]} erroUf={erroUf}
      pib={pib} pibUf={pibUf[ufPib]} erroPib={erroPib}
      ibid={inovacao?.ibid} ensinoSuperior={inovacao?.ensinoSuperior} erroIbid={erroIbid}
      ideb={idebGeral} idebUf={idebUf[ufIdeb]} erroIdeb={erroIdeb} uf={rota.uf} />
  )
  if (rota.tipo !== 'comparar') return tela
  const trocarIndicador = (slug) => {
    const p = new URLSearchParams(url.search)
    p.set('indicador', indicadorPorSlug(slug).slug)
    navegar(`${caminho(rota)}?${p.toString().replaceAll('%2C', ',')}`, { substituir: true })
  }
  return <CompararUFs indicador={indicadorDaComparacao(url.search)} onTrocar={trocarIndicador}>{tela}</CompararUFs>
}

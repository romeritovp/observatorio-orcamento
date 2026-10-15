import { useCallback, useEffect, useMemo, useState } from 'react'

import { JANELAS_IDEB, JANELAS_TENDENCIA } from './calculos.js'
import {
  carregarDados, carregarDadosDaUf, carregarEnsinoSuperior, carregarIbid, carregarIdeb, carregarIdebDaUf, carregarPib, carregarPibDaUf,
} from './dados.js'
import { escreverEstado, lerEstado, paresPadrao, VIEW_PADRAO, VIEWS } from './estado.js'
import Navegacao from './componentes/Navegacao.jsx'
import Comparar from './telas/Comparar.jsx'
import Metodo from './telas/Metodo.jsx'
import PibEstados from './telas/PibEstados.jsx'
import PesquisaInovacao from './telas/PesquisaInovacao.jsx'
import Educacao from './telas/Educacao.jsx'
import PorEstado from './telas/PorEstado.jsx'

const AREA_PADRAO = '10'

/** Tela pedida na URL, antes de os dados chegarem (para o menu já mostrar a tela certa). */
const viewDaUrl = () => {
  const view = new URLSearchParams(window.location.search).get('view')
  return view in VIEWS ? view : VIEW_PADRAO
}

export default function App() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    // Na tela "Por estado", a UF da URL começa a baixar junto com os dados gerais (sem esperar por eles)
    const ufDaUrl = new URLSearchParams(window.location.search).get('uf')?.toUpperCase()
    if (viewDaUrl() === 'estado' && ufDaUrl && /^[A-Z]{2}$/.test(ufDaUrl)) carregarDadosDaUf(ufDaUrl).catch(() => {})
    if (viewDaUrl() === 'inovacao') Promise.all([carregarIbid(), carregarEnsinoSuperior()]).catch(() => {})
    if (viewDaUrl() === 'educacao') {
      carregarIdeb().catch(() => {})
      if (ufDaUrl && /^[A-Z]{2}$/.test(ufDaUrl)) carregarIdebDaUf(ufDaUrl).catch(() => {})
    }
    if (viewDaUrl() === 'pib') {
      carregarPib().catch(() => {})
      if (ufDaUrl && /^[A-Z]{2}$/.test(ufDaUrl)) carregarPibDaUf(ufDaUrl).catch(() => {})
    }
    carregarDados().then(setDados).catch((e) => setErro(e.message))
  }, [])

  if (erro || !dados) {
    return (
      <>
        <Navegacao view={viewDaUrl()} />
        <main className="pagina">
          <p className="aviso">{erro ? `Não foi possível carregar os dados: ${erro}` : 'Carregando os dados…'}</p>
        </main>
      </>
    )
  }
  return <Site dados={dados} />
}

// Estado da tela (sempre lido da URL e gravado nela), menu e a tela escolhida.
function Site({ dados }) {
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

  const [estado, setEstado] = useState(() => lerEstado(window.location.search, contexto))
  useEffect(() => {
    const voltar = () => setEstado(lerEstado(window.location.search, contexto))
    window.addEventListener('popstate', voltar)
    return () => window.removeEventListener('popstate', voltar)
  }, [contexto])

  const mudar = useCallback((mudancas) => {
    setEstado((atual) => {
      const novo = { ...atual, ...mudancas }
      if ('uf' in mudancas && !novo.paresPersonalizados) novo.pares = paresPadrao(ufs, novo.uf)
      novo.pares = novo.pares.filter((p) => p !== novo.uf)
      const busca = escreverEstado(novo)
      // Trocar de tela entra no histórico (o botão Voltar volta à tela anterior); o resto só substitui
      const metodo = 'view' in mudancas && mudancas.view !== atual.view ? 'pushState' : 'replaceState'
      window.history[metodo](null, '', `${window.location.pathname}${busca}`)
      return lerEstado(busca, contexto)
    })
  }, [ufs, contexto])

  // Links internos para outra tela (?view=..., como o "entenda" das ressalvas): troca de tela sem recarregar
  // os dados, guardando a âncora (#...) na URL para a tela de destino rolar até ela
  useEffect(() => {
    const clicar = (e) => {
      const link = e.target.closest?.('a[href^="?view="]')
      if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      const [busca, ancora = ''] = link.getAttribute('href').split('#')
      const destino = lerEstado(busca, contexto)
      setEstado((atual) => {
        const novo = { ...atual, view: destino.view, ...(destino.view === 'metodo' ? {} : destino) }
        window.history.pushState(null, '', `${window.location.pathname}${escreverEstado(novo)}${ancora ? `#${ancora}` : ''}`)
        return lerEstado(escreverEstado(novo), contexto)
      })
    }
    document.addEventListener('click', clicar)
    return () => document.removeEventListener('click', clicar)
  }, [contexto])

  // Dados da UF em destaque (subfunções, linhas da receita, lista de estatais), só para a tela "Por estado"
  const [porUf, setPorUf] = useState({})
  const [erroUf, setErroUf] = useState(null)
  useEffect(() => {
    if (estado.view !== 'estado' || !estado.uf || porUf[estado.uf]) return
    carregarDadosDaUf(estado.uf)
      .then((d) => setPorUf((atual) => ({ ...atual, [estado.uf]: d })))
      .catch((e) => setErroUf(e.message))
  }, [estado.view, estado.uf, porUf])

  // PIB dos Estados: pib.json (todas as UFs) e pib/<UF>.json, só quando a tela é aberta
  const [pib, setPib] = useState(null)
  const [pibUf, setPibUf] = useState({})
  const [erroPib, setErroPib] = useState(null)
  // Também na versão "Fórmulas" da página "Como fazemos", que usa o PIB da UF do exemplo
  const formulas = estado.view === 'metodo' && estado.nivel === 'formulas'
  const ufPib = formulas ? meta.documentacao?.exemplo?.uf : estado.uf
  useEffect(() => {
    if (estado.view !== 'pib' && !formulas) return
    if (!pib) carregarPib().then(setPib).catch((e) => setErroPib(e.message))
    if (ufPib && !pibUf[ufPib]) {
      carregarPibDaUf(ufPib)
        .then((linhas) => setPibUf((atual) => ({ ...atual, [ufPib]: linhas })))
        .catch((e) => setErroPib(e.message))
    }
  }, [estado.view, formulas, ufPib, pib, pibUf])

  // Pesquisa e Inovação: ibid.json e despesa_ensino_superior.json, só quando a tela é aberta
  const [inovacao, setInovacao] = useState(null)
  const [erroIbid, setErroIbid] = useState(null)
  useEffect(() => {
    if (estado.view !== 'inovacao' || inovacao) return
    Promise.all([carregarIbid(), carregarEnsinoSuperior()])
      .then(([ibid, ensinoSuperior]) => setInovacao({ ibid, ensinoSuperior }))
      .catch((e) => setErroIbid(e.message))
  }, [estado.view, inovacao])

  // Educação: ideb.json e ideb/<UF>.json, só quando a tela é aberta (e na versão "Fórmulas" do "Como fazemos",
  // que usa o IDEB da UF do exemplo)
  const [idebGeral, setIdebGeral] = useState(null)
  const [idebUf, setIdebUf] = useState({})
  const [erroIdeb, setErroIdeb] = useState(null)
  const ufIdeb = formulas ? meta.documentacao?.exemplo?.uf : estado.uf
  useEffect(() => {
    if (estado.view !== 'educacao' && !formulas) return
    if (!idebGeral) carregarIdeb().then(setIdebGeral).catch((e) => setErroIdeb(e.message))
    if (ufIdeb && !idebUf[ufIdeb]) {
      carregarIdebDaUf(ufIdeb).then((d) => setIdebUf((atual) => ({ ...atual, [ufIdeb]: d }))).catch((e) => setErroIdeb(e.message))
    }
  }, [estado.view, formulas, ufIdeb, idebGeral, idebUf])

  // Nova tela começa do topo, salvo quando a URL aponta uma âncora (a tela rola até ela)
  useEffect(() => { if (!window.location.hash) window.scrollTo(0, 0) }, [estado.view])

  const links = Object.fromEntries(Object.keys(VIEWS).map((view) => [view, escreverEstado({ ...estado, view })]))
  const TELAS = { estado: PorEstado, comparar: Comparar, pib: PibEstados, inovacao: PesquisaInovacao, educacao: Educacao, metodo: Metodo }
  const Tela = TELAS[estado.view]

  return (
    <>
      <Navegacao view={estado.view} links={links} onIr={(view) => mudar({ view })} />
      <Tela dados={dados} estado={estado} mudar={mudar} funcoes={funcoes} dadosUf={porUf[estado.uf]} erroUf={erroUf}
        pib={pib} pibUf={pibUf[ufPib]} erroPib={erroPib}
        ibid={inovacao?.ibid} ensinoSuperior={inovacao?.ensinoSuperior} erroIbid={erroIbid}
        ideb={idebGeral} idebUf={idebUf[ufIdeb]} erroIdeb={erroIdeb} />
    </>
  )
}

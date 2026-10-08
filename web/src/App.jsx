import { useCallback, useEffect, useMemo, useState } from 'react'

import { carregarDados } from './dados.js'
import { escreverEstado, lerEstado, paresPadrao, VIEW_PADRAO, VIEWS } from './estado.js'
import Navegacao from './componentes/Navegacao.jsx'
import Comparar from './telas/Comparar.jsx'
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
  }), [ufs, meta.anos, funcoes, meta.uf_padrao])

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

  useEffect(() => { window.scrollTo(0, 0) }, [estado.view])

  const links = Object.fromEntries(Object.keys(VIEWS).map((view) => [view, escreverEstado({ ...estado, view })]))
  const Tela = estado.view === 'estado' ? PorEstado : Comparar

  return (
    <>
      <Navegacao view={estado.view} links={links} onIr={(view) => mudar({ view })} />
      <Tela dados={dados} estado={estado} mudar={mudar} funcoes={funcoes} />
    </>
  )
}

import { useEffect, useMemo } from 'react'

import Markdown from '../componentes/Markdown.jsx'
import { preencher } from '../markdown.js'
import { INTRODUCAO, SECOES } from '../conteudo/metodo/indice.js'
import { NIVEIS_METODO } from '../estado.js'
import Rodape from '../componentes/Rodape.jsx'
import { valoresDoMetodo } from './metodo/valores.js'

// Página "Como fazemos": seções em Markdown (src/conteudo/metodo/), na versão escolhida na URL
// (?nivel=simples|tecnico). Os números dos textos vêm de valoresDoMetodo (dados publicados + calculos.js).
export default function Metodo({ dados, estado, mudar }) {
  const valores = useMemo(() => valoresDoMetodo(dados), [dados])
  const nivel = estado.nivel

  // Âncora na URL (ex.: link "entenda" de uma ressalva): rola até ela depois de montar a página
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [nivel])

  return (
    <main className="pagina metodo">
      <header className="cabecalho" id={INTRODUCAO.id}>
        <h1>{INTRODUCAO.titulo}</h1>
        <Markdown texto={preencher(INTRODUCAO[nivel], valores)} />
      </header>

      <div className="campo nivel-metodo">
        <div className="alternador" role="group" aria-label="Nível da explicação">
          {Object.entries(NIVEIS_METODO).map(([id, rotulo]) => (
            <button key={id} type="button" aria-pressed={nivel === id} onClick={() => mudar({ nivel: id })}>{rotulo}</button>
          ))}
        </div>
      </div>

      <nav className="indice-metodo" aria-label="Seções da página">
        <ol>
          {SECOES.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.titulo}</a></li>)}
        </ol>
      </nav>

      {SECOES.map((s, i) => (
        <section key={s.id} id={s.id} className="secao secao-metodo" aria-labelledby={`titulo-${s.id}`}>
          <p className="metodo-numero" aria-hidden="true">Seção {i + 1}</p>
          <h2 id={`titulo-${s.id}`}>{s.titulo}</h2>
          <Markdown texto={preencher(s[nivel], valores)} />
        </section>
      ))}

      <Rodape fonte={dados.meta.fontes[0]} estatais={dados.estatais} divida={dados.divida} receita={dados.receita} />
    </main>
  )
}

import { useEffect, useMemo } from 'react'

import Markdown from '../componentes/Markdown.jsx'
import { preencher } from '../markdown.js'
import { INTRODUCAO, SECOES } from '../conteudo/metodo/indice.js'
import { NIVEIS_METODO } from '../estado.js'
import Rodape from '../componentes/Rodape.jsx'
import { valoresDasFormulas } from './metodo/formulas.js'
import { valoresDoMetodo } from './metodo/valores.js'

// Página "Como fazemos": seções em Markdown (src/conteudo/metodo/), na versão escolhida na URL
// (?nivel=simples|tecnico|formulas). Os números dos textos vêm de valoresDoMetodo (dados publicados + calculos.js);
// na versão "Fórmulas", também de valoresDasFormulas, que precisa do pib.json e do pib/<UF do exemplo>.json
// (pib, pibUf, ideb: carregados pelo App só nessa versão). Ela mostra só as seções que têm fórmulas.
export default function Metodo({ dados, estado, mudar, pib, pibUf, erroPib, ideb, erroIdeb }) {
  const nivel = estado.nivel
  const formulas = nivel === 'formulas'
  const prontos = !formulas || (pib && pibUf && ideb)
  const valores = useMemo(() => ({
    ...valoresDoMetodo(dados), ...(formulas && pib && pibUf && ideb ? { formulas: valoresDasFormulas(dados, pib, pibUf, ideb) } : {}),
  }), [dados, formulas, pib, pibUf, ideb])
  const secoes = formulas ? SECOES.filter((s) => s.formulas) : SECOES

  // Âncora na URL (ex.: link "entenda" de uma ressalva): rola até ela depois de montar a página. Na versão
  // "Fórmulas", âncora que só existe nas outras versões leva à explicação técnica.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id || !prontos) return
    const alvo = document.getElementById(id)
    if (alvo) alvo.scrollIntoView()
    else if (formulas) mudar({ nivel: 'tecnico' })
  }, [nivel, prontos, formulas, mudar])

  return (
    <main className="pagina metodo">
      <header className="cabecalho" id={INTRODUCAO.id}>
        <h1>{INTRODUCAO.titulo}</h1>
        <Markdown texto={preencher(INTRODUCAO[nivel] ?? INTRODUCAO.tecnico, valores)} />
      </header>

      <div className="campo nivel-metodo">
        <div className="alternador" role="group" aria-label="Nível da explicação">
          {Object.entries(NIVEIS_METODO).map(([id, rotulo]) => (
            <button key={id} type="button" aria-pressed={nivel === id} onClick={() => mudar({ nivel: id })}>{rotulo}</button>
          ))}
        </div>
      </div>

      {!prontos && (
        <p className="aviso">{erroPib || erroIdeb ? `Não foi possível carregar os dados dos exemplos: ${erroPib ?? erroIdeb}` : 'Carregando os dados dos exemplos…'}</p>
      )}

      {prontos && (
        <nav className="indice-metodo" aria-label="Seções da página">
          <ol>
            {secoes.map((s) => <li key={s.id} value={SECOES.indexOf(s) + 1}><a href={`#${s.id}`}>{s.titulo}</a></li>)}
          </ol>
        </nav>
      )}

      {prontos && secoes.map((s) => (
        <section key={s.id} id={s.id} className="secao secao-metodo" aria-labelledby={`titulo-${s.id}`}>
          <p className="metodo-numero" aria-hidden="true">Seção {SECOES.indexOf(s) + 1}</p>
          <h2 id={`titulo-${s.id}`}>{s.titulo}</h2>
          <Markdown texto={preencher(s[nivel], valores)} />
        </section>
      ))}

      <Rodape fonte={dados.meta.fontes[0]} estatais={dados.estatais} divida={dados.divida} receita={dados.receita} />
    </main>
  )
}

import { caminho } from '../rotas.js'
import MegaMenuIndicadores from '../componentes/navegacao/MegaMenuIndicadores.jsx'
import PainelEstados from '../componentes/navegacao/PainelEstados.jsx'

// Página inicial: as duas entradas para a mesma matriz estado × indicador.
export default function Inicio() {
  return (
    <main className="pagina inicio">
      <header className="cabecalho">
        <h1>As contas e os indicadores dos 27 estados</h1>
        <p>
          Quanto cada governo estadual arrecada, gasta e deve, e como está o estado em economia, educação e inovação,
          com dados públicos oficiais e cada conta explicada. Comece por um estado ou por um indicador.
        </p>
      </header>
      <section className="secao">
        <h2 className="titulo-secao">Por estado</h2>
        <PainelEstados />
      </section>
      <section className="secao">
        <h2 className="titulo-secao">Por indicador</h2>
        <p className="nota">A visão nacional de cada indicador, com as 27 UFs.</p>
        <MegaMenuIndicadores />
      </section>
      <p className="nota">
        Para pôr estados lado a lado, use <a href={caminho({ tipo: 'comparar' })}>Comparar</a>. De onde vem cada número
        e como é calculado está em <a href={caminho({ tipo: 'metodologia' })}>Metodologia</a>.
      </p>
    </main>
  )
}

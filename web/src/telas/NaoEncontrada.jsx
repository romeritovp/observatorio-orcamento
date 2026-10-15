import { BASE } from '../rotas.js'

export default function NaoEncontrada() {
  return (
    <main className="pagina">
      <header className="cabecalho">
        <h1>Página não encontrada</h1>
        <p>O endereço não corresponde a um estado ou indicador do site. <a href={BASE}>Voltar ao início</a>.</p>
      </header>
    </main>
  )
}

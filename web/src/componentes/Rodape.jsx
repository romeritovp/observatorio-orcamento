import { data } from '../formatacao.js'

// Rodapé de fontes, igual nas duas telas.
export default function Rodape({ fonte, estatais, divida, receita }) {
  return (
    <footer className="rodape">
      <p>
        Fonte: SICONFI/Tesouro Nacional (Declaração de Contas Anuais) e IBGE (IPCA).
        Dados extraídos em {data(fonte?.extraido_em_max)}. Valores declarados pelos estados, sujeitos a retificação.
      </p>
      {receita && <p>Receita: {receita.fonte}.</p>}
      {divida && <p>Dívida: {divida.fonte}.</p>}
      <p>{estatais.atribuicao} Exercícios {estatais.edicoes.join(' e ')}.</p>
    </footer>
  )
}

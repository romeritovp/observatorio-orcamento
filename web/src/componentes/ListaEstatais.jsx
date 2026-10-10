import { iniciaisMaiusculas, nomeParaExibir } from '../formatacao.js'
import { SEM_INFO_ESTATAIS } from '../textos.js'

const SITUACAO = { ATIVA: 'ativa', 'EM LIQUIDAÇÃO': 'em liquidação' }

// Marca de setor e situação herdados de outra edição (pelo CNPJ); a nota abaixo da lista explica
const HERDADO = <sup className="herdado" title="vindo de outra edição do Raio X, pelo CNPJ">†</sup>

function Grupo({ titulo, explicacao, empresas, nomesFuncoes, siglasUfs, classe }) {
  return (
    <section className={`grupo-estatais ${classe}`}>
      <h3>{titulo} <span className="nota">({empresas.length})</span></h3>
      <p className="explicacao">{explicacao}</p>
      {empresas.length === 0 ? <p className="nota">Nenhuma.</p> : (
        <div className="rolagem">
          <table className="tabela tabela-estatais">
            <thead>
              <tr><th scope="col">Sigla</th><th scope="col">Nome</th><th scope="col">Setor</th>
                <th scope="col">Área relacionada</th><th scope="col">Dependência</th><th scope="col">Situação</th></tr>
            </thead>
            <tbody>
              {empresas.map((e) => {
                const { sigla, nome } = nomeParaExibir(e, siglasUfs)
                return (
                  <tr key={e.cnpj}>
                    <th scope="row">{sigla ?? '–'}</th>
                    <td>{nome}</td>
                    <td>{e.setor ? iniciaisMaiusculas(e.setor) : '–'}{e.campos_herdados ? HERDADO : null}</td>
                    <td>{e.funcao_cod ? nomesFuncoes[e.funcao_cod] : '–'}</td>
                    <td>{e.dependente ? 'dependente' : 'não dependente'}</td>
                    <td>{e.situacao ? SITUACAO[e.situacao] ?? e.situacao : '–'}{e.campos_herdados ? HERDADO : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// Estatais do estado, separadas por dependência. Só cadastro (nenhum valor financeiro).
// lista: estataisDoEstado; fonteCurta: atribuição; nomesFuncoes: funcao_cod → nome.
export default function ListaEstatais({ lista, nomesFuncoes, siglasUfs, fonteCurta }) {
  if (lista.edicao === null) return <p className="nota">{SEM_INFO_ESTATAIS}</p>
  return (
    <div>
      <Grupo
        titulo="Estatais não dependentes" classe="nao-dependentes" empresas={lista.naoDependentes}
        explicacao="A operação destas empresas não aparece nas contas acima: elas não dependem do orçamento do estado para pagar pessoal e custeio."
        nomesFuncoes={nomesFuncoes} siglasUfs={siglasUfs}
      />
      <Grupo
        titulo="Estatais dependentes" classe="dependentes" empresas={lista.dependentes}
        explicacao="Recebem do estado recursos para pessoal ou custeio; pela regra, seus gastos fazem parte do orçamento estadual."
        nomesFuncoes={nomesFuncoes} siglasUfs={siglasUfs}
      />
      {[...lista.naoDependentes, ...lista.dependentes].some((e) => e.campos_herdados) && (
        <p className="nota">
          † Setor e situação vêm da edição do exercício {[...lista.naoDependentes, ...lista.dependentes].find((e) => e.herdado_de)?.herdado_de},
          pela mesma empresa (CNPJ): a edição deste ano não traz a situação e usa outra classificação de setores.
          A dependência é a desta edição. Empresa sem setor e sem situação (–) não aparece na outra edição.
        </p>
      )}
      <p className="nota">
        Área relacionada: correspondência aproximada entre o setor da empresa e uma área do orçamento. Fonte: {fonteCurta},
        situação em {lista.edicao}
        {lista.painel && <> (<a href={lista.painel} target="_blank" rel="noopener noreferrer">ver o painel do Tesouro</a>)</>}.
      </p>
    </div>
  )
}

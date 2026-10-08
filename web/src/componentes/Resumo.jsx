// Números do ano em destaque. itens: [{id, rotulo, valor (texto pronto), detalhe}]
export default function Resumo({ itens }) {
  return (
    <dl className="resumo numeros">
      {itens.map((i) => (
        <div key={i.id} className="resumo-item">
          <dt>{i.rotulo}</dt>
          <dd>{i.valor}</dd>
          {i.detalhe && <dd className="nota">{i.detalhe}</dd>}
        </div>
      ))}
    </dl>
  )
}

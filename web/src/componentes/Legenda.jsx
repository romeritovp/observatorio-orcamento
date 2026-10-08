export const SIMBOLO_ESTATAL = '◆'

export default function Legenda({ uf, temPares, mediana = 'mediana dos estados', linha = false, temEstatal = false }) {
  return (
    <ul className="legenda">
      {uf && <li><span className="amostra destaque" />{uf}</li>}
      {temPares && <li><span className="amostra par" />pares</li>}
      {!linha && <li><span className="amostra" />demais</li>}
      <li><span className="amostra linha-mediana" />{mediana}</li>
      {temEstatal && (
        <li><span className="simbolo-estatal" aria-hidden="true">{SIMBOLO_ESTATAL}</span>tem estatal não dependente nesta área (fora destas contas)</li>
      )}
    </ul>
  )
}

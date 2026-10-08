export default function Frase({ texto }) {
  if (!texto) return <p className="frase vazia">Escolha um estado para ver a posição dele entre os demais.</p>
  return <p className="frase" aria-live="polite">{texto}</p>
}

import { useEffect, useState } from 'react'

/** Largura em pixels do elemento (acompanha redimensionamento). */
export function useLargura(ref, inicial = 320) {
  const [largura, setLargura] = useState(inicial)
  useEffect(() => {
    if (!ref.current) return undefined
    const observador = new ResizeObserver(([entrada]) => setLargura(entrada.contentRect.width))
    observador.observe(ref.current)
    return () => observador.disconnect()
  }, [ref])
  return largura
}

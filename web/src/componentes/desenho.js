// Auxiliares de desenho (escala e posição de rótulos). Só geometria da tela, nenhuma conta sobre os dados.

/** Marcas "redondas" de 0 até cobrir `maximo` (ex.: 0, 250, 500, 750, 1000). */
export function marcasEixo(maximo, quantidade = 4) {
  if (!(maximo > 0)) return [0, 1]
  const bruto = maximo / quantidade
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)
  const marcas = []
  for (let v = 0; v < maximo + passo * 0.999; v += passo) marcas.push(Number(v.toPrecision(12)))
  return marcas
}

/** Afasta rótulos verticais para não se sobreporem (posições em pixels, `distancia` mínima). */
export function afastar(posicoes, distancia) {
  const ordem = posicoes.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0])
  const saida = [...posicoes]
  for (let k = 1; k < ordem.length; k += 1) {
    const anterior = saida[ordem[k - 1][1]]
    const atual = ordem[k][1]
    if (saida[atual] - anterior < distancia) saida[atual] = anterior + distancia
  }
  return saida
}

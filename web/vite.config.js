import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// gabarito.json serve só para os testes (Vitest); não vai para o site publicado.
function semGabarito() {
  let saida
  return {
    name: 'sem-gabarito',
    apply: 'build',
    configResolved(config) {
      saida = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      rmSync(resolve(saida, 'data', 'gabarito.json'), { force: true })
    },
  }
}

// Site estático (Hostgator): base relativa para funcionar em qualquer pasta do servidor.
export default defineConfig({
  base: './',
  plugins: [react(), semGabarito()],
  test: {
    environment: 'node',
  },
})

import { readFileSync, rmSync } from 'node:fs'
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

// Configuração do site (config/site.yaml): domínio, nome e indexação. Chaves simples "chave: valor",
// lidas por expressão regular para não acrescentar uma biblioteca de YAML ao front.
function lerSite() {
  const texto = readFileSync(resolve(import.meta.dirname, '..', 'config', 'site.yaml'), 'utf-8')
  const valor = (chave) => texto.match(new RegExp(`^${chave}:\\s*"?([^"\\n#]*?)"?\\s*(#.*)?$`, 'm'))?.[1]?.trim()
  return { dominio: valor('dominio'), nomeSite: valor('nome_site'), indexar: valor('indexar') === 'true' }
}

// Troca %DOMINIO% e %NOME_SITE% no index.html e tira o noindex quando a indexação for autorizada.
function metatagsDoSite() {
  const site = lerSite()
  return {
    name: 'metatags-do-site',
    transformIndexHtml(html) {
      let saida = html.replaceAll('%DOMINIO%', site.dominio).replaceAll('%NOME_SITE%', site.nomeSite)
      if (site.indexar) saida = saida.replace(/\s*<meta name="robots" content="noindex"[^>]*>/, '')
      return saida
    },
  }
}

// Site estático (Hostgator): base relativa para funcionar em qualquer pasta do servidor.
export default defineConfig({
  base: './',
  plugins: [react(), semGabarito(), metatagsDoSite()],
  test: {
    environment: 'node',
    // As telas renderizam com os JSONs publicados (11 anos × 27 UFs): 5 s não basta neste disco
    testTimeout: 30000,
  },
})

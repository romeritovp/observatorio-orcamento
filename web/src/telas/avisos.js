// Avisos de uma área para o estado em destaque, usados pelas duas telas (só textos; nenhum valor muda):
// estatais não dependentes na área e quebras de série por mudança de dependência.

import { edicaoDaUf, edicaoParaAno, estataisNaArea, mudancasDeDependencia } from '../calculos.js'
import { nomeParaExibir } from '../formatacao.js'
import { SEM_INFO_ESTATAIS, avisoEstatal, avisoQuebraSerie, fonteDasQuebras } from '../textos.js'

export function avisosDaArea({ estatais, uf, artigo, area, ano, anos, siglasUfs }) {
  const edicao = edicaoParaAno(estatais.edicoes, ano)
  const avisosEstatais = uf ? estataisNaArea(estatais, uf, area, ano).map((e) => {
    const { sigla, nome } = nomeParaExibir(e, siglasUfs)
    return { id: e.cnpj, texto: avisoEstatal({ uf, artigo, sigla, empresa: nome }) }
  }) : []
  const mudancas = uf ? mudancasDeDependencia(estatais, uf, area, anos) : []
  const avisosQuebra = mudancas.map((m) => {
    const { sigla, nome } = nomeParaExibir(m, siglasUfs)
    return { id: `${m.cnpj}-${m.ano}`, texto: avisoQuebraSerie({ ano: m.ano, sigla, empresa: nome, uf, sentido: m.sentido }) }
  })
  return {
    avisosEstatais,
    fonteEstatais: `Fonte: ${estatais.fonte_curta}, situação em ${edicao}.`,
    // Ano antes da primeira edição do cadastro: nenhum aviso possível
    semInfoEstatais: Boolean(uf) && edicaoDaUf(estatais, uf, ano) === null ? SEM_INFO_ESTATAIS : null,
    anosQuebra: mudancas.map((m) => m.ano),
    avisosQuebra,
    fonteQuebras: fonteDasQuebras(estatais.fonte_curta, mudancas),
  }
}

// Ligações "entenda" das telas para a página "Como fazemos": id da ressalva ou do aviso → âncora.
// O teste confere que toda ressalva publicada (meta, receita e dívida, inclusive as por UF) tem ligação
// e que toda âncora existe nas duas versões da página.

export const ENTENDA = {
  // meta.json → ressalvas (gerais) e ressalvas_por_funcao
  municipios: 'decisao-so-estado',
  intra: 'decisao-intra',
  populacao: 'decisao-populacao',
  valores: 'calculo-por-habitante',
  declarado: 'limite-retificacao',
  saneamento_companhias: 'decisao-estatais',
  // receita.json → ressalvas e ressalvas_por_uf
  recodificacao_2018: 'decisao-serie-2015',
  recodificacao_2022: 'decisao-recodificacao',
  icms_2022: 'limite-icms-2022',
  fundeb: 'termo-fundeb',
  compensacoes: 'decisao-compensacoes',
  operacoes_credito: 'termo-operacoes-de-credito',
  petroleo_rj: 'limite-royalties',
  petroleo_df: 'limite-royalties',
  petroleo_mg_2022: 'limite-petroleo-mg',
  itaipu_pr: 'limite-itaipu',
  outorga_cedae: 'limite-cedae',
  // divida.json → ressalvas
  pagar_pouco: 'calculo-juros-amortizacao',
  suspensao_2020: 'decisao-juros',
  passivo_atuarial: 'limite-fora-das-contas',
  // avisos gerados nas telas (estatais e quebras de série)
  aviso_estatal: 'decisao-estatais',
  sem_info_estatais: 'decisao-estatais-edicao',
  quebra_dependencia: 'decisao-quebra-dependencia',
}

/** Link "entenda" para uma ressalva ou aviso; null se não houver ligação (o teste impede isso). */
export function linkEntenda(id) {
  const ancora = ENTENDA[id]
  return ancora ? `?view=metodo#${ancora}` : null
}

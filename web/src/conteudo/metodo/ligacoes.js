// Ligações "entenda" das telas para a página "Como fazemos": id da ressalva ou do aviso → âncora.
// O teste confere que toda ressalva publicada (meta, receita, dívida e PIB, inclusive as por UF) tem ligação
// e que toda âncora existe nas duas versões da página.

import { BASE } from '../../rotas.js'

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
  // pib.json → ressalvas
  pib_administracao_publica: 'limite-pib-administracao-publica',
  pib_nominal: 'limite-pib-nominal',
  pib_defasagem: 'limite-pib-defasagem',
  // meta.json → ibid.ressalvas
  ibid_escores_entre_anos: 'limite-ibid-escores',
  ibid_ct_ensino_superior: 'limite-ibid-ct-ensino-superior',
  ibid_lado_a_lado: 'limite-ibid-causa',
  // ideb.json → ressalvas e ressalvas_por_uf (as notas da planilha têm id pelo texto da nota)
  ideb_formulacao_2007: 'limite-ideb-formulacao',
  ideb_metas_ate_2021: 'limite-ideb-metas',
  ideb_pandemia_2021: 'limite-ideb-2021',
  ideb_medio_saeb_censitario: 'limite-ideb-medio-saeb',
  ideb_escalas_saeb: 'limite-ideb-escalas',
  ideb_municipalizacao: 'limite-ideb-municipalizacao',
  ideb_df_distrital: 'limite-ideb-df',
  ideb_nota_medias_do_saeb_2009_e_ideb_2009_calculados_sem: 'limite-ideb-notas-planilha',
  ideb_nota_medias_do_saeb_2009_e_ideb_2009_calculados_somente: 'limite-ideb-notas-planilha',
  ideb_nota_medias_do_saeb_2009_e_ideb_2009_nao_calculados: 'limite-ideb-notas-planilha',
  ideb_nota_medias_do_saeb_2011_e_ideb_2011_calculados_sem: 'limite-ideb-notas-planilha',
  // avisos gerados nas telas (estatais e quebras de série)
  aviso_estatal: 'decisao-estatais',
  sem_info_estatais: 'decisao-estatais-edicao',
  quebra_dependencia: 'decisao-quebra-dependencia',
  tendencia: 'calculo-tendencia',
}

/** Link "entenda" para uma ressalva ou aviso; null se não houver ligação (o teste impede isso). */
export function linkEntenda(id) {
  const ancora = ENTENDA[id]
  return ancora ? `${BASE}metodologia#${ancora}` : null
}

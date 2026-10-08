"""Estatais estaduais × funções orçamentárias. Só informativo: nada aqui altera valores de despesa.

O dicionário de estatais serve para avisar que parte da atuação do estado numa área passa por
empresas fora destas contas (ex.: companhia de saneamento não dependente), nunca para somar,
subtrair ou corrigir a despesa (docs/decisoes.md).
"""

import pandas as pd


def funcao_das_estatais(estatais, setor_funcao, ajustes):
    """Função orçamentária de cada estatal: o ajuste por empresa (CNPJ) tem prioridade sobre o setor.

    estatais: uma linha por empresa, UF e exercício (dicionarios/nacional/estatais.csv), com `setor` e `cnpj`.
    setor_funcao: setor, funcao_cod (nulo = sem correspondência), correspondencia, justificativa.
    ajustes: cnpj, funcao_cod, justificativa (exceções por empresa).
    Cria funcao_cod, correspondencia (a do setor, ou "ajuste") e justificativa_funcao.
    Setor sem linha em setor_funcao, ou CNPJ repetido nos ajustes, é erro.
    """
    if setor_funcao["setor"].duplicated().any():
        raise ValueError("setor_funcao com setor repetido")
    if ajustes["cnpj"].duplicated().any():
        raise ValueError("ajustes com CNPJ repetido")
    sem_setor = set(estatais["setor"]) - set(setor_funcao["setor"])
    if sem_setor:
        raise ValueError(f"setores sem linha em setor_funcao: {sorted(sem_setor)}")

    pelo_setor = setor_funcao[["setor", "funcao_cod", "correspondencia", "justificativa"]]
    pelo_ajuste = ajustes[["cnpj", "funcao_cod", "justificativa"]].rename(
        columns={"funcao_cod": "_funcao_ajuste", "justificativa": "_justificativa_ajuste"})
    df = estatais.merge(pelo_setor, on="setor", how="left").merge(pelo_ajuste, on="cnpj", how="left")

    tem_ajuste = df["cnpj"].isin(ajustes["cnpj"])
    df["funcao_cod"] = df["funcao_cod"].where(~tem_ajuste, df["_funcao_ajuste"])
    df["correspondencia"] = df["correspondencia"].where(~tem_ajuste, "ajuste")
    df["justificativa_funcao"] = df["justificativa"].where(~tem_ajuste, df["_justificativa_ajuste"])
    return df.drop(columns=["justificativa", "_funcao_ajuste", "_justificativa_ajuste"])


def estatais_fora_das_contas(estatais_com_funcao):
    """Estatais ativas, não dependentes e com função: a operação delas não aparece na despesa do estado.

    Mantém todas as edições (`ano_referencia`); escolher a edição de cada ano é com edicao_para_ano.
    `dependente` deve ser booleano.
    """
    df = estatais_com_funcao
    # Texto como "false" viraria True num astype(bool): exige booleano de verdade
    if df["dependente"].dtype != bool:
        raise TypeError("dependente deve ser booleano (converta 'true'/'false' antes)")
    filtro = ~df["dependente"] & (df["situacao"] == "ATIVA") & df["funcao_cod"].notna()
    return df[filtro].sort_values(["ano_referencia", "uf", "funcao_cod", "sigla"]).reset_index(drop=True)


def edicao_para_ano(edicoes, ano):
    """Edição do dicionário (exercício) a usar para um ano da despesa: a mais recente que não passa do ano.

    Ano anterior a todas as edições usa a mais antiga (até incorporarmos edições antigas).
    Ex.: edições [2023, 2024] → 2019..2023 usam 2023; 2024 em diante usa 2024.
    """
    edicoes = sorted(int(e) for e in edicoes)
    if not edicoes:
        raise ValueError("nenhuma edição")
    anteriores = [e for e in edicoes if e <= int(ano)]
    return anteriores[-1] if anteriores else edicoes[0]


def mudancas_de_dependencia(estatais_com_funcao):
    """Empresas que mudaram de dependência entre edições consecutivas, com a função da edição nova.

    Uma linha por UF, CNPJ e edição em que a mudança aparece: uf, cnpj, sigla, empresa, funcao_cod,
    ano (edição nova), ano_anterior, sentido ("passou_a_dependente" ou "deixou_de_ser_dependente").
    Só empresas presentes nas duas edições e com função. Descreve a classificação da fonte; não
    diz se a despesa mudou. `dependente` deve ser booleano.
    """
    df = estatais_com_funcao
    if df["dependente"].dtype != bool:
        raise TypeError("dependente deve ser booleano (converta 'true'/'false' antes)")
    edicoes = sorted(df["ano_referencia"].unique())
    partes = []
    for anterior, atual in zip(edicoes, edicoes[1:]):
        antes = df[df["ano_referencia"] == anterior][["uf", "cnpj", "dependente"]]
        depois = df[df["ano_referencia"] == atual]
        m = depois.merge(antes, on=["uf", "cnpj"], suffixes=("", "_antes"))
        m = m[(m["dependente"] != m["dependente_antes"]) & m["funcao_cod"].notna()]
        partes.append(m.assign(
            ano=atual, ano_anterior=anterior,
            sentido=m["dependente"].map({True: "passou_a_dependente", False: "deixou_de_ser_dependente"}),
        ))
    colunas = ["uf", "cnpj", "sigla", "empresa", "funcao_cod", "ano", "ano_anterior", "sentido"]
    if not partes:
        return df.iloc[0:0].reindex(columns=colunas)
    return pd.concat(partes, ignore_index=True)[colunas].sort_values(["uf", "funcao_cod", "ano", "sigla"],
                                                                     ignore_index=True)


def _tem_acento(texto):
    return any(ord(c) > 127 for c in str(texto))


def nomes_de_exibicao(estatais, correcoes):
    """Sigla e nome para exibir, por UF e CNPJ. Não altera o dicionário: só escolhe o que mostrar.

    Ordem de prioridade:
    1. correção manual (`correcoes`: cnpj, sigla_exibicao, nome_exibicao), usada como está;
    2. entre as edições do mesmo CNPJ, a versão com acentos (a mais recente, se houver mais de uma);
    3. a versão da edição mais recente.
    Devolve uf, cnpj, sigla_exibicao, nome_exibicao e nome_manual (True quando veio da correção).
    """
    if correcoes["cnpj"].duplicated().any():
        raise ValueError("correções de nome com CNPJ repetido")
    linhas = []
    for (uf, cnpj), grupo in estatais.groupby(["uf", "cnpj"], sort=True):
        grupo = grupo.sort_values("ano_referencia", ascending=False)

        def escolher(coluna):
            com_acento = grupo[grupo[coluna].map(_tem_acento)]
            return (com_acento if len(com_acento) else grupo)[coluna].iloc[0]

        linhas.append({"uf": uf, "cnpj": cnpj, "sigla_exibicao": escolher("sigla"),
                       "nome_exibicao": escolher("empresa"), "nome_manual": False})
    df = pd.DataFrame(linhas, columns=["uf", "cnpj", "sigla_exibicao", "nome_exibicao", "nome_manual"])

    manual = df["cnpj"].isin(correcoes["cnpj"])
    corr = df.loc[manual, ["cnpj"]].merge(correcoes, on="cnpj", how="left")
    df.loc[manual, "sigla_exibicao"] = corr["sigla_exibicao"].values
    df.loc[manual, "nome_exibicao"] = corr["nome_exibicao"].values
    df.loc[manual, "nome_manual"] = True
    return df

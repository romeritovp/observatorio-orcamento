"""Testes da DCA Anexo I-E com resposta real da API salva em tests/fixtures/ (sem rede)."""

import json
import shutil
from pathlib import Path

import httpx
import pandas as pd
import pytest

from extractors import base
from extractors.nacional.siconfi import cliente, dca, dicionario_funcoes

FIXTURE = Path(__file__).parent / "fixtures" / "dca_anexo_i_e.json"


@pytest.fixture
def resposta():
    with open(FIXTURE, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def ente(resposta):
    """(uf, cod_ibge, ano) lidos da própria fixture."""
    item = resposta["items"][0]
    return item["uf"], str(item["cod_ibge"]), item["exercicio"]


@pytest.fixture
def df(resposta, ente):
    return dca.transformar_despesa_funcao(resposta["items"], *ente)


def test_classificar_conta():
    assert dca.classificar_conta("10 - Saúde") == {
        "nivel": "funcao", "funcao_cod": "10", "subfuncao_cod": None, "nome": "Saúde", "intra": False}
    assert dca.classificar_conta("10.302 - Assistência Hospitalar e Ambulatorial")["subfuncao_cod"] == "302"
    assert dca.classificar_conta("FU10 - Demais Subfunções")["nivel"] == "demais"
    assert dca.classificar_conta("Despesas Exceto Intraorçamentárias")["intra"] is False
    # variantes de 2015–2016
    assert dca.classificar_conta("Despesas (Exceto Intraorçamentárias)")["nivel"] == "total"
    assert dca.classificar_conta("Despesas (Exceto Intra-Orçamentárias)")["intra"] is False
    assert dca.classificar_conta("Despesas (Intra-Orçamentárias)")["intra"] is True
    assert dca.classificar_conta("Despesas Intraorçamentárias") == {
        "nivel": "total", "funcao_cod": None, "subfuncao_cod": None,
        "nome": "Despesas Intraorçamentárias", "intra": True}
    with pytest.raises(ValueError):
        dca.classificar_conta("linha nova que ninguém previu")


def test_niveis_e_codigos(df):
    assert set(df["nivel"]) == {"total", "funcao", "subfuncao", "demais"}
    # subfuncao_cod nulo fora do nível subfuncao; funcao_cod nulo só no total
    assert df.loc[df["nivel"] != "subfuncao", "subfuncao_cod"].isna().all()
    assert df.loc[df["nivel"] == "subfuncao", "subfuncao_cod"].notna().all()
    assert df.loc[df["nivel"] == "total", "funcao_cod"].isna().all()
    assert df.loc[df["nivel"] != "total", "funcao_cod"].str.fullmatch(r"\d{2}").all()
    assert df.loc[df["nivel"] == "subfuncao", "subfuncao_cod"].str.fullmatch(r"\d{3}").all()


def test_intra_separada(df):
    totais = df[df["nivel"] == "total"]
    assert sorted(totais["intra"]) == [False, True]
    # na DCA 2024 as intraorçamentárias não têm detalhe por função
    assert not df.loc[df["nivel"] != "total", "intra"].any()


def test_soma_das_funcoes_bate_com_total(df):
    dca.validar_despesa_funcao(df)  # não levanta erro


def test_subfuncoes_mais_demais_batem_com_funcao(df):
    funcoes = df[df["nivel"] == "funcao"].set_index("funcao_cod")
    abaixo = df[df["nivel"].isin(["subfuncao", "demais"])].groupby("funcao_cod")
    for coluna in ["empenhado", "liquidado", "pago"]:
        diferenca = (abaixo[coluna].sum() - funcoes[coluna]).abs()
        assert (diferenca.fillna(0) < 1).all()


def test_demais_calculado_so_onde_falta_demais_e_ha_diferenca(df):
    # com "demais" declarado, nada muda
    assert dca.completar_demais_calculado(df) is df
    # sem as linhas "demais" (como em 2015–2016), a diferença função − Σ subfunções vira demais_calculado
    sem_demais = df[df["nivel"] != "demais"].reset_index(drop=True)
    completo = dca.completar_demais_calculado(sem_demais)
    calculadas = completo[completo["nivel"] == "demais_calculado"]
    originais = df[df["nivel"] == "demais"].set_index("funcao_cod")
    assert len(calculadas) >= 1
    assert set(calculadas["funcao_cod"]) <= set(originais.index)
    for linha in calculadas.itertuples():
        assert linha.subfuncao_cod is None and linha.intra is False
        esperado = originais.loc[linha.funcao_cod, "empenhado"]
        assert linha.empenhado == pytest.approx(esperado, abs=0.01)
    # subfunções + demais calculado = função (a validação de sempre continua valendo)
    funcoes = completo[completo["nivel"] == "funcao"].set_index("funcao_cod")["empenhado"]
    abaixo = completo[completo["nivel"].isin(["subfuncao", "demais_calculado"])].groupby("funcao_cod")["empenhado"].sum()
    assert ((abaixo - funcoes).abs().fillna(0) < 1).all()
    dca.validar_despesa_funcao(completo)


def test_demais_calculado_nao_aparece_quando_subfuncoes_somam_a_funcao(df):
    sem_demais = df[df["nivel"] != "demais"].copy()
    funcoes = sem_demais["nivel"] == "funcao"
    somas = sem_demais[sem_demais["nivel"] == "subfuncao"].groupby("funcao_cod")[["empenhado", "liquidado", "pago"]].sum()
    for coluna in somas.columns:
        sem_demais.loc[funcoes, coluna] = sem_demais.loc[funcoes, "funcao_cod"].map(somas[coluna]).fillna(0.0) \
            .where(sem_demais.loc[funcoes, coluna].notna())
    assert "demais_calculado" not in set(dca.completar_demais_calculado(sem_demais)["nivel"])


def test_valor_ausente_fica_nulo(resposta, df):
    # na fixture, alguma linha "Demais" tem empenhado mas não liquidado/pago
    so_empenho = df[df["empenhado"].notna() & df["liquidado"].isna()]
    assert len(so_empenho) >= 1
    assert so_empenho["pago"].isna().all()


def test_validacao_falha_se_total_nao_bate(df):
    adulterado = df.copy()
    linha = adulterado.index[adulterado["nivel"] == "funcao"][0]
    adulterado.loc[linha, "pago"] += 1_000_000
    with pytest.raises(base.ErroValidacao, match="pago"):
        dca.validar_despesa_funcao(adulterado)


def test_extrair_le_do_cache_e_grava(tmp_path, resposta, ente):
    uf, cod_ibge, ano = ente
    # Coloca a fixture no cache com o formato gravado pelo cliente
    params = {"an_exercicio": ano, "no_anexo": dca.ANEXO_I_E, "id_ente": cod_ibge}
    arquivo = cliente.caminho_cache("dca", params, tmp_path / "raw")
    arquivo.parent.mkdir(parents=True)
    arquivo.write_text(json.dumps({"extraido_em": "teste", "endpoint": "dca",
                                   "params": params, "paginas": [resposta]}), encoding="utf-8")
    sem_rede = httpx.Client(transport=httpx.MockTransport(lambda r: pytest.fail("chamou a API")))

    df = dca.extrair_despesa_funcao(uf.lower(), ano, dir_raw=tmp_path / "raw",
                                    dir_processed=tmp_path / "processed", http=sem_rede)

    gravado = tmp_path / "processed" / "despesa" / f"uf={uf}" / f"ano={ano}" / f"{dca.NOME_ARQUIVO}.parquet"
    assert gravado.exists()
    lido = pd.read_parquet(gravado)
    assert len(lido) == len(df)
    assert (lido["cod_ibge"] == cod_ibge).all()
    assert (lido["fonte_dado"] == dca.FONTE_DADO).all()
    assert lido["periodo"].isna().all()  # DCA é anual
    assert (lido["extraido_em"] == "teste").all()  # data da extração vem do cache

    pop = pd.read_parquet(tmp_path / "processed" / "populacao" / f"uf={uf}" / f"ano={ano}" / f"{dca.NOME_ARQUIVO}.parquet")
    assert pop["populacao"].tolist() == [resposta["items"][0]["populacao"]]
    assert pop["cod_ibge"].tolist() == [cod_ibge]


def test_populacao_diferente_entre_itens_e_erro(resposta, ente):
    itens = [dict(i) for i in resposta["items"]]
    itens[5]["populacao"] += 1
    with pytest.raises(base.ErroValidacao, match="populacao"):
        dca.transformar_populacao(itens, *ente)


def test_gerar_dicionarios(resposta):
    funcoes, subfuncoes = dicionario_funcoes.gerar_dicionarios(resposta["items"])

    assert list(funcoes.columns) == ["funcao_cod", "funcao_nome"]
    assert dict(zip(funcoes["funcao_cod"], funcoes["funcao_nome"]))["10"] == "Saúde"
    assert dict(zip(subfuncoes["subfuncao_cod"], subfuncoes["subfuncao_nome"]))["122"] == "Administração Geral"
    assert funcoes["funcao_cod"].is_unique and subfuncoes["subfuncao_cod"].is_unique
    assert "Demais Subfunções" not in set(subfuncoes["subfuncao_nome"])


def test_dicionario_usa_nome_mais_recente(resposta):
    antigo = [{**i, "exercicio": 2000, "conta": "10 - Saude (grafia antiga)"} for i in resposta["items"][:1]]
    funcoes, _ = dicionario_funcoes.gerar_dicionarios(antigo + resposta["items"])
    assert dict(zip(funcoes["funcao_cod"], funcoes["funcao_nome"]))["10"] == "Saúde"


def test_dicionario_main_le_cache_e_grava_csv(tmp_path, resposta):
    destino = tmp_path / "raw" / "dca" / "99"
    destino.mkdir(parents=True)
    (destino / "2024_DCA-Anexo-I-E.json").write_text(json.dumps({"paginas": [resposta]}), encoding="utf-8")

    dicionario_funcoes.main(dir_raw=tmp_path / "raw", dir_saida=tmp_path / "dic")

    funcoes = pd.read_csv(tmp_path / "dic" / "funcoes.csv", dtype=str)
    assert funcoes["funcao_cod"].str.fullmatch(r"\d{2}").all()  # zeros à esquerda preservados
    assert (tmp_path / "dic" / "subfuncoes.csv").exists()

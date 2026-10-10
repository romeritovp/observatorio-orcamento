"""Testes do RREO Anexo 02 com resposta real da API salva em tests/fixtures/rreo.json (sem rede)."""

import json
from pathlib import Path

import httpx
import pandas as pd
import pytest

from extractors import base
from extractors.nacional.siconfi import cliente, rreo

FIXTURE = Path(__file__).parent / "fixtures" / "rreo.json"
LIQUIDADO = "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)"


@pytest.fixture
def resposta():
    with open(FIXTURE, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def ente(resposta):
    """(uf, cod_ibge, ano, periodo) lidos da própria fixture."""
    item = resposta["items"][0]
    return item["uf"], str(item["cod_ibge"]), item["exercicio"], item["periodo"]


@pytest.fixture
def funcoes():
    return rreo.nomes_de_funcoes()


@pytest.fixture
def df(resposta, ente):
    return rreo.transformar_anexo_02(resposta["items"], *ente)


def test_classificar_linha(funcoes):
    assert rreo.classificar_linha("RREO2TotalDespesas", "Saúde", funcoes) == ("exceto", "funcao")
    assert rreo.classificar_linha("RREO2TotalDespesasIntra", "Saúde", funcoes) == ("intra", "funcao")
    assert rreo.classificar_linha("RREO2TotalDespesas", "FU10 - Demais Subfunções", funcoes) == ("exceto", "subfuncao")
    assert rreo.classificar_linha("RREO2TotalDespesas", "Atenção Básica", funcoes) == ("exceto", "subfuncao")
    assert rreo.classificar_linha(
        "RREO2TotalDespesas", "DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)", funcoes) == ("exceto", "total_exceto")
    assert rreo.classificar_linha("RREO2TotalDespesas", "TOTAL (III) = (I + II)", funcoes) == ("exceto", "total_geral")
    with pytest.raises(base.ErroValidacao, match="cod_conta"):
        rreo.classificar_linha("OutraConta", "Saúde", funcoes)


def test_linha_intra_dentro_do_bloco_exceto_e_reconhecida(funcoes):
    # O aviso registrado: a linha (II) aparece também no bloco "exceto intra"
    assert rreo.classificar_linha(
        "RREO2TotalDespesas", "DESPESAS (INTRA-ORÇAMENTÁRIAS) (II)", funcoes) == ("exceto", "total_intra")


def test_transformar_no_esquema_demonstrativo(df, resposta):
    assert len(df) == len(resposta["items"])
    validado = base.validar_esquema(df, "demonstrativo")
    assert list(validado.columns) == list(base.ESQUEMAS["demonstrativo"])
    assert validado["cod_ibge"].str.fullmatch(r"\d+").all()


def test_validacao_passa_na_resposta_real(df, funcoes):
    rreo.validar_anexo_02(df, funcoes)


def test_validacao_nao_depende_do_rotulo(df, funcoes):
    # Em 2019 o bloco intra tinha rótulo "Total de Despesas"
    outro = df.copy()
    outro.loc[outro["cod_conta"] == "RREO2TotalDespesasIntra", "rotulo"] = "Total de Despesas"
    rreo.validar_anexo_02(outro, funcoes)


def test_validacao_aceita_colunas_so_com_a_letra(df, funcoes):
    # Relatórios antigos (RN 2015, BA 2016): "Até o Bimestre (b)" = empenhado, "(d)" = liquidado
    antigo = df.copy()
    antigo["coluna"] = antigo["coluna"].replace({"DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)": "Até o Bimestre (b)",
                                                 LIQUIDADO: "Até o Bimestre (d)"})
    assert (antigo["coluna"] == "Até o Bimestre (d)").any()
    rreo.validar_anexo_02(antigo, funcoes)


def test_validacao_falha_se_funcao_nao_soma(df, funcoes):
    adulterado = df.copy()
    alvo = (adulterado["conta"] == "Saúde") & (adulterado["coluna"] == LIQUIDADO) \
        & (adulterado["cod_conta"] == "RREO2TotalDespesas")
    assert alvo.sum() == 1
    adulterado.loc[alvo, "valor"] += 1_000_000
    with pytest.raises(base.ErroValidacao, match="difere"):
        rreo.validar_anexo_02(adulterado, funcoes)


def test_validacao_falha_se_funcao_desconhecida(df):
    # Sem "Saúde" no dicionário, a linha vira subfunção e a soma das funções não fecha
    sem_saude = rreo.nomes_de_funcoes() - {"saude"}
    with pytest.raises(base.ErroValidacao):
        rreo.validar_anexo_02(df, sem_saude)


def test_extrair_le_do_cache_e_grava(tmp_path, resposta, ente):
    uf, cod_ibge, ano, periodo = ente
    params = {
        "an_exercicio": ano, "nr_periodo": periodo, "co_tipo_demonstrativo": "RREO",
        "no_anexo": rreo.ANEXO_02, "co_esfera": "E", "id_ente": cod_ibge,
    }
    arquivo = cliente.caminho_cache("rreo", params, tmp_path / "raw")
    arquivo.parent.mkdir(parents=True)
    arquivo.write_text(json.dumps({"extraido_em": "2026-01-02T03:04:05+00:00", "paginas": [resposta]}),
                       encoding="utf-8")
    sem_rede = httpx.Client(transport=httpx.MockTransport(lambda r: pytest.fail("chamou a API")))

    df = rreo.extrair_anexo_02(uf, ano, periodo, dir_raw=tmp_path / "raw",
                               dir_processed=tmp_path / "processed", http=sem_rede)

    gravado = (tmp_path / "processed" / "demonstrativo" / f"uf={uf}" / f"ano={ano}"
               / f"siconfi_rreo_anexo_02_p{periodo}.parquet")
    lido = pd.read_parquet(gravado)
    assert len(lido) == len(df) == len(resposta["items"])
    assert set(lido["cod_conta"]) == set(rreo.BLOCOS)
    assert (lido["extraido_em"] == "2026-01-02T03:04:05+00:00").all()


def test_extrair_resposta_vazia(tmp_path, ente):
    uf, _, ano, periodo = ente
    vazia = httpx.Client(base_url="https://api.teste", transport=httpx.MockTransport(
        lambda r: httpx.Response(200, json={"items": [], "hasMore": False})))
    with pytest.raises(base.ConsultaVazia):
        rreo.extrair_anexo_02(uf, ano, periodo, dir_raw=tmp_path, dir_processed=tmp_path, http=vazia)

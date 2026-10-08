"""Testes do contrato comum dos extractors, com duas UFs fictícias."""

import pandas as pd
import pytest

from extractors import base


@pytest.fixture
def ufs_csv(tmp_path):
    caminho = tmp_path / "ufs.csv"
    caminho.write_text("uf,cod_ibge,nome,regiao\nAA,01,Estado A,Norte\nBB,02,Estado B,Sul\n", encoding="utf-8")
    return caminho


def despesa_duas_ufs():
    return pd.DataFrame({
        "uf": ["AA", "AA", "BB"],
        "cod_ibge": ["01", "01", "02"],
        "ano": [2024, 2024, 2024],
        "fonte_dado": ["teste"] * 3,
        "nivel": ["funcao", "funcao", "funcao"],
        "intra": [False, False, False],
        "funcao_cod": ["04", "10", "10"],
        "empenhado": [1.0, 2.0, 3.0],
    })


def test_ente_converte_sigla_em_codigo(ufs_csv):
    assert base.ente("bb", ufs_csv) == ("BB", "02")
    with pytest.raises(ValueError):
        base.ente("ZZ", ufs_csv)


def test_validar_esquema_completa_colunas_e_tipos():
    df = base.validar_esquema(despesa_duas_ufs(), "despesa")

    assert list(df.columns) == list(base.ESQUEMAS["despesa"])
    assert df["funcao_cod"].tolist() == ["04", "10", "10"]  # zero à esquerda preservado
    assert df["pago"].isna().all()  # ausente na fonte → nulo
    assert df["programa_cod"].isna().all()


def test_validar_esquema_recusa_coluna_estranha():
    df = despesa_duas_ufs().assign(inventada=1)
    with pytest.raises(base.ErroValidacao, match="inventada"):
        base.validar_esquema(df, "despesa")


def test_validar_esquema_recusa_uf_nula():
    df = despesa_duas_ufs()
    df.loc[0, "uf"] = None
    with pytest.raises(base.ErroValidacao, match="uf"):
        base.validar_esquema(df, "despesa")


def test_validar_soma():
    partes = pd.DataFrame({"pago": [1.0, 2.0, None]})
    base.validar_soma(partes, pd.DataFrame({"pago": [3.0]}), ["pago"])
    base.validar_soma(partes, pd.DataFrame({"pago": [3.5]}), ["pago"], tolerancia=1.0)
    with pytest.raises(base.ErroValidacao, match="difere"):
        base.validar_soma(partes, pd.DataFrame({"pago": [10.0]}), ["pago"])
    with pytest.raises(base.ErroValidacao, match="1 linha"):
        base.validar_soma(partes, pd.DataFrame({"pago": [1.0, 2.0]}), ["pago"])


def test_gravar_particiona_por_uf_e_ano(tmp_path):
    arquivos = base.gravar(despesa_duas_ufs(), "despesa", "teste", dir_processed=tmp_path)

    assert sorted(p.relative_to(tmp_path).as_posix() for p in arquivos) == [
        "despesa/uf=AA/ano=2024/teste.parquet",
        "despesa/uf=BB/ano=2024/teste.parquet",
    ]
    lido = pd.read_parquet(tmp_path / "despesa")  # uf e ano voltam pelo caminho
    assert lido.groupby(lido["uf"].astype(str))["empenhado"].sum().to_dict() == {"AA": 3.0, "BB": 3.0}

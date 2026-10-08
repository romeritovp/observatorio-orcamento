"""Testes de analyses/carregar.py com parquets gravados pelo base.py, duas UFs fictícias."""

import pandas as pd
import pytest

from analyses.carregar import carregar
from extractors import base


@pytest.fixture
def processed(tmp_path):
    df = pd.DataFrame({
        "uf": ["AA", "AA", "BB"],
        "cod_ibge": ["01", "01", "02"],
        "ano": [2023, 2024, 2024],
        "fonte_dado": ["teste"] * 3,
        "populacao": [10, 11, 20],
    })
    base.gravar(df, "populacao", "teste", dir_processed=tmp_path)
    return tmp_path


def test_carregar_tudo_com_tipos_certos(processed):
    df = carregar("populacao", dir_processed=processed)

    assert len(df) == 3
    assert pd.api.types.is_string_dtype(df["uf"]) and set(df["uf"]) == {"AA", "BB"}
    assert pd.api.types.is_string_dtype(df["cod_ibge"]) and set(df["cod_ibge"]) == {"01", "02"}
    assert pd.api.types.is_integer_dtype(df["ano"])


def test_carregar_filtra_uf_e_ano(processed):
    assert carregar("populacao", ufs="aa", dir_processed=processed)["ano"].tolist() == [2023, 2024]
    assert carregar("populacao", anos=[2024], dir_processed=processed)["uf"].tolist() == ["AA", "BB"]
    assert carregar("populacao", ufs=["BB"], anos=2024, dir_processed=processed)["populacao"].tolist() == [20]


def test_carregar_sem_dados_e_erro(processed):
    with pytest.raises(ValueError, match="nenhum dado"):
        carregar("populacao", ufs="ZZ", dir_processed=processed)
    with pytest.raises(FileNotFoundError):
        carregar("inexistente", dir_processed=processed)

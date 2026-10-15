"""consolidar_edicoes: a edição mais recente prevalece; a primeira publicação e a revisão ficam ao lado.
UFs fictícias (XA, XB)."""
import pandas as pd
import pytest

from analytics import consolidar_edicoes

PUBLICADO = pd.DataFrame([
    # XA 2020: publicado em 2021 e revisado em 2022; XA 2021: só na edição 2022
    {"uf": "XA", "ano": 2020, "edicao": 2021, "numero": 100.0, "taxa": 10.0},
    {"uf": "XA", "ano": 2020, "edicao": 2022, "numero": 104.0, "taxa": 10.3},
    {"uf": "XA", "ano": 2021, "edicao": 2022, "numero": 90.0, "taxa": 9.0},
    # XB 2020: a taxa não saiu na edição 2021 (nulo não conta como publicação)
    {"uf": "XB", "ano": 2020, "edicao": 2021, "numero": 50.0, "taxa": None},
    {"uf": "XB", "ano": 2020, "edicao": 2022, "numero": 48.0, "taxa": 4.8},
])


def test_edicao_mais_recente_prevalece_e_revisao_e_final_menos_primeira():
    c = consolidar_edicoes(PUBLICADO, ["uf", "ano"], ["numero", "taxa"]).set_index(["uf", "ano"])
    xa = c.loc[("XA", 2020)]
    assert (xa["numero"], xa["numero_primeira_publicacao"], xa["revisao_numero"]) == (104, 100, 4)
    assert (xa["edicao_fonte"], xa["edicao_primeira_publicacao"]) == (2022, 2021)
    assert xa["revisao_taxa"] == pytest.approx(0.3)
    assert c.loc[("XA", 2021), "revisao_numero"] == 0  # uma publicação só: revisão zero
    assert (c.loc[("XB", 2020), "taxa_primeira_publicacao"], c.loc[("XB", 2020), "revisao_taxa"]) == (4.8, 0)
    assert c.loc[("XB", 2020), "revisao_numero"] == -2


def test_dois_valores_na_mesma_edicao_e_erro():
    duplicado = pd.concat([PUBLICADO, PUBLICADO.iloc[[0]]])
    with pytest.raises(ValueError, match="mesma edição"):
        consolidar_edicoes(duplicado, ["uf", "ano"], ["numero"])

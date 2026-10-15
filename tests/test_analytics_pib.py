"""Testes das contas do PIB por UF (analytics/pib.py), com duas UFs fictícias (AA e BB) e o país (PP)."""

import math

import pandas as pd
import pytest

from analytics import crescimento_acumulado, participacao_no_pais, participacao_no_vab, rebasear

GRUPOS = {"02": "agro", "03": "industria", "04": "servicos", "05": "servicos"}


def atividades():
    """Total (01) e quatro atividades, AA e BB, 2022 e 2023. BB 2022 tem a atividade 05 nula."""
    linhas = []
    for uf, ano, valores in [("AA", 2022, [10, 30, 40, 20]), ("AA", 2023, [5, 45, 30, 20]),
                             ("BB", 2022, [1, 2, 3, None]), ("BB", 2023, [2, 2, 2, 2])]:
        total = 10.0 if valores[-1] is None else float(sum(valores))
        linhas.append({"uf": uf, "ano": ano, "atividade_cod": "01", "nivel": "total", "vab": total})
        for cod, v in zip(["02", "03", "04", "05"], valores):
            linhas.append({"uf": uf, "ano": ano, "atividade_cod": cod, "nivel": "atividade",
                           "vab": float("nan") if v is None else float(v)})
    return pd.DataFrame(linhas)


def test_participacao_por_atividade_usa_a_linha_de_total():
    p = participacao_no_vab(atividades()).set_index(["uf", "ano", "chave"])["pct"]
    assert p[("AA", 2023, "03")] == pytest.approx(45.0)
    assert p.xs(("AA", 2022), level=["uf", "ano"]).sum() == pytest.approx(100.0)
    assert "01" not in p.index.get_level_values("chave")  # o total não entra como parte


def test_participacao_por_grande_setor_soma_100_e_nulo_nao_vira_soma_parcial():
    p = participacao_no_vab(atividades(), GRUPOS).set_index(["uf", "ano", "chave"])["pct"]
    assert p[("AA", 2022, "servicos")] == pytest.approx(60.0)
    for uf, ano in [("AA", 2022), ("AA", 2023), ("BB", 2023)]:
        assert p.xs((uf, ano), level=["uf", "ano"]).sum() == pytest.approx(100.0)
    assert math.isnan(p[("BB", 2022, "servicos")])  # 05 nula: setor nulo
    assert p[("BB", 2022, "industria")] == pytest.approx(20.0)


def test_atividade_sem_grupo_e_erro():
    with pytest.raises(ValueError, match="sem grupo"):
        participacao_no_vab(atividades(), {"02": "agro"})


def pib():
    return pd.DataFrame({"uf": ["AA", "AA", "BB", "BB", "PP", "PP"], "ano": [2022, 2023] * 3,
                         "pib_corrente": [30.0, 40.0, 70.0, 60.0, 100.0, 100.0],
                         "volume": [100.0, 110.0, 120.0, 114.0, 200.0, 210.0]})


def test_participacao_no_pais():
    p = participacao_no_pais(pib(), "pib_corrente", "PP").set_index(["uf", "ano"])["pib_corrente_pct_pais"]
    assert p[("AA", 2023)] == pytest.approx(40.0)
    assert p[("PP", 2022)] == pytest.approx(100.0)


def test_rebasear_por_uf_e_base_ausente_fica_nula():
    r = rebasear(pib(), "volume", 2022).set_index(["uf", "ano"])["volume_base_2022"]
    assert r[("AA", 2022)] == 100 and r[("AA", 2023)] == pytest.approx(110.0)
    assert r[("BB", 2023)] == pytest.approx(95.0)
    sem_base = rebasear(pib()[pib()["ano"] == 2023], "volume", 2022)
    assert sem_base["volume_base_2022"].isna().all()


def test_crescimento_acumulado():
    c = crescimento_acumulado(pib(), "volume", 2022, 2023).set_index("uf")["crescimento_pct"]
    assert c["AA"] == pytest.approx(10.0) and c["BB"] == pytest.approx(-5.0) and c["PP"] == pytest.approx(5.0)
    assert crescimento_acumulado(pib(), "volume", 2021, 2023)["crescimento_pct"].isna().all()

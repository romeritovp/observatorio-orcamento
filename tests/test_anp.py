"""Testes da ANP (royalties e participação especial por estado) e da conferência com a DCA, sem rede."""

import json

import httpx
import pandas as pd
import pytest

from extractors import base
from extractors.nacional.anp import compensacoes as anp
from publicacao import compensacoes

UFS = pd.DataFrame({"uf": ["AA", "BB"], "cod_ibge": ["91", "92"], "nome": ["Ásia Alta", "Bela Baía"]})

# 01/01/2024 = 45292 e 01/12/2024 = 45627 no número de série do Excel
ROYALTIES = ("competencia;caixa;asia alta;bela baia;\r\n"
             "45231;45292;1000,5;0\r\n"
             "45261;45627;2000;10,25\r\n"
             ";;;\r\n;;;\r\n")  # linhas vazias no fim e ";" final, como nos arquivos reais
PE = ("competencia;caixa;estado;valor\r\n"
      "45200;45323;ásia alta;500,5\r\n"
      "45383;45597;asia alta;100\r\n"
      "45383;45658;bela baia;7\r\n")  # 45658 = 2025


@pytest.fixture
def brutos(tmp_path):
    (tmp_path / "royalties-estados").mkdir(parents=True)
    (tmp_path / "participacao-especial").mkdir(parents=True)
    (tmp_path / "royalties-estados" / "2024.csv").write_bytes(ROYALTIES.encode("latin1"))
    (tmp_path / "participacao-especial" / "pe_estado.csv").write_bytes(PE.encode("latin1"))
    (tmp_path / "manifesto.json").write_text(json.dumps({
        "royalties-estados/2024.csv": {"url": "u1", "extraido_em": "t1"},
        "participacao-especial/pe_estado.csv": {"url": "u2", "extraido_em": "t2"}}), encoding="utf-8")
    caminho_ufs = tmp_path / "ufs.csv"
    UFS.to_csv(caminho_ufs, index=False)
    return tmp_path, caminho_ufs


def test_links_aceitam_nomes_variados():
    html = ('<a href="https://x/royalties_estado_2018.csv">a</a><a href="https://x/royalties-estado-2019.csv">b</a>'
            '<a href="https://x/royalties-estados-2022.csv">c</a><a href="https://x/pe_estado.csv">d</a>'
            '<a href="https://x/pe_municipio.csv">e</a><a href="https://x/royalties-municipio-2022.csv">f</a>')
    assert anp.links_da_pagina(html) == {
        "royalties-estados/2018.csv": "https://x/royalties_estado_2018.csv",
        "royalties-estados/2019.csv": "https://x/royalties-estado-2019.csv",
        "royalties-estados/2022.csv": "https://x/royalties-estados-2022.csv",
        "participacao-especial/pe_estado.csv": "https://x/pe_estado.csv",
    }


def test_le_formato_largo_e_longo(brutos):
    pasta, _ = brutos
    roy = anp.ler_royalties(pasta / "royalties-estados" / "2024.csv", UFS)
    assert len(roy) == 4  # 2 meses × 2 estados; linhas vazias fora
    assert roy.loc[(roy["uf"] == "AA") & (roy["caixa"].dt.month == 1), "valor"].item() == 1000.5
    pe = anp.ler_participacao_especial(pasta / "participacao-especial" / "pe_estado.csv", UFS)
    assert sorted(pe["uf"]) == ["AA", "AA", "BB"] and pe["valor"].sum() == pytest.approx(607.5)


def test_estado_desconhecido_e_erro(tmp_path):
    caminho = tmp_path / "x.csv"
    caminho.write_bytes("competencia;caixa;atlantida\r\n45231;45292;1\r\n".encode("latin1"))
    with pytest.raises(base.ErroValidacao, match="atlantida"):
        anp.ler_royalties(caminho, UFS)


def test_extrair_soma_por_ano_de_caixa_e_grava(brutos, tmp_path):
    pasta, caminho_ufs = brutos
    tabela, cobertura = anp.extrair(dir_raw=pasta, dir_processed=tmp_path / "processed", caminho_ufs=caminho_ufs)
    v = tabela.set_index(["uf", "ano", "tipo"])["valor"]
    assert v[("AA", 2024, "royalties")] == pytest.approx(3000.5)
    assert v[("AA", 2024, "participacao_especial")] == pytest.approx(600.5)
    assert v[("BB", 2025, "participacao_especial")] == 7  # ano de caixa, não de competência
    assert set(tabela["fonte_dado"]) == {"anp_royalties_estados", "anp_pe_estado"}
    assert tabela.loc[tabela["tipo"] == "royalties", "extraido_em"].unique().tolist() == ["t1"]
    assert cobertura["pe_ultima_caixa"] == "2025-01-01"
    assert (tmp_path / "processed" / "compensacoes_anp" / "uf=AA" / "ano=2024" / "anp.parquet").exists()


def test_baixar_usa_cache_e_grava_manifesto(tmp_path):
    chamadas = []

    def responder(req):
        chamadas.append(str(req.url))
        if str(req.url) == anp.PAGINA:
            return httpx.Response(200, text='<a href="https://x/royalties-estado-2024.csv"></a><a href="https://x/pe_estado.csv"></a>')
        return httpx.Response(200, content=b"conteudo")

    http = httpx.Client(transport=httpx.MockTransport(responder))
    manifesto = anp.baixar(dir_raw=tmp_path, http=http)
    assert set(manifesto) == {"royalties-estados/2024.csv", "participacao-especial/pe_estado.csv"}
    assert (tmp_path / "royalties-estados" / "2024.csv").read_bytes() == b"conteudo"
    anp.baixar(dir_raw=tmp_path, http=http)
    assert len(chamadas) == 4  # 2ª vez: só a página; os arquivos vieram do cache


# --- conferência DCA × ANP -----------------------------------------------------------------------

def test_conferencia_desconta_o_fep_e_marca_parcial():
    receita = pd.DataFrame({"uf": ["AA", "AA", "AA"], "ano": [2023, 2024, 2025], "item": ["petroleo_gas"] * 3,
                            "bruta": [110.0, 200.0, 50.0]})
    ic = pd.DataFrame({"uf": ["AA", "AA"], "ano": [2023, 2024], "coluna": ["Receitas Brutas Realizadas"] * 2,
                       "cod_conta": ["RO1.7.1.2.52.4.0", "RO1.3.9.0.00.0.0"], "valor": [10.0, 500.0]})
    tabela_anp = pd.DataFrame({"uf": ["AA"] * 4, "ano": [2023, 2023, 2024, 2025],
                               "tipo": ["royalties", "participacao_especial", "royalties", "royalties"],
                               "valor": [60.0, 40.0, 150.0, 30.0]})
    conf = compensacoes.conferencia(receita, ic, tabela_anp, [2023, 2024, 2025]).set_index("ano")
    assert conf.loc[2023, "razao"] == pytest.approx(1.10) and conf.loc[2023, "razao_sem_fep"] == pytest.approx(1.0)
    assert not conf.loc[2023, "fora_da_faixa"]
    # participação especial só até 2023: 2024 e 2025 ficam parciais (sem total)
    assert conf.loc[2024, "anp_parcial"] and conf.loc[2025, "anp_parcial"] and pd.isna(conf.loc[2025, "anp_total"])
    petroleo, ultimo = compensacoes.montar_petroleo(receita, ic, tabela_anp, [2023, 2024, 2025])
    assert ultimo == 2023
    assert petroleo.set_index("ano").loc[2024, "demais_patrimoniais"] == 500.0


def test_fep_em_cada_codificacao_da_receita():
    ic = pd.DataFrame({"uf": ["AA"] * 4, "ano": [2016, 2017, 2019, 2023], "coluna": ["Receitas Brutas Realizadas"] * 4,
                       "cod_conta": ["RO1.7.2.1.22.70.00", "RO1.7.2.1.22.30.00", "RO1.7.1.8.02.6.0", "RO1.7.1.2.52.4.0"],
                       "valor": [7.0, 99.0, 8.0, 9.0]})
    fep = compensacoes.fep_dca(ic)
    assert fep.to_dict() == {("AA", 2016): 7.0, ("AA", 2019): 8.0, ("AA", 2023): 9.0}  # royalties de 2017 não é FEP

"""Testes das Contas Regionais do IBGE (PIB por UF), sem rede.

Duas partes:
- leitura com planilhas de exemplo montadas no teste (FolhaFake imita a aba do xlrd: tipos de célula, #REF!,
  nomes de território com variações de grafia, aba com nome errado);
- conferências com os brutos reais da edição em data/raw/ibge/contas-regionais/ (pulados se não baixados).
"""

import json

import httpx
import pandas as pd
import pytest
import xlrd

from extractors import base
from extractors.nacional.ibge_contas_regionais import baixar
from extractors.nacional.ibge_contas_regionais import pib

UFS = pd.DataFrame({"uf": ["AA", "BB"], "cod_ibge": ["91", "92"], "nome": ["Ásia Alta", "Bela Baía"],
                    "regiao": ["Norte", "Norte"]})
TERRITORIOS = pd.DataFrame({"uf": ["BR"], "cod_ibge": ["1"], "nome": ["Brasil"]})
ATIVIDADES = [("01", "total das atividades"), ("02", "agropecuaria"), ("03", "industrias extrativas")]
ANOS = [2002, 2003, 2004]

VAZIA, NUM, TEXTO, ERRO = xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_NUMBER, xlrd.XL_CELL_TEXT, xlrd.XL_CELL_ERROR
REF = 0x17  # código do #REF! no Excel


class FolhaFake:
    """Imita xlrd.sheet.Sheet: linhas de células (tipo, valor)."""

    def __init__(self, nome, linhas):
        self.name = nome
        largura = max(len(l) for l in linhas)
        self._linhas = [l + [(VAZIA, "")] * (largura - len(l)) for l in linhas]
        self.nrows, self.ncols = len(self._linhas), largura

    def cell_type(self, r, c):
        return self._linhas[r][c][0]

    def cell_value(self, r, c):
        return self._linhas[r][c][1]


class LivroFake:
    def __init__(self, folhas):
        self._folhas = folhas

    def sheets(self):
        return self._folhas


def t(valor):
    return (TEXTO, valor)


def n(valor):
    return (NUM, float(valor))


CABECALHO = [t("ANO"), t("VALOR DO ANO ANTERIOR\n(1 000 000 R$)"), t("ÍNDICE DE VOLUME "),
             t("VALOR A PREÇOS DO ANO ANTERIOR \n(1 000 000 R$)"), t("ÍNDICE DE PREÇO       "),
             t("VALOR A PREÇO CORRENTE\n(1 000 000 R$)")]


def aba_conta(nome_aba, territorio, atividade, vbp, ci, indices=(None, 1.1, 1.2), celula_2002_vbp=None):
    """Aba da Conta da Produção com 3 anos: VAB = VBP − CI. Títulos dizem '2002-2022' como em 364 abas reais."""
    linhas = [[t("CONTAS REGIONAIS DO BRASIL")], [t("Ano de referência 2010")]]
    for i, (titulo, valores) in enumerate([("Valor Bruto da Produção 2002-2022", vbp),
                                           ("Consumo intermediário 2002-2022", ci),
                                           ("Valor Adicionado Bruto 2002-2022", [v - c for v, c in zip(vbp, ci)])]):
        linhas += [[t(titulo)], [t(territorio)], [t(atividade)], CABECALHO]
        for k, (ano, valor) in enumerate(zip(ANOS, valores)):
            indice = n(indices[k]) if indices[k] is not None else (VAZIA, "")
            corrente = celula_2002_vbp if (celula_2002_vbp and k == 0 and i in (0, 2)) else n(valor)
            linhas.append([n(ano), n(1), indice, n(1), n(1), corrente])
        linhas += [[], []]
    linhas[-1] = [t("Fonte: IBGE, em parceria com os Órgãos Estaduais de Estatística...")]
    return FolhaFake(nome_aba, linhas)


def livro_conta(territorio, nomes_abas=("T.1", "T.2", "T.3"), **kwargs):
    """Total = agropecuária + extrativas."""
    agro = aba_conta(nomes_abas[1], territorio, "Agropecuária", [10, 20, 30], [4, 5, 6])
    extr = aba_conta(nomes_abas[2], territorio, "Indústrias extrativas", [100, 200, 300], [40, 50, 60], **kwargs)
    total = aba_conta(nomes_abas[0], territorio, "Total das Atividades", [110, 220, 330], [44, 55, 66])
    return LivroFake([FolhaFake("Sumário", [[t("Sumário")]]), total, agro, extr])


@pytest.fixture
def dicionarios(tmp_path):
    caminho_ufs, caminho_territorios = tmp_path / "ufs.csv", tmp_path / "territorios.csv"
    UFS.to_csv(caminho_ufs, index=False)
    TERRITORIOS.to_csv(caminho_territorios, index=False)
    return pib.territorios(caminho_ufs, caminho_territorios)


# --- leitura (planilhas de exemplo) ----------------------------------------------------------

def test_normaliza_grafias_dos_territorios(dicionarios):
    mapa, regioes = dicionarios
    for grafia in ("  Ásia alta ", "ASIA ALTA", "Asia  Alta"):
        assert mapa[pib.normalizar(grafia)] == ("AA", "91")
    assert mapa[pib.normalizar("               Brasil")] == ("BR", "1")
    assert pib.normalizar("          Norte") in regioes and pib.normalizar("Região Norte") in regioes


def test_le_conta_pela_posicao_e_nao_pelo_nome_da_aba(dicionarios):
    mapa, regioes = dicionarios
    livro = livro_conta("Bela baía ", nomes_abas=("Tabela1.1", "Tabela1.2", "Tabela1.3"))  # como a Tabela19
    uf, cod, df = pib.ler_arquivo_conta(livro, ANOS, mapa, regioes, ATIVIDADES)
    assert (uf, cod) == ("BB", "92")
    extr = df[df["atividade_cod"] == "03"].set_index("ano")
    assert extr.loc[2004, "vab"] == 240 and extr.loc[2003, "consumo_intermediario"] == 50
    assert extr.loc[2003, "vab_indice_volume"] == pytest.approx(1.1)
    assert pd.isna(extr.loc[2002, "vab_indice_volume"])  # 2002 não tem índice


def test_regiao_e_ignorada(dicionarios):
    mapa, regioes = dicionarios
    assert pib.ler_arquivo_conta(livro_conta("Região Norte"), ANOS, mapa, regioes, ATIVIDADES) is None


def test_territorio_desconhecido_e_erro(dicionarios):
    mapa, regioes = dicionarios
    with pytest.raises(base.ErroValidacao, match="atlantida"):
        pib.ler_arquivo_conta(livro_conta("Atlântida"), ANOS, mapa, regioes, ATIVIDADES)


def test_atividade_fora_de_ordem_e_erro(dicionarios):
    mapa, regioes = dicionarios
    livro = livro_conta("Ásia Alta")
    folhas = livro.sheets()
    folhas[2], folhas[3] = folhas[3], folhas[2]
    with pytest.raises(base.ErroValidacao, match="atividade 'industrias extrativas'"):
        pib.ler_arquivo_conta(livro, ANOS, mapa, regioes, ATIVIDADES)


def test_territorio_diferente_dentro_do_arquivo_e_erro(dicionarios):
    mapa, regioes = dicionarios
    livro = livro_conta("Ásia Alta")
    livro.sheets()[3] = aba_conta("T.3", "Bela Baía", "Indústrias extrativas", [1, 2, 3], [0, 0, 0])
    with pytest.raises(base.ErroValidacao, match="território 'bela baia'"):
        pib.ler_arquivo_conta(livro, ANOS, mapa, regioes, ATIVIDADES)


def test_ref_vira_nulo_e_vai_para_o_log(dicionarios, caplog):
    mapa, regioes = dicionarios
    livro = livro_conta("Ásia Alta", celula_2002_vbp=(ERRO, REF))
    ocorrencias = []
    _, _, df = pib.ler_arquivo_conta(livro, ANOS, mapa, regioes, ATIVIDADES, ocorrencias)
    linha = df[(df["atividade_cod"] == "03") & (df["ano"] == 2002)].iloc[0]
    assert pd.isna(linha["valor_producao"]) and pd.isna(linha["vab"])
    assert linha["consumo_intermediario"] == 40  # o CI não tem erro
    assert len(ocorrencias) == 2 and "#REF!" in ocorrencias[0]
    assert "#REF!" in caplog.text


def test_texto_no_lugar_de_numero_e_erro(dicionarios):
    mapa, regioes = dicionarios
    livro = livro_conta("Ásia Alta", celula_2002_vbp=t("23"))
    with pytest.raises(base.ErroValidacao, match="não numérica"):
        pib.ler_arquivo_conta(livro, ANOS, mapa, regioes, ATIVIDADES)


def tab_especial(rotulo, valores):
    """tab01/03/04: territórios nas linhas (Brasil e região indentados, UF com espaço no fim), anos nas colunas."""
    linhas = [[t("Tabela 1 - ...")], [], [t("Brasil, Grandes Regiões\ne\nUnidades da Federação"), t(rotulo)],
              [(VAZIA, "")] + [n(a) for a in ANOS]]
    for nome, vals in valores.items():
        linhas.append([t(nome)] + [n(v) for v in vals])
    linhas.append([t("Fonte: IBGE...")])
    return FolhaFake("Tabela1", linhas)


def test_le_especial_sem_regioes(dicionarios):
    mapa, regioes = dicionarios
    folha = tab_especial("Produto Interno Bruto (1 000 000 R$)", {
        "               Brasil": [3, 6, 9], "          Norte": [3, 6, 9], "Ásia Alta ": [1, 2, 3], "Bela baía": [2, 4, 6]})
    df = pib.ler_especial(folha, ANOS, mapa, regioes, "produto interno bruto")
    assert sorted(df["uf"].unique()) == ["AA", "BB", "BR"]
    assert df.set_index(["uf", "ano"]).loc[("BB", 2004), "valor"] == 6


def test_especial_sem_territorio_e_erro(dicionarios):
    mapa, regioes = dicionarios
    folha = tab_especial("Produto Interno Bruto (1 000 000 R$)", {"Brasil": [1, 1, 1], "Ásia Alta": [1, 1, 1]})
    with pytest.raises(base.ErroValidacao, match="BB"):
        pib.ler_especial(folha, ANOS, mapa, regioes, "produto interno bruto")


def test_conferir_acusa_soma_que_nao_bate():
    atividade = pd.DataFrame({
        "uf": ["AA"] * 3, "ano": [2003] * 3, "atividade_cod": ["01", "02", "03"],
        "nivel": ["total", "atividade", "atividade"],
        "valor_producao": [110e6, 10e6, 100e6], "consumo_intermediario": [44e6, 4e6, 40e6],
        "vab": [66e6, 6e6, 60e6]})
    pib_uf = pd.DataFrame({"uf": ["AA"], "ano": [2003], "vab": [66e6]})
    assert pib.conferir(pib_uf, atividade)["soma_vab"] == 0
    errado = atividade.assign(valor_producao=[110e6, 10e6, 101e6], vab=[66e6, 6e6, 61e6])
    with pytest.raises(base.ErroValidacao, match="soma_vab"):
        pib.conferir(pib_uf, errado)


# --- download --------------------------------------------------------------------------------

def test_urls_vem_da_edicao_no_config():
    config = {"edicao": 2025, "serie_inicio": 2002, "url_base": "https://x/{edicao}/xls",
              "arquivos": ["A_{inicio}_{edicao}.zip", "B_{inicio}_{edicao}.txt"]}
    assert baixar.urls(config) == {"2025/A_2002_2025.zip": "https://x/2025/xls/A_2002_2025.zip",
                                   "2025/B_2002_2025.txt": "https://x/2025/xls/B_2002_2025.txt"}


def _zip(arquivos):
    import io
    import zipfile
    memoria = io.BytesIO()
    with zipfile.ZipFile(memoria, "w") as z:
        for nome, conteudo in arquivos.items():
            z.writestr(nome, conteudo)
    return memoria.getvalue()


def test_baixar_extrai_zip_usa_cache_e_grava_hash(tmp_path):
    config = {"edicao": 2023, "serie_inicio": 2002, "url_base": "https://x/{edicao}", "timeout_segundos": 1,
              "arquivos": ["P_{inicio}_{edicao}.zip", "I_{inicio}_{edicao}.txt"]}
    conteudos = {"/2023/P_2002_2023.zip": _zip({"Tabela1.xls": b"planilha"}), "/2023/I_2002_2023.txt": b"indice"}
    chamadas = []

    def responder(req):
        chamadas.append(req.url.path)
        return httpx.Response(200, content=conteudos[req.url.path])

    http = httpx.Client(transport=httpx.MockTransport(responder))
    manifesto = baixar.baixar(config, dir_raw=tmp_path, http=http)
    assert (tmp_path / "2023" / "P_2002_2023" / "Tabela1.xls").read_bytes() == b"planilha"
    assert (tmp_path / "2023" / "P_2002_2023.zip").read_bytes() == conteudos["/2023/P_2002_2023.zip"]  # intacto
    import hashlib
    assert manifesto["2023/I_2002_2023.txt"]["sha256"] == hashlib.sha256(b"indice").hexdigest()
    assert manifesto["2023/I_2002_2023.txt"]["bytes"] == 6
    assert json.loads((tmp_path / "manifesto.json").read_text(encoding="utf-8")) == manifesto

    baixar.baixar(config, dir_raw=tmp_path, http=http)  # já existe: não baixa de novo
    assert len(chamadas) == 2
    baixar.baixar(config, dir_raw=tmp_path, http=http, atualizar=True)
    assert len(chamadas) == 4


def test_zip_com_caminho_para_fora_e_recusado(tmp_path):
    caminho = tmp_path / "mau.zip"
    caminho.write_bytes(_zip({"../fora.txt": b"x"}))
    with pytest.raises(base.ErroValidacao, match="caminho suspeito"):
        baixar.extrair_zip(caminho)
    assert not (tmp_path / "fora.txt").exists()


# --- conferências com os brutos reais --------------------------------------------------------

CONFIG = baixar.ler_config()
PASTA_CONTA, PASTA_ESPECIAIS, _, _ = pib.pastas(CONFIG, baixar.DIR_RAW)
ANOS_REAIS = list(range(CONFIG["serie_inicio"], CONFIG["edicao"] + 1))
reais = pytest.mark.skipif(not PASTA_CONTA.exists() or not PASTA_ESPECIAIS.exists(),
                           reason="brutos das Contas Regionais não baixados")
MI = pib.MILHAO
COLUNAS = ["valor_producao", "consumo_intermediario", "vab"]


@pytest.fixture(scope="module")
def extraido(tmp_path_factory):
    pib_uf, atividade, ocorrencias, _ = pib.extrair(dir_processed=tmp_path_factory.mktemp("processed"))
    return pib_uf.astype({"ano": int}), atividade.astype({"ano": int}), ocorrencias


@reais
def test_cobertura_27_ufs_e_brasil(extraido):
    pib_uf, atividade, _ = extraido
    ufs = pd.read_csv(base.CAMINHO_UFS, dtype=str)
    assert set(pib_uf["uf"]) == set(ufs["uf"]) | {"BR"}
    assert len(pib_uf) == 28 * len(ANOS_REAIS) and len(atividade) == 28 * len(ANOS_REAIS) * 13
    assert pib_uf.loc[pib_uf["uf"] == "BR", "cod_ibge"].unique().tolist() == ["1"]
    assert set(pib_uf["edicao"]) == {CONFIG["edicao"]}


@reais
def test_nulos_so_no_acre_2002_atividades_9_a_13(extraido):
    _, atividade, ocorrencias = extraido
    nulos = atividade[atividade[COLUNAS].isna().any(axis=1)]
    assert set(nulos["uf"]) == {"AC"} and set(nulos["ano"]) == {2002}
    assert sorted(nulos["atividade_cod"]) == ["09", "10", "11", "12", "13"]
    assert nulos["valor_producao"].isna().all() and nulos["vab"].isna().all()
    assert nulos["consumo_intermediario"].notna().all()
    assert len(ocorrencias) == 10


@reais
def test_soma_das_atividades_igual_ao_total(extraido):
    _, atividade, _ = extraido
    total = atividade[atividade["nivel"] == "total"].set_index(["uf", "ano"])[COLUNAS]
    partes = atividade[atividade["nivel"] == "atividade"]
    soma = partes.groupby(["uf", "ano"])[COLUNAS].sum(min_count=12)  # nulo se faltar atividade (Acre 2002)
    dif = (soma - total).abs()
    assert dif.notna().sum().sum() == 3 * 28 * len(ANOS_REAIS) - 2  # Acre 2002: só VBP e VAB ficam de fora
    assert dif.max().max() <= 0.01 * MI


@reais
def test_vbp_menos_ci_igual_vab(extraido):
    _, atividade, _ = extraido
    dif = (atividade["valor_producao"] - atividade["consumo_intermediario"] - atividade["vab"]).abs()
    assert dif.max() <= 0.01 * MI


@reais
def test_vab_da_conta_igual_tab04(extraido):
    pib_uf, atividade, _ = extraido
    total = atividade[atividade["nivel"] == "total"].set_index(["uf", "ano"])["vab"]
    assert (total - pib_uf.set_index(["uf", "ano"])["vab"]).abs().max() <= 0.01 * MI


@reais
def test_soma_das_ufs_igual_brasil(extraido):
    """O Brasil de 2010 a 2021 vem arredondado ao inteiro (R$ milhão): tolerância proporcional, 1e-6."""
    pib_uf, _, _ = extraido
    br = pib_uf[pib_uf["uf"] == "BR"].set_index("ano")
    soma = pib_uf[pib_uf["uf"] != "BR"].groupby("ano")[["pib_corrente", "vab"]].sum()
    relativa = ((soma - br[["pib_corrente", "vab"]]) / br[["pib_corrente", "vab"]]).abs()
    assert relativa.max().max() < 1e-6


@reais
def test_indices_anuais_reproduzem_tab05(extraido):
    _, atividade, _ = extraido
    mapa, regioes = pib.territorios()
    tab05 = pib.ler_volume_vab_atividades(PASTA_ESPECIAIS / "tab05.xls", ANOS_REAIS, mapa, regioes, pib.atividades())
    serie = atividade.sort_values(["uf", "atividade_cod", "ano"])
    acumulado = serie["vab_indice_volume"].fillna(1.0).groupby(
        [serie["uf"], serie["atividade_cod"]]).cumprod() * 100
    comparado = serie.assign(acumulado=acumulado).merge(tab05, on=["uf", "ano", "atividade_cod"])
    assert len(comparado) == len(atividade)
    relativa = ((comparado["acumulado"] - comparado["volume_2002_100"]) / comparado["volume_2002_100"]).abs()
    assert relativa.max() < 1e-8


@reais
def test_ancoras_rj_2023(extraido):
    pib_uf, atividade, _ = extraido
    rj = pib_uf.set_index(["uf", "ano"]).loc[("RJ", 2023)]
    assert rj["pib_corrente"] / MI == pytest.approx(1_172_871.4434, abs=0.0001)
    assert rj["vab"] / MI == pytest.approx(1_049_547.3623, abs=0.0001)
    extrativas = atividade.set_index(["uf", "ano", "atividade_cod"]).loc[("RJ", 2023, "03"), "vab"]
    assert extrativas / MI == pytest.approx(274_964.38, abs=0.01)

"""Prévias de compartilhamento: imagens 1200×630 (og/), ícone e textos por página para o index.php.

Uso (o export também chama no fim):
    uv run python -m publicacao.og

Lê só os JSONs exportados em web/public/data/ (meta, dicionarios, receita, divida, despesa_funcoes, ipca) e grava:
    web/public/og/padrao.png          nome do site e a frase do site, sem números
    web/public/og/estado-<uf>.png     "As contas de <estado>", o ano e três números (sem o endereço do site)
    web/public/og/numeros.json        os números escritos em cada imagem (o teste confere com o gabarito.json)
    web/public/apple-touch-icon.png   ícone 180×180
    web/public/data/compartilhar.json textos de título, descrição e imagem por UF e por área, para o index.php
Domínio e nome do site vêm de config/site.yaml. Visual do site: creme, texto quase preto, vermelho de destaque,
fonte Inter (a mesma do site: web/src/fontes/, publicacao/fontes/).
"""

import json
from pathlib import Path

import pandas as pd
import yaml
from PIL import Image, ImageDraw, ImageFont

from analytics import deflacionar

RAIZ = Path(__file__).resolve().parents[1]
DIR_DATA = RAIZ / "web" / "public" / "data"
DIR_OG = RAIZ / "web" / "public" / "og"
DIR_PUBLIC = RAIZ / "web" / "public"
DIR_FONTES = Path(__file__).resolve().parent / "fontes"
CAMINHO_SITE = RAIZ / "config" / "site.yaml"

LARGURA, ALTURA = 1200, 630
FUNDO, SUPERFICIE = "#f7f3ea", "#fcfaf5"
TEXTO, TEXTO_2, TEXTO_3 = "#1d1b18", "#57514a", "#857d70"
LINHA, DESTAQUE = "#e3dccd", "#b3261e"
FRASE = "Quanto cada governo estadual arrecada, gasta e deve, segundo as contas entregues ao Tesouro Nacional."
FONTE_DADOS = "SICONFI/Tesouro Nacional"
FUNCAO_SAUDE = "10"


def ler_site(caminho=CAMINHO_SITE):
    with open(caminho, encoding="utf-8") as f:
        site = yaml.safe_load(f) or {}
    return {"dominio": str(site["dominio"]), "nome": str(site["nome_site"]), "url": f"https://{site['dominio']}"}


def fonte(peso, tamanho):
    return ImageFont.truetype(str(DIR_FONTES / f"Inter-{peso}.ttf"), tamanho)


# --- números (só dos JSONs exportados) --------------------------------------------------------

def reais_compacto(valor):
    """1.2345e10 → 'R$ 12,3 bi' (mesma regra de formatacao.js: uma casa abaixo de 100)."""
    for divisor, sufixo in [(1e9, "bi"), (1e6, "mi"), (1e3, "mil")]:
        if abs(valor) >= divisor:
            v = valor / divisor
            casas = 0 if abs(v) >= 100 else 1
            return f"R$ {v:,.{casas}f} {sufixo}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {valor:,.0f}".replace(",", ".")


def reais_inteiros(valor):
    return f"R$ {valor:,.0f}".replace(",", ".")


def pct(valor):
    return f"{valor:,.1f}%".replace(",", "X").replace(".", ",").replace("X", ".")


def numeros_por_uf(dados):
    """{uf: {ano, receita_liquida, dcl_rcl_pct, saude_per_capita}} no último ano dos dados.

    receita líquida (sem intra) de receita.json; DCL/RCL (linha oficial) de divida.json; saúde por habitante
    = liquidado da função 10, sem intra, a preços de dez/ano base, ÷ população, de despesa_funcoes.json. Ausente = None.
    """
    ano = max(dados["meta"]["anos"])
    ano_base = dados["meta"]["deflacao"]["ano_base_padrao"]
    receita = {(t["uf"], t["ano"]): t["liquida_exceto_intra"] for t in dados["receita"]["totais"]}
    divida = {(d["uf"], d["ano"]): d["dcl_rcl_pct"] for d in dados["divida"]["linhas"]}
    saude = pd.DataFrame([l for l in dados["despesa"] if l["ano"] == ano and l["nivel"] == "funcao"
                          and not l["intra"] and l["fonte_dado"] == "siconfi_dca"
                          and l["funcao_cod"] == FUNCAO_SAUDE and l["liquidado"] is not None])
    ipca = pd.DataFrame(dados["ipca"]["serie"])
    saude = deflacionar(saude, ["liquidado"], ano_base, ipca)
    por_hab = dict(zip(saude["uf"], saude["liquidado_real"] / saude["populacao"]))
    return {u["uf"]: {"ano": ano, "receita_liquida": receita.get((u["uf"], ano)),
                      "dcl_rcl_pct": divida.get((u["uf"], ano)), "saude_per_capita": por_hab.get(u["uf"], 0.0)}
            for u in dados["dicionarios"]["ufs"]}


# --- desenho ------------------------------------------------------------------------------------

def _quebrar(desenho, texto, letra, largura):
    linhas, atual = [], ""
    for palavra in texto.split():
        teste = f"{atual} {palavra}".strip()
        if desenho.textlength(teste, font=letra) <= largura:
            atual = teste
        else:
            linhas.append(atual)
            atual = palavra
    return linhas + [atual]


def _base(site):
    imagem = Image.new("RGB", (LARGURA, ALTURA), FUNDO)
    d = ImageDraw.Draw(imagem)
    d.rectangle([0, 0, 14, ALTURA], fill=DESTAQUE)  # faixa de destaque
    d.text((80, 64), site["nome"].upper(), font=fonte("SemiBold", 26), fill=TEXTO_2)
    d.line([(80, ALTURA - 96), (LARGURA - 80, ALTURA - 96)], fill=LINHA, width=2)
    d.text((80, ALTURA - 72), f"Fonte: {FONTE_DADOS}", font=fonte("Regular", 24), fill=TEXTO_3)
    # Sem o endereço do site na imagem: a prévia já mostra o domínio abaixo dela
    return imagem, d


def imagem_padrao(site):
    imagem, d = _base(site)
    letra = fonte("Bold", 62)
    y = 150
    for linha in _quebrar(d, FRASE, letra, LARGURA - 160):
        d.text((80, y), linha, font=letra, fill=TEXTO)
        y += 78
    return imagem


def imagem_estado(site, nome_estado, artigo, numeros):
    imagem, d = _base(site)
    preposicao = {"o": "do", "a": "da"}.get(artigo, "de")
    d.text((80, 112), f"As contas {preposicao} {nome_estado}", font=fonte("Bold", 66), fill=TEXTO)
    d.text((80, 200), f"Em {numeros['ano']}, segundo as contas entregues ao Tesouro Nacional",
           font=fonte("Regular", 28), fill=TEXTO_2)
    cartoes = [
        (reais_compacto(numeros["receita_liquida"]) if numeros["receita_liquida"] is not None else "–", "receita no ano"),
        (pct(numeros["dcl_rcl_pct"]) if numeros["dcl_rcl_pct"] is not None else "–", "dívida sobre a receita"),
        (reais_inteiros(numeros["saude_per_capita"]), "em saúde por habitante"),
    ]
    largura_cartao, x = (LARGURA - 160 - 2 * 28) / 3, 80
    for valor, rotulo in cartoes:
        d.rounded_rectangle([x, 286, x + largura_cartao, 486], radius=18, fill=SUPERFICIE, outline=LINHA, width=2)
        d.text((x + 28, 318), valor, font=fonte("Bold", 54), fill=TEXTO)
        d.text((x + 28, 404), rotulo, font=fonte("Regular", 26), fill=TEXTO_2)
        x += largura_cartao + 28
    return imagem


def icone():
    """Ícone 180×180: barras do site, a última em vermelho."""
    imagem = Image.new("RGB", (180, 180), FUNDO)
    d = ImageDraw.Draw(imagem)
    for i, (altura, cor) in enumerate([(60, "#a1988a"), (95, "#a1988a"), (130, DESTAQUE)]):
        x = 38 + i * 38
        d.rounded_rectangle([x, 150 - altura, x + 26, 150], radius=5, fill=cor)
    return imagem


def gravar_png(imagem, caminho):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    imagem.save(caminho, "PNG", optimize=True)
    return caminho


# --- textos para o index.php ----------------------------------------------------------------------

def montar_compartilhar(site, dados, numeros):
    """Título, descrição e imagem por UF e por área; o PHP só escolhe entre estes textos."""
    nome = site["nome"]
    imagem = lambda arquivo: f"{site['url']}/og/{arquivo}"
    ufs = {}
    for u in dados["dicionarios"]["ufs"]:
        n = numeros[u["uf"]]
        preposicao = {"o": "do", "a": "da"}.get(u.get("artigo"), "de")
        partes = [f"receita de {reais_compacto(n['receita_liquida'])}" if n["receita_liquida"] is not None else None,
                  f"dívida de {pct(n['dcl_rcl_pct'])} da receita" if n["dcl_rcl_pct"] is not None else None,
                  f"{reais_inteiros(n['saude_per_capita'])} por habitante em saúde"]
        ufs[u["uf"]] = {
            "nome": u["nome"],
            "title": f"As contas {preposicao} {u['nome']} · {nome}",
            "description": f"Em {n['ano']}: " + ", ".join(p for p in partes if p) + ". De onde vem e para onde vai "
                           "o dinheiro do estado, segundo as contas entregues ao Tesouro Nacional.",
            "image": imagem(f"estado-{u['uf'].lower()}.png"),
        }
    funcoes = {f["funcao_cod"]: {
        "nome": f["funcao_nome"],
        "title": f"Comparar estados: {f['funcao_nome']} · {nome}",
        "description": f"Quanto cada governo estadual gasta em {f['funcao_nome'].lower()} por habitante e em % do "
                       "orçamento, com a conta aberta. Dados entregues ao Tesouro Nacional.",
    } for f in dados["dicionarios"]["funcoes"]}
    return {
        "aviso": "Gerado por publicacao/og.py; lido pelo index.php. Não editar à mão.",
        "url_site": site["url"],
        "padrao": {"title": f"{nome}: as contas dos estados", "description": FRASE, "image": imagem("padrao.png")},
        "comparar": {"title": f"Comparar estados · {nome}",
                     "description": "Quanto cada governo estadual gasta em cada área, por habitante e em % do "
                                    "orçamento. Dados entregues ao Tesouro Nacional.",
                     "image": imagem("padrao.png")},
        "pib": {"title": f"PIB dos Estados · {nome}",
                "description": "O tamanho da economia de cada estado, o peso de cada setor ano a ano e o crescimento"
                               + (f" desde {dados['meta']['pib']['anos'][0]}" if dados["meta"].get("pib") else "")
                               + ", segundo o IBGE.",
                "image": imagem("padrao.png")},
        "inovacao": {"title": f"Pesquisa e Inovação · {nome}",
                     "description": "O índice de inovação do INPI (IBID) dos 27 estados, com o gasto estadual em ciência "
                                    "e tecnologia ao lado.",
                     "image": imagem("padrao.png")},
        "educacao": {"title": f"Educação · {nome}",
                     "description": "O IDEB de cada estado, por etapa e rede, de 2005 a 2025: série histórica, tendência e "
                                    "ranking, com os dados do Inep.",
                     "image": imagem("padrao.png")},
        "violencia": {"title": f"Violência · {nome}",
                      "description": "As mortes violentas intencionais em cada estado desde 2016, a comparação com a "
                                     "região e o Brasil e o ranking pela taxa, com os dados do Anuário Brasileiro de "
                                     "Segurança Pública.",
                      "image": imagem("padrao.png")},
        "views": ["estado", "comparar", "pib", "inovacao", "educacao", "violencia"],
        # slug do indicador na URL (/sp/pib, /indicadores/pib) → chave dos textos acima; o mesmo que
        # web/src/navegacao.config.js (um teste do front confere). "orcamento" usa "comparar" na visão nacional
        # e o texto da UF na página do estado.
        "indicadores": {"orcamento": "comparar", "pib": "pib", "educacao": "educacao", "pesquisa-e-inovacao": "inovacao",
                        "violencia": "violencia"},
        "ufs": ufs,
        "funcoes": funcoes,
    }


def ler_dados(dir_data=DIR_DATA):
    arquivos = {"meta": "meta", "dicionarios": "dicionarios", "receita": "receita", "divida": "divida",
                "despesa": "despesa_funcoes", "ipca": "ipca"}
    return {nome: json.loads((Path(dir_data) / f"{arquivo}.json").read_text(encoding="utf-8"))
            for nome, arquivo in arquivos.items()}


def main(dir_data=DIR_DATA, dir_og=DIR_OG, dir_public=DIR_PUBLIC, caminho_site=CAMINHO_SITE):
    site = ler_site(caminho_site)
    dados = ler_dados(dir_data)
    numeros = numeros_por_uf(dados)
    dir_og = Path(dir_og)
    gravados = [gravar_png(imagem_padrao(site), dir_og / "padrao.png")]
    for u in dados["dicionarios"]["ufs"]:
        gravados.append(gravar_png(imagem_estado(site, u["nome"], u.get("artigo"), numeros[u["uf"]]),
                                   dir_og / f"estado-{u['uf'].lower()}.png"))
    gravar_png(icone(), Path(dir_public) / "apple-touch-icon.png")
    (dir_og / "numeros.json").write_text(json.dumps(numeros, ensure_ascii=False, indent=1), encoding="utf-8")
    (Path(dir_data) / "compartilhar.json").write_text(
        json.dumps(montar_compartilhar(site, dados, numeros), ensure_ascii=False, indent=1), encoding="utf-8")
    maior = max(p.stat().st_size for p in gravados)
    print(f"og/: {len(gravados)} imagens 1200×630 (maior: {maior / 1024:,.0f} KB); compartilhar.json; apple-touch-icon.png")


if __name__ == "__main__":
    main()

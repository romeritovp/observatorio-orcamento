"""Baixa os zips do IDEB (Inep) por regiões e UFs e do Brasil, e guarda os brutos como vieram.

Uso:
    uv run python -m extractors.nacional.inep.baixar              # baixa se ainda não tiver
    uv run python -m extractors.nacional.inep.baixar --atualizar  # baixa de novo

A página de resultados do Inep carrega os links por JavaScript; as URLs seguem o padrão das edições
(conferido para 2023 e 2025): https://download.inep.gov.br/ideb/resultados/<arquivo>_<EDICAO>.zip, com
<arquivo> = divulgacao_regioes_ufs_ideb (27 UFs e 5 regiões) e divulgacao_brasil_ideb (o país).
Brutos: data/raw/inep/ideb/<EDICAO>/<arquivo>_<EDICAO>.zip (intactos) e o conteúdo extraído na pasta ao lado, com
data/raw/inep/manifesto.json (URL, data da extração, tamanho e SHA-256 de cada zip).

Certificado: o servidor download.inep.gov.br não envia o certificado intermediário (RNP ICPEdu GR46 OV TLS CA 2025).
Navegadores e o curl do macOS completam a cadeia sozinhos; o Python não. `contexto_tls` baixa o intermediário do
endereço indicado no próprio certificado (AIA) e o usa só para montar a cadeia até uma raiz do certifi: a cadeia
parcial fica desligada, então o intermediário nunca vira raiz de confiança (um falso não valida). A verificação
nunca é desligada.
"""

import hashlib
import json
import ssl
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import certifi
import httpx

from extractors import base

EDICAO = 2025
ARQUIVOS = ["divulgacao_regioes_ufs_ideb", "divulgacao_brasil_ideb"]
URL = "https://download.inep.gov.br/ideb/resultados/{arquivo}_{edicao}.zip"
DIR_RAW = base.RAIZ / "data" / "raw" / "inep"
MANIFESTO = "manifesto.json"
# Intermediário que o servidor deixa de enviar (campo "CA Issuers" do certificado de *.inep.gov.br)
URL_INTERMEDIARIO = "http://secure.globalsign.com/cacert/rnpicpedugr46ovtlsca2025.crt"


def contexto_tls(url_intermediario=URL_INTERMEDIARIO):
    """Raízes do certifi + o intermediário só para construir a cadeia (sem cadeia parcial)."""
    der = httpx.get(url_intermediario, timeout=60, follow_redirects=True).content
    contexto = ssl.create_default_context(cafile=certifi.where())
    contexto.load_verify_locations(cadata=ssl.DER_cert_to_PEM_cert(der))
    if hasattr(ssl, "VERIFY_X509_PARTIAL_CHAIN"):
        contexto.verify_flags &= ~ssl.VERIFY_X509_PARTIAL_CHAIN
    return contexto


def relativo(arquivo, edicao=EDICAO):
    return f"ideb/{edicao}/{arquivo}_{edicao}.zip"


def extrair_zip(caminho_zip):
    """Extrai o zip numa pasta ao lado, com o mesmo nome sem .zip. Recusa caminhos que saiam da pasta."""
    destino = caminho_zip.with_suffix("")
    with zipfile.ZipFile(caminho_zip) as z:
        for nome in z.namelist():
            if not (destino / nome).resolve().is_relative_to(destino.resolve()):
                raise base.ErroValidacao(f"{caminho_zip.name}: caminho suspeito no zip ({nome})")
        z.extractall(destino)
    return destino


def baixar(edicao=EDICAO, dir_raw=DIR_RAW, http=None, atualizar=False):
    """Baixa os zips que faltam (ou todos, com atualizar), extrai e atualiza o manifesto.
    Devolve {arquivo: caminho do zip}."""
    dir_raw = Path(dir_raw)
    caminho_manifesto = dir_raw / MANIFESTO
    manifesto = json.loads(caminho_manifesto.read_text(encoding="utf-8")) if caminho_manifesto.exists() else {}
    caminhos = {}
    for arquivo in ARQUIVOS:
        rel = relativo(arquivo, edicao)
        destino = caminhos[arquivo] = dir_raw / rel
        if destino.exists() and not atualizar:
            continue
        url = URL.format(arquivo=arquivo, edicao=edicao)
        http = http or httpx.Client(timeout=300, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}, verify=contexto_tls())
        resposta = http.get(url)
        resposta.raise_for_status()
        if not resposta.content.startswith(b"PK"):
            raise base.ErroValidacao(f"{url}: a resposta não é um zip")
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(resposta.content)  # como veio
        extrair_zip(destino)
        manifesto[rel] = {"url": url, "extraido_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                          "bytes": len(resposta.content), "sha256": hashlib.sha256(resposta.content).hexdigest()}
        print(f"baixado {rel} ({len(resposta.content):,} bytes)")
    caminho_manifesto.parent.mkdir(parents=True, exist_ok=True)
    caminho_manifesto.write_text(json.dumps(manifesto, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    return caminhos


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    for caminho in baixar(atualizar="--atualizar" in argv).values():
        print(f"Bruto: {caminho.relative_to(base.RAIZ)}")


if __name__ == "__main__":
    main()

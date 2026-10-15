"""Baixa a planilha do IBID (INPI) e guarda o bruto como veio.

Uso:
    uv run python -m extractors.nacional.inpi.baixar              # baixa se ainda não tiver
    uv run python -m extractors.nacional.inpi.baixar --atualizar  # baixa de novo

Bruto: data/raw/inpi/ibid/ibid-serie-historica.xlsx, com data/raw/inpi/manifesto.json (URL, data da extração,
tamanho e SHA-256), como nas outras fontes nacionais.
"""

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

from extractors import base

URL = ("https://www.gov.br/inpi/pt-br/inpi-data/"
       "indice-brasil-de-inovacao-e-desenvolvimento-ibid/ibid-serie-historica.xlsx")
DIR_RAW = base.RAIZ / "data" / "raw" / "inpi"
RELATIVO = "ibid/ibid-serie-historica.xlsx"
MANIFESTO = "manifesto.json"


def baixar(dir_raw=DIR_RAW, http=None, atualizar=False):
    """Baixa a planilha se faltar (ou sempre, com atualizar) e atualiza o manifesto. Devolve o caminho do bruto."""
    dir_raw = Path(dir_raw)
    destino = dir_raw / RELATIVO
    caminho_manifesto = dir_raw / MANIFESTO
    manifesto = json.loads(caminho_manifesto.read_text(encoding="utf-8")) if caminho_manifesto.exists() else {}
    if destino.exists() and not atualizar:
        return destino
    http = http or httpx.Client(timeout=120, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"})
    resposta = http.get(URL)
    resposta.raise_for_status()
    if not resposta.content.startswith(b"PK"):  # xlsx é um zip; página de erro em HTML não passa
        raise base.ErroValidacao(f"{URL}: a resposta não é uma planilha xlsx")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(resposta.content)  # como veio
    manifesto[RELATIVO] = {"url": URL, "extraido_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                           "bytes": len(resposta.content), "sha256": hashlib.sha256(resposta.content).hexdigest()}
    caminho_manifesto.write_text(json.dumps(manifesto, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    print(f"baixado {RELATIVO} ({len(resposta.content):,} bytes)")
    return destino


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    print(f"Bruto: {baixar(atualizar='--atualizar' in argv).relative_to(base.RAIZ)}")


if __name__ == "__main__":
    main()

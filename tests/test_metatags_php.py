"""Roda web/scripts/testar_metatags.sh (robô de prévia contra o index.php em php -S). Pulado sem PHP ou sem build."""

import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "web" / "scripts" / "testar_metatags.sh"


@pytest.mark.skipif(shutil.which("php") is None, reason="php não instalado: o teste do index.php não rodou")
def test_metatags_devolvidas_ao_robo():
    resultado = subprocess.run([str(SCRIPT)], capture_output=True, text=True, timeout=60)
    if resultado.returncode == 2:
        pytest.skip(resultado.stdout.strip())
    assert resultado.returncode == 0, resultado.stdout + resultado.stderr

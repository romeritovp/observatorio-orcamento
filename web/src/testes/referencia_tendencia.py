"""Referência independente para web/src/estatistica/tendencia.js: regressão log-linear calculada pelo statsmodels.

Gera web/src/testes/referencia_tendencia.json (séries de entrada + resultados esperados), lido pelo
tendencia.test.js. statsmodels não é dependência do projeto: rodar num ambiente temporário,

    uv run --no-project --with statsmodels python -I web/src/testes/referencia_tendencia.py

Séries determinísticas (sem sorteio), para o arquivo não mudar entre execuções.
"""

import json
import math
from pathlib import Path

import numpy as np
import statsmodels
import statsmodels.api as sm
from scipy import stats
from statsmodels.stats.diagnostic import acorr_ljungbox
from statsmodels.stats.stattools import durbin_watson

SAIDA = Path(__file__).with_suffix(".json")
DADOS = Path(__file__).resolve().parents[2] / "public" / "data"
ATIVIDADE_EXEMPLO = "04"  # a da página "Como fazemos" (ATIVIDADE_PIB_PADRAO em src/estado.js)


def serie(anos, f):
    return [{"ano": a, "valor": f(i, a)} for i, a in enumerate(anos)]


A15 = list(range(2009, 2024))
A22 = list(range(2002, 2024))
SERIES = {
    # oscilações ao redor de uma tendência de +2% ao ano
    "oscilacao": serie(A15, lambda i, a: 100 * 1.02 ** i * (1 + 0.03 * math.sin(2.1 * i) + 0.01 * math.cos(5.3 * i))),
    # queda de ~3% ao ano com ruído pequeno
    "queda_ruido": serie(A15, lambda i, a: 50 * 0.97 ** i * (1 + 0.02 * math.sin(3.7 * i))),
    # ondas longas: desvios persistentes (autocorrelação positiva) em torno de +1% ao ano
    "autocorrelacao": serie(A22, lambda i, a: 10 * 1.01 ** i * math.exp(0.06 * math.sin(i / 2.5))),
    # sem tendência e muito ruído: R² baixo, intervalo inclui zero
    "r2_baixo": serie(A15, lambda i, a: 20 * (1 + 0.15 * math.sin(2.9 * i + 1) + 0.1 * math.cos(1.7 * i))),
    # poucos anos (janela de 3 anos = 4 observações)
    "quatro_anos": serie([2020, 2021, 2022, 2023], lambda i, a: [3.1, 3.4, 3.3, 3.9][i]),
    # seis anos (janela de 5 anos)
    "seis_anos": serie(list(range(2018, 2024)), lambda i, a: [7.2, 7.0, 6.1, 6.6, 6.4, 6.0][i]),
}


def serie_do_exemplo():
    """Série real do exemplo da página "Como fazemos": participação % da atividade no VAB da UF do exemplo
    (meta.json → documentacao.exemplo), lida dos JSON publicados, de 2002 ao último ano."""
    uf = json.loads((DADOS / "meta.json").read_text(encoding="utf-8"))["documentacao"]["exemplo"]["uf"]
    linhas = json.loads((DADOS / "pib" / f"{uf}.json").read_text(encoding="utf-8"))
    total = {l["ano"]: l["vab"] for l in linhas if l["atividade_cod"] == "01"}
    return uf, [{"ano": l["ano"], "valor": l["vab"] / total[l["ano"]] * 100}
                for l in sorted(linhas, key=lambda l: l["ano"]) if l["atividade_cod"] == ATIVIDADE_EXEMPLO]


def calcular(obs):
    anos = np.array([o["ano"] for o in obs], dtype=float)
    y = np.log([o["valor"] for o in obs])
    n = len(y)
    X = sm.add_constant(anos - anos.mean())
    mqo = sm.OLS(y, X).fit()
    ic = mqo.conf_int(alpha=0.05)[1]
    resid = mqo.resid
    defasagens = max(1, math.floor(4 * (n / 100) ** (2 / 9)))
    nw = sm.OLS(y, X).fit(cov_type="HAC", cov_kwds={"maxlags": defasagens, "use_correction": True}, use_t=True)
    lb = acorr_ljungbox(resid, lags=[1])
    return {
        "n": n, "beta": mqo.params[1], "r2": mqo.rsquared, "erro_padrao_mqo": mqo.bse[1], "t": mqo.tvalues[1],
        "valor_p": mqo.pvalues[1], "ic_beta": list(ic), "erro_padrao_newey_west": nw.bse[1], "defasagens": defasagens,
        "ic_beta_newey_west": list(nw.conf_int(alpha=0.05)[1]), "valor_p_newey_west": nw.pvalues[1],
        "durbin_watson": durbin_watson(resid), "ljung_box_q": float(lb["lb_stat"].iloc[0]),
        "ljung_box_p": float(lb["lb_pvalue"].iloc[0]),
        "rho1": float(np.sum(resid[1:] * resid[:-1]) / np.sum(resid ** 2)),
    }


def distribuicoes():
    """Quantis e valores-p da t e da qui-quadrado (scipy) para conferir distribuicoes.js."""
    casos_t = [(gl, p) for gl in (1, 2, 4, 13, 20, 100) for p in (0.9, 0.95, 0.975, 0.995)]
    return {
        "t_quantil": [{"gl": gl, "p": p, "valor": stats.t.ppf(p, gl)} for gl, p in casos_t],
        "t_valor_p": [{"gl": gl, "t": t, "valor": 2 * stats.t.sf(abs(t), gl)} for gl in (2, 13, 20) for t in (0.3, 1.7, 2.5, 6.0)],
        "qui2_valor_p": [{"gl": 1, "q": q, "valor": stats.chi2.sf(q, 1)} for q in (0.01, 0.5, 2.7, 3.84, 10.0)],
    }


def main():
    uf, exemplo = serie_do_exemplo()
    saida = {
        "gerado_por": f"web/src/testes/referencia_tendencia.py (statsmodels {statsmodels.__version__})",
        "series": {nome: {"observacoes": obs, "esperado": calcular(obs)} for nome, obs in SERIES.items()},
        "exemplo_metodo": {"uf": uf, "atividade_cod": ATIVIDADE_EXEMPLO, "observacoes": exemplo, "esperado": calcular(exemplo)},
        "distribuicoes": distribuicoes(),
    }
    SAIDA.write_text(json.dumps(saida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{SAIDA.name}: {len(SERIES)} séries")


if __name__ == "__main__":
    main()

import re
import unicodedata

ESPECIE_LABEL = {"canino": "Cão", "felino": "Gato", "ave": "Ave", "roedor": "Roedor", "lagomorfo": "Coelho",
                 "reptil": "Réptil", "exotico": "Exótico", "outro": "Outro"}

VARIAVEIS = ["{paciente}", "{nº paciente}", "{espécie}", "{raça}", "{tutor}", "{data}", "{veterinário}"]

_ALIASES = {"paciente": "paciente", "no paciente": "codigo", "n paciente": "codigo", "numero paciente": "codigo",
            "n. paciente": "codigo", "especie": "especie", "raca": "raca", "tutor": "tutor", "data": "data",
            "veterinario": "veterinario"}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.strip().lower())
    return re.sub(r"\s+", " ", "".join(c for c in s if not unicodedata.combining(c)))


def aplicar_variaveis(texto: str, valores: dict) -> str:
    def troca(m):
        chave = _ALIASES.get(_norm(m.group(1)))
        return str(valores.get(chave, "")) if chave else m.group(0)
    return re.sub(r"\{([^{}\n]{1,30})\}", troca, texto or "")

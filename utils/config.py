from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, Iterable

CANONICAL_KEY_ALIASES = {
    'GEMINI_API_KEY': ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI API KEY', 'GOOGLE API KEY'],
    'GEMINI_MODEL': ['GEMINI_MODEL', 'GEMINI MODEL'],
    'SECRET_KEY': ['SECRET_KEY', 'SECRET KEY'],
    'PORT': ['PORT'],
    'GROQ_API_KEY': ['GROQ_API_KEY', 'GROQ API KEY'],
    'OPENAI_API_KEY': ['OPENAI_API_KEY', 'OPENAI API KEY'],
}


def _candidate_env_paths() -> Iterable[Path]:
    here = Path(__file__).resolve().parents[1]
    cwd = Path.cwd()
    names = ['.env', '.env.txt']
    seen = set()
    for base in [cwd, here]:
        for name in names:
            path = (base / name).resolve()
            if path not in seen:
                seen.add(path)
                yield path


def _normalize_key(key: str) -> str:
    return ' '.join(key.strip().replace('_', ' ').split()).upper()


class Settings:
    def __init__(self) -> None:
        self.loaded_files: list[str] = []
        self.values = self._load_all()

    def _load_all(self) -> Dict[str, str]:
        values: Dict[str, str] = {}
        for path in _candidate_env_paths():
            if not path.exists() or not path.is_file():
                continue
            self.loaded_files.append(str(path))
            try:
                for raw_line in path.read_text(encoding='utf-8').splitlines():
                    line = raw_line.strip()
                    if not line or line.startswith('#') or '=' not in line:
                        continue
                    key, value = line.split('=', 1)
                    key = key.strip().strip('"').strip("'")
                    value = value.strip().strip('"').strip("'")
                    values[key] = value
            except Exception:
                continue
        for key, value in os.environ.items():
            values.setdefault(key, value)
        return values

    def get(self, canonical_key: str, default: str | None = None) -> str | None:
        aliases = CANONICAL_KEY_ALIASES.get(canonical_key, [canonical_key])
        normalized_aliases = {_normalize_key(alias) for alias in aliases}

        for key, value in os.environ.items():
            if _normalize_key(key) in normalized_aliases and str(value).strip():
                return str(value).strip()

        for key, value in self.values.items():
            if _normalize_key(key) in normalized_aliases and str(value).strip():
                return str(value).strip()

        return default


settings = Settings()

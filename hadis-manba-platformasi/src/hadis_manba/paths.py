"""OS uchun to'g'ri foydalanuvchi ma'lumotlari joyi (repo ichida emas)."""
from __future__ import annotations

import os
import sys
from pathlib import Path


def data_home() -> Path:
    env = os.environ.get("HADIS_MANBA_HOME")
    if env:
        return Path(env).expanduser()
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "HadisManba"
    if os.name == "nt":
        return Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "HadisManba"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "hadis-manba"


class Home:
    def __init__(self, root: Path | None = None):
        self.root = Path(root) if root else data_home()

    @property
    def db(self) -> Path:
        return self.root / "hadis-manba.sqlite"

    @property
    def packages(self) -> Path:
        return self.root / "packages"

    @property
    def staging(self) -> Path:
        return self.root / "staging"

    @property
    def journal(self) -> Path:
        return self.root / "import-journal.jsonl"

    def ensure(self) -> "Home":
        for p in (self.root, self.packages, self.staging):
            p.mkdir(parents=True, exist_ok=True)
        return self

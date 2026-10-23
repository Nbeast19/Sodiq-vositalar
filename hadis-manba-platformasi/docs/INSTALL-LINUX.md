# Linux

```sh
python3 -m venv .venv && .venv/bin/pip install ".[mcp]"
.venv/bin/hadis-manba doctor
.venv/bin/hadis-manba install dist/*.hmz
.venv/bin/hadis-manba search "طلب العلم"
.venv/bin/hadis-manba serve --web web     # http://127.0.0.1:8765/
```
Ma'lumot joyi: `$XDG_DATA_HOME/hadis-manba` (standart `~/.local/share/hadis-manba`).
PWA: Chrome/Chromium → O'rnatish belgisi.

**Holat:** Linux konteynerda (Python 3.13, SQLite 3.45, Chromium headless) barcha avtomatik testlar o'tgan.

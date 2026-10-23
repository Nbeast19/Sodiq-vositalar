# Windows

## A) AIsiz o'qish/qidiruv (PWA) — tavsiya
1. Chrome yoki Edge'da Hadith Library saytini oching.
2. Manzil satridagi **O'rnatish** belgisi → ilova Start menyusida paydo bo'ladi.
3. **Kitoblar** → paket o'rnating → "Oflayn tayyor".

## B) Saytsiz, to'liq mahalliy (Python bilan)
1. [python.org](https://www.python.org/downloads/windows/) dan Python 3.12/3.13 o'rnating ("Add python.exe to PATH" belgisini qo'ying).
2. Loyiha papkasida (PowerShell):
   ```powershell
   py -m pip install ".[mcp]"
   hadis-manba doctor
   hadis-manba serve --web web
   ```
3. Brauzerda `http://127.0.0.1:8765/` → o'rnatish (PWA) → paketlarni import qiling.
4. Ma'lumot joyi: `%APPDATA%\HadisManba` (yoki `HADIS_MANBA_HOME`).

AI ulash: `AI-ULASH.md`. **Holat:** real Windows'da sinalmagan.

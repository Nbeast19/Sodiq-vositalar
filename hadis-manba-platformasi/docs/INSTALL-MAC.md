# Mac

## A) PWA
Safari 17+ (File → Add to Dock) yoki Chrome/Edge (O'rnatish belgisi) → **Kitoblar** → paket o'rnating.

## B) Python bilan (mahalliy xizmat va MCP)
```sh
python3 -m venv ~/.hadis-manba-venv
~/.hadis-manba-venv/bin/pip install ".[mcp]"      # loyiha papkasida
~/.hadis-manba-venv/bin/hadis-manba doctor
~/.hadis-manba-venv/bin/hadis-manba serve --web web
```
Ma'lumot joyi: `~/Library/Application Support/HadisManba`.

## Shaxsiy manbalarni audit qilish (faqat o'qiydi)
```sh
hadis-manba audit --zips ~/Downloads/ZIPLAR --manba ~/Downloads/Kitob-loyiha/0-Manba --out ~/HadisManba-audit
```
Kirish papkalariga hech narsa yozilmaydi; pre/post xesh bilan isbotlanadi.

**Holat:** real Mac'da sinalmagan (Linux konteynerda Python 3.13 bilan sinalgan).

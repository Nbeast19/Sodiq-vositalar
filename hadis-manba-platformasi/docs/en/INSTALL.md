# Install and use offline — Windows, Mac, iPhone, Android, Linux

No account, no Python, no AI. After installation the books you installed work without internet.
**Test status:** these flows pass automated tests in headless Chromium (English and Arabic, 1280px and 390px, offline). They have **not yet been tested on real devices**; see [PLATFORM-TEST-MATRIX.md](../PLATFORM-TEST-MATRIX.md).

## iPhone / iPad (iOS/iPadOS 16.4 or newer)
1. Open the Hadis Manba address in **Safari**.
2. Share (↑) → **Add to Home Screen** → **Add**. Open it from the Home Screen icon.
3. **Library** → choose a book → **Install book only** or **Install book + selected commentaries** → wait for **Offline ready**.
4. Keep the screen on while downloading; iOS may pause downloads in the background. If interrupted, press install again — nothing is lost.
5. **My books → Ask for persistent storage.** The Home Screen app and Safari keep data separately; deleting Safari data or the app can remove books. Back up notes (**Notes → Export**) and keep package files (**My books → Save as file**).
6. Offline check: turn on Airplane mode, close and reopen the app, search.

## Android (Chrome 103 or newer)
1. Open the address in **Chrome** → ⋮ → **Install app** (or Add to Home screen).
2. Install books from the **Library**; wait for **Offline ready**.
3. To install from a file: **Library → Install from a file** (Downloads or Drive).
4. Ask for persistent storage and back up notes.

## Windows (Chrome or Edge 103+)
1. Open the address → click the **install** icon in the address bar → the app appears in the Start menu.
2. Install books from the **Library**.

## Mac
- Safari 17+: File → **Add to Dock**. Chrome/Edge: **install** icon in the address bar.
- Install books from the **Library**.

## Linux
Chrome/Chromium → install icon. Advanced: `pip install ".[mcp]"` then `hadis-manba serve --web web` → http://127.0.0.1:8765/.

## Optional: AI connection (computer only)
See [../AI-ULASH.md](../AI-ULASH.md). The app does not need it.

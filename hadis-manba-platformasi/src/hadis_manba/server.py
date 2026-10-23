"""Ixtiyoriy mahalliy HTTP xizmat (faqat 127.0.0.1).

  POST /api/<tool>   JSON body — core bilan bir xil konvert qaytaradi
  GET  /api/tools    mavjud amallar
  GET  /             web/ PWA fayllari (agar --web berilsa)
Host va Origin tekshiriladi (DNS rebinding va begona saytlardan himoya).
"""
from __future__ import annotations

import json
import mimetypes
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from .core import TOOL_NAMES, Core
from .store import Library

MAX_BODY = 64 * 1024


def make_handler(core: Core, port: int, web_root: Path | None):
    allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
    allowed_origins = {f"http://{h}" for h in allowed_hosts}

    class Handler(BaseHTTPRequestHandler):
        server_version = "HadisManba"

        def log_message(self, fmt, *args):  # foydalanuvchi so'rov matni logga yozilmaydi
            pass

        def _send(self, code: int, body: bytes, ctype: str = "application/json; charset=utf-8"):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; object-src 'none'")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, code: int, obj):
            self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"))

        def _guard(self) -> bool:
            if self.headers.get("Host") not in allowed_hosts:
                self._json(403, {"error": {"code": "forbidden", "message": "Host ruxsat etilmagan"}})
                return False
            origin = self.headers.get("Origin")
            if origin is not None and origin not in allowed_origins:
                self._json(403, {"error": {"code": "forbidden", "message": "Origin ruxsat etilmagan"}})
                return False
            return True

        def do_GET(self):
            if not self._guard():
                return
            path = urlsplit(self.path).path
            if path == "/api/tools":
                return self._json(200, {"tools": list(TOOL_NAMES)})
            if path.startswith("/api/"):
                return self._json(405, {"error": {"code": "invalid_parameter", "message": "POST ishlating"}})
            if web_root is None:
                return self._json(404, {"error": {"code": "not_found", "message": "web o'chirilgan"}})
            rel = path.lstrip("/") or "index.html"
            target = (web_root / rel).resolve()
            if web_root not in target.parents and target != web_root:
                return self._json(403, {"error": {"code": "forbidden", "message": "yo'l ruxsat etilmagan"}})
            if target.is_dir():
                target = target / "index.html"
            if not target.is_file():
                return self._json(404, {"error": {"code": "not_found", "message": "fayl yo'q"}})
            ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            self._send(200, target.read_bytes(), ctype)

        def do_POST(self):
            if not self._guard():
                return
            path = urlsplit(self.path).path
            if not path.startswith("/api/"):
                return self._json(404, {"error": {"code": "not_found", "message": "yo'q"}})
            tool = path[len("/api/"):]
            n = int(self.headers.get("Content-Length") or 0)
            if n > MAX_BODY:
                return self._json(413, {"error": {"code": "invalid_parameter", "message": "so'rov juda katta"}})
            try:
                args = json.loads(self.rfile.read(n) or b"{}")
                if not isinstance(args, dict):
                    raise ValueError
            except ValueError:
                return self._json(400, {"error": {"code": "invalid_parameter", "message": "JSON obyekt kerak"}})
            env = core.call(tool, **args)
            self._json(200 if not env.get("error") else 400, env)

    return Handler


def serve(home, port: int = 8765, web_root: Path | None = None, ready=None):
    lib = Library(home)
    core = Core(lib)
    httpd = HTTPServer(("127.0.0.1", port), make_handler(core, port, web_root.resolve() if web_root else None))
    if ready:
        ready(httpd)
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
        lib.close()

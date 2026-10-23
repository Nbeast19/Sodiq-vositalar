import asyncio
import http.client
import json
import socket
import sys
import threading
from pathlib import Path

import pytest

from hadis_manba.core import Core
from hadis_manba.paths import Home
from hadis_manba.server import serve

ROOT = Path(__file__).resolve().parents[1]


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


@pytest.fixture
def server(full, lib):
    port = free_port()
    box = {}
    t = threading.Thread(target=serve, args=(lib.home, port, ROOT / "web"),
                         kwargs={"ready": lambda h: box.setdefault("h", h)}, daemon=True)
    t.start()
    while "h" not in box:
        pass
    yield port
    box["h"].shutdown()


def req(port, method, path, body=None, headers=None):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    h = {"Host": f"127.0.0.1:{port}", "Content-Type": "application/json"}
    h.update(headers or {})
    c.request(method, path, body=json.dumps(body) if body is not None else None, headers=h)
    r = c.getresponse()
    return r.status, r.read()


def test_api_matches_core(server, full):
    st, b = req(server, "POST", "/api/search_hadith", {"query": "طلب العلم"})
    assert st == 200
    api = json.loads(b)
    direct = full.call("search_hadith", query="طلب العلم")
    assert [r.get("unit_id") or r.get("occurrence_id") for r in api["results"]] == \
           [r.get("unit_id") or r.get("occurrence_id") for r in direct["results"]]


def test_host_origin_and_traversal_guard(server):
    assert req(server, "GET", "/api/tools", headers={"Host": "evil.example"})[0] == 403
    assert req(server, "POST", "/api/list_books", {}, headers={"Origin": "https://evil.example"})[0] == 403
    assert req(server, "GET", "/../../etc/passwd")[0] in (403, 404)
    assert req(server, "GET", "/%2e%2e/%2e%2e/etc/passwd")[0] in (403, 404)
    assert req(server, "POST", "/api/not_a_tool", {})[0] == 400


def test_mcp_stdio_real_client(full, lib):
    """Rasmiy SDK mijozi bilan haqiqiy STDIO sessiya: tools ro'yxati, so'rov, dalil."""
    from mcp import Client
    from mcp.client.stdio import StdioServerParameters

    params = StdioServerParameters(command=sys.executable, args=["-m", "hadis_manba", "--home", str(lib.home.root), "mcp"],
                                   env={"PYTHONPATH": str(ROOT / "src")})

    async def run():
        async with Client(params) as c:
            tools = await c.list_tools()
            names = sorted(t.name for t in tools.tools)
            r = await c.call_tool("search_hadith", {"query": "طلب العلم", "filters": {"scope": "base"}})
            r2 = await c.call_tool("get_evidence", {"evidence_id": "ed-namuna-a-ev1"})
            r3 = await c.call_tool("get_hadith", {"unit_id": "ed-namuna-a:u0010"})
            return names, r, r2, r3

    names, r, r2, r3 = asyncio.run(run())
    assert len(names) == 13 and "get_commentary" in names
    payload = r.structured_content or json.loads(r.content[0].text)
    payload = payload.get("result", payload)
    assert payload["results"][0]["unit_id"] == "ed-namuna-a:u0001"
    ev = r2.structured_content or json.loads(r2.content[0].text)
    ev = ev.get("result", ev)
    assert ev["results"][0]["evidence_id"] == "ed-namuna-a-ev1"
    h = r3.structured_content or json.loads(r3.content[0].text)
    h = h.get("result", h)
    assert "IGNORE ALL PREVIOUS INSTRUCTIONS" in h["results"][0]["text_ar"]  # ma'lumot sifatida qaytdi
    # kutubxona joyida — manba ichidagi "o'chir" jumlasi hech narsa qilmadi
    assert Core(lib).call("list_books")["results"]

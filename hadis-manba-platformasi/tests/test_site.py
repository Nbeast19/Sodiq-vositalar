"""SEO statik sahifalari: canonical, hreflang, x-default, sitemap, havolalar, til/yo'nalish, maxfiylik."""
import re
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from hadis_manba.publish import build_public
from hadis_manba.site import build_site

BASE = "https://example.github.io/repo/hadis-manba-platformasi/web/"


class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.alts, self.canon, self.html_attrs, self.title, self.desc, self.h1 = [], {}, None, {}, "", None, 0
        self._t = False

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == "html":
            self.html_attrs = a
        if tag == "link" and a.get("rel") == "canonical":
            self.canon = a["href"]
        if tag == "link" and a.get("rel") == "alternate":
            self.alts[a["hreflang"]] = a["href"]
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        if tag == "meta" and a.get("name") == "description":
            self.desc = a["content"]
        if tag == "title":
            self._t = True
        if tag == "h1":
            self.h1 += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self._t = False

    def handle_data(self, d):
        if self._t:
            self.title += d


def test_site(built, tmp_path):
    import shutil
    web = Path(__file__).resolve().parents[1] / "web"
    out = tmp_path / "web"
    out.mkdir()
    for f in ("index.html", "style.css"):
        shutil.copy(web / f, out / f)
    shutil.copytree(web / "ikonkalar", out / "ikonkalar")
    build_public(list(built["pkg"].values()), out)
    info = build_site([out / "catalog.json"], out, BASE)
    pages = sorted(out.glob("*/**/index.html"))
    assert info["pages_per_language"] >= 10 and len(pages) == 2 * info["pages_per_language"]
    parsed = {}
    for f in pages:
        rel = f.relative_to(out).as_posix()
        url = BASE + rel[: -len("index.html")]
        p = P()
        p.feed(f.read_text("utf-8"))
        parsed[url] = p
        lang = rel.split("/")[0]
        assert p.html_attrs == {"lang": lang, "dir": "rtl" if lang == "ar" else "ltr"}
        assert p.canon == url, (rel, p.canon)                       # self-canonical
        assert set(p.alts) == {"en", "ar", "x-default"}
        assert p.alts[lang] == url and p.alts["x-default"] == p.alts["en"]
        assert p.title.strip() and p.desc and p.h1 == 1
        txt = f.read_text("utf-8")
        assert "/home/" not in txt and "/Users/" not in txt and "<script" not in txt  # JS shart emas, shaxsiy yo'l yo'q
        for href in p.links:                                         # nisbiy havolalar mavjud faylga olib boradi
            if href.startswith(("http", "#")):
                continue
            target = urljoin(url, href)
            path = urlsplit(target).path[len(urlsplit(BASE).path):]
            local = out / path
            if path.endswith("/") or not path:
                local = local / "index.html"
            assert local.exists(), (rel, href)
    for url, p in parsed.items():                                    # hreflang o'zaro (reciprocal)
        for l, other in p.alts.items():
            if l != "x-default":
                assert parsed[other].alts[l] == other and url in parsed[other].alts.values()
    en = parsed[BASE + "en/"]
    ar = parsed[BASE + "ar/"]
    assert en.title != ar.title and en.desc != ar.desc
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "x": "http://www.w3.org/1999/xhtml"}
    root = ET.parse(out / "sitemap.xml").getroot()
    locs = [u.find("s:loc", ns).text for u in root.findall("s:url", ns)]
    assert sorted(locs) == sorted(parsed)
    for u in root.findall("s:url", ns):
        hl = {x.get("hreflang") for x in u.findall("x:link", ns)}
        assert hl == {"en", "ar", "x-default"}
    assert "Sitemap: " + BASE + "sitemap.xml" in (out / "robots.txt").read_text()
    # manba matni (hadis) statik sahifalarga qo'yilmaydi — faqat metadata
    sample_hadith = "إِنَّمَا هَذَا مِثَالٌ"
    assert not any(sample_hadith in f.read_text("utf-8") for f in pages)
    assert re.search(r"Sample Book", (out / "en/books/w-namuna/index.html").read_text())

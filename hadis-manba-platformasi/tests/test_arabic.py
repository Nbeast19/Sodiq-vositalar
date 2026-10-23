import json
from pathlib import Path

from hadis_manba.arabic import NORMALIZATION_VERSION, normalize_with_map, snippet

V = json.loads((Path(__file__).parent / "arabic_vectors.json").read_text("utf-8"))


def test_version_matches_vectors():
    assert V["normalization_version"] == NORMALIZATION_VERSION


def test_vectors():
    for v in V["vectors"]:
        n, m = normalize_with_map(v["input"])
        assert n == v["normalized"], v["input"]
        assert m == v["map"], v["input"]


def test_snippets_show_original_layer():
    for s in V["snippets"]:
        _, m = normalize_with_map(s["text"])
        got = snippet(s["text"], s["norm_start"], s["norm_len"], m, s["window"])
        assert got == s["expected"]
        # parcha asl matnning aynan bo'lagi (qidiruv nusxasi emas)
        assert got["text"] in s["text"]


def test_original_text_never_modified():
    t = "إِنَّمَا"
    normalize_with_map(t)
    assert t == "إِنَّمَا"

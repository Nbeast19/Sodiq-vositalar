import json
from pathlib import Path

import jsonschema

from hadis_manba.pkgformat import open_package

ROOT = Path(__file__).resolve().parents[1]


def test_fixture_manifests_match_json_schema(built):
    schema = json.loads((ROOT / "src/hadis_manba/schemas/package-manifest.schema.json").read_text())
    for p in built["pkg"].values():
        jsonschema.validate(open_package(p).manifest, schema)


def test_registry_schema_is_valid():
    schema = json.loads((ROOT / "manifests/package-registry.schema.json").read_text())
    jsonschema.Draft202012Validator.check_schema(schema)

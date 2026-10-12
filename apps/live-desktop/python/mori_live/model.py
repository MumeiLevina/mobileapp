"""Validate private Snow Neko references before exposing an exact file allowlist."""

import json
from pathlib import Path


def validate_model(renderer_root):
    root = Path(renderer_root).resolve(strict=True)
    model_dir = root / "Resources" / "snow-neko"
    manifest_path = model_dir / "snow-neko.model3.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("Version") != 3:
        raise ValueError("Expected Snow Neko manifest v3")
    refs = manifest["FileReferences"]
    files = [refs["Moc"], refs["Physics"], refs["DisplayInfo"], *refs["Textures"]]
    files += [item["File"] for item in refs["Expressions"]]
    files += [item["File"] for group in refs["Motions"].values() for item in group]
    allowed = {
        "index.html",
        manifest_path.relative_to(root).as_posix(),
        "Core/live2dcubismcore.min.js",
    }
    for name in files:
        path = (model_dir / name).resolve(strict=True)
        if not path.is_relative_to(model_dir) or not path.is_file():
            raise ValueError("Unsafe/missing model reference")
        allowed.add(path.relative_to(root).as_posix())
    if not refs["Motions"].get("Idle"):
        raise ValueError("No verified Idle motion")
    for directory, suffixes in [
        ("assets", {".js", ".css"}),
        ("Framework/Shaders", {".vert", ".frag"}),
    ]:
        for path in (root / directory).rglob("*"):
            if path.is_file() and path.suffix in suffixes:
                if not path.resolve().is_relative_to(root):
                    raise ValueError("Unsafe renderer asset")
                allowed.add(path.relative_to(root).as_posix())
    for name in allowed:
        if not (root / name).is_file() or not (root / name).resolve().is_relative_to(
            root
        ):
            raise ValueError("Missing renderer asset")
    with (model_dir / refs["Moc"]).open("rb") as moc:
        if moc.read(4) != b"MOC3":
            raise ValueError("Invalid MOC3 signature")
    parameters = {
        item["Id"]
        for item in json.loads(
            (model_dir / refs["DisplayInfo"]).read_text(encoding="utf-8")
        )["Parameters"]
    }
    if "ParamMouthOpenY" not in parameters:
        raise ValueError("No verified mouth parameter")
    for expression in refs["Expressions"]:
        document = json.loads(
            (model_dir / expression["File"]).read_text(encoding="utf-8")
        )
        if document.get("Type") != "Live2D Expression":
            raise ValueError("Invalid expression")
        if any(item["Id"] not in parameters for item in document.get("Parameters", [])):
            raise ValueError("Expression references unknown parameter")
    names = {e["Name"] for e in refs["Expressions"]}
    # Surprised has no verified subtle counterpart: deliberate neutral fallback.
    desired = {
        "neutral": None,
        "happy": "blushing",
        "sad": "cry",
        "surprised": None,
        "confused": "sullen_face",
    }
    mapping = {
        emotion: name if name in names else None for emotion, name in desired.items()
    }
    return root, allowed, mapping

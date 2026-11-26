"""Build the arXiv source ZIP from the manuscript and the matching Lean sources."""

import argparse
from pathlib import Path
import tomllib
from zipfile import ZIP_DEFLATED, ZipFile


def build(destination: Path) -> None:
    paper = Path(__file__).resolve().parent
    project = paper.parents[1]
    config = tomllib.loads((project / "lakefile.toml").read_text())
    mathlib = next(dep for dep in config["require"] if dep["name"] == "mathlib")
    # The stand-alone companion has one library. Share the repository's dependency pin.
    lakefile = f'''name = "{config['name']}"
version = "{config['version']}"
defaultTargets = ["CubeComm"]

[[lean_lib]]
name = "CubeComm"

[[require]]
name = "mathlib"
git = "{mathlib['git']}"
rev = "{mathlib['rev']}"
'''
    with ZipFile(destination, "w", compression=ZIP_DEFLATED) as archive:
        archive.write(paper / "main.tex", "main.tex")
        archive.writestr("anc/lakefile.toml", lakefile)
        archive.write(paper / "AuditPaper.lean", "anc/AuditPaper.lean")
        archive.write(project.parents[1] / "LICENSE", "anc/LICENSE")
        for name in ("CubeComm.lean", "lean-toolchain", "lake-manifest.json",
                     "generate.py", "cache.sh"):
            archive.write(project / name, "anc/" + name)
        for source in sorted((project / "CubeComm").glob("*.lean")):
            archive.write(source, "anc/CubeComm/" + source.name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    build(parser.parse_args().destination)

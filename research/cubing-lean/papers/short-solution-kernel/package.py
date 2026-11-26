"""Bundle the paper and the transitive local imports of its Lean audit."""
from pathlib import Path
import re
import sys
from zipfile import ZIP_DEFLATED, ZipFile

paper = Path(__file__).resolve().parent
project = paper.parents[1]
pending = ["CubeKernel"]
sources = set()
while pending:
    name = pending.pop()
    if name in sources:
        continue
    sources.add(name)
    text = (project / (name.replace(".", "/") + ".lean")).read_text()
    pending.extend(re.findall(r"^(?:public )?import (Cube(?:Kernel|Diameter)(?:\.\w+)*)$", text, re.M))

config = (project / "lakefile.toml").read_text()
with ZipFile(sys.argv[1], "w", compression=ZIP_DEFLATED) as archive:
    archive.write(paper / "main.tex", "main.tex")
    archive.write(paper / "AuditPaper.lean", "anc/AuditPaper.lean")
    archive.write(project.parents[1] / "LICENSE", "anc/LICENSE")
    archive.writestr("anc/lakefile.toml", 'name = "cubing_lean"\nversion = "0.1.0"\n'
                     'defaultTargets = ["CubeKernel"]\n\n[[lean_lib]]\nname = "CubeKernel"\n'
                     '\n[[lean_lib]]\nname = "CubeDiameter"\n\n'
                     '[[require]]' + config.split('[[require]]', 1)[1])
    archive.writestr("anc/CubeDiameter.lean", "import CubeDiameter.Rectangle\n")
    for name in ["lean-toolchain", "lake-manifest.json", "cache.sh"]:
        archive.write(project / name, "anc/" + name)
    for name in sorted(sources):
        path = name.replace(".", "/") + ".lean"
        archive.write(project / path, "anc/" + path)
    archive.writestr("README.txt", "Compile main.tex with pdflatex (twice).\n"
                     "In anc/ run: bash cache.sh, then lake build CubeKernel,\n"
                     "lake env lean -DwarningAsError=true AuditPaper.lean, then\n"
                     "LEAN_NUM_THREADS=2 lake env leanchecker CubeDiameter CubeKernel\n")

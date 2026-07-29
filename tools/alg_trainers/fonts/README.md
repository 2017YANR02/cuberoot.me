# Self-hosted webfonts for the Alg Trainers fork

Upstream (`mihlefeld/Alg-Trainers`) loads both families from `fonts.googleapis.com`
with two render-blocking `<link>`s. This fork serves them from `../fonts.css` instead,
so the trainers keep working offline / behind a blocked Google.

## Titillium Web v19 — SIL OFL 1.1

`latin` + `latin-ext`, only the weights the trainers actually use
(400, 600, 700, 900, plus 400 italic — upstream requested 11 weights but the CSS
only ever asks for 400 / 800 / bold; 800 resolves to 900).

```sh
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
curl -H "User-Agent: $UA" \
  'https://fonts.googleapis.com/css2?family=Titillium+Web:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap'
# then fetch each woff2 the CSS points at, named titillium-web-<weight>[-italic]-<subset>.woff2
```

Note `style/main.css` used to ask for `"Titilium Web"` (one `l`) — an upstream typo
that meant the webfont never applied. Fixed here; that is why the trainers look
different from upstream.

## Material Symbols Outlined v362 — Apache 2.0

Subsetted via the Google Fonts `icon_names` parameter to the 14 icons in use
— 15 KB instead of the multi-MB full variable font.

```sh
curl -H "User-Agent: $UA" \
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=arrow_back,arrow_forward,bookmark_add,bookmark_remove,close,dark_mode,delete,download,edit,light_mode,send,settings,undo,upload'
```

Adding an icon to the trainers means adding its name to that `icon_names` list and
re-downloading — a glyph that is not in the subset renders as its literal name.

To re-derive the list, match **any** tag (`span` / `button` / `label` are all used)
and allow the glyph name to sit on the next line — a `<span ...>name<` -only grep
silently misses `send`, `upload`, `settings`, `edit`, `light_mode`, `dark_mode`:

```sh
python - <<'PY'
import re, glob
pat = re.compile(r'<[a-zA-Z][a-zA-Z0-9-]*\b[^>]*class\s*=\s*([\'"`])[^\'"`]*material-symbols-outlined[^\'"`]*\1[^>]*>\s*([^<{`]*?)\s*<', re.S)
names = set()
for f in glob.glob('../**/*.html', recursive=True) + glob.glob('../**/*.js', recursive=True):
    if '/vendor/' in f.replace('\\', '/'): continue
    for m in pat.finditer(open(f, encoding='utf-8', errors='replace').read()):
        t = m.group(2).strip()
        if re.fullmatch(r'[a-z0-9_]+', t): names.add(t)
print(','.join(sorted(names)))
PY
```

(`Close`, capital C, also appears inside an icon span — no such ligature exists, so
it renders as the literal word. That is upstream behaviour, left alone.)

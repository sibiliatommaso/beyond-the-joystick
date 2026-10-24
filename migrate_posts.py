#!/usr/bin/env python3
"""Migrate imported WordPress articles for Hugo. Does two things:

 1. FRONT MATTER: decodes HTML entities in titles, categories, tags, excerpts
      'Can&#8217;t'  ->  Can’t        'Algorithms &amp; AI'  ->  Algorithms & AI
    (the article body is not touched: there, entities are valid HTML)

 2. MATH: rewrites the WordPress KaTeX plugin syntax into Hugo shortcodes
      [katex]v_{enc}[/katex]                      ->  {{< math >}} v_{enc} {{< /math >}}
      <div class="katex-eq"><pre>TeX</pre></div>  ->  <div class="math-block">{{< mathblock >}} TeX {{< /mathblock >}}</div>

Dry run by default (nothing is written). To apply:
    python3 migrate_posts.py content/posts --apply
Before applying, a full copy of the folder is saved in ./backup-posts-<date>/
"""
import sys, re, html, shutil, pathlib, datetime
try:
    import yaml
except ImportError:
    sys.exit("PyYAML is missing. Install it with:  pip install pyyaml")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
apply = "--apply" in sys.argv
root = pathlib.Path(args[0] if args else "content/posts")
files = sorted(root.rglob("*.md"))
if not files:
    sys.exit(f"No .md files found in {root}/  (run this from the project folder)")

# ---------- 1. front matter ----------
fm_changes = []
def unescape_values(v, path):
    if isinstance(v, str):
        n = html.unescape(v).replace("\xa0", " ")
        if n != v:
            fm_changes.append((path, v, n))
        return n
    if isinstance(v, list):
        return [unescape_values(x, f"{path}[{i}]") for i, x in enumerate(v)]
    if isinstance(v, dict):
        return {k: unescape_values(x, f"{path}.{k}") for k, x in v.items()}
    return v

# ---------- 2. math ----------
warnings = []
def clean_tex(raw, name):
    tex = re.sub(r"</?[a-zA-Z][^>]*>", "", raw)          # stray tags
    tex = html.unescape(tex).strip()
    if "{{<" in tex or "{{%" in tex:
        warnings.append(f"{name}: formula contains '{{{{<' or '{{{{%' -> check by hand: {tex[:60]}")
    return tex

DISPLAY = re.compile(
    r'<div\b[^>]*\bkatex-eq\b[^>]*>\s*<pre[^>]*>(.*?)</pre>\s*</div>', re.S)
INLINE = re.compile(
    r'\[katex(\s+display\s*=\s*["\']?(?:true|1)["\']?)?\s*\](.*?)\[/katex\]', re.S)

def convert_math(body, name):
    counts = {"inline": 0, "display": 0}
    def disp(m):
        counts["display"] += 1
        return ('<div class="math-block">{{< mathblock >}}\n'
                + clean_tex(m.group(1), name) + '\n{{< /mathblock >}}</div>')
    def inl(m):
        tex = clean_tex(m.group(2), name)
        if m.group(1):
            counts["display"] += 1
            return '<div class="math-block">{{< mathblock >}}\n' + tex + '\n{{< /mathblock >}}</div>'
        counts["inline"] += 1
        return '{{< math >}} ' + tex + ' {{< /math >}}'
    body = DISPLAY.sub(disp, body)
    body = INLINE.sub(inl, body)
    return body, counts

# ---------- run ----------
if apply:
    backup = pathlib.Path(f"backup-posts-{datetime.datetime.now():%Y%m%d-%H%M%S}")
    shutil.copytree(root, backup)
    print(f"Backup saved in {backup}/  (outside content/, Hugo ignores it)\n")

tot = {"files": 0, "inline": 0, "display": 0, "fm": 0}
for f in files:
    text = f.read_text(encoding="utf-8")
    m = re.match(r"---\r?\n(.*?)\r?\n---\r?\n", text, re.S)
    if not m:
        print(f"SKIP (no YAML front matter): {f.name}"); continue
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        print(f"SKIP (invalid YAML): {f.name}: {e}"); continue
    if not isinstance(data, dict):
        continue
    fm_changes.clear()
    new_data = unescape_values(data, f.name)
    body = text[m.end():]
    new_body, c = convert_math(body, f.name)
    if not fm_changes and new_body == body:
        continue
    tot["files"] += 1; tot["fm"] += len(fm_changes)
    tot["inline"] += c["inline"]; tot["display"] += c["display"]
    print(f"{f.name}: {len(fm_changes)} front matter value(s), "
          f"{c['inline']} inline + {c['display']} display formula(s)")
    for path, old, nw in fm_changes[:3]:
        print(f"    - {old[:80]!r}\n    + {nw[:80]!r}")
    if apply:
        fm = yaml.safe_dump(new_data, allow_unicode=True, sort_keys=False,
                            width=10**6, default_flow_style=False)
        f.write_text("---\n" + fm + "---\n" + new_body, encoding="utf-8")

left = sum(len(re.findall(r"\[/?katex", f.read_text(encoding="utf-8"))) for f in files) if apply else None
print(f"\n{tot['files']} of {len(files)} files {'changed' if apply else 'would change'}: "
      f"{tot['fm']} front matter values, {tot['inline']} inline and {tot['display']} display formulas.")
for w in warnings: print("WARNING:", w)
if apply:
    print("Leftover [katex] tags:", left)
else:
    print("Nothing was written. Run again with --apply to apply.")

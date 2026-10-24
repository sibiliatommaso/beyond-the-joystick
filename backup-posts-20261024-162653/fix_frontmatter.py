#!/usr/bin/env python3
"""Decode HTML entities in the YAML front matter of Hugo content files,
e.g.  'Algorithms &amp; AI'  ->  'Algorithms & AI'   and   &#8217;  ->  ’
The article body is NOT touched (there, entities like &amp; are correct HTML).

Dry run by default. To write the changes (after copying content/ to content.bak/):
    python3 fix_frontmatter.py --apply
Usage:  python3 fix_frontmatter.py [content_dir] [--apply]
"""
import sys, re, html, shutil, pathlib
try:
    import yaml
except ImportError:
    sys.exit("PyYAML is missing. Install it with:  pip install pyyaml")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
apply = "--apply" in sys.argv
root = pathlib.Path(args[0] if args else "content")
files = sorted(root.rglob("*.md"))
if not files:
    sys.exit(f"No .md files found in {root}/")

changes = []
def fix(v, path=""):
    if isinstance(v, str):
        n = html.unescape(v).replace("\xa0", " ")
        if n != v:
            changes.append((path, v, n))
        return n
    if isinstance(v, list):
        return [fix(x, f"{path}[{i}]") for i, x in enumerate(v)]
    if isinstance(v, dict):
        return {k: fix(x, f"{path}.{k}") for k, x in v.items()}
    return v

if apply:
    shutil.copytree(root, root.with_name(root.name + ".bak"), dirs_exist_ok=True)
    print(f"Backup saved in {root.name}.bak/")

touched = skipped = 0
for f in files:
    text = f.read_text(encoding="utf-8")
    m = re.match(r"---\r?\n(.*?)\r?\n---\r?\n", text, re.S)
    if not m:
        skipped += 1; continue
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        print(f"SKIP (invalid YAML) {f.name}: {e}"); skipped += 1; continue
    if not isinstance(data, dict):
        skipped += 1; continue
    changes.clear()
    new = fix(data, f.name)
    if not changes:
        continue
    touched += 1
    for path, old, nw in changes[:6]:
        print(f"{path}\n    - {old[:90]!r}\n    + {nw[:90]!r}")
    if apply:
        fm = yaml.safe_dump(new, allow_unicode=True, sort_keys=False,
                            width=10**6, default_flow_style=False)
        f.write_text("---\n" + fm + "---\n" + text[m.end():], encoding="utf-8")

print(f"\n{touched} file(s) {'fixed' if apply else 'would be fixed'}, {skipped} skipped (no YAML front matter).")
if not apply and touched:
    print("Nothing was written. Run again with --apply to apply.")

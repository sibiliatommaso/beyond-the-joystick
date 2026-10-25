#!/usr/bin/env python3
"""Fix the systematic link problems of articles imported from WordPress.

 1. ADDRESS: every article gets a front matter `slug:` (no date, no /posts/ in the address,
    once hugo.toml has  [permalinks.page] posts = '/:slugorfilename/' ).
      - existing `slug` or `url`            -> kept
      - `permalink: /my-slug/`              -> slug: my-slug
      - `permalink: /2025/10/my-slug/`      -> url: /2025/10/my-slug/  (old multi-part address kept as is)
      - `permalink: '/?p=123'` or missing   -> slug built from the file name (date removed)
 2. LINKS in the body: absolute links to your own site become relative
      https://beyondthejoystick.space/x/   ->  /x/        (works locally and in production)
 3. WORDPRESS PATHS: /category/<slug>/ and /tag/<slug>/ become the Hugo ones
      /category/algorithms-ai/  ->  /categories/algorithms--ai/       /tag/x/ -> /tags/x/

Dry run by default. To apply (a backup copy is saved first, outside content/):
    python3 scripts/fix_links.py content/posts --apply
"""
import sys, re, shutil, pathlib, datetime
try:
    import yaml
except ImportError:
    sys.exit("PyYAML is missing. Install it with:  pip install pyyaml")

DOMAIN = "beyondthejoystick.space"
# old WordPress category slug -> Hugo slug (Hugo drops '&' and keeps both hyphens)
CATEGORY_MAP = {
    "core-concepts": "core-concepts",
    "advance-topics": "advanced-topics--future",
    "advanced-topics": "advanced-topics--future",
    "sensors-hardware": "sensors--hardware",
    "algorithms-ai": "algorithms--ai",
    "missions-case-studies": "missions--case-studies",
    "projects-tutorials": "projects--tutorials",
}

args = [a for a in sys.argv[1:] if not a.startswith("--")]
apply = "--apply" in sys.argv
root = pathlib.Path(args[0] if args else "content/posts")
files = sorted(p for p in root.rglob("*.md") if p.name != "_index.md")
if not files:
    sys.exit(f"No .md files found in {root}/  (run this from the project folder)")

dom = re.escape(DOMAIN)
ATTR = re.compile(rf'(href|src)=(["\'])https?://(?:www\.)?{dom}(/[^"\']*)?\2', re.I)
MD   = re.compile(rf'\]\(https?://(?:www\.)?{dom}(/[^)\s]*)?\)', re.I)
CAT  = re.compile(r'(?<![\w/])/category/([a-z0-9-]+)/?', re.I)
TAG  = re.compile(r'(?<![\w/])/tag/([a-z0-9-]+)/?', re.I)

def derive_slug(f):
    return re.sub(r"^\d{4}-\d{2}-\d{2}-", "", f.stem)

def fix_body(body, stats):
    def a(m):
        stats["abs"] += 1; return f'{m.group(1)}={m.group(2)}{m.group(3) or "/"}{m.group(2)}'
    def md(m):
        stats["abs"] += 1; return f']({m.group(1) or "/"})'
    def cat(m):
        stats["wp"] += 1; s = m.group(1).lower(); return f"/categories/{CATEGORY_MAP.get(s, s)}/"
    def tag(m):
        stats["wp"] += 1; return f"/tags/{m.group(1).lower()}/"
    body = ATTR.sub(a, body); body = MD.sub(md, body)
    body = CAT.sub(cat, body); body = TAG.sub(tag, body)
    return body

if apply:
    backup = pathlib.Path(f"backup-links-{datetime.datetime.now():%Y%m%d-%H%M%S}")
    shutil.copytree(root, backup); print(f"Backup saved in {backup}/\n")

tot = {"files": 0, "url": 0, "abs": 0, "wp": 0}
for f in files:
    text = f.read_text(encoding="utf-8")
    m = re.match(r"---\r?\n(.*?)\r?\n---\r?\n", text, re.S)
    if not m:
        print(f"SKIP (no valid front matter): {f.name}  <- the file must start with '---'"); continue
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        print(f"SKIP (invalid YAML): {f.name}: {e}"); continue
    if not isinstance(data, dict):
        continue
    stats = {"abs": 0, "wp": 0}; note = []
    if not data.get("url") and not data.get("slug"):
        perm = str(data.get("permalink") or "")
        one = re.fullmatch(r"/([^/?#]+)/?", perm)
        if one:
            data["slug"] = one.group(1); note.append(f"slug <- permalink: {one.group(1)}")
        elif re.fullmatch(r"/[^?#]+/", perm):
            data["url"] = perm; note.append(f"url <- permalink (multi-part): {perm}")
        else:
            data["slug"] = derive_slug(f)
            note.append(f"slug from file name: {data['slug']}  (permalink was {perm!r})")
        tot["url"] += 1
    body = text[m.end():]
    new_body = fix_body(body, stats)
    if not note and new_body == body:
        continue
    tot["files"] += 1; tot["abs"] += stats["abs"]; tot["wp"] += stats["wp"]
    print(f"{f.name}: " + "; ".join(note + ([f"{stats['abs']} absolute link(s) made relative"] if stats["abs"] else [])
                                           + ([f"{stats['wp']} WordPress path(s) converted"] if stats["wp"] else [])))
    if apply:
        fm = yaml.safe_dump(data, allow_unicode=True, sort_keys=False, width=10**6, default_flow_style=False)
        f.write_text("---\n" + fm + "---\n" + new_body, encoding="utf-8")

print(f"\n{tot['files']} of {len(files)} files {'changed' if apply else 'would change'}: "
      f"{tot['url']} addresses, {tot['abs']} absolute links, {tot['wp']} WordPress paths.")
if not apply:
    print("Nothing was written. Run again with --apply to apply.")

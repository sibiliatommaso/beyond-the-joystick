#!/usr/bin/env python3
"""Find broken internal links in a BUILT Hugo site (links, images, CSS and JS).

Run after every build:
    hugo --quiet && python3 scripts/check_links.py

Optional arguments:  check_links.py [public_dir] [site_url]
External links (other domains) are not checked. Exit code is 1 if something is broken.
"""
import sys, pathlib, urllib.parse, collections
from html.parser import HTMLParser

public = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "public")
site = (sys.argv[2] if len(sys.argv) > 2 else "https://beyondthejoystick.space").rstrip("/")
site_host = urllib.parse.urlparse(site).netloc.lower().removeprefix("www.")
if not public.is_dir():
    sys.exit(f"'{public}/' not found. Run 'hugo' first, from the project folder.")

class Collector(HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []; self.ids = set()
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for k in ("id", "name"):
            if a.get(k): self.ids.add(a[k])
        if tag == "meta" and a.get("http-equiv", "").lower() == "refresh":
            return                                    # Hugo alias redirect pages
        for k in ("href", "src"):
            if a.get(k):
                self.links.append((tag, a[k]))

cache = {}
def parse(path):
    if path not in cache:
        c = Collector(); c.feed(path.read_text(encoding="utf-8", errors="replace")); cache[path] = c
    return cache[path]

def to_file(url_path):
    p = urllib.parse.unquote(url_path)
    cand = public / p.lstrip("/")
    if p.endswith("/") or cand.is_dir():
        cand = cand / "index.html"
    return cand if cand.is_file() else None

broken = collections.defaultdict(list)       # (reason, target) -> [source pages]
pages = checked = external = 0
for page in sorted(public.rglob("*.html")):
    rel = page.relative_to(public).as_posix()
    page_url = "/" + (rel[:-10] if rel.endswith("index.html") else rel)
    pages += 1
    for tag, href in parse(page).links:
        href = href.strip()
        if not href or href.startswith(("mailto:", "tel:", "javascript:", "data:")):
            continue
        u = urllib.parse.urlparse(urllib.parse.urljoin(page_url, href) if not href.startswith(("http://", "https://", "//")) else href)
        if u.netloc and u.netloc.lower().removeprefix("www.") != site_host:
            external += 1; continue
        checked += 1
        q = urllib.parse.parse_qs(u.query)
        if u.path in ("", "/") and ("p" in q or "page_id" in q):
            broken[("WordPress short link (?p=ID)", href)].append(rel); continue
        target = to_file(u.path or page_url)
        if target is None:
            broken[("missing page or file", u.path)].append(rel); continue
        if u.fragment and u.fragment != "top" and target.suffix == ".html":
            if u.fragment not in parse(target).ids:
                broken[("missing #anchor", f"{u.path}#{u.fragment}")].append(rel)

dated = sorted(p.parent.relative_to(public).as_posix() for p in public.rglob("index.html")
               if __import__("re").search(r"(^|/)\d{4}-\d{2}-\d{2}-", p.parent.relative_to(public).as_posix()))
print(f"Pages scanned: {pages} | internal links checked: {checked} | external skipped: {external}")
if dated:
    print(f"\nWARNING: {len(dated)} page address(es) contain a date (bad for SEO). Add 'slug:' to their front matter:")
    for d in dated[:10]: print("    /" + d + "/")
if not broken:
    print("OK: no broken internal links."); sys.exit(1 if dated else 0)
print(f"\n{len(broken)} BROKEN TARGET(S):\n")
for (reason, target), srcs in sorted(broken.items(), key=lambda kv: (kv[0][0], kv[0][1])):
    uniq = sorted(set(srcs))
    print(f"[{reason}] {target}\n    used in {len(uniq)} page(s): " + ", ".join(uniq[:3]) + (" ..." if len(uniq) > 3 else ""))
sys.exit(1)

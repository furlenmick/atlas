#!/usr/bin/env python3
"""Atlas build script — pure frontend, Python stdlib only.

Reads articles/*.md (frontmatter + Markdown body) and generates a
static site into dist/:
  dist/index.html            homepage (1:1 with the live KB homepage)
  dist/articles/<id>.html    one detail page per article

No external requests, no network, no dependencies.
Usage:  python3 scripts/build.py   (run from the repo root)
"""
import html as htmllib
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTICLES_DIR = os.path.join(ROOT, "articles")
DIST_DIR = os.path.join(ROOT, "dist")

with open(os.path.join(ROOT, "scripts", "atlas.js"), encoding="utf-8") as _f:
    ATLAS_JS = _f.read()

CSS = """
:root{--ink:#26221e;--muted:#6f6a63;--paper:#faf7f2;--surface:#fff;--line:#e8e0d5;
--accent:#d94f30;--accent-soft:#fdeee9;--pine:#2e6b4f;--pine-soft:#e8f2ec}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif;font-size:17px;line-height:1.85}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
h1,h2,h3,h4{font-family:"Noto Serif SC","Songti SC","STSong",serif;line-height:1.35}
code{font-family:ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace;font-size:.88em;background:#f1ece4;padding:1px 6px;border-radius:4px}
pre{background:#26221e;color:#f5efe6;padding:16px 18px;border-radius:10px;overflow-x:auto}
pre code{background:none;color:inherit;padding:0}
blockquote{border-left:3px solid var(--accent);background:var(--accent-soft);margin:20px 0;padding:12px 18px;color:#5a4a44}
blockquote p{margin:0}
table{border-collapse:collapse;width:100%;margin:16px 0;font-size:15px;display:block;overflow-x:auto}
th,td{border:1px solid var(--line);padding:8px 12px;text-align:left}
th{background:#f1ece4}
img{max-width:100%}
figure{margin:20px 0;text-align:center}
figcaption{color:var(--muted);font-size:14px;margin-top:8px}
hr{border:none;border-top:1px solid var(--line);margin:28px 0}
.tag{display:inline-block;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:2px 10px;font-size:13px;margin:0 6px 6px 0;color:var(--muted);font-family:ui-monospace,"JetBrains Mono",Menlo,monospace}
/* --- homepage --- */
.topbar{position:sticky;top:0;z-index:20;background:var(--paper);border-bottom:1px solid var(--line);padding:14px 0}
.top-actions{display:flex;gap:10px;align-items:center;margin:16px 0 4px;flex-wrap:wrap}
.btn{display:inline-block;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:7px 16px;font-size:14px;cursor:pointer;color:var(--ink);font-family:inherit}
.btn:hover{border-color:var(--accent)}
.btn-primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn-danger{color:#b3261e;border-color:#e5b6b0}
#atlas-pending{color:var(--accent);font-size:13px}
.modal{position:fixed;inset:0;background:rgba(38,34,30,.45);z-index:100;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:32px 16px}
.modal[hidden]{display:none}
.modal-card{background:var(--surface);border-radius:14px;padding:22px 24px;max-width:640px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.25)}
.modal-card h3{margin:0 0 12px;font-size:22px}
.field{display:block;margin:12px 0;font-size:14px;color:var(--muted)}
.field input[type=text],.field textarea,.field select{width:100%;margin-top:4px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;font-size:15px;font-family:inherit;background:#fff;color:var(--ink)}
.field textarea{font-family:ui-monospace,"JetBrains Mono",Menlo,monospace}
.modal-actions{display:flex;gap:10px;margin-top:16px}
.modal-note{color:var(--muted);font-size:13px;line-height:1.7}
.modal-card ul,.modal-card ol{font-size:14px;line-height:1.8}

.wrap{max-width:1080px;margin:0 auto;padding:0 24px 64px}
.search{width:100%;font-size:16px;padding:12px 16px;border:1px solid var(--line);border-radius:999px;background:var(--surface);font-family:inherit}
.search:focus{outline:2px solid var(--accent);outline-offset:1px}
.overview{color:var(--muted);font-size:14px;margin:20px 0 4px}
.catgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:18px 0 8px}
@media(min-width:900px){.catgrid{grid-template-columns:repeat(3,1fr)}}
.catcard{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 18px;box-shadow:0 1px 4px rgba(38,34,30,.06)}
.catcard h3{margin:0 0 4px;font-size:19px}
.catcard p{margin:4px 0;color:var(--muted);font-size:14px}
.pinned-sec{margin:28px 0}
.pinned-sec h2,.sechead{font-size:22px;font-weight:900;margin:0 0 12px;padding-bottom:6px}
.pinned-sec h2::before{content:"";display:block;width:32px;height:4px;background:var(--accent);border-radius:2px;margin-bottom:10px}
.chips{margin:18px 0;display:flex;flex-wrap:wrap;gap:8px}
.chip{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:5px 14px;font-size:14px;cursor:pointer}
.chip.active{background:var(--pine);color:#fff;border-color:var(--pine)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:14px 0;box-shadow:0 1px 4px rgba(38,34,30,.06)}
.card h3{margin:0 0 6px;font-size:19px}
.card h3 a{color:var(--ink)}
.card p{margin:6px 0;color:var(--muted);font-size:15px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card .catline{color:var(--pine);font-size:13px;font-weight:700}
.pinned{display:inline-block;background:var(--accent);color:#fff;border-radius:4px;font-size:12px;padding:2px 8px;margin-left:8px;vertical-align:middle}
.date{color:var(--muted);font-size:13px}
/* --- detail --- */
#progress{position:fixed;top:0;left:0;height:3px;background:var(--accent);width:0;z-index:200;display:block;pointer-events:none}
/* sticky article header carrying a second progress bar, so the bar stays
   pinned at the top with the header even when the fixed #progress bar is
   covered / stays at 0 in an app shell */
.art-head{position:sticky;top:0;z-index:30;background:var(--paper);padding:10px 0 0}
.art-progress{height:3px;background:transparent;margin-top:8px}
#artProgressFill{display:block;height:3px;background:var(--accent);width:0}
.layout{display:grid;grid-template-columns:240px 1fr;gap:32px;max-width:1080px;margin:0 auto;padding:24px}
@media(max-width:860px){.layout{grid-template-columns:1fr}}
.toc{position:sticky;top:20px;max-height:calc(100vh - 40px);overflow-y:auto;scrollbar-width:thin;align-self:start}
.toc h4{margin:0 0 8px;font-size:14px}
.toc ol{margin:0;padding-left:0;list-style:none}
.toc li{margin:2px 0}
.toc a{display:block;padding:5px 10px;border-radius:8px;color:var(--ink);font-size:14px;line-height:1.5}
.toc a.active{background:var(--accent-soft);color:var(--accent);font-weight:700}
.toc-mobile{display:none}
@media(max-width:860px){.toc{display:none}.toc-mobile{display:block;position:sticky;top:0;z-index:15;background:var(--paper);padding:10px 0;border-bottom:1px solid var(--line)}}
.kicker{color:var(--accent);font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.article h1{font-size:32px;font-weight:900;margin:8px 0}
.lead{color:var(--muted);font-size:15px}
.meta{color:var(--muted);font-size:14px;margin:10px 0}
.sec-head{display:flex;gap:12px;align-items:baseline;margin:36px 0 12px}
.sec-head h2{margin:0;font-size:24px;font-weight:900}
.badge{flex:0 0 auto;border:2px solid var(--accent);color:var(--accent);border-radius:8px;font-family:ui-monospace,"JetBrains Mono",monospace;font-weight:700;font-size:14px;padding:1px 8px}
.img-note{border:1px dashed var(--line);border-radius:10px;padding:14px;color:var(--muted);font-size:14px;text-align:center;margin:20px 0}
nav.back{margin-bottom:16px;font-size:15px}
nav.pager{display:flex;justify-content:space-between;gap:16px;margin-top:48px;padding-top:20px;border-top:1px solid var(--line);font-size:15px}
#toTop{position:fixed;right:20px;bottom:20px;width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:var(--surface);opacity:.75;font-size:18px;cursor:pointer;z-index:40}
footer{color:var(--muted);font-size:13px;margin-top:56px;border-top:1px solid var(--line);padding-top:16px}
footer.site-footer{text-align:center;line-height:1.9}
footer.site-footer p{margin:4px 0}
footer.site-footer a{color:var(--pine);font-weight:700}
footer.site-footer a:hover{color:var(--accent)}
@media(max-width:640px){body{font-size:16px}.article h1{font-size:26px}.layout{padding:16px}}
"""

JS_HOME = """
function filterCards(q){q=q.trim().toLowerCase();document.querySelectorAll('[data-search]').forEach(function(el){el.style.display=(!q||el.dataset.search.toLowerCase().includes(q))?'':'none';});}
function setChip(btn,cat){document.querySelectorAll('.chip').forEach(function(c){c.classList.remove('active');});btn.classList.add('active');document.querySelectorAll('[data-cat]').forEach(function(el){el.style.display=(cat==='全部'||el.dataset.cat===cat)?'':'none';});}
"""

JS_DETAIL = """
var bar=document.getElementById('progress');
var links=Array.prototype.slice.call(document.querySelectorAll('.toc a'));
var secs=links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1));}).filter(Boolean);
function onScroll(){var st=window.scrollY||document.documentElement.scrollTop;var h=document.documentElement.scrollHeight-window.innerHeight;var pct=h>0?(st/h):0;var root=document.getElementById('artRoot');if(root){var r=root.getBoundingClientRect();var total=r.height-window.innerHeight;var artPct=total>0?Math.min(1,Math.max(0,-r.top/total)):(r.top<=0?1:0);pct=Math.max(pct,artPct);}var w=(pct*100)+'%';bar.style.width=w;var fill=document.getElementById('artProgressFill');if(fill)fill.style.width=w;var cur=secs[0];secs.forEach(function(s){if(s.getBoundingClientRect().top<=120)cur=s;});links.forEach(function(a){var on=a.getAttribute('href')==='#'+(cur&&cur.id);a.classList.toggle('active',on);if(on)a.scrollIntoView({block:'nearest'});});}
window.addEventListener('scroll',onScroll,{passive:true});onScroll();
document.getElementById('toTop').addEventListener('click',function(){var st=window.scrollY||document.documentElement.scrollTop;window.scrollTo({top:0,behavior:st>600?'smooth':'auto'});});
"""


def esc(s):
    return htmllib.escape(s or "")


def parse_frontmatter(text):
    """Split --- frontmatter --- body. Returns (meta dict, body)."""
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        meta[k.strip()] = v.strip().strip('"')
    body = m.group(2)
    # tags: ["A", "B"]
    tags = re.findall(r'"([^"]+)"', meta.get("tags", ""))
    meta["tags_list"] = tags
    meta["pinned_bool"] = meta.get("pinned", "false").lower() == "true"
    try:
        meta["id_int"] = int(meta.get("id", "0"))
    except ValueError:
        meta["id_int"] = 0
    return meta, body


def inline_md(s):
    s = esc(s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
    return s


def md_to_html(body):
    """Small Markdown -> HTML converter (stdlib only). Returns (html, toc)."""
    lines = body.splitlines()
    out = []
    toc = []  # (id, label, level)
    i = 0
    sec_n = 0

    def heading_id(text):
        nonlocal sec_n
        sec_n += 1
        return "sec-%d" % sec_n

    while i < len(lines):
        line = lines[i]
        # fenced code
        if line.startswith("```"):
            lang = line[3:].strip()
            buf = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1
            out.append("<pre><code>%s</code></pre>" % esc("\n".join(buf)))
            continue
        # table
        if line.strip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1]):
            rows = []
            i += 1  # header
            header = [c.strip() for c in line.strip().strip("|").split("|")]
            i += 1  # separator
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            t = ["<table><thead><tr>%s</tr></thead><tbody>" % "".join("<th>%s</th>" % inline_md(c) for c in header)]
            for r in rows:
                t.append("<tr>%s</tr>" % "".join("<td>%s</td>" % inline_md(c) for c in r))
            t.append("</tbody></table>")
            out.append("".join(t))
            continue
        # headings
        m = re.match(r"^(#{1,3})\s+(.*)$", line)
        if m:
            level = len(m.group(1))
            raw = m.group(2)
            toc_label = None
            tm = re.search(r"<!--\s*toc:\s*(.*?)\s*-->", raw)
            if tm:
                toc_label = tm.group(1)
            raw = re.sub(r"<!--.*?-->", "", raw).strip()
            if level == 1:
                out.append("<h1>%s</h1>" % inline_md(raw))
            elif level == 2:
                hid = heading_id(raw)
                label = toc_label or re.sub(r"^\d+[\.\、\s]*", "", raw)
                toc.append((hid, label, 2))
                badge = re.match(r"^(\d+)", raw)
                badge_txt = badge.group(1) if badge else ("%02d" % len(toc))
                out.append('<div class="sec-head" id="%s"><span class="badge">%s</span><h2>%s</h2></div>' % (hid, esc(badge_txt), inline_md(raw)))
            else:
                # h3: include in TOC only if numbered (e.g. 6.1, 9.1)
                if re.match(r"^\d+\.\d+", raw):
                    hid = heading_id(raw)
                    toc.append((hid, raw, 3))
                    out.append('<div class="sec-head" id="%s"><span class="badge">%s</span><h3>%s</h3></div>' % (hid, esc(raw.split()[0]), inline_md(raw)))
                else:
                    out.append("<h3>%s</h3>" % inline_md(raw))
            i += 1
            continue
        # blockquote
        if line.startswith(">"):
            buf = []
            while i < len(lines) and lines[i].startswith(">"):
                buf.append(lines[i].lstrip("> ").rstrip())
                i += 1
            out.append("<blockquote><p>%s</p></blockquote>" % "<br>".join(inline_md(b) for b in buf))
            continue
        # hr
        if line.strip() in ("---", "***", "___"):
            out.append("<hr>")
            i += 1
            continue
        # image (kbimg: placeholders — images are not in the repo)
        m = re.match(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$", line)
        if m:
            alt, src = m.group(1), m.group(2)
            out.append('<div class="img-note">🖼 %s（配图 %s，未包含在导出中）</div>' % (esc(alt), esc(src)))
            i += 1
            continue
        # unordered list
        if re.match(r"^\s*[-*]\s+", line):
            items = []
            while i < len(lines) and re.match(r"^\s*[-*]\s+", lines[i]):
                items.append(re.sub(r"^\s*[-*]\s+", "", lines[i]))
                i += 1
            out.append("<ul>%s</ul>" % "".join("<li>%s</li>" % inline_md(x) for x in items))
            continue
        # ordered list
        if re.match(r"^\s*\d+[\.\)]\s+", line):
            items = []
            while i < len(lines) and re.match(r"^\s*\d+[\.\)]\s+", lines[i]):
                items.append(re.sub(r"^\s*\d+[\.\)]\s+", "", lines[i]))
                i += 1
            out.append("<ol>%s</ol>" % "".join("<li>%s</li>" % inline_md(x) for x in items))
            continue
        # blank
        if not line.strip():
            i += 1
            continue
        # paragraph (join wrapped lines)
        buf = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(#{1,3}\s|```|\s*[-*]\s|\s*\d+[\.\)]\s+>|>|\|)", lines[i]):
            buf.append(lines[i])
            i += 1
        out.append("<p>%s</p>" % " ".join(inline_md(b) for b in buf))
    return "\n".join(out), toc


def load_articles():
    arts = []
    for fn in sorted(os.listdir(ARTICLES_DIR)):
        if not fn.endswith(".md"):
            continue
        with open(os.path.join(ARTICLES_DIR, fn), encoding="utf-8") as f:
            meta, body = parse_frontmatter(f.read())
        meta["file"] = fn
        meta["body"] = body
        arts.append(meta)
    arts.sort(key=lambda a: a["id_int"])
    return arts


def footer_html(n_articles, n_cats):
    return ('<footer class="site-footer"><p>© 2026 Atlas · Paul Mack</p>'
            '<p><a href="https://github.com/furlenmick/atlas">GitHub</a> · '
            '<a href="https://yanchs.com">Lather &amp; Lore</a></p>'
            '<p>共 %d 篇 · %d 个分类</p></footer>' % (n_articles, n_cats))


def page(title, body_html, extra_js=""):
    return ("<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
            "<title>%s · Atlas</title>\n<style>%s</style>\n</head>\n<body>\n%s\n<script>%s</script>\n</body>\n</html>\n"
            % (esc(title), CSS, body_html, extra_js))


def article_data(a):
    return {"id": a["id_int"], "title": a["title"], "category": a["category"],
            "tags": a["tags_list"], "summary": a["summary"], "pinned": a["pinned_bool"],
            "updated_at": a.get("updated_at", ""), "cover_key": a.get("cover_key", ""),
            "source_note": a.get("source_note", ""), "file": a.get("file", ""), "body": a["body"]}


def data_script(obj):
    # "</" is escaped so article bodies can never break out of the script tag
    return ('<script id="atlas-data" type="application/json">%s</script>'
            % json.dumps(obj, ensure_ascii=False).replace("</", "<\\/"))


def build_home(arts):
    cats = {}
    for a in arts:
        cats.setdefault(a["category"], []).append(a)
    pinned = [a for a in arts if a["pinned_bool"]]
    cat_cards = []
    for cat in sorted(cats, key=lambda c: -len(cats[c])):
        latest = cats[cat][0]
        cat_cards.append(
            '<div class="catcard" data-cat="%s"><h3>%s</h3><p>%d 篇 · 最新：%s</p></div>'
            % (esc(cat), esc(cat), len(cats[cat]), esc(latest["title"])))
    chips = ['<button class="chip active" onclick="setChip(this,\'全部\')">全部</button>']
    for cat in sorted(cats):
        chips.append('<button class="chip" onclick="setChip(this,\'%s\')">%s</button>' % (esc(cat), esc(cat)))
    pinned_html = "".join(
        '<article class="card" data-article-id="%d" data-cat="%s" data-search="%s"><h3><a href="articles/%d.html">%s</a><span class="pinned">置顶</span></h3>'
        '<p>%s</p><div>%s</div></article>'
        % (a["id_int"], esc(a["category"]), esc(a["title"] + " " + a["summary"] + " " + " ".join(a["tags_list"])),
           a["id_int"], esc(a["title"]), esc(a["summary"]),
           "".join('<span class="tag">%s</span>' % esc(t) for t in a["tags_list"]))
        for a in pinned)
    grouped = []
    for cat in sorted(cats, key=lambda c: -len(cats[c])):
        items = "".join(
            '<article class="card" data-article-id="%d" data-cat="%s" data-search="%s"><h3><a href="articles/%d.html">%s</a>%s</h3>'
            '<p>%s</p><div><span class="date">%s</span> %s</div></article>'
            % (a["id_int"], esc(a["category"]), esc(a["title"] + " " + a["summary"] + " " + " ".join(a["tags_list"])),
               a["id_int"], esc(a["title"]),
               '<span class="pinned">置顶</span>' if a["pinned_bool"] else "",
               esc(a["summary"]), esc(a.get("updated_at", "")[:10]),
               "".join('<span class="tag">%s</span>' % esc(t) for t in a["tags_list"]))
            for a in cats[cat])
        grouped.append('<section><h2 class="sechead">%s（%d 篇）</h2>%s</section>' % (esc(cat), len(cats[cat]), items))
    body = (
        '<div class="topbar"><div class="wrap" style="padding-bottom:0">'
        '<input class="search" placeholder="搜索文章、标签、摘要…" oninput="filterCards(this.value)">'
        '</div></div>'
        '<div class="wrap"><div class="top-actions">'
        '<button class="btn btn-primary" type="button" onclick="atlasNewArticle()">＋ 新增文章</button>'
        '<button class="btn" type="button" onclick="atlasExportChanges()">导出改动</button>'
        '<span id="atlas-pending" style="display:none"></span></div>'
        '<p class="overview">共 %d 篇 · %d 个分类</p>'
        '<div class="catgrid">%s</div>'
        '<section class="pinned-sec"><h2>置顶推荐</h2>%s</section>'
        '<div class="chips">%s</div>%s'
        '%s</div>'
        % (len(arts), len(cats), "".join(cat_cards), pinned_html, "".join(chips), "".join(grouped),
           footer_html(len(arts), len(cats))))
    data = {"articles": [article_data(a) for a in arts],
            "categories": sorted({a["category"] for a in arts})}
    return page("Atlas", data_script(data) + body, ATLAS_JS)


def build_detail(a, arts):
    body_html, toc = md_to_html(a["body"])
    # drop the duplicate in-body H1 (title is already in the header)
    body_html = re.sub(r"<h1>.*?</h1>", "", body_html, count=1, flags=re.S)
    words = len(re.sub(r"<[^>]+>", "", body_html))
    minutes = max(1, words // 400)
    toc_items = "".join(
        '<li style="%s"><a href="#%s">%s %s</a></li>'
        % ("padding-left:14px;" if lvl == 3 else "", hid, esc(label.split()[0]) if False else "", esc(label))
        for hid, label, lvl in toc)
    toc_html = ('<nav class="toc"><h4>目录（%d 节）</h4><ol>%s</ol></nav>' % (len(toc), toc_items)) if toc else ""
    idx = arts.index(a)
    prev_a = arts[idx - 1] if idx > 0 else None
    next_a = arts[idx + 1] if idx + 1 < len(arts) else None
    pager = '<nav class="pager"><span>%s</span><span>%s</span></nav>' % (
        '<a href="%d.html">← %s</a>' % (prev_a["id_int"], esc(prev_a["title"])) if prev_a else "",
        '<a href="%d.html">%s →</a>' % (next_a["id_int"], esc(next_a["title"])) if next_a else "")
    body = (
        '<div id="progress"></div><button id="toTop" title="回到顶部">↑</button>'
        '<div class="layout"><aside>%s</aside><main class="article" id="artRoot">'
        '<header class="art-head"><nav class="back"><a href="../index.html">← 返回 Atlas</a> '
        '<button class="btn" type="button" onclick="atlasEditCurrent()">编辑</button> '
        '<button class="btn btn-danger" type="button" onclick="atlasDeleteCurrent()">删除</button></nav>'
        '<div class="art-progress"><div id="artProgressFill"></div></div></header>'
        '<div class="kicker">%s</div><h1>%s</h1><p class="lead">%s</p>'
        '<div id="article-tags">%s</div><p class="meta">约 %d 字 · 阅读约 %d 分钟 · 更新 %s</p>'
        '%s<div id="article-body">%s</div>%s%s</main></div>'
        % (toc_html, esc(a["category"]), esc(a["title"]), esc(a["summary"]),
           "".join('<span class="tag">%s</span>' % esc(t) for t in a["tags_list"]),
           words, minutes, esc(a.get("updated_at", "")[:10]),
           ('<div class="toc-mobile"><details><summary>目录（%d 节）</summary><ol>%s</ol></details></div>' % (len(toc), toc_items)) if toc else "",
           body_html, pager,
           footer_html(len(arts), len({x["category"] for x in arts}))))
    data = {"articles": [article_data(a)], "categories": sorted({x["category"] for x in arts})}
    return page(a["title"],
                '<script>window.ATLAS_CURRENT_ID=%d;</script>' % a["id_int"] + data_script(data) + body,
                ATLAS_JS)


def build_view(arts):
    """Generic detail shell for articles added in the browser (no static file)."""
    body = (
        '<div id="progress"></div><button id="toTop" title="回到顶部">↑</button>'
        '<div class="layout"><aside><nav class="toc" id="view-toc"></nav></aside>'
        '<main class="article" id="artRoot"><div id="view-main"><p>加载中…</p></div>'
        + footer_html(len(arts), len({a["category"] for a in arts})) + '</main></div>')
    data = {"articles": [article_data(a) for a in arts],
            "categories": sorted({a["category"] for a in arts})}
    return page("Atlas", data_script(data) + body, ATLAS_JS)


def main():
    arts = load_articles()
    if not arts:
        print("no articles found in %s" % ARTICLES_DIR)
        sys.exit(1)
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(os.path.join(DIST_DIR, "articles"))
    with open(os.path.join(DIST_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(build_home(arts))
    with open(os.path.join(DIST_DIR, "articles", "view.html"), "w", encoding="utf-8") as f:
        f.write(build_view(arts))
    for a in arts:
        with open(os.path.join(DIST_DIR, "articles", "%d.html" % a["id_int"]), "w", encoding="utf-8") as f:
            f.write(build_detail(a, arts))
    cats = sorted({a["category"] for a in arts})
    print("built %d articles, %d categories -> %s" % (len(arts), len(cats), DIST_DIR))
    print("pinned: %d" % sum(1 for a in arts if a["pinned_bool"]))


if __name__ == "__main__":
    main()

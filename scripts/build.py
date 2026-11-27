#!/usr/bin/env python3
"""Atlas build script — pure frontend, Python stdlib only.

Reproduces the Space Atlas v10 build exactly (same code as the Space):
the generated site is the v10 single-page app — v10 CSS, v10 markup,
v10 render logic in scripts/atlas.js — with articles/*.md as the text
source of truth and locally bundled fonts (no Google Fonts requests).

Reads articles/*.md (frontmatter + Markdown body) and generates:
  dist/index.html            homepage (SPA shell; JS renders home)
  dist/articles/<id>.html    one detail page per article (SPA shell;
                             JS renders that article)
  dist/articles/view.html    generic viewer for browser-added articles

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
ASSETS_DIR = os.path.join(ROOT, "assets")

with open(os.path.join(ROOT, "scripts", "atlas.js"), encoding="utf-8") as _f:
    ATLAS_JS = _f.read()
with open(os.path.join(ROOT, "scripts", "atlas.css"), encoding="utf-8") as _f:
    CSS = _f.read()
with open(os.path.join(ROOT, "scripts", "captions.json"), encoding="utf-8") as _f:
    CAPTIONS = json.load(_f)

# Modal / toast / back-to-top shell, verbatim from the v10 Space export.
SHELL = """
<div id="progress"></div>
<div id="app"></div>
<div class="modal" id="atlasModal" hidden><div class="modal-card">
<h3 id="atlasModalTitle">编辑文章</h3>
<label class="field">标题<input id="edTitle" type="text" autocomplete="off"></label>
<label class="field">分类<select id="edCategory"></select></label>
<label class="field" id="edCategoryNewWrap" hidden>新分类名称<input id="edCategoryNew" type="text" autocomplete="off"></label>
<label class="field">标签（逗号分隔）<input id="edTags" type="text" autocomplete="off"></label>
<label class="field">摘要<textarea id="edSummary" rows="2"></textarea></label>
<label class="check-line"><input id="edPinned" type="checkbox"> 置顶推荐</label>
<label class="field">正文（Markdown）<textarea id="edBody" class="mono" rows="10"></textarea></label>
<div class="modal-actions"><button type="button" class="btn btn-primary" id="edSave">保存</button><button type="button" class="btn" id="edCancel">取消</button></div>
<p class="modal-note">保存后只存在这台浏览器（localStorage），换一台设备或浏览器看不到这些改动。</p>
</div></div>
<div class="modal" id="atlasConfirmModal" hidden><div class="modal-card">
<h3>删除文章</h3>
<p id="confirmMsg" style="font-size:15px;line-height:1.7;margin:8px 0 0"></p>
<div class="modal-actions"><button type="button" class="btn btn-danger" id="confirmYes">删除</button><button type="button" class="btn" id="confirmNo">取消</button></div>
</div></div>
<div id="atlasToast" role="status" aria-live="polite"></div>
<button id="toTop" aria-label="回到顶部">↑</button>
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
    """Markdown -> HTML, mirroring the original knowledge-base renderer
    that produced the v10 stored article HTML.

    Returns (html, toc) with toc entries {title, label, level, n}.
    Rules (all verified against the v10 stored HTML):
    - level-1 headings are dropped (the article header shows the title)
    - every h2/h3 becomes a sec-N anchor feeding the TOC; the TOC label
      is the <!-- toc: ... --> note when present, else the full title
    - fenced code keeps its language as class="language-<lang>" and a
      trailing newline before </code>
      (```bill fences become the cost-comparison card at render time)
    - images become .img-note placeholders; the client swaps in the
      real figures from BODYIMGS (with （上）/（下） shot rows)
    - blocks are separated by blank lines; inside one block, lines are
      joined with <br />\\n — a paragraph keeps "- " lines as literal
      text, and a list attaches non-marker lines to the current item
      (verbatim, leading spaces kept); only a line with the list's own
      marker type starts a new item
    - standalone <!-- ... --> lines are skipped
    """
    lines = body.splitlines()
    out = []
    toc = []
    i = 0
    sec_n = 0
    h1_seen = [False]
    n_lines = len(lines)

    def is_table_sep(line):
        return re.match(r"^\s*\|[\s:|-]+\|\s*$", line)

    def is_fence(line):
        # ``` plus an optional language word, and nothing else — a ```
        # line with a trailing space (article 6's tail) is not a fence.
        return re.match(r"^```\w*$", line) is not None

    def is_structural(line, next_line=None):
        """A line that starts a new block even without a blank line."""
        if is_fence(line):
            return True
        if re.match(r"^#{1,4}", line):
            return True
        if line.strip() in ("---", "***", "___"):
            return True
        if re.match(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$", line):
            return True
        if line.startswith(">"):
            return True
        if line.strip().startswith("|") and next_line is not None and is_table_sep(next_line):
            return True
        return False

    while i < n_lines:
        line = lines[i]
        # blank
        if not line.strip():
            i += 1
            continue
        # fenced code (language kept as a class)
        fm = re.match(r"^```(\w*)$", line)
        if fm:
            lang = fm.group(1)
            buf = []
            i += 1
            while i < n_lines and not re.match(r"^```\w*$", lines[i]):
                buf.append(lines[i])
                i += 1
            i += 1
            cls = ' class="language-%s"' % esc(lang) if lang else ""
            out.append("<pre><code%s>%s\n</code></pre>" % (cls, esc("\n".join(buf))))
            continue
        # table
        if line.strip().startswith("|") and i + 1 < n_lines and is_table_sep(lines[i + 1]):
            header = [c.strip() for c in line.strip().strip("|").split("|")]
            i += 2
            rows = []
            while i < n_lines and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            t = ["<table><thead><tr>%s</tr></thead><tbody>" % "".join("<th>%s</th>" % inline_md(c) for c in header)]
            for r in rows:
                t.append("<tr>%s</tr>" % "".join("<td>%s</td>" % inline_md(c) for c in r))
            t.append("</tbody></table>")
            out.append("".join(t))
            continue
        # headings ("#xxx" without a space counts too, e.g. the hashtag
        # line in article 4). Only the FIRST h1 is dropped (the article
        # title, already shown in the header); later h1s render as <h1>.
        m = re.match(r"^(#{1,4})\s*(.*)$", line)
        if m:
            level = len(m.group(1))
            raw = m.group(2)
            tm = re.search(r"<!--\s*toc:\s*(.*?)\s*-->", raw)
            toc_label = tm.group(1) if tm else None
            raw = re.sub(r"<!--.*?-->", "", raw).strip()
            if level == 1:
                if not h1_seen[0]:
                    h1_seen[0] = True  # title h1: header already shows it
                else:
                    out.append("<h1>%s</h1>" % inline_md(raw))
            elif level in (2, 3):
                sec_n += 1
                label = toc_label or raw
                toc.append({"title": raw, "label": label, "level": level, "n": sec_n})
                out.append('<h%d id="sec-%d">%s</h%d>' % (level, sec_n, inline_md(raw), level))
            else:
                out.append("<h4>%s</h4>" % inline_md(raw))
            i += 1
            continue
        # standalone HTML comment line
        if line.strip().startswith("<!--"):
            i += 1
            continue
        # blockquote
        if line.startswith(">"):
            buf = []
            while i < n_lines and lines[i].startswith(">"):
                buf.append(lines[i].lstrip("> ").rstrip())
                i += 1
            out.append("<blockquote><p>%s</p></blockquote>" % "<br />\n".join(inline_md(b) for b in buf))
            continue
        # hr
        if line.strip() in ("---", "***", "___"):
            out.append("<hr />")
            i += 1
            continue
        # image -> .img-note placeholder (client swaps in the real figure)
        m = re.match(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$", line)
        if m:
            out.append('<div class="img-note">🖼 配图：%s（原图随知识库保存，此线上版以文字标注位置）</div>' % esc(m.group(1)))
            i += 1
            continue
        # list block: first line carries the marker; the block runs to the
        # next blank line (or structural line). Only a line with the same
        # marker type starts a new item; anything else attaches verbatim
        # to the current item.
        lm = re.match(r"^(\s*)([-*]|\d+[\.\)])\s+(.*)$", line)
        if lm:
            ordered = bool(re.match(r"^\d+[\.\)]$", lm.group(2)))
            items = []  # each item: list of raw segments
            while i < n_lines and lines[i].strip() and not is_structural(lines[i], lines[i+1] if i+1 < n_lines else None):
                m2 = re.match(r"^(\s*)([-*]|\d+[\.\)])\s+(.*)$", lines[i])
                if m2 and bool(re.match(r"^\d+[\.\)]$", m2.group(2))) == ordered:
                    items.append([m2.group(3)])
                elif items:
                    items[-1].append(lines[i])
                else:
                    # marker line of the other type before any item: treat
                    # as literal text of a first item
                    items.append([lines[i]])
                i += 1
            tag = "ol" if ordered else "ul"
            out.append("<%s>%s</%s>" % (
                tag,
                "".join("<li>%s</li>" % "<br />\n".join(inline_md(p) for p in parts) for parts in items),
                tag))
            continue
        # paragraph block: runs to the next blank line (or structural line);
        # lines are joined with <br /> — "- " lines stay literal text.
        # The block's first line is stripped (a leading indent on it is
        # not kept); continuation lines are kept verbatim.
        buf = [line.strip()]
        i += 1
        while i < n_lines and lines[i].strip() and not is_structural(lines[i], lines[i+1] if i+1 < n_lines else None) \
                and not lines[i].strip().startswith("<!--"):
            buf.append(lines[i])
            i += 1
        out.append("<p>%s</p>" % "<br />\n".join(inline_md(b) for b in buf))
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
    # Newest first: updated date descending, article id descending
    # as the tie-breaker (articles 1-16 share one updated date).
    arts.sort(key=lambda a: (a.get("updated_at", ""), a["id_int"]), reverse=True)
    return arts


def cover_file(cover_key):
    """Bundled cover image for a cover_key, or None."""
    for ext in ("jpg", "webp", "png"):
        fn = "%s.%s" % (cover_key, ext)
        if os.path.exists(os.path.join(ASSETS_DIR, "images", fn)):
            return fn
    return None


def article_data(a):
    body_html, toc = md_to_html(a["body"])
    kbimg = re.findall(r"kbimg:([^\s)]+)", a["body"])
    return {
        "id": a["id_int"], "title": a["title"], "category": a["category"],
        "tags": a["tags_list"], "summary": a["summary"], "pinned": a["pinned_bool"],
        "updated": a.get("updated_at", "")[:10],
        "source": a.get("source_note", ""),
        "toc": toc, "html": body_html, "body": a["body"],
        "file": a.get("file", ""), "cover_key": a.get("cover_key", ""),
        "_kbimg": kbimg,
    }


def data_script(obj):
    # "</" is escaped so article bodies can never break out of the script tag
    return ('<script id="atlas-data" type="application/json">%s</script>'
            % json.dumps(obj, ensure_ascii=False).replace("</", "<\\/"))


def page(title, data, boot):
    return ("<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            "<meta name=\"color-scheme\" content=\"light dark\">\n"
            "<link rel=\"icon\" href=\"data:,\">\n"
            "<title>%s</title>\n<link rel=\"stylesheet\" href=\"/assets/fonts.css\">\n<style>%s</style>\n</head>\n<body>\n%s\n%s\n<script>%s</script>\n<script>%s</script>\n</body>\n</html>\n"
            % (esc(title), CSS, SHELL, data_script(data), boot, ATLAS_JS))


def build_all_data(arts):
    data_articles = [article_data(a) for a in arts]
    covers = {}
    bodyimgs = {}
    for d in data_articles:
        fn = cover_file(d["cover_key"])
        if fn:
            covers[str(d["id"])] = "/assets/images/" + fn
        if d["_kbimg"]:
            bodyimgs[str(d["id"])] = ["/assets/images/" + f for f in d["_kbimg"]]
        del d["_kbimg"]
    cat_order = []
    for d in data_articles:
        if d["category"] not in cat_order:
            cat_order.append(d["category"])
    return {"articles": data_articles, "covers": covers,
            "bodyimgs": bodyimgs, "captions": CAPTIONS,
            "categories": cat_order}


def main():
    arts = load_articles()
    if not arts:
        print("no articles found in %s" % ARTICLES_DIR)
        sys.exit(1)
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(os.path.join(DIST_DIR, "articles"))
    # bundled assets (fonts + images) are copied into dist/ as-is
    if os.path.exists(ASSETS_DIR):
        shutil.copytree(ASSETS_DIR, os.path.join(DIST_DIR, "assets"))
    shutil.copy(os.path.join(ROOT, "scripts", "fonts.css"),
                os.path.join(DIST_DIR, "assets", "fonts.css"))
    data = build_all_data(arts)
    missing_covers = [d["title"] for d in data["articles"]
                      if str(d["id"]) not in data["covers"]]
    if missing_covers:
        print("WARNING: articles without a bundled cover: %s" % missing_covers)
    with open(os.path.join(DIST_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(page("Atlas", data, 'window.ATLAS_PAGE="home";'))
    with open(os.path.join(DIST_DIR, "articles", "view.html"), "w", encoding="utf-8") as f:
        f.write(page("Atlas", data, 'window.ATLAS_PAGE="view";'))
    for a in arts:
        with open(os.path.join(DIST_DIR, "articles", "%d.html" % a["id_int"]), "w", encoding="utf-8") as f:
            f.write(page("%s · Atlas" % a["title"], data,
                         'window.ATLAS_PAGE="detail";window.ATLAS_STATIC_ID=%d;' % a["id_int"]))
    print("built %d articles, %d categories -> %s" % (len(arts), len(data["categories"]), DIST_DIR))
    print("pinned: %d" % sum(1 for a in arts if a["pinned_bool"]))
    print("covers: %d, body image sets: %s" % (len(data["covers"]), sorted(data["bodyimgs"])))


if __name__ == "__main__":
    main()

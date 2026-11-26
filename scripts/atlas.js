/* Atlas client runtime — Add / Edit / Delete (no backend).
 *
 * Built-in articles are baked into each page as JSON (#atlas-data).
 * All adds/edits/deletes are stored in localStorage under key
 * "atlas_overrides" and applied on top of the built-in articles:
 *   { v: 1, added: [article...], edited: {id: article}, deleted: [id...] }
 * Nothing leaves the browser on its own. The export helper
 * (atlasExportChanges) is still in this file and can be called from the
 * console to download the changed Markdown files, which then go into
 * articles/ and are rebuilt and pushed to GitHub. There is no visible
 * export button on the homepage (removed at the user's request,
 * 2026-11-26).
 *
 * Article list pagination: the homepage list is a flat list, max 20
 * articles per page, with prev/next + page numbers below the list.
 */
(function () {
  "use strict";
  var KEY = "atlas_overrides";

  /* ---------- data ---------- */
  var DATA = null;
  try {
    var el = document.getElementById("atlas-data");
    DATA = el ? JSON.parse(el.textContent) : { articles: [], categories: [] };
  } catch (e) { DATA = { articles: [], categories: [] }; }
  var BUILTIN = DATA.articles || [];
  var CATEGORIES = DATA.categories || [];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function loadOverrides() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "null");
      if (o && Array.isArray(o.added) && o.edited && Array.isArray(o.deleted)) return o;
    } catch (e) {}
    return { v: 1, added: [], edited: {}, deleted: [] };
  }
  function saveOverrides(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { alert("保存失败：浏览器 localStorage 不可用。"); }
  }
  function builtinById(id) {
    for (var i = 0; i < BUILTIN.length; i++) if (BUILTIN[i].id === id) return BUILTIN[i];
    return null;
  }
  function getArticle(id) {
    var o = loadOverrides();
    if (o.deleted.indexOf(id) !== -1) return null;
    if (o.edited[id]) return o.edited[id];
    for (var i = 0; i < o.added.length; i++) if (o.added[i].id === id) return o.added[i];
    return builtinById(id);
  }
  function getAllArticles() {
    var o = loadOverrides();
    var list = [];
    BUILTIN.forEach(function (a) {
      if (o.deleted.indexOf(a.id) !== -1) return;
      list.push(o.edited[a.id] || a);
    });
    o.added.forEach(function (a) {
      if (o.deleted.indexOf(a.id) !== -1) return;
      list.push(a);
    });
    list.sort(function (x, y) { return x.id - y.id; });
    return list;
  }
  function pendingCount() {
    var o = loadOverrides();
    return o.added.length + Object.keys(o.edited).length + o.deleted.length;
  }
  function nextAddedId() {
    var o = loadOverrides();
    var max = 1000;
    o.added.forEach(function (a) { if (a.id > max) max = a.id; });
    return max + 1;
  }
  function slugify(title) {
    var s = String(title || "article").replace(/[^\w\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "");
    return s ? s.slice(0, 40) : "article";
  }
  function articleFilename(a) {
    if (a.file) return a.file;
    return a.id + "-" + slugify(a.title) + ".md";
  }
  function toMarkdown(a) {
    var tags = (a.tags || []).map(function (t) { return '"' + String(t).replace(/"/g, "") + '"'; }).join(", ");
    var fm = ["---", "id: " + a.id, 'title: "' + String(a.title || "").replace(/"/g, "") + '"',
      'category: "' + String(a.category || "").replace(/"/g, "") + '"',
      "tags: [" + tags + "]", "pinned: " + (a.pinned ? "true" : "false")];
    if (a.cover_key) fm.push('cover_key: "' + a.cover_key + '"');
    fm.push('summary: "' + String(a.summary || "").replace(/"/g, "") + '"');
    if (a.source_note) fm.push('source_note: "' + String(a.source_note).replace(/"/g, "") + '"');
    fm.push("updated_at: " + JSON.stringify(a.updated_at || new Date().toISOString()));
    fm.push("---", "");
    return fm.join("\n") + "\n" + (a.body || "");
  }

  /* ---------- small Markdown -> HTML (mirrors scripts/build.py) ---------- */
  function inlineMd(s) {
    s = esc(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return s;
  }
  function mdToHtml(body) {
    var lines = String(body || "").split("\n"), out = [], toc = [], i = 0, secN = 0;
    function isTableSep(l) { return /^\s*\|[\s:|-]+\|\s*$/.test(l); }
    while (i < lines.length) {
      var line = lines[i];
      if (line.indexOf("```") === 0) {
        var buf = []; i++;
        while (i < lines.length && lines[i].indexOf("```") !== 0) { buf.push(lines[i]); i++; }
        i++;
        out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>"); continue;
      }
      if (line.trim().indexOf("|") === 0 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        var header = line.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); });
        i += 2; var rows = [];
        while (i < lines.length && lines[i].trim().indexOf("|") === 0) {
          rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); })); i++;
        }
        var t = "<table><thead><tr>" + header.map(function (c) { return "<th>" + inlineMd(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
        rows.forEach(function (r) { t += "<tr>" + r.map(function (c) { return "<td>" + inlineMd(c) + "</td>"; }).join("") + "</tr>"; });
        out.push(t + "</tbody></table>"); continue;
      }
      var hm = line.match(/^(#{1,3})\s+(.*)$/);
      if (hm) {
        var level = hm[1].length, raw = hm[2], tm = raw.match(/<!--\s*toc:\s*(.*?)\s*-->/);
        var tocLabel = tm ? tm[1] : null;
        raw = raw.replace(/<!--.*?-->/g, "").trim();
        if (level === 1) { out.push("<h1>" + inlineMd(raw) + "</h1>"); }
        else if (level === 2) {
          secN++; var hid = "sec-" + secN;
          var label = tocLabel || raw.replace(/^\d+[\.\、\s]*/, "");
          toc.push({ id: hid, label: label, level: 2 });
          var b = raw.match(/^(\d+)/);
          out.push('<div class="sec-head" id="' + hid + '"><span class="badge">' + esc(b ? b[1] : ("0" + toc.length).slice(-2)) + '</span><h2>' + inlineMd(raw) + "</h2></div>");
        } else {
          if (/^\d+\.\d+/.test(raw)) {
            secN++; var hid3 = "sec-" + secN;
            toc.push({ id: hid3, label: raw, level: 3 });
            out.push('<div class="sec-head" id="' + hid3 + '"><span class="badge">' + esc(raw.split(" ")[0]) + "</span><h3>" + inlineMd(raw) + "</h3></div>");
          } else { out.push("<h3>" + inlineMd(raw) + "</h3>"); }
        }
        i++; continue;
      }
      if (line.indexOf(">") === 0) {
        var bq = [];
        while (i < lines.length && lines[i].indexOf(">") === 0) { bq.push(lines[i].replace(/^>\s?/, "")); i++; }
        out.push("<blockquote><p>" + bq.map(inlineMd).join("<br>") + "</p></blockquote>"); continue;
      }
      if (line.trim() === "---" || line.trim() === "***" || line.trim() === "___") { out.push("<hr>"); i++; continue; }
      var im = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
      if (im) { out.push('<div class="img-note">🖼 ' + esc(im[1]) + "（配图 " + esc(im[2]) + "，未包含在导出中）</div>"); i++; continue; }
      if (/^\s*[-*]\s+/.test(line)) {
        var items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
        out.push("<ul>" + items.map(function (x) { return "<li>" + inlineMd(x) + "</li>"; }).join("") + "</ul>"); continue;
      }
      if (/^\s*\d+[\.\)]\s+/.test(line)) {
        var oitems = [];
        while (i < lines.length && /^\s*\d+[\.\)]\s+/.test(lines[i])) { oitems.push(lines[i].replace(/^\s*\d+[\.\)]\s+/, "")); i++; }
        out.push("<ol>" + oitems.map(function (x) { return "<li>" + inlineMd(x) + "</li>"; }).join("") + "</ol>"); continue;
      }
      if (!line.trim()) { i++; continue; }
      var para = [line]; i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|\s*[-*]\s|\s*\d+[\.\)]\s+>|>|\|)/.test(lines[i])) { para.push(lines[i]); i++; }
      out.push("<p>" + para.map(inlineMd).join(" ") + "</p>");
    }
    return { html: out.join("\n"), toc: toc };
  }

  /* ---------- homepage search / filter + pagination (inline handlers) ---------- */
  var PAGE_SIZE = 20;
  var currentPage = 1;
  var currentQuery = "";
  var currentCat = "全部";
  function cardMatches(card) {
    if (currentCat !== "全部" && card.getAttribute("data-cat") !== currentCat) return false;
    if (currentQuery) {
      var s = (card.getAttribute("data-search") || "").toLowerCase();
      if (s.indexOf(currentQuery) === -1) return false;
    }
    return true;
  }
  function listCards() {
    var list = document.getElementById("article-list");
    if (!list) return [];
    return Array.prototype.slice.call(list.querySelectorAll(".card[data-article-id]"));
  }
  function renderPagination(totalPages) {
    var nav = document.getElementById("pagination");
    if (!nav) return;
    var prev = document.getElementById("page-prev");
    var next = document.getElementById("page-next");
    var nums = document.getElementById("page-numbers");
    var info = document.getElementById("page-info");
    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = currentPage >= totalPages;
    if (info) info.textContent = "第 " + currentPage + " / " + totalPages + " 页";
    if (nums) {
      var html = "";
      for (var p = 1; p <= totalPages; p++) {
        html += '<button class="btn page-num' + (p === currentPage ? " active" : "") +
          '" type="button" onclick="atlasGoToPage(' + p + ')"' + (p === currentPage ? " disabled" : "") + ">" + p + "</button>";
      }
      nums.innerHTML = html;
    }
  }
  function applyPagination() {
    var cards = listCards();
    var visible = cards.filter(cardMatches);
    var totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    var start = (currentPage - 1) * PAGE_SIZE;
    var pageCards = visible.slice(start, start + PAGE_SIZE);
    cards.forEach(function (card) {
      card.style.display = pageCards.indexOf(card) !== -1 ? "" : "none";
    });
    /* pinned section is not paginated: it just follows the same filter */
    document.querySelectorAll(".pinned-sec .card[data-article-id]").forEach(function (card) {
      card.style.display = cardMatches(card) ? "" : "none";
    });
    renderPagination(totalPages);
  }
  window.atlasGoToPage = function (target) {
    var cards = listCards();
    var visible = cards.filter(cardMatches);
    var totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    if (target === "prev") currentPage = Math.max(1, currentPage - 1);
    else if (target === "next") currentPage = Math.min(totalPages, currentPage + 1);
    else if (typeof target === "number") currentPage = Math.min(totalPages, Math.max(1, target));
    applyPagination();
    var list = document.getElementById("article-list");
    if (list) list.scrollIntoView({ block: "start" });
  };
  window.filterCards = function (q) {
    currentQuery = (q || "").trim().toLowerCase();
    currentPage = 1;
    var title = document.getElementById("siteTitle");
    if (title) title.hidden = !!currentQuery;
    applyPagination();
  };
  window.setChip = function (btn, cat) {
    currentCat = cat;
    currentPage = 1;
    var title = document.getElementById("siteTitle");
    if (title) title.hidden = cat !== "全部";
    document.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
    btn.classList.add("active");
    applyPagination();
  };

  /* ---------- editor modal ---------- */
  var currentEditId = null;
  function ensureModal() {
    if (document.getElementById("atlas-modal")) return;
    var div = document.createElement("div");
    div.id = "atlas-modal";
    div.className = "modal";
    div.hidden = true;
    div.innerHTML =
      '<div class="modal-card"><h3 id="atlas-modal-title">编辑文章</h3>' +
      '<label class="field">标题<input id="ed-title" type="text"></label>' +
      '<label class="field">分类<select id="ed-category"></select>' +
      '<input id="ed-category-new" type="text" placeholder="新分类名称" hidden style="margin-top:6px"></label>' +
      '<label class="field">标签（逗号分隔）<input id="ed-tags" type="text"></label>' +
      '<label class="field">摘要<textarea id="ed-summary" rows="2"></textarea></label>' +
      '<label class="field"><span><input id="ed-pinned" type="checkbox"> 置顶推荐</span></label>' +
      '<label class="field">正文（Markdown）<textarea id="ed-body" rows="14"></textarea></label>' +
      '<div class="modal-actions"><button class="btn btn-primary" id="ed-save">保存</button>' +
      '<button class="btn" type="button" onclick="atlasCloseModal()">取消</button></div>' +
      '<p class="modal-note">保存后只存在本浏览器（localStorage），不会自动同步到 GitHub；要同步到其它主机，需把改动过的 Markdown 文件放回仓库的 articles/，重新构建并推送。</p></div>';
    document.body.appendChild(div);
    document.getElementById("ed-category").addEventListener("change", function () {
      document.getElementById("ed-category-new").hidden = this.value !== "__new__";
    });
    document.getElementById("ed-save").addEventListener("click", saveEditor);
  }
  function fillCategories(selected) {
    var sel = document.getElementById("ed-category");
    var cats = CATEGORIES.slice();
    getAllArticles().forEach(function (a) { if (cats.indexOf(a.category) === -1) cats.push(a.category); });
    sel.innerHTML = cats.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === selected ? " selected" : "") + ">" + esc(c) + "</option>";
    }).join("") + '<option value="__new__">＋ 新分类…</option>';
    document.getElementById("ed-category-new").hidden = true;
  }
  window.atlasCloseModal = function () {
    var m = document.getElementById("atlas-modal");
    if (m) m.hidden = true;
    var e = document.getElementById("atlas-export-modal");
    if (e) e.hidden = true;
  };
  window.atlasNewArticle = function () { openEditor(null); };
  window.atlasEditCurrent = function () {
    var id = window.ATLAS_CURRENT_ID;
    if (id == null) return;
    openEditor(getArticle(id));
  };
  function openEditor(article) {
    ensureModal();
    currentEditId = article ? article.id : null;
    document.getElementById("atlas-modal-title").textContent = article ? "编辑文章" : "新增文章";
    document.getElementById("ed-title").value = article ? article.title : "";
    fillCategories(article ? article.category : CATEGORIES[0]);
    document.getElementById("ed-tags").value = article ? (article.tags || []).join(", ") : "";
    document.getElementById("ed-summary").value = article ? article.summary : "";
    document.getElementById("ed-pinned").checked = !!(article && article.pinned);
    document.getElementById("ed-body").value = article ? article.body : "";
    document.getElementById("atlas-modal").hidden = false;
  }
  function saveEditor() {
    var title = document.getElementById("ed-title").value.trim();
    if (!title) { alert("请填写标题。"); return; }
    var catSel = document.getElementById("ed-category");
    var category = catSel.value === "__new__"
      ? document.getElementById("ed-category-new").value.trim()
      : catSel.value;
    if (!category) { alert("请选择或填写分类。"); return; }
    var tags = document.getElementById("ed-tags").value.split(/[,，、]/).map(function (t) { return t.trim(); }).filter(Boolean);
    var o = loadOverrides();
    if (currentEditId == null) {
      var a = { id: nextAddedId(), title: title, category: category, tags: tags,
        summary: document.getElementById("ed-summary").value.trim(), pinned: document.getElementById("ed-pinned").checked,
        updated_at: new Date().toISOString(), body: document.getElementById("ed-body").value };
      o.added.push(a);
      saveOverrides(o);
      atlasCloseModal();
      location.href = atlasPath("articles/view.html?id=" + a.id);
    } else {
      var orig = getArticle(currentEditId);
      var updated = { id: currentEditId, title: title, category: category, tags: tags,
        summary: document.getElementById("ed-summary").value.trim(), pinned: document.getElementById("ed-pinned").checked,
        updated_at: new Date().toISOString(), body: document.getElementById("ed-body").value,
        cover_key: orig.cover_key, source_note: orig.source_note, file: orig.file };
      if (orig.file) { o.edited[currentEditId] = updated; }
      else {
        for (var i = 0; i < o.added.length; i++) if (o.added[i].id === currentEditId) o.added[i] = updated;
      }
      saveOverrides(o);
      atlasCloseModal();
      location.reload();
    }
  }
  function atlasPath(rel) {
    return location.pathname.indexOf("/articles/") !== -1 ? "../" + rel : rel;
  }
  window.atlasDeleteCurrent = function () {
    var id = window.ATLAS_CURRENT_ID;
    if (id == null) return;
    var a = getArticle(id);
    if (!a) return;
    if (!confirm("确定删除「" + a.title + "」吗？\n删除后只在本地生效，需把改动同步到 GitHub 才会对其它主机生效。")) return;
    var o = loadOverrides();
    delete o.edited[id];
    o.added = o.added.filter(function (x) { return x.id !== id; });
    if (builtinById(id) && o.deleted.indexOf(id) === -1) o.deleted.push(id);
    saveOverrides(o);
    location.href = atlasPath("index.html");
  };

  /* ---------- export changes ---------- */
  function downloadBlob(filename, text, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  window.atlasExportChanges = function () {
    var o = loadOverrides();
    var changed = [];
    o.added.forEach(function (a) { changed.push({ kind: "新增", article: a }); });
    Object.keys(o.edited).forEach(function (id) { changed.push({ kind: "修改", article: o.edited[id] }); });
    var deleted = o.deleted.map(function (id) { var b = builtinById(id); return { id: id, title: b ? b.title : ("id " + id), file: b ? b.file : null }; });
    if (!changed.length && !deleted.length) { alert("本地没有改动（localStorage 里没有新增/修改/删除）。"); return; }
    var div = document.getElementById("atlas-export-modal");
    if (!div) {
      div = document.createElement("div");
      div.id = "atlas-export-modal"; div.className = "modal"; div.hidden = true;
      document.body.appendChild(div);
    }
    var rows = changed.map(function (c, i) {
      return '<li>' + esc(c.kind) + "：" + esc(c.article.title) + ' — <a href="#" data-exp="' + i + '">下载 ' + esc(articleFilename(c.article)) + "</a></li>";
    }).join("");
    var delRows = deleted.map(function (d) {
      return "<li>删除：" + esc(d.title) + (d.file ? " — 在 articles/ 里删掉 " + esc(d.file) : "") + "</li>";
    }).join("");
    div.innerHTML = '<div class="modal-card"><h3>导出本地改动</h3>' +
      "<p>以下改动只存在本浏览器（localStorage），还没有同步到 GitHub：</p><ul>" + rows + delRows + "</ul>" +
      '<p><button class="btn btn-primary" id="exp-json">下载全部改动 (atlas-changes.json)</button> ' +
      '<button class="btn" type="button" onclick="atlasCloseModal()">关闭</button></p>' +
      "<ol class=\"modal-note\"><li>把上面下载的 Markdown 文件放进仓库的 articles/（新增放新文件，修改覆盖同名文件，删除的删掉对应文件）。</li>" +
      "<li>在仓库根目录跑 <code>python3 scripts/build.py</code> 重新生成 dist/。</li>" +
      "<li><code>git add -A && git commit -m \"更新文章\" && git push origin main</code>，其它主机 git pull 即可。</li></ol></div>";
    div.hidden = false;
    div.querySelectorAll("[data-exp]").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var c = changed[parseInt(a.getAttribute("data-exp"), 10)];
        downloadBlob(articleFilename(c.article), toMarkdown(c.article), "text/markdown;charset=utf-8");
      });
    });
    document.getElementById("exp-json").addEventListener("click", function () {
      downloadBlob("atlas-changes.json", JSON.stringify({
        exported_at: new Date().toISOString(),
        added: o.added, edited: o.edited, deleted: o.deleted
      }, null, 2), "application/json;charset=utf-8");
    });
  };

  /* ---------- homepage overrides ---------- */
  function cardHtml(a) {
    var search = esc(a.title + " " + a.summary + " " + (a.tags || []).join(" "));
    var tags = (a.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
    var href = a.id >= 1001 ? "articles/view.html?id=" + a.id : "articles/" + a.id + ".html";
    return '<article class="card" data-cat="' + esc(a.category) + '" data-search="' + search + '" data-article-id="' + a.id + '">' +
      '<h3><a href="' + href + '">' + esc(a.title) + "</a>" + (a.pinned ? '<span class="pinned">置顶</span>' : "") + "</h3>" +
      "<p>" + esc(a.summary) + "</p><div><span class=\"date\">" + esc((a.updated_at || "").slice(0, 10)) + "</span> " + tags + "</div></article>";
  }
  function applyHomepageOverrides() {
    var o = loadOverrides();
    if (!document.querySelector(".card[data-article-id]")) return;
    var all = getAllArticles();
    var pinnedSec = document.querySelector(".pinned-sec");
    var listEl = document.getElementById("article-list");
    // hide deleted / patch edited cards in place
    document.querySelectorAll(".card[data-article-id]").forEach(function (card) {
      var id = parseInt(card.getAttribute("data-article-id"), 10);
      var a = getArticle(id);
      if (!a) { card.remove(); return; }
      var h3a = card.querySelector("h3 a");
      if (h3a) h3a.textContent = a.title;
      var p = card.querySelector("p");
      if (p) p.textContent = a.summary;
      var tagsDiv = card.querySelector("h3").parentNode.querySelector("div");
      var pin = card.querySelector(".pinned");
      if (a.pinned && !pin) {
        var s = document.createElement("span"); s.className = "pinned"; s.textContent = "置顶";
        card.querySelector("h3").appendChild(s);
      } else if (!a.pinned && pin) { pin.remove(); }
      if (tagsDiv) {
        tagsDiv.innerHTML = '<span class="date">' + esc((a.updated_at || "").slice(0, 10)) + "</span> " +
          (a.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
      }
      card.setAttribute("data-cat", a.category);
      card.setAttribute("data-search", a.title + " " + a.summary + " " + (a.tags || []).join(" "));
    });
    // pinned status / category: pinned articles appear in BOTH the pinned
    // section and the grouped list, so toggle the pinned-section copy only
    all.forEach(function (a) {
      var pinnedCard = pinnedSec ? pinnedSec.querySelector('.card[data-article-id="' + a.id + '"]') : null;
      var groupedCard = null;
      document.querySelectorAll('.card[data-article-id="' + a.id + '"]').forEach(function (c) {
        if (!pinnedSec || !pinnedSec.contains(c)) groupedCard = c;
      });
      if (a.pinned && !pinnedCard) {
        var clone = groupedCard ? groupedCard.cloneNode(true) : null;
        if (!clone) { var t0 = document.createElement("div"); t0.innerHTML = cardHtml(a); clone = t0.firstChild; }
        if (pinnedSec) pinnedSec.appendChild(clone);
      } else if (!a.pinned && pinnedCard) { pinnedCard.remove(); }
      if (!groupedCard) {
        var wrap = document.createElement("div"); wrap.innerHTML = cardHtml(a);
        var newCard = wrap.firstChild;
        if (listEl) listEl.appendChild(newCard);
        /* new category: add a filter chip (the list itself stays flat) */
        var chipExists = false;
        document.querySelectorAll(".chip").forEach(function (c) { if (c.textContent === a.category) chipExists = true; });
        if (!chipExists) {
          var chipRow = document.querySelector(".chips");
          if (chipRow) {
            var chip = document.createElement("button");
            chip.className = "chip"; chip.textContent = a.category;
            chip.setAttribute("onclick", "setChip(this,'" + a.category.replace(/'/g, "") + "')");
            chipRow.appendChild(chip);
          }
        }
      }
    });
    // recount: overview, category cards, section headings
    var ov = document.querySelector(".overview");
    if (ov) ov.textContent = "共 " + all.length + " 篇 · " + new Set(all.map(function (a) { return a.category; })).size + " 个分类";
    document.querySelectorAll(".catcard").forEach(function (cc) {
      var cat = cc.getAttribute("data-cat");
      var list = all.filter(function (a) { return a.category === cat; });
      if (!list.length) { cc.remove(); return; }
      var p = cc.querySelector("p");
      if (p) p.textContent = list.length + " 篇 · 最新：" + list[0].title;
    });
    // pending-changes badge
    var badge = document.getElementById("atlas-pending");
    if (badge) {
      var n = pendingCount();
      badge.textContent = n ? ("本地有 " + n + " 处改动") : "";
      badge.style.display = n ? "" : "none";
    }
  }

  /* ---------- detail overrides + generic view page ---------- */
  function rebuildToc(toc) {
    var items = toc.map(function (t) {
      return '<li' + (t.level === 3 ? ' style="padding-left:14px;"' : "") + '><a href="#' + t.id + '">' + esc(t.label) + "</a></li>";
    }).join("");
    document.querySelectorAll(".toc ol").forEach(function (ol) { ol.innerHTML = items; });
    document.querySelectorAll(".toc-mobile ol").forEach(function (ol) { ol.innerHTML = items; });
    var h = document.querySelector(".toc h4");
    if (h) h.textContent = "目录（" + toc.length + " 节）";
    var s = document.querySelector(".toc-mobile summary");
    if (s) s.textContent = "目录（" + toc.length + " 节）";
  }
  function applyDetailOverride() {
    var id = window.ATLAS_CURRENT_ID;
    if (id == null) return;
    var o = loadOverrides();
    if (!o.edited[id]) return;
    var a = o.edited[id];
    var main = document.querySelector("main.article");
    if (!main) return;
    var h1 = main.querySelector("h1");
    if (h1) h1.textContent = a.title;
    var lead = main.querySelector(".lead");
    if (lead) lead.textContent = a.summary;
    var tags = document.getElementById("article-tags");
    if (tags) tags.innerHTML = (a.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
    var meta = main.querySelector(".meta");
    if (meta) meta.textContent = "约 " + a.body.length + " 字 · 阅读约 " + Math.max(1, Math.round(a.body.length / 400)) + " 分钟 · 更新 " + (a.updated_at || "").slice(0, 10) + "（本地修改，未导出）";
    var bodyEl = document.getElementById("article-body");
    if (bodyEl) {
      var r = mdToHtml(a.body);
      bodyEl.innerHTML = r.html;
      rebuildToc(r.toc);
      document.title = a.title + " · Atlas";
    }
    initScrollspy();
  }
  function renderViewPage() {
    var main = document.getElementById("view-main");
    if (!main) return;
    var id = parseInt(new URLSearchParams(location.search).get("id") || "0", 10);
    var a = getArticle(id);
    if (!a) {
      main.innerHTML = '<nav class="back"><a href="../index.html">← 返回 Atlas</a></nav><h1>文章不存在</h1><p class="lead">这篇文章可能已被删除，或链接不正确。</p>';
      document.title = "文章不存在 · Atlas";
      return;
    }
    window.ATLAS_CURRENT_ID = id;
    var r = mdToHtml(a.body);
    var words = a.body.length;
    main.innerHTML =
      '<header class="art-head"><nav class="back"><a href="../index.html">← 返回 Atlas</a> ' +
      '<button class="btn" type="button" onclick="atlasEditCurrent()">编辑</button> ' +
      '<button class="btn btn-danger" type="button" onclick="atlasDeleteCurrent()">删除</button></nav>' +
      '<div class="art-progress"><div id="artProgressFill"></div></div></header>' +
      '<div class="kicker">' + esc(a.category) + "</div><h1>" + esc(a.title) + "</h1>" +
      '<p class="lead">' + esc(a.summary) + "</p>" +
      '<div id="article-tags">' + (a.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("") + "</div>" +
      '<p class="meta">约 ' + words + " 字 · 阅读约 " + Math.max(1, Math.round(words / 400)) + " 分钟 · 更新 " + (a.updated_at || "").slice(0, 10) + "</p>" +
      '<div id="article-body">' + r.html + "</div>";
    document.title = a.title + " · Atlas";
    var tocNav = document.getElementById("view-toc");
    if (tocNav) {
      tocNav.innerHTML = "<h4>目录（" + r.toc.length + " 节）</h4><ol>" +
        r.toc.map(function (t) {
          return '<li' + (t.level === 3 ? ' style="padding-left:14px;"' : "") + '><a href="#' + t.id + '">' + esc(t.label) + "</a></li>";
        }).join("") + "</ol>";
    }
    initScrollspy();
  }

  /* ---------- scrollspy / progress (detail pages) ---------- */
  var spyInit = false;
  function initScrollspy() {
    var bar = document.getElementById("progress");
    if (!bar) return;
    var links = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
    var secs = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); }).filter(Boolean);
    function onScroll() {
      var st = window.scrollY || document.documentElement.scrollTop;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var pct = h > 0 ? (st / h) : 0;
      /* Progress from the article's actual position in the viewport: the
         old window-only calculation stays at 0 / is covered in an app
         shell, so take the max of the two. */
      var root = document.getElementById("artRoot");
      if (root) {
        var r = root.getBoundingClientRect();
        var total = r.height - window.innerHeight;
        var artPct = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : (r.top <= 0 ? 1 : 0);
        pct = Math.max(pct, artPct);
      }
      var w = (pct * 100) + "%";
      bar.style.width = w;
      var fill = document.getElementById("artProgressFill");
      if (fill) fill.style.width = w;
      var cur = secs[0];
      secs.forEach(function (s) { if (s.getBoundingClientRect().top <= 120) cur = s; });
      links.forEach(function (a) {
        var on = cur && a.getAttribute("href") === "#" + cur.id;
        a.classList.toggle("active", !!on);
        if (on) a.scrollIntoView({ block: "nearest" });
      });
    }
    function scrollToTop() {
      var st = window.scrollY || document.documentElement.scrollTop;
      window.scrollTo({ top: 0, behavior: st > 600 ? "smooth" : "auto" });
    }
    if (!spyInit) {
      window.addEventListener("scroll", onScroll, { passive: true });
      var top = document.getElementById("toTop");
      if (top) top.addEventListener("click", scrollToTop);
      spyInit = true;
    }
    onScroll();
  }

  /* ---------- boot ---------- */
  if (document.getElementById("view-main")) renderViewPage();
  else {
    applyHomepageOverrides();
    applyDetailOverride();
    if (document.getElementById("pagination")) applyPagination();
  }
  if (document.getElementById("progress")) initScrollspy();
  var topBtn = document.getElementById("toTop");
  if (topBtn && !spyInit) topBtn.addEventListener("click", function () {
    var st = window.scrollY || document.documentElement.scrollTop;
    window.scrollTo({ top: 0, behavior: st > 600 ? "smooth" : "auto" });
  });

  /* Test hook (no-op in browsers): lets `node --check`-style tests require
     the pure functions without a DOM. */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { mdToHtml: mdToHtml, toMarkdown: toMarkdown,
      loadOverrides: loadOverrides, saveOverrides: saveOverrides,
      getAllArticles: getAllArticles, getArticle: getArticle };
  }
})();

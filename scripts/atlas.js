/* Atlas client runtime — port of the Space Atlas v10 build.
 *
 * The generated pages are the v10 single-page app: the same CSS, the
 * same markup, the same render logic as the Space. Articles are baked
 * into each page as JSON (#atlas-data); covers and body images are
 * local files under /assets/images/ (no base64, no Google Fonts).
 *
 * Pages:
 *   index.html           home SPA (hash routing #/ and #/a/<id>)
 *   articles/<id>.html   static detail page (renders that article)
 *   articles/view.html   viewer for browser-added articles (?id=)
 *
 * Add / Edit / Delete live in localStorage under "atlas_overrides"
 * and are applied on top of the built-in articles. Nothing leaves
 * the browser on its own. atlasExportChanges() (console-only) downloads
 * the changed Markdown files, which then go into articles/, are
 * rebuilt and pushed to GitHub.
 */
(function () {
  "use strict";

  /* ---------- data (baked in by scripts/build.py) ---------- */
  var DATA = null;
  try {
    var el = document.getElementById("atlas-data");
    DATA = el ? JSON.parse(el.textContent) : { articles: [], covers: {}, bodyimgs: {}, captions: {} };
  } catch (e) { DATA = { articles: [], covers: {}, bodyimgs: {}, captions: {} }; }
  var ARTICLES = DATA.articles || [];
  var COVERS = DATA.covers || {};       // id -> "/assets/images/<cover file>"
  var BODYIMGS = DATA.bodyimgs || {};   // id -> ["/assets/images/<file>", ...]
  var CAPTIONS = DATA.captions || {};   // id -> cover caption
  var CATORDER = [];
  ARTICLES.forEach(function (a) { if (CATORDER.indexOf(a.category) < 0) CATORDER.push(a.category); });

  var app = document.getElementById('app');
  var progressEl = document.getElementById('progress');
  var toTop = document.getElementById('toTop');
  var scrollCtx = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function byId(id) { for (var i = 0; i < ARTICLES.length; i++) if (ARTICLES[i].id === id) return ARTICLES[i]; return null; }
  function fmtDate(iso) { var d = new Date(String(iso).slice(0, 10) + 'T00:00:00'); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }); }
  function stripHtml(html) { var d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; }
  function siteFooter() {
    return '<footer class="site-foot"><div class="site-foot-in">'
      + '<p class="site-foot-copy">© 2026 Atlas · Paul Mack</p>'
      + '<nav class="site-foot-links" aria-label="其他站点">'
      + '<a href="https://github.com/furlenmick/atlas" target="_blank" rel="noopener noreferrer">GitHub</a>'
      + '<span class="site-foot-sep" aria-hidden="true">·</span>'
      + '<a href="https://yanchs.com" target="_blank" rel="noopener noreferrer">Lather &amp; Lore</a>'
      + '</nav>'
      + '</div></footer>';
  }
  function pageScroller(from) {
    var el = from || document.querySelector('[data-hatch-space-root]') || document.body;
    while (el && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight + 1) {
        var oy = getComputedStyle(el).overflowY;
        if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') return el;
      }
      el = el.parentElement;
    }
    return document.documentElement;
  }

  /* ------------------------------- Home ------------------------------- */
  var homeState = { q: '', cat: null, page: 1 };
  var PAGE_SIZE = 20;
  var homeTimer = null;

  function articleMatches(a, q) {
    var hay = (a.title + ' ' + a.summary + ' ' + a.category + ' ' + a.tags.join(' ') + ' ' + (a._text || '')).toLowerCase();
    return hay.indexOf(q) >= 0;
  }
  function renderHome() {
    scrollCtx = null;
    var html = '<div class="home-top"><div class="home-hero" id="homeHero"><h1>Atlas</h1><p class="tagline">我的个人知识库 — 流程、工具和踩过的坑，都沉淀在这里。</p><div class="rule" aria-hidden="true"></div></div></div>'
      + '<header class="home-head"><div class="home-head-in"><div class="search-row">'
      + '<div class="search-wrap"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>'
      + '<label class="sr" for="kb-search" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">搜索知识库</label>'
      + '<input id="kb-search" type="search" placeholder="搜关键词：流程、工具、踩过的坑…" autocomplete="off" value="' + esc(homeState.q) + '" /></div>'
      + '<div class="home-actions"><button type="button" class="btn btn-primary" id="addBtn">＋ 新增文章</button>'
      + '<span id="atlasPending" class="pending-note" hidden></span></div>'
      + '</div></div></header>'
      + '<main class="home-main" id="homeMain"></main>'
      + siteFooter();
    app.innerHTML = html;
    var inp = document.getElementById('kb-search');
    inp.addEventListener('input', function () {
      var v = inp.value;
      clearTimeout(homeTimer);
      homeTimer = setTimeout(function () { homeState.q = v.trim(); homeState.page = 1; updateHomeMain(false); }, 250);
    });
    document.getElementById('addBtn').addEventListener('click', function () { openEditor(null); });
    updatePendingBadge();
    updateHomeMain(true);
    resetScroll();
  }
  function updateHomeMain(scrollList) {
    var main = document.getElementById('homeMain');
    if (!main) return;
    var q = homeState.q.toLowerCase();
    var filtering = q !== '' || homeState.cat !== null;
    var heroEl = document.getElementById('homeHero');
    if (heroEl) heroEl.style.display = filtering ? 'none' : '';
    var total = ARTICLES.length;
    var pinned = ARTICLES.filter(function (a) { return a.pinned; });
    var html = '';
    if (!filtering) {
      html += '<p class="overview-line">共 ' + total + ' 篇 · ' + CATORDER.length + ' 个分类 · 搜标题、摘要、标签和正文都能找到</p>';
      html += '<section aria-label="按分类浏览" style="margin-top:0"><div class="cat-grid">' + CATORDER.map(function (c) {
        var list = ARTICLES.filter(function (a) { return a.category === c; });
        var latest = list[0];
        return '<button type="button" class="cat-card" data-cat="' + esc(c) + '"><span class="row"><span class="name">' + esc(c) + '</span><span class="cnt">' + list.length + ' 篇</span></span>'
          + (latest ? '<span class="latest">最新：' + esc(latest.title) + '</span>' : '') + '</button>';
      }).join('') + '</div></section>';
      if (pinned.length) {
        html += '<section class="pinned-sec" aria-label="置顶推荐"><h2 class="sec-h"><span class="dash" aria-hidden="true"></span>置顶推荐</h2><div class="pin-grid">'
          + pinned.map(function (a) {
            return '<button type="button" class="pin-card" data-open="' + a.id + '"><span class="cat">' + esc(a.category) + '</span>'
              + '<span class="ttl">' + esc(a.title) + '</span>'
              + (a.summary ? '<span class="sum">' + esc(a.summary) + '</span>' : '')
              + '<span class="date">更新于 ' + fmtDate(a.updated) + '</span></button>';
          }).join('') + '</div></section>';
      }
    }
    var list = ARTICLES.filter(function (a) {
      if (homeState.cat && a.category !== homeState.cat) return false;
      if (q && !articleMatches(a, q)) return false;
      return true;
    });
    var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (homeState.page > totalPages) homeState.page = totalPages;
    if (homeState.page < 1) homeState.page = 1;
    var pageList = list.slice((homeState.page - 1) * PAGE_SIZE, homeState.page * PAGE_SIZE);
    var listTitle = q ? '搜索「' + esc(homeState.q) + '」' : (homeState.cat ? esc(homeState.cat) : '');
    html += '<div class="list-anchor" id="listAnchor"><div class="list-head">'
      + (listTitle ? '<h2>' + listTitle + '</h2>' : '')
      + '<span class="cnt">' + list.length + ' 篇</span>'
      + (filtering ? '<button type="button" class="clear-btn" id="clearFilter">清除筛选</button>' : '') + '</div>';
    html += '<nav class="chips" aria-label="按分类检索">'
      + '<button type="button" class="chip' + (homeState.cat === null ? ' on' : '') + '" data-chip="">全部' + (total > 0 ? ' · ' + total : '') + '</button>'
      + CATORDER.map(function (c) {
        var n = ARTICLES.filter(function (a) { return a.category === c; }).length;
        return '<button type="button" class="chip' + (homeState.cat === c ? ' on' : '') + '" data-chip="' + esc(c) + '">' + esc(c) + ' · ' + n + '</button>';
      }).join('') + '</nav>';
    if (!list.length) {
      html += '<div class="state-msg"><p class="big">这一格是空的</p><p class="small">没有匹配的文章，换个关键词或分类试试。</p></div>';
    } else {
      html += '<ul class="alist">' + pageList.map(function (a) {
        return '<li><button type="button" class="acard" data-open="' + a.id + '"><span class="top"><span class="cat">' + esc(a.category) + '</span>'
          + (a.pinned ? '<span class="pin">置顶</span>' : '')
          + '<span class="date">' + fmtDate(a.updated) + '</span></span>'
          + '<h3>' + esc(a.title) + '</h3>'
          + (a.summary ? '<p class="sum">' + esc(a.summary) + '</p>' : '')
          + (a.tags.length ? '<p class="tags">' + a.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</p>' : '')
          + '</button></li>';
      }).join('') + '</ul>';
      if (totalPages > 1) {
        var pageNums = [];
        for (var pi = 1; pi <= totalPages; pi++) {
          if (pi === 1 || pi === totalPages || Math.abs(pi - homeState.page) <= 1) pageNums.push(pi);
          else if (pageNums[pageNums.length - 1] !== 0) pageNums.push(0);
        }
        html += '<nav class="pager" aria-label="文章分页">'
          + '<button type="button" class="pg-btn" data-page="' + (homeState.page - 1) + '"' + (homeState.page <= 1 ? ' disabled' : '') + '>上一页</button>'
          + pageNums.map(function (n) {
            if (n === 0) return '<span class="pg-info" aria-hidden="true">…</span>';
            return '<button type="button" class="pg-btn' + (n === homeState.page ? ' on' : '') + '" data-page="' + n + '"' + (n === homeState.page ? ' aria-current="page"' : '') + '>' + n + '</button>';
          }).join('')
          + '<button type="button" class="pg-btn" data-page="' + (homeState.page + 1) + '"' + (homeState.page >= totalPages ? ' disabled' : '') + '>下一页</button>'
          + '<span class="pg-info">第 ' + homeState.page + ' / ' + totalPages + ' 页</span>'
          + '</nav>';
      }
    }
    html += '</div>';
    main.innerHTML = html;
    Array.prototype.forEach.call(main.querySelectorAll('[data-open]'), function (b) {
      b.addEventListener('click', function () { openArticle(parseInt(b.getAttribute('data-open'), 10)); });
    });
    Array.prototype.forEach.call(main.querySelectorAll('[data-cat]'), function (b) {
      b.addEventListener('click', function () { pickCategory(b.getAttribute('data-cat')); });
    });
    Array.prototype.forEach.call(main.querySelectorAll('[data-chip]'), function (b) {
      b.addEventListener('click', function () { var v = b.getAttribute('data-chip'); homeState.cat = v ? v : null; homeState.page = 1; updateHomeMain(false); });
    });
    Array.prototype.forEach.call(main.querySelectorAll('[data-page]'), function (b) {
      b.addEventListener('click', function () { homeState.page = parseInt(b.getAttribute('data-page'), 10); updateHomeMain(true); });
    });
    var cf = document.getElementById('clearFilter');
    if (cf) cf.addEventListener('click', function () {
      homeState.q = ''; homeState.cat = null; homeState.page = 1;
      var inp = document.getElementById('kb-search'); if (inp) inp.value = '';
      updateHomeMain(false);
    });
    if (scrollList) {
      var anchor = document.getElementById('listAnchor');
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onScroll(null);
  }
  function pickCategory(name) {
    homeState.cat = name;
    homeState.page = 1;
    updateHomeMain(false);
    var anchor = document.getElementById('listAnchor');
    if (anchor) requestAnimationFrame(function () { anchor.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }

  /* ------------------------------- Article body transforms ----------------
     The stored bodies are plain rendered markdown; the original knowledge
     base renders the same markdown through component rules (numbered point
     cards, layer card grids, check lists, gate cards, trio cells, step
     pills, the bill card, example cards). These transforms re-apply those
     exact rules to the stored HTML so the page matches the original. */
  var TAG_LINE = /^[A-Z0-9][A-Z0-9 ·-]*$/;
  function leadInfo(li) {
    // Returns {tag, leadEl, leadText} when the item opens with a bold lead
    // followed by a colon, honouring an ALL-CAPS eyebrow line above it.
    var nodes = Array.prototype.slice.call(li.childNodes);
    var i = 0;
    while (i < nodes.length && nodes[i].nodeType === 3 && nodes[i].textContent.trim() === '') i++;
    var tag = '';
    if (i < nodes.length && nodes[i].nodeType === 3 && TAG_LINE.test(nodes[i].textContent.trim())) {
      var j = i + 1;
      if (j < nodes.length && nodes[j].nodeName === 'BR') {
        var k = j + 1;
        while (k < nodes.length && nodes[k].nodeType === 3 && nodes[k].textContent.trim() === '') k++;
        if (k < nodes.length && nodes[k].nodeName === 'STRONG') { tag = nodes[i].textContent.trim(); i = k; }
      }
    }
    if (i < nodes.length && nodes[i].nodeName === 'STRONG') {
      var strong = nodes[i];
      var after = nodes[i + 1];
      if (after && after.nodeType === 3 && /^\s*[：:]/.test(after.textContent)) {
        return { tag: tag, leadEl: strong, leadText: strong.textContent.trim() };
      }
    }
    return null;
  }
  function restructureLead(li, info) {
    var strong = info.leadEl;
    var rest = document.createElement('span'); rest.className = 'kb-rest';
    var node = strong.nextSibling;
    var first = true;
    while (node) {
      var next = node.nextSibling;
      if (first && node.nodeType === 3) { node.textContent = node.textContent.replace(/^\s*[：:]\s*/, ''); }
      first = false;
      rest.appendChild(node);
      node = next;
    }
    // Drop the eyebrow line nodes (text + <br>) that preceded the lead.
    while (li.firstChild && li.firstChild !== strong) li.removeChild(li.firstChild);
    li.removeChild(strong);
    var lead = document.createElement('strong'); lead.className = 'kb-lead'; lead.textContent = info.leadText;
    if (info.tag) { var tg = document.createElement('span'); tg.className = 'kb-tag'; tg.textContent = info.tag; li.appendChild(tg); }
    li.appendChild(lead);
    li.appendChild(rest);
  }
  function classifyList(list, inExample) {
    var items = Array.prototype.slice.call(list.children).filter(function (el) { return el.nodeName === 'LI'; });
    if (!items.length) return;
    var ordered = list.nodeName === 'OL';
    var flat = items.every(function (li) { return !li.querySelector('ul,ol'); });
    var infos = items.map(leadInfo);
    var allLead = flat && infos.every(function (x) { return !!x; });
    var allGates = allLead && infos.every(function (x) { return /检查$/.test(x.leadText); });
    var allShortLeads = allLead && infos.every(function (x) { return x.leadText.length <= 4; });
    var allShortPlain = flat && items.length >= 3 && items.every(function (li) {
      return !li.querySelector('strong,b,a,code') && (li.textContent || '').trim().length <= 42;
    });
    var variant = null;
    if (inExample) variant = ordered ? 'flow' : null;
    else if (ordered && allLead) variant = 'points';
    else if (ordered) variant = 'flow';
    else if (!ordered && allGates) variant = 'gates';
    else if (!ordered && items.length === 3 && allShortLeads) variant = 'trio';
    else if (!ordered && allLead && items.length <= 6) variant = 'cards';
    else if (!ordered && allShortPlain) variant = 'checks';
    if (!variant) return;
    list.classList.add('kb-' + variant);
    if (variant === 'cards') list.setAttribute('data-count', String(Math.min(items.length, 4)));
    if (variant === 'points' || variant === 'cards' || variant === 'trio' || variant === 'gates') {
      items.forEach(function (li, i) { restructureLead(li, infos[i]); });
    }
    if (variant === 'checks') {
      items.forEach(function (li) {
        var box = document.createElement('span'); box.className = 'kb-box'; box.setAttribute('aria-hidden', 'true');
        box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>';
        li.insertBefore(box, li.firstChild);
      });
    }
  }
  function transformBody(root, article) {
    // Section number badges come from the CSS counter in the original.
    Array.prototype.forEach.call(root.querySelectorAll('h2 .sec-num'), function (s) { s.remove(); });
    // Tables: phone layout labels from the header row.
    Array.prototype.forEach.call(root.querySelectorAll('table'), function (t) {
      var heads = Array.prototype.map.call(t.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
      Array.prototype.forEach.call(t.querySelectorAll('tbody tr'), function (tr) {
        Array.prototype.forEach.call(tr.children, function (td, ci) {
          if (ci > 0 && heads[ci]) td.setAttribute('data-k', heads[ci]);
        });
      });
    });
    // ```bill fence → the cost-comparison card.
    Array.prototype.forEach.call(root.querySelectorAll('pre'), function (pre) {
      var code = pre.querySelector('code.language-bill');
      if (!code) return;
      var rows = code.textContent.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      if (rows.length < 5) return;
      var lp = rows[2].split('|').map(function (s) { return s.trim(); });
      var rp = rows[4].split('|').map(function (s) { return s.trim(); });
      if (lp.length < 3 || rp.length < 3) return;
      function side(cells, cheap) {
        return '<div class="kb-bill-side' + (cheap ? ' kb-cheap' : '') + '"><div class="kb-bill-who">' + esc(cells[0]) + '</div><div class="kb-bill-amt">' + esc(cells[1]) + '</div><div class="kb-bill-per">' + esc(cells[2]) + '</div></div>';
      }
      var day = rows[5] ? '<p class="kb-bill-day">' + esc(rows[5]).replace(/\$[\d.]+/g, function (m) { return '<b>' + m + '</b>'; }) + '</p>' : '';
      var div = document.createElement('div'); div.className = 'kb-bill';
      div.innerHTML = '<h4>' + esc(rows[0]) + '</h4><p class="kb-bill-sub">' + esc(rows[1]) + '</p><div class="kb-bill-vs">' + side(lp, false) + '<div class="kb-bill-mid">' + esc(rows[3]) + '</div>' + side(rp, true) + '</div>' + day;
      pre.replaceWith(div);
    });
    // Image placeholders → the original's real figures. A （上）/（下）
    // pair renders side by side, like the original's shot row.
    var imgs = BODYIMGS[article.id] || [];
    var notes = Array.prototype.slice.call(root.querySelectorAll('.img-note'));
    var made = notes.map(function (note, i) {
      var cap = (note.textContent || '').replace(/^🖼\s*配图：/, '').replace(/（原图随知识库保存，此线上版以文字标注位置）\s*$/, '').trim();
      if (!imgs[i]) {
        var miss = document.createElement('span'); miss.className = 'kb-img-missing'; miss.textContent = '图片未收录：' + cap;
        return { node: miss, cap: cap };
      }
      var fig = document.createElement('figure');
      var im = document.createElement('img'); im.src = imgs[i]; im.alt = cap; im.loading = 'lazy';
      fig.appendChild(im);
      if (cap) { var fc = document.createElement('figcaption'); fc.textContent = cap; fig.appendChild(fc); }
      return { node: fig, cap: cap };
    });
    for (var i = 0; i < notes.length; i++) {
      if (/（上）$/.test(made[i].cap) && i + 1 < notes.length && /（下）$/.test(made[i + 1].cap)) {
        var row = document.createElement('div'); row.className = 'kb-shot-row';
        row.appendChild(made[i].node); row.appendChild(made[i + 1].node);
        notes[i].replaceWith(row);
        notes[i + 1].remove();
        i++;
      } else {
        notes[i].replaceWith(made[i].node);
      }
    }
    // Example cards: an h3 opening with 例子 N wraps the blocks that
    // follow it, until the next heading or a figure.
    var kids = Array.prototype.slice.call(root.childNodes);
    var group = null;
    function flush() { group = null; }
    kids.forEach(function (node) {
      if (node.nodeType !== 1) { if (group) group.appendChild(node); return; }
      var name = node.nodeName;
      if (name === 'H3' && /^例子\s*\d/.test(node.textContent.trim())) {
        var box = document.createElement('div'); box.className = 'kb-example';
        root.insertBefore(box, node);
        box.appendChild(node);
        group = box;
        return;
      }
      if (name === 'H1' || name === 'H2' || name === 'H3' || name === 'FIGURE' || node.classList.contains('kb-shot-row')) { flush(); return; }
      if (group) group.appendChild(node);
    });
    // Component lists.
    Array.prototype.slice.call(root.querySelectorAll('ol,ul')).forEach(function (list) {
      if (list.parentElement && list.parentElement.closest('li')) return;
      classifyList(list, !!list.closest('.kb-example'));
    });
    // "A → B → C" paragraphs → step pills, final step highlighted.
    Array.prototype.slice.call(root.childNodes).forEach(function (node) {
      if (node.nodeType !== 1 || node.nodeName !== 'P') return;
      if (node.querySelector('*')) return;
      var segs = (node.textContent || '').split('→').map(function (s) { return s.trim().replace(/。$/, ''); });
      if (segs.length >= 3 && segs.length <= 7 && segs.every(function (s) { return s.length > 0 && s.length <= 10; })) {
        var div = document.createElement('div'); div.className = 'kb-steps';
        segs.forEach(function (s, si) {
          if (si > 0) { var ar = document.createElement('span'); ar.className = 'kb-arr'; ar.setAttribute('aria-hidden', 'true'); ar.textContent = '→'; div.appendChild(ar); }
          var sp = document.createElement('span'); sp.className = 'kb-step' + (si === segs.length - 1 ? ' kb-hot' : ''); sp.textContent = s; div.appendChild(sp);
        });
        node.replaceWith(div);
      }
    });
  }

  /* ------------------------------- Article ------------------------------- */
  function renderArticle(id) {
    var a = byId(id);
    if (!a) { goHome(); return; }
    var idx = ARTICLES.indexOf(a);
    var prev = ARTICLES[idx - 1], next = ARTICLES[idx + 1];
    var chars = stripHtml(a.html).replace(/\s/g, '').length;
    var minutes = Math.max(1, Math.round(chars / 450));
    var kickerParts = [esc(a.category)];
    if (a.pinned) kickerParts.push('置顶');
    a.tags.slice(0, 2).forEach(function (t) { kickerParts.push(esc(t)); });
    var tocBtns = function (chips) {
      return a.toc.map(function (h) {
        return '<li' + (h.level === 3 ? ' class="sub"' : '') + '><button type="button" data-sec="' + h.n + '"' + (h.level === 3 && !chips ? ' class="sub"' : '') + '><span class="n">' + String(h.n).padStart(2, '0') + '</span>' + esc(h.label) + '</button></li>';
      }).join('');
    };
    // Cover: local file from COVERS (every built-in article has one).
    // Added/edited articles keep the built-in cover via cover_key.
    var coverUrl = COVERS[a.id] || '';
    var coverFig = coverUrl
      ? '<figure class="cover-fig"><img src="' + coverUrl + '" alt="《' + esc(a.title) + '》头图" /><figcaption>' + esc(CAPTIONS[a.id] || '') + '</figcaption></figure>'
      : '';
    var html = '<div id="artRoot">'
      + '<header class="art-head"><div class="art-progress" aria-hidden="true"><div class="art-progress-fill" id="artProgressFill"></div></div><div class="art-head-in"><button type="button" class="back-btn" id="backBtn">← 返回</button>'
      + '<span class="crumb">' + esc(a.category) + ' · ' + esc(a.title) + '</span>'
      + '<span class="art-actions"><button type="button" class="btn" id="editBtn">编辑</button>'
      + '<button type="button" class="btn btn-danger" id="delBtn">删除</button></span></div></header>'
      + '<main class="art-main">'
      + '<header class="art-hero"><div class="kicker">' + kickerParts.join('<span class="dot" aria-hidden="true"></span>') + '</div>'
      + '<h1 class="art-title">' + esc(a.title) + '</h1>'
      + (a.summary ? '<p class="art-summary">' + esc(a.summary) + '</p>' : '')
      + (a.tags.length ? '<p style="margin:0"><span class="tag-pill">' + a.tags.map(function (t, i) { return (i > 0 ? '<span class="sep" aria-hidden="true">·</span>' : '') + '<span class="tg">' + esc(t) + '</span>'; }).join('') + '</span></p>' : '')
      + '<div class="art-meta"><span>更新于 ' + fmtDate(a.updated) + '</span><span>全文约 ' + chars.toLocaleString() + ' 字 · 阅读约 ' + minutes + ' 分钟</span></div>'
      + coverFig
      + '</header>'
      + '<div class="art-grid' + (a.toc.length >= 2 ? ' has-toc' : '') + '">'
      + (a.toc.length >= 2 ? '<aside class="toc-side"><nav aria-label="本篇目录"><p class="toc-title">目录</p><ol class="toc-list" id="tocList">' + tocBtns(false) + '</ol></nav></aside>' : '')
      + '<div style="min-width:0">'
      + (a.toc.length >= 2 ? '<nav class="toc-chips" aria-label="本篇目录"><ol>' + tocBtns(true) + '</ol></nav>' : '')
      + '<div class="md-body" id="mdBody">' + a.html + '</div>'
      + (a.source ? '<footer class="src-foot"><p>来源与整理说明：' + esc(a.source.replace(/^来源：/, '')) + '</p></footer>' : '')
      + ((prev || next) ? '<nav class="prevnext" aria-label="上一篇与下一篇">'
        + (prev ? '<button type="button" class="pn-btn" data-open="' + prev.id + '"><span class="dir">← 上一篇</span><span class="t">' + esc(prev.title) + '</span></button>' : '<span class="pn-empty"></span>')
        + (next ? '<button type="button" class="pn-btn pn-next" data-open="' + next.id + '"><span class="dir">下一篇 →</span><span class="t">' + esc(next.title) + '</span></button>' : '')
        + '</nav>' : '')
      + '</div></div></main>'
      + siteFooter()
      + '</div>';
    app.innerHTML = html;
    document.getElementById('backBtn').addEventListener('click', function () { goHome(); });
    document.getElementById('editBtn').addEventListener('click', function () { openEditor(a); });
    document.getElementById('delBtn').addEventListener('click', function () { askDelete(a); });
    Array.prototype.forEach.call(app.querySelectorAll('[data-open]'), function (b) {
      b.addEventListener('click', function () { openArticle(parseInt(b.getAttribute('data-open'), 10)); });
    });
    var body = document.getElementById('mdBody');
    transformBody(body, a);
    var tocList = document.getElementById('tocList');
    var btns = Array.prototype.slice.call(app.querySelectorAll('[data-sec]'));
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var t = document.getElementById('sec-' + b.getAttribute('data-sec'));
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    scrollCtx = {
      root: document.getElementById('artRoot'), tocList: tocList, btns: btns,
      heads: a.toc.map(function (h) { return { n: h.n, el: document.getElementById('sec-' + h.n) }; }).filter(function (x) { return x.el; }),
      scroller: null, active: -1
    };
    resetScroll();
    onScroll(null);
  }
  function resetScroll() {
    pageScroller(null).scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    if (scrollCtx) scrollCtx.scroller = null;
  }
  function setActive(n) {
    if (!scrollCtx || scrollCtx.active === n) return;
    scrollCtx.active = n;
    scrollCtx.btns.forEach(function (b) {
      var on = parseInt(b.getAttribute('data-sec'), 10) === n;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    var list = scrollCtx.tocList;
    if (list) {
      var active = list.querySelector('[aria-current="true"]');
      if (active) {
        var margin = 10;
        var top = active.offsetTop, bottom = top + active.offsetHeight;
        if (top < list.scrollTop + margin) list.scrollTop = Math.max(0, top - margin);
        else if (bottom > list.scrollTop + list.clientHeight - margin) list.scrollTop = bottom - list.clientHeight + margin;
      }
    }
  }
  function onScroll(e) {
    var el = null;
    if (scrollCtx) {
      var t = e ? e.target : null;
      if (t === document || t === document.documentElement) el = document.documentElement;
      else if (t instanceof HTMLElement && scrollCtx.root && t.contains(scrollCtx.root)) el = t;
      if (!el) el = scrollCtx.scroller || pageScroller(scrollCtx.root);
      if (el !== document.documentElement) scrollCtx.scroller = el;
    } else {
      el = pageScroller(null);
    }
    var max = el.scrollHeight - el.clientHeight;
    var p = max > 0 ? Math.min(1, el.scrollTop / max) : 0;
    var scrolledPx = el.scrollTop;
    if (scrollCtx && scrollCtx.root) {
      // Rect-based progress: derived from where the article actually sits in
      // the viewport, so it stays correct whichever element (window, shell
      // wrapper, nested scroller) is doing the scrolling — the scroller guess
      // above can silently stay at 0 in shells whose scroller is not the
      // document, which made the bar look gone.
      var rect = scrollCtx.root.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var total = scrollCtx.root.offsetHeight - vh;
      if (total > 0) {
        var rp = Math.min(1, Math.max(0, -rect.top / total));
        if (rp > p) p = rp;
      }
      if (-rect.top > scrolledPx) scrolledPx = -rect.top;
    }
    progressEl.style.width = (p * 100) + '%';
    var fill = document.getElementById('artProgressFill');
    if (fill) fill.style.width = (p * 100) + '%';
    toTop.classList.toggle('show', scrolledPx > 600);
    if (scrollCtx && scrollCtx.heads.length) {
      var cur = -1;
      for (var i = 0; i < scrollCtx.heads.length; i++) {
        if (scrollCtx.heads[i].el.getBoundingClientRect().top <= 120) cur = scrollCtx.heads[i].n;
      }
      setActive(cur);
    }
  }
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  window.addEventListener('resize', function () { onScroll(null); });
  toTop.addEventListener('click', function () {
    var el = (scrollCtx && scrollCtx.scroller) || pageScroller(scrollCtx ? scrollCtx.root : null);
    el.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------------- Atlas sync: add / edit / delete ----------------
     Browser-side changes live in localStorage under "atlas_overrides"
     ({v:1, added:[...], edited:{id:...}, deleted:[id...]}) applied on
     top of the built-in articles. Nothing reaches GitHub until the
     changed Markdown files are exported (atlasExportChanges, console),
     dropped into articles/, rebuilt and pushed. Native dialog calls do
     not exist in this shell, so validation uses a toast and deletion an
     in-page dialog. */
  var OVERRIDE_KEY = 'atlas_overrides';
  var BUILTIN = ARTICLES.slice();
  function loadOverrides() {
    try {
      var o = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || 'null');
      if (o && Object.prototype.toString.call(o.added) === '[object Array]' && o.edited && Object.prototype.toString.call(o.deleted) === '[object Array]') return o;
    } catch (e) {}
    return { v: 1, added: [], edited: {}, deleted: [] };
  }
  function saveOverrides(o) {
    try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o)); }
    catch (e) { toast('保存失败：这台浏览器的本地存储不可用。'); }
  }
  function pendingCount() {
    var o = loadOverrides();
    return o.added.length + Object.keys(o.edited).length + o.deleted.length;
  }
  function builtinById(id) {
    for (var i = 0; i < BUILTIN.length; i++) if (BUILTIN[i].id === id) return BUILTIN[i];
    return null;
  }
  function refreshCatOrder() {
    var order = [];
    ARTICLES.forEach(function (a) { if (order.indexOf(a.category) < 0) order.push(a.category); });
    CATORDER.length = 0;
    order.forEach(function (c) { CATORDER.push(c); });
  }
  function effectiveArticle(stored) {
    var base = builtinById(stored.id);
    var r = mdRender(stored.body || '');
    return {
      id: stored.id, title: stored.title, category: stored.category,
      tags: stored.tags || [], pinned: !!stored.pinned,
      summary: stored.summary || '', source: stored.source || (base ? base.source : ''),
      updated: String(stored.updated_at || '').slice(0, 10) || (base ? base.updated : ''),
      toc: r.toc, html: r.html, body: stored.body || '',
      file: stored.file || (base ? base.file : ''), cover_key: stored.cover_key || (base ? base.cover_key : '')
    };
  }
  function rebuildArticles() {
    var o = loadOverrides();
    var list = [];
    BUILTIN.forEach(function (a) {
      if (o.deleted.indexOf(a.id) >= 0) return;
      list.push(o.edited[a.id] ? effectiveArticle(o.edited[a.id]) : a);
    });
    o.added.forEach(function (a) {
      if (o.deleted.indexOf(a.id) >= 0) return;
      list.push(effectiveArticle(a));
    });
    list.sort(function (x, y) { return x.id - y.id; });
    ARTICLES.length = 0;
    list.forEach(function (a) { a._text = stripHtml(a.html); ARTICLES.push(a); });
    refreshCatOrder();
  }
  function updatePendingBadge() {
    var el = document.getElementById('atlasPending');
    if (!el) return;
    var n = pendingCount();
    el.hidden = n === 0;
    el.textContent = n ? ('本地有 ' + n + ' 处改动') : '';
  }
  /* Small Markdown -> {html, toc} renderer for added/edited articles.
     Mirrors scripts/build.py md_to_html, emitting this page's section
     markup: h2/h3 become sec-N anchors feeding the TOC, images become
     .img-note placeholders the body transform swaps for real figures,
     and ```bill fences stay language-bill blocks for the bill card. */
  function inlineMd(s) {
    s = esc(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return s;
  }
  function mdRender(body) {
    var lines = String(body || '').split('\n'), out = [], toc = [], i = 0, secN = 0;
    function isTableSep(l) { return /^\s*\|[\s:|-]+\|\s*$/.test(l); }
    while (i < lines.length) {
      var line = lines[i];
      var fm = line.match(/^```(\w*)$/);
      if (fm) {
        var lang = fm[1];
        var buf = []; i++;
        while (i < lines.length && !/^```\w*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre><code' + (lang ? ' class="language-' + esc(lang) + '"' : '') + '>' + esc(buf.join('\n')) + '\n</code></pre>');
        continue;
      }
      if (line.trim().indexOf('|') === 0 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        var header = line.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
        i += 2; var rows = [];
        while (i < lines.length && lines[i].trim().indexOf('|') === 0) {
          rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); })); i++;
        }
        var th = '<table><thead><tr>' + header.map(function (c) { return '<th>' + inlineMd(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        rows.forEach(function (r) { th += '<tr>' + r.map(function (c) { return '<td>' + inlineMd(c) + '</td>'; }).join('') + '</tr>'; });
        out.push(th + '</tbody></table>');
        continue;
      }
      var hm = line.match(/^(#{1,4})\s+(.*)$/);
      if (hm) {
        var level = hm[1].length, raw = hm[2];
        var tm = raw.match(/<!--\s*toc:\s*(.*?)\s*-->/);
        var tocLabel = tm ? tm[1] : null;
        raw = raw.replace(/<!--.*?-->/g, '').trim();
        if (level === 1) { /* in-body title: the article header already shows it */ }
        else if (level === 2 || level === 3) {
          secN++;
          var label = tocLabel || raw.replace(/^\d+[\.\、\s]*/, '');
          toc.push({ title: raw, label: label, level: level, n: secN });
          out.push('<h' + level + ' id="sec-' + secN + '">' + inlineMd(raw) + '</h' + level + '>');
        } else {
          out.push('<h4>' + inlineMd(raw) + '</h4>');
        }
        i++; continue;
      }
      if (line.trim().indexOf('<!--') === 0) { i++; continue; }
      if (line.indexOf('>') === 0) {
        var bq = [];
        while (i < lines.length && lines[i].indexOf('>') === 0) { bq.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<blockquote><p>' + bq.map(inlineMd).join('<br />\n') + '</p></blockquote>');
        continue;
      }
      if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') { out.push('<hr />'); i++; continue; }
      var im = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
      if (im) {
        out.push('<div class="img-note">🖼 配图：' + esc(im[1]) + '（原图随知识库保存，此线上版以文字标注位置）</div>');
        i++; continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        var items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
        out.push('<ul>' + items.map(function (x) { return '<li>' + inlineMd(x) + '</li>'; }).join('') + '</ul>');
        continue;
      }
      if (/^\s*\d+[\.\)]\s+/.test(line)) {
        var oitems = [];
        while (i < lines.length && /^\s*\d+[\.\)]\s+/.test(lines[i])) { oitems.push(lines[i].replace(/^\s*\d+[\.\)]\s+/, '')); i++; }
        out.push('<ol>' + oitems.map(function (x) { return '<li>' + inlineMd(x) + '</li>'; }).join('') + '</ol>');
        continue;
      }
      if (!line.trim()) { i++; continue; }
      var para = [line]; i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*[-*]\s|\s*\d+[\.\)]\s+>|>|\|)/.test(lines[i]) && lines[i].trim().indexOf('<!--') !== 0) { para.push(lines[i]); i++; }
      out.push('<p>' + para.map(inlineMd).join(' ') + '</p>');
    }
    return { html: out.join('\n'), toc: toc };
  }
  /* Editor / confirm UI */
  var editingId = null;
  var modalEl = document.getElementById('atlasModal');
  var confirmEl = document.getElementById('atlasConfirmModal');
  var toastEl = document.getElementById('atlasToast');
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }
  function closeModals() { modalEl.hidden = true; confirmEl.hidden = true; }
  window.atlasCloseModal = function () {
    closeModals();
    var e = document.getElementById('atlas-export-modal');
    if (e) e.hidden = true;
  };
  [modalEl, confirmEl].forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m) m.hidden = true; });
  });
  function fillCategories(selected) {
    var sel = document.getElementById('edCategory');
    var cats = [];
    ARTICLES.forEach(function (a) { if (cats.indexOf(a.category) < 0) cats.push(a.category); });
    sel.innerHTML = cats.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === selected ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('') + '<option value="__new__">＋ 新分类…</option>';
    document.getElementById('edCategoryNewWrap').hidden = true;
  }
  document.getElementById('edCategory').addEventListener('change', function () {
    document.getElementById('edCategoryNewWrap').hidden = this.value !== '__new__';
  });
  function openEditor(article) {
    editingId = article ? article.id : null;
    document.getElementById('atlasModalTitle').textContent = article ? '编辑文章' : '新增文章';
    document.getElementById('edTitle').value = article ? article.title : '';
    fillCategories(article ? article.category : (CATORDER[0] || ''));
    document.getElementById('edTags').value = article ? (article.tags || []).join(', ') : '';
    document.getElementById('edSummary').value = article ? (article.summary || '') : '';
    document.getElementById('edPinned').checked = !!(article && article.pinned);
    document.getElementById('edBody').value = article ? (article.body || '') : '';
    modalEl.hidden = false;
    document.getElementById('edTitle').focus();
  }
  document.getElementById('edCancel').addEventListener('click', closeModals);
  document.getElementById('edSave').addEventListener('click', saveEditor);
  function nextAddedId() {
    var o = loadOverrides(), max = 1000;
    o.added.forEach(function (a) { if (a.id > max) max = a.id; });
    return max + 1;
  }
  function saveEditor() {
    var title = document.getElementById('edTitle').value.trim();
    if (!title) { toast('请先填写标题。'); return; }
    var catSel = document.getElementById('edCategory');
    var category = catSel.value === '__new__' ? document.getElementById('edCategoryNew').value.trim() : catSel.value;
    if (!category) { toast('请选择或填写分类。'); return; }
    var tags = document.getElementById('edTags').value.split(/[,，、]/).map(function (s) { return s.trim(); }).filter(Boolean);
    var fields = {
      title: title, category: category, tags: tags,
      summary: document.getElementById('edSummary').value.trim(),
      pinned: document.getElementById('edPinned').checked,
      body: document.getElementById('edBody').value,
      updated_at: new Date().toISOString()
    };
    var o = loadOverrides();
    if (editingId === null) {
      var a = { id: nextAddedId() };
      for (var k in fields) a[k] = fields[k];
      o.added.push(a);
      saveOverrides(o);
      closeModals();
      rebuildArticles();
      openArticle(a.id);
      toast('已新增，改动只存在这台浏览器。');
    } else {
      var orig = byId(editingId);
      var stored = { id: editingId, source: orig ? orig.source : '', file: orig ? orig.file : '', cover_key: orig ? orig.cover_key : '' };
      for (var k2 in fields) stored[k2] = fields[k2];
      var ai = -1;
      for (var j = 0; j < o.added.length; j++) if (o.added[j].id === editingId) ai = j;
      if (ai >= 0) o.added[ai] = stored; else o.edited[editingId] = stored;
      saveOverrides(o);
      closeModals();
      rebuildArticles();
      renderArticle(editingId);
      onScroll(null);
      toast('已保存到这台浏览器。');
    }
  }
  var pendingDelete = null;
  function askDelete(article) {
    pendingDelete = article;
    document.getElementById('confirmMsg').textContent = '确定删除「' + article.title + '」吗？删除先只在这台浏览器生效。';
    confirmEl.hidden = false;
  }
  document.getElementById('confirmNo').addEventListener('click', function () { confirmEl.hidden = true; pendingDelete = null; });
  document.getElementById('confirmYes').addEventListener('click', function () {
    if (!pendingDelete) return;
    var id = pendingDelete.id;
    pendingDelete = null;
    confirmEl.hidden = true;
    var o = loadOverrides();
    delete o.edited[id];
    o.added = o.added.filter(function (x) { return x.id !== id; });
    if (builtinById(id) && o.deleted.indexOf(id) < 0) o.deleted.push(id);
    saveOverrides(o);
    rebuildArticles();
    goHome();
    toast('已删除，改动只存在这台浏览器。');
  });

  /* ------------------------------- Router -------------------------------
     Navigation renders directly on click; the hash is only kept in sync
     for deep links and the back button. (Relying on hashchange alone left
     readers stuck on the homepage in shells that swallow hash changes.)
     On static detail pages (articles/<id>.html) and view.html there is no
     SPA: opening another article navigates to its static file, and going
     home navigates back to the index. */
  var navGuard = false;
  function setHash(h) {
    if (window.ATLAS_PAGE !== 'home') return;
    if (location.hash === h) return;
    navGuard = true;
    try { location.hash = h; } catch (e) {}
    setTimeout(function () { navGuard = false; }, 0);
  }
  function openArticle(id) {
    if (window.ATLAS_PAGE === 'home') {
      setHash('#/a/' + id);
      renderArticle(id);
      onScroll(null);
      return;
    }
    if (id < 1001) { location.href = id + '.html'; return; }
    if (window.ATLAS_PAGE === 'view') { renderArticle(id); onScroll(null); return; }
    location.href = 'view.html?id=' + id;
  }
  function goHome() {
    if (window.ATLAS_PAGE === 'home') {
      setHash('#/');
      renderHome();
      onScroll(null);
      return;
    }
    location.href = '../index.html';
  }
  function route() {
    var h = location.hash || '#/';
    var m = h.match(/^#\/a\/(\d+)/);
    if (m) renderArticle(parseInt(m[1], 10)); else renderHome();
    onScroll(null);
  }

  /* ------------------------- Export changes (console) -------------------------
     atlasExportChanges() downloads the changed Markdown files so they can
     be dropped into articles/, rebuilt and pushed. No visible button. */
  function slugify(title) {
    var s = String(title || 'article').replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
    return s ? s.slice(0, 40) : 'article';
  }
  function articleFilename(a) {
    if (a.file) return a.file;
    return a.id + '-' + slugify(a.title) + '.md';
  }
  function toMarkdown(a) {
    var tags = (a.tags || []).map(function (t) { return '"' + String(t).replace(/"/g, '') + '"'; }).join(', ');
    var fm = ['---', 'id: ' + a.id, 'title: "' + String(a.title || '').replace(/"/g, '') + '"',
      'category: "' + String(a.category || '').replace(/"/g, '') + '"',
      'tags: [' + tags + ']', 'pinned: ' + (a.pinned ? 'true' : 'false')];
    if (a.cover_key) fm.push('cover_key: "' + a.cover_key + '"');
    fm.push('summary: "' + String(a.summary || '').replace(/"/g, '') + '"');
    var src = a.source_note || a.source || '';
    if (src) fm.push('source_note: "' + String(src).replace(/"/g, '') + '"');
    fm.push('updated_at: ' + JSON.stringify(a.updated_at || (a.updated ? a.updated + 'T00:00:00.000Z' : new Date().toISOString())));
    fm.push('---', '');
    return fm.join('\n') + '\n' + (a.body || '');
  }
  function downloadBlob(filename, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  window.atlasExportChanges = function () {
    var o = loadOverrides();
    var changed = [];
    o.added.forEach(function (a) { changed.push({ kind: '新增', article: a }); });
    Object.keys(o.edited).forEach(function (id) { changed.push({ kind: '修改', article: o.edited[id] }); });
    var deleted = o.deleted.map(function (id) { var b = builtinById(id); return { id: id, title: b ? b.title : ('id ' + id), file: b ? b.file : null }; });
    if (!changed.length && !deleted.length) { toast('本地没有改动（localStorage 里没有新增/修改/删除）。'); return; }
    var div = document.getElementById('atlas-export-modal');
    if (!div) {
      div = document.createElement('div');
      div.id = 'atlas-export-modal'; div.className = 'modal'; div.hidden = true;
      document.body.appendChild(div);
    }
    var rows = changed.map(function (c, i) {
      return '<li>' + esc(c.kind) + '：' + esc(c.article.title) + ' — <a href="#" data-exp="' + i + '">下载 ' + esc(articleFilename(c.article)) + '</a></li>';
    }).join('');
    var delRows = deleted.map(function (d) {
      return '<li>删除：' + esc(d.title) + (d.file ? ' — 在 articles/ 里删掉 ' + esc(d.file) : '') + '</li>';
    }).join('');
    div.innerHTML = '<div class="modal-card"><h3>导出本地改动</h3>'
      + '<p>以下改动只存在本浏览器（localStorage），还没有同步到 GitHub：</p><ul>' + rows + delRows + '</ul>'
      + '<p><button class="btn btn-primary" id="exp-json">下载全部改动 (atlas-changes.json)</button> '
      + '<button class="btn" type="button" onclick="atlasCloseModal()">关闭</button></p>'
      + '<ol class="modal-note"><li>把上面下载的 Markdown 文件放进仓库的 articles/（新增放新文件，修改覆盖同名文件，删除的删掉对应文件）。</li>'
      + '<li>在仓库根目录跑 <code>python3 scripts/build.py</code> 重新生成 dist/。</li>'
      + '<li><code>git add -A && git commit -m "更新文章" && git push origin main</code>，其它主机 git pull 即可。</li></ol></div>';
    div.hidden = false;
    div.querySelectorAll('[data-exp]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var c = changed[parseInt(a.getAttribute('data-exp'), 10)];
        downloadBlob(articleFilename(c.article), toMarkdown(c.article), 'text/markdown;charset=utf-8');
      });
    });
    document.getElementById('exp-json').addEventListener('click', function () {
      downloadBlob('atlas-changes.json', JSON.stringify({
        exported_at: new Date().toISOString(),
        added: o.added, edited: o.edited, deleted: o.deleted
      }, null, 2), 'application/json;charset=utf-8');
    });
  };

  /* ------------------------------- Boot ------------------------------- */
  rebuildArticles();
  if (window.ATLAS_PAGE === 'detail') {
    renderArticle(window.ATLAS_STATIC_ID);
    onScroll(null);
  } else if (window.ATLAS_PAGE === 'view') {
    var vid = parseInt(new URLSearchParams(location.search).get('id') || '0', 10);
    if (!byId(vid)) {
      app.innerHTML = '<main class="art-main"><header class="art-hero"><h1 class="art-title">文章不存在</h1>'
        + '<p class="art-summary">这篇文章可能已被删除，或链接不正确。</p></header>'
        + '<p><a href="../index.html">← 返回 Atlas</a></p></main>' + siteFooter();
    } else {
      renderArticle(vid);
      onScroll(null);
    }
  } else {
    window.addEventListener('hashchange', function () { if (navGuard) return; route(); });
    route();
  }

  /* Test hook (no-op in browsers): lets node --check-style tests require
     the pure functions without a DOM. */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mdRender: mdRender, toMarkdown: toMarkdown };
  }
})();

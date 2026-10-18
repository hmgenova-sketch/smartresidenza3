/* Builds one form per PDF page from spec.json, lets people duplicate pages, and writes everything onto the PDFs with pdf-lib. */
(function () {
  var KEY = "genova-forms-v2", PH = 842;
  var $ = function (id) { return document.getElementById(id); };
  var SPEC = [], pages = [];            // pages: {d, p, copy, inc, ctrls:[{c, get, set}], root}
  var saveT;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(pages.map(function (g) { return { d: g.d, p: g.p, copy: g.copy, inc: g.inc, v: g.ctrls.map(function (k) { return k.get(); }) }; }))); } catch (e) {}
    }, 300);
  }

  function buildControls(g, host) {
    var page = SPEC[g.d].pages[g.p];
    page.sections.forEach(function (s) {
      if (s.title) host.appendChild(el("h3", "sec", s.title));
      var grid = el("div", "grid"); host.appendChild(grid);
      s.c.forEach(function (c) {
        var k = { c: c }, lab = el("label", c.t === "a" || c.t === "c" ? "full" : "");
        if (c.t === "c") {
          lab.className = "chk full"; var cb = el("input"); cb.type = "checkbox"; lab.appendChild(cb); lab.appendChild(document.createTextNode(c.l));
          k.get = function () { return cb.checked; }; k.set = function (v) { cb.checked = !!v; }; cb.onchange = save;
        } else {
          lab.appendChild(document.createTextNode(c.l)); var inp;
          if (c.t === "s") {
            inp = el("select"); inp.appendChild(new Option("—", ""));
            c.o.forEach(function (o, i) { inp.appendChild(new Option(o[0], String(i))); });
            lab.className = "full";
          } else if (c.t === "a") { inp = el("textarea"); inp.rows = 3; }
          else { inp = el("input"); inp.type = "text"; inp.autocomplete = "off"; }
          lab.appendChild(inp);
          k.get = function () { return inp.value; }; k.set = function (v) { inp.value = v == null ? "" : v; }; inp.oninput = inp.onchange = save;
        }
        g.ctrls.push(k); grid.appendChild(lab);
      });
    });
  }

  function makePage(d, p, copy, vals, inc) {
    var doc = SPEC[d], g = { d: d, p: p, copy: !!copy, inc: inc !== false, ctrls: [] };
    var fs = el("fieldset"), lg = el("legend", "", "Pagina " + (p + 1) + " di " + doc.pages.length + " – " + doc.title);
    fs.appendChild(lg);
    var head = el("div", "page-head"), b = el("b", "", copy ? "Copia aggiuntiva / Extra copy" : "Pagina originale");
    if (copy) { var bd = el("span", "badge", "copia"); head.appendChild(bd); }
    head.appendChild(b);
    var lab = el("label"), cb = el("input"); cb.type = "checkbox"; cb.checked = g.inc;
    cb.onchange = function () { g.inc = cb.checked; save(); }; lab.appendChild(cb); lab.appendChild(document.createTextNode("Includi nella stampa / Include")); head.appendChild(lab);
    var add = el("button", "sm ghost", "+ Aggiungi pagina / Add page"); add.type = "button";
    add.onclick = function () { var n = makePage(d, p, true); pages.splice(pages.indexOf(g) + 1, 0, n.g); fs.after(n.fs); n.fs.scrollIntoView({ behavior: "smooth", block: "start" }); save(); };
    head.appendChild(add);
    if (copy) {
      var rm = el("button", "sm danger", "Rimuovi / Remove"); rm.type = "button";
      rm.onclick = function () { if (confirm("Rimuovere questa copia?")) { pages.splice(pages.indexOf(g), 1); fs.remove(); save(); } };
      head.appendChild(rm);
    }
    fs.appendChild(head);
    if (!doc.pages[p].sections.length) fs.appendChild(el("p", "note", "Questa pagina non ha campi da compilare (solo informazioni). / This page has no fields."));
    buildControls(g, fs);
    if (vals) g.ctrls.forEach(function (k, i) { k.set(vals[i]); });
    g.root = fs; return { g: g, fs: fs };
  }

  function buildAll(saved) {
    $("docs").textContent = ""; $("jump").textContent = ""; pages = [];
    SPEC.forEach(function (doc, di) {
      var h = el("h2", "doc", doc.title); h.id = "doc" + di; $("docs").appendChild(h);
      var a = el("a", "", doc.title); a.href = "#doc" + di; $("jump").appendChild(a);
      var list = saved ? saved.filter(function (s) { return s.d === di; }) : doc.pages.map(function (_, p) { return { d: di, p: p, copy: false, inc: true }; });
      list.forEach(function (s) { var n = makePage(s.d, s.p, s.copy, s.v, s.inc); pages.push(n.g); $("docs").appendChild(n.fs); });
    });
  }

  // ---------- PDF ----------
  async function makePdf() {
    if (!window.PDFLib || !window.fontkit) throw new Error("Libreria PDF non caricata: carica su GitHub anche la cartella lib/ (pdf-lib.min.js e fontkit.umd.min.js) mantenendo la struttura delle cartelle.");
    var PL = PDFLib, out = await PL.PDFDocument.create(); out.registerFontkit(fontkit);
    var fb = await (await fetch("fonts/LiberationSans-Regular.ttf")).arrayBuffer();
    var font = await out.embedFont(fb, { subset: true }), cs = new Set(font.getCharacterSet()), ink = PL.rgb(0.05, 0.1, 0.45);
    var clean = function (s) { return Array.from(String(s).replace(/\t/g, " ")).map(function (ch) { return ch === "\n" || cs.has(ch.codePointAt(0)) ? ch : "?"; }).join(""); };
    var src = {}, n = 0;
    for (var gi = 0; gi < pages.length; gi++) {
      var g = pages[gi]; if (!g.inc) continue;
      var doc = SPEC[g.d];
      if (!src[doc.file]) { var r = await fetch(doc.file); if (!r.ok) throw new Error("Impossibile caricare " + doc.file); src[doc.file] = await PL.PDFDocument.load(await r.arrayBuffer()); }
      var cp = await out.copyPages(src[doc.file], [g.p]), pg = cp[0]; out.addPage(pg); n++;
      g.ctrls.forEach(function (k) {
        var v = k.get(), c = k.c; if (v === "" || v === false || v == null) return;
        if (c.t === "s") { drawX(pg, c.o[+v].slice(1)); return; }
        if (c.t === "c") { drawX(pg, c.b); return; }
        var b = c.b, s = clean(v); if (!s.trim()) return;
        if (c.t === "t") {
          var fs = 9; while (fs > 5 && font.widthOfTextAtSize(s, fs) > b[2] - 2) fs -= 0.5;
          pg.drawText(s, { x: b[0] + 1, y: PH - (b[1] + b[3]) + 2.4, size: fs, font: font, color: ink });
        } else {
          var lines = [];
          s.split("\n").forEach(function (par) { var cur = ""; par.split(" ").forEach(function (w) { var t = cur ? cur + " " + w : w; if (cur && font.widthOfTextAtSize(t, 9) > b[2] - 3) { lines.push(cur); cur = w; } else cur = t; }); lines.push(cur); });
          lines.forEach(function (l, j) { pg.drawText(l, { x: b[0] + 1.5, y: PH - (b[1] + 9.5) - j * 11, size: 9, font: font, color: ink }); });
        }
      });
    }
    function drawX(pg, b) {
      var o = { thickness: 1.3, color: ink }, x = b[0], y = b[1];
      pg.drawLine(Object.assign({ start: { x: x + 1.5, y: PH - (y + 1.5) }, end: { x: x + 7, y: PH - (y + 7) } }, o));
      pg.drawLine(Object.assign({ start: { x: x + 1.5, y: PH - (y + 7) }, end: { x: x + 7, y: PH - (y + 1.5) } }, o));
    }
    return n ? out.save() : null;
  }

  async function run(mode) {
    var msg = $("msg"), w = mode === "print" ? window.open("", "_blank") : null;
    msg.className = ""; msg.textContent = "Creo il PDF…"; $("print").disabled = $("dl").disabled = true;
    try {
      var bytes = await makePdf();
      if (!bytes) { if (w) w.close(); msg.className = "err"; msg.textContent = "Nessuna pagina selezionata."; return; }
      var url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      var a = document.createElement("a"); a.href = url; a.download = "residenza_genova_compilato.pdf"; a.textContent = "scarica il PDF";
      if (w) w.location = url; else { document.body.appendChild(a); a.click(); a.remove(); }
      msg.textContent = "Fatto! "; msg.appendChild(a);
    } catch (err) { if (w) w.close(); msg.className = "err"; msg.textContent = err.message || "Errore durante la creazione del PDF."; }
    finally { $("print").disabled = $("dl").disabled = false; }
  }
  $("print").onclick = function () { run("print"); };
  $("dl").onclick = function () { run("dl"); };
  $("clear").onclick = function () { if (confirm("Cancellare tutto quello che hai scritto e le copie aggiunte?")) { buildAll(); save(); } };

  fetch("spec.json").then(function (r) { return r.json(); }).then(function (s) {
    SPEC = s; var saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    var ok = Array.isArray(saved) && saved.length && saved.every(function (x) { return SPEC[x.d] && SPEC[x.d].pages[x.p]; });
    buildAll(ok ? saved : null);
  }).catch(function () {
    $("msg").className = "err"; $("msg").textContent = "Impossibile caricare spec.json. Apri il sito tramite GitHub Pages o un server locale (python -m http.server), non con doppio clic.";
  });
})();

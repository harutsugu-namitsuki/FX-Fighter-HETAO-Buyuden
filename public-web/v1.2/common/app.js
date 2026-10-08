// 模擬サイト共通の処理。
// 行き: アプリが URL の「#d=」の後ろに付けたデータ（JSON を base64url にしたもの）を読む
// 帰り: 「アプリに戻る」で yourcampus12://return?d=... を開く。d には、このサイトで行った操作の一覧を入れる
// サーバーはないため、使い捨てのコードは「付いていれば通す」見た目だけの再現（使ったコードはこの端末に記録する）
// アプリの中（WebView）で開かれたときは window.YourCampusApp が差し込まれていて、
// お手続きを 1 件ずつその場でアプリに反映できる（戻りリンクに頼らない）
var YC = (function () {
  // アプリの版（このフォルダ v1.2 のサイトは Your Campus 1.2 専用）。
  // ブラウザの保存領域に書く名前に版を入れ、同じ端末に別の版のアプリが並んでいても混ざらないようにする（D-044）
  var VER = "12";
  var USED_KEY = "yc" + VER + "_used_codes";
  var STATE_KEY = "yc" + VER + "_state_";

  function decode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function usedCodes() {
    try { return JSON.parse(localStorage.getItem(USED_KEY) || "[]"); } catch (e) { return []; }
  }

  function markUsed(code) {
    var list = usedCodes();
    if (list.indexOf(code) < 0) list.push(code);
    localStorage.setItem(USED_KEY, JSON.stringify(list.slice(-200)));
  }

  // 戻り値: { data } か { error: "none" | "broken" | "site" | "used" }
  function load(site) {
    var m = location.hash.match(/[#&]d=([^&]+)/);
    if (!m) return { error: "none" };
    var d;
    try { d = JSON.parse(decode(m[1])); } catch (e) { return { error: "broken" }; }
    if (d.site !== site) return { error: "site" };
    if (usedCodes().indexOf(d.code) >= 0) return { error: "used" };
    return { data: d };
  }

  // 画面を読み直しても、このコードで行った操作と画面の状態が消えないようにする
  function saveSession(code, state) {
    sessionStorage.setItem(STATE_KEY + code, JSON.stringify(state));
  }

  function loadSession(code) {
    try { return JSON.parse(sessionStorage.getItem(STATE_KEY + code) || "null"); } catch (e) { return null; }
  }

  // アプリの中で開かれているか（アプリが差し込む橋渡し）
  function hasBridge() {
    return !!(window.YourCampusApp && typeof window.YourCampusApp.apply === "function");
  }

  // お手続きを 1 件、記録する。
  // アプリの中なら、その場でアプリに反映する（だめなら理由を出して false）。
  // ブラウザなら s.ops にためて、「アプリに戻る」のリンクで渡す
  function record(d, s, op) {
    if (!hasBridge()) { s.ops.push(op); return true; }
    var res;
    try {
      res = JSON.parse(window.YourCampusApp.apply(encode(JSON.stringify({ code: d.code, site: d.site, ops: [op] }))));
    } catch (e) {
      res = { ok: false, message: "アプリに反映できませんでした" };
    }
    if (!res || !res.ok) { dialog("アプリに反映できませんでした", (res && res.message) || ""); return false; }
    s.applied = (s.applied || 0) + 1;
    return true;
  }

  function returnUrl(d, ops) {
    return (d.ret || "yourcampus" + VER + "://return") + "?d=" + encode(JSON.stringify({ code: d.code, site: d.site, ops: ops }));
  }

  function goBack(d, ops) {
    markUsed(d.code);
    sessionStorage.removeItem(STATE_KEY + d.code);
    location.href = returnUrl(d, ops);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 円未満切り捨てで表示（アプリと同じ）
  function yen(n) {
    return Math.floor(Number(n) || 0).toLocaleString("ja-JP") + "円";
  }

  // アプリの日時（2026-10-08T12:00）を読みやすくする
  function dt(s) {
    return String(s == null ? "" : s).replace("T", " ");
  }

  function num(n, digits) {
    return Number(n).toLocaleString("ja-JP", { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 });
  }

  // 投資信託は 1 万口あたりの基準価額、株式は 1 株あたりの価格
  function marketValue(kind, qty, price) {
    return kind === "投資信託" ? Math.floor(qty * price / 10000) : Math.floor(qty * price);
  }

  function errorPage(kind, siteName) {
    var msg = {
      none: "このページは、アプリから開いてください。",
      broken: "リンクのデータを読み取れませんでした。アプリから開き直してください。",
      site: "別のサイト向けのリンクです。アプリから開き直してください。",
      used: "このリンクはすでに使われています。安全のため、アプリから開き直してください。"
    }[kind];
    return '<div class="card"><h2>' + esc(siteName) + '</h2><p>' + esc(msg) + '</p>' +
      '<p class="note">アプリが発行する使い捨てのリンクで、ログインした状態になります（模擬）。</p></div>';
  }

  function dialog(title, body) {
    var el = document.createElement("div");
    el.className = "dialog";
    el.innerHTML = '<div class="box"><h3>' + esc(title) + '</h3><pre>' + esc(body) + '</pre><button class="btn sub">閉じる</button></div>';
    el.querySelector("button").onclick = function () { el.remove(); };
    el.onclick = function (e) { if (e.target === el) el.remove(); };
    document.body.appendChild(el);
  }

  // 確認のダイアログ（ブラウザの confirm はアプリ内の WebView では出ないことがあるため、ページ内に出す）
  function ask(title, body, okLabel, onOk) {
    var el = document.createElement("div");
    el.className = "dialog";
    el.innerHTML = '<div class="box"><h3>' + esc(title) + '</h3><pre>' + esc(body) + '</pre>' +
      '<button class="btn" data-ok>' + esc(okLabel) + '</button><button class="btn sub">やめる</button></div>';
    el.querySelector("[data-ok]").onclick = function () { el.remove(); onOk(); };
    el.querySelector(".btn.sub").onclick = function () { el.remove(); };
    document.body.appendChild(el);
  }

  // 下に固定する「アプリに戻る」。s はサイトの状態（ops: ためている操作、applied: 反映済みの件数）
  function returnBar(d, s) {
    var bar = document.getElementById("returnbar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "returnbar";
      bar.className = "returnbar";
      document.body.appendChild(bar);
    }
    var ops = s.ops || [];
    var count;
    if (hasBridge()) count = s.applied ? "お手続き " + s.applied + " 件は、アプリに反映済みです" : "お手続きをせずにアプリに戻れます";
    else count = ops.length ? "このサイトでのお手続き " + ops.length + " 件を、アプリに反映します" : "お手続きをせずにアプリに戻れます";
    bar.innerHTML = '<div class="inner"><div class="count">' + esc(count) + '</div><a href="#" id="goapp">アプリに戻る</a></div>';
    document.getElementById("goapp").onclick = function (e) { e.preventDefault(); goBack(d, ops); };
  }

  return {
    load: load, saveSession: saveSession, loadSession: loadSession, returnUrl: returnUrl, goBack: goBack, hasBridge: hasBridge, record: record,
    esc: esc, yen: yen, num: num, dt: dt, marketValue: marketValue, errorPage: errorPage, dialog: dialog, ask: ask, returnBar: returnBar,
    encode: encode, decode: decode
  };
})();

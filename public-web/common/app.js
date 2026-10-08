// 模擬サイト共通の処理。
// 行き: アプリが URL の「#d=」の後ろに付けたデータ（JSON を base64url にしたもの）を読む
// 帰り: 「アプリに戻る」で yourcampus://return?d=... を開く。d には、このサイトで行った操作の一覧を入れる
// サーバーはないため、使い捨てのコードは「付いていれば通す」見た目だけの再現（使ったコードはこの端末に記録する）
var YC = (function () {
  var USED_KEY = "yc_used_codes";

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
    sessionStorage.setItem("yc_state_" + code, JSON.stringify(state));
  }

  function loadSession(code) {
    try { return JSON.parse(sessionStorage.getItem("yc_state_" + code) || "null"); } catch (e) { return null; }
  }

  function returnUrl(d, ops) {
    return (d.ret || "yourcampus://return") + "?d=" + encode(JSON.stringify({ code: d.code, site: d.site, ops: ops }));
  }

  function goBack(d, ops) {
    markUsed(d.code);
    sessionStorage.removeItem("yc_state_" + d.code);
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

  // 下に固定する「アプリに戻る」
  function returnBar(d, ops) {
    var bar = document.getElementById("returnbar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "returnbar";
      bar.className = "returnbar";
      document.body.appendChild(bar);
    }
    var count = ops.length ? "このサイトでのお手続き " + ops.length + " 件を、アプリに反映します" : "お手続きをせずにアプリに戻れます";
    bar.innerHTML = '<div class="inner"><div class="count">' + esc(count) + '</div><a href="#" id="goapp">アプリに戻る</a></div>';
    document.getElementById("goapp").onclick = function (e) { e.preventDefault(); goBack(d, ops); };
  }

  return {
    load: load, saveSession: saveSession, loadSession: loadSession, returnUrl: returnUrl, goBack: goBack,
    esc: esc, yen: yen, num: num, dt: dt, marketValue: marketValue, errorPage: errorPage, dialog: dialog, ask: ask, returnBar: returnBar,
    encode: encode, decode: decode
  };
})();

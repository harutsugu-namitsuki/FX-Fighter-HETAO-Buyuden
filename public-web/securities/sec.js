// 模擬証券サイト（要件 §5-7）。口座開設・NISA・保有一覧（鉛筆で価格編集）・買付・解約・積立・電子交付
(function () {
  var E = YC.esc, yen = YC.yen;
  var NISA = { TSUMITATE: 1200000, GROWTH: 2400000, LIFETIME: 18000000 };
  var FUND = "投資信託", STOCK = "株式";
  var main = document.getElementById("main");
  var r = YC.load("sec");
  if (r.error) { main.innerHTML = YC.errorPage(r.error, "ゆうやけ証券"); return; }
  var d = r.data;
  var s = YC.loadSession(d.code) || {
    cash: d.cash,
    sec: d.sec,
    market: d.market,
    holdings: d.holdings || [],
    tsumitate: d.tsumitate || [],
    ops: [],
    docs: [],
    tab: d.page === "open" ? "open" : "hold",
    editing: null,
    msg: null
  };
  if (d.provider) document.getElementById("brand").textContent = d.provider;

  function save() { YC.saveSession(d.code, s); }
  function item(code) { for (var i = 0; i < s.market.length; i++) if (s.market[i].code === code) return s.market[i]; return null; }
  function holding(code, nisa) { for (var i = 0; i < s.holdings.length; i++) if (s.holdings[i].code === code && !!s.holdings[i].nisa === !!nisa) return s.holdings[i]; return null; }
  function addOp(op, doc) {
    s.ops.push(op);
    if (doc) s.docs.unshift({ title: doc.title, date: d.now, body: doc.body });
    save();
  }
  function caution() {
    return '<div class="caution"><ul>' +
      '<li>投資信託・株式は預金ではありません。預金保険の対象ではありません</li>' +
      '<li>価格の変動により、元本を割り込むおそれがあります</li>' +
      '<li>証券のお取引の有無は、銀行の他のお取引に影響しません</li>' +
      '<li>銀行は証券会社の代理人ではありません。お取引の相手は当社です</li></ul></div>';
  }
  function setTab(t) { s.tab = t; s.msg = null; s.editing = null; save(); render(); }
  window.secTab = setTab;

  function header() {
    var c = d.customer || {};
    var h = '<div class="card"><div class="row"><span class="k">お客さま</span><span class="v">' + E(c.name) + ' 様</span></div>' +
      '<div class="row"><span class="k">証券口座</span><span class="v">' + E(s.sec.status) + (s.sec.account ? "　" + E(s.sec.account) : "") +
      (s.sec.nisa ? '<span class="pill">NISA</span>' : "") + '</span></div>' +
      '<div class="row"><span class="k">お預り金（銀行の普通預金と連動）</span><span class="v">' + yen(s.cash) + '</span></div></div>';
    return h;
  }

  function tabs() {
    var list = s.sec.status === "開設済"
      ? [["hold", "保有一覧"], ["buy", "買付"], ["sell", "解約・売却"], ["tsumi", "積立"], ["nisa", "NISA"], ["docs", "電子交付書類"]]
      : [["open", "口座開設"], ["docs", "電子交付書類"]];
    return '<div class="tabs">' + list.map(function (t) {
      return '<button class="' + (s.tab === t[0] ? "on" : "") + '" onclick="secTab(\'' + t[0] + '\')">' + t[1] + '</button>';
    }).join("") + '</div>';
  }

  // ---------- 口座開設 ----------
  function openView() {
    if (s.sec.status === "申込中") {
      return '<div class="card"><h2>口座開設のお申込み</h2><div class="ok">お申込みを受け付けました。審査中です。<br>開設が完了すると、銀行アプリにお知らせが届きます。</div>' +
        '<p class="note">デモでは、申込から約 3 分後に自動で開設済になります（アプリの管理画面からすぐに切り替えることもできます）。</p></div>';
    }
    var c = d.customer || {};
    return '<div class="card"><h2>証券口座の開設</h2>' +
      '<div class="steps"><span class="on">本人情報</span><span class="on">確認</span><span class="on">同意</span><span>申込中</span><span>開設済</span></div>' +
      '<h3>本人情報（銀行から引き継ぎ）</h3>' +
      '<div class="row"><span class="k">お名前</span><span class="v">' + E(c.name) + '</span></div>' +
      '<div class="row"><span class="k">お取引店</span><span class="v">' + E(c.branch) + '</span></div>' +
      '<div class="row"><span class="k">入出金口座</span><span class="v">普通 ' + E(c.account) + '</span></div>' +
      '<label>マイナンバー（12 桁・ダミーの数字で構いません）</label><input type="text" id="mn" inputmode="numeric" maxlength="12" placeholder="123456789012">' +
      '<label>投資のご経験</label><select id="exp"><option value="">選んでください</option><option>なし</option><option>1 年未満</option><option>1〜5 年</option><option>5 年以上</option></select>' +
      '<label>投資の目的</label><select id="aim"><option value="">選んでください</option><option>老後の資金づくり</option><option>教育資金</option><option>余裕資金の運用</option></select>' +
      '<label class="check"><input type="checkbox" id="c1"> 契約締結前交付書面・重要事項の説明を読みました</label>' +
      '<label class="check"><input type="checkbox" id="c2"> 書類を電子交付で受け取ることに同意します</label>' +
      '<label class="check"><input type="checkbox" id="c3"> 当社が銀行から本人情報を受け取ることに同意します</label>' +
      '<label class="check"><input type="checkbox" id="nisa"> NISA 口座も同時に申し込む</label>' +
      caution() +
      '<div id="err" class="err"></div><button class="btn" onclick="secOpenSubmit()">口座開設を申し込む</button></div>';
  }
  window.secOpenSubmit = function () {
    var mn = document.getElementById("mn").value;
    var err = "";
    if (!/^\d{12}$/.test(mn)) err = "マイナンバーは 12 桁の数字で入力してください";
    else if (!document.getElementById("exp").value || !document.getElementById("aim").value) err = "投資のご経験と目的を選んでください";
    else if (!document.getElementById("c1").checked || !document.getElementById("c2").checked || !document.getElementById("c3").checked) err = "3 つの同意にチェックしてください";
    if (err) { document.getElementById("err").textContent = err; return; }
    var nisa = document.getElementById("nisa").checked;
    s.sec.status = "申込中";
    s.sec.nisa = nisa;
    addOp({ t: "secOpen", nisa: nisa }, { title: "口座開設申込の受付", body: "証券口座の開設のお申込みを受け付けました。" + (nisa ? "\nNISA 口座も同時にお申込みいただきました。" : "") });
    render();
  };

  // ---------- 保有一覧（鉛筆で価格を編集） ----------
  function holdView() {
    var total = 0, cost = 0;
    var rows = s.holdings.map(function (h, i) {
      var it = item(h.code) || { name: h.code, kind: STOCK, price: 0, asOf: "" };
      var v = YC.marketValue(it.kind, h.qty, it.price);
      var c = YC.marketValue(it.kind, h.qty, h.avgCost);
      total += v; cost += c;
      var pl = v - c;
      var unit = it.kind === FUND ? "口" : "株";
      var price = s.editing === h.code + "#" + i
        ? '<div class="priceedit"><input type="number" step="0.01" id="pe" value="' + it.price + '"><button onclick="secPriceSave(\'' + h.code + '\')">保存</button></div>'
        : YC.num(it.price, it.kind === FUND ? 0 : 1).replace(/\.0$/, "") + '<button class="pencil" title="価格を編集" onclick="secPriceEdit(\'' + h.code + '#' + i + '\')">✎</button>';
      return '<tr><td><b>' + E(it.name) + '</b>' + (h.nisa ? '<span class="pill">NISA</span>' : "") +
        '<br><span class="note">' + E(it.kind) + '　' + YC.num(h.qty) + unit + '　取得単価 ' + YC.num(Math.round(h.avgCost)) + '</span></td>' +
        '<td class="n">' + price + '<br><span class="note">基準 ' + E(YC.dt(it.asOf)) + '</span></td>' +
        '<td class="n">' + yen(v) + '<br><span class="' + (pl >= 0 ? "plus" : "minus") + '">' + (pl >= 0 ? "+" : "") + yen(pl) + '</span></td></tr>';
    }).join("");
    if (!rows) rows = '<tr><td>保有している銘柄はありません</td></tr>';
    return '<div class="card"><h2>保有一覧</h2>' +
      '<div class="row"><span class="k">評価額合計</span><span class="v">' + yen(total) + '</span></div>' +
      '<div class="row"><span class="k">評価損益</span><span class="v ' + (total - cost >= 0 ? "plus" : "minus") + '">' + (total - cost >= 0 ? "+" : "") + yen(total - cost) + '</span></div>' +
      '<table class="hold"><tr><td class="note">銘柄・数量・取得単価</td><td class="n note">現在価格</td><td class="n note">評価額・損益</td></tr>' + rows + '</table>' +
      '<p class="note">投資信託の価格は 1 万口あたりの基準価額です。現在価格の ✎ を押すと、その場で価格を変えられます（デモ用）。</p>' +
      (s.msg ? '<div class="ok">' + E(s.msg) + '</div>' : "") + '</div>' + caution();
  }
  window.secPriceEdit = function (key) { s.editing = key; render(); var el = document.getElementById("pe"); if (el) el.focus(); };
  window.secPriceSave = function (code) {
    var p = parseFloat(document.getElementById("pe").value);
    if (!(p > 0)) { YC.dialog("価格を確かめてください", "0 より大きい価格を入力してください"); return; }
    var it = item(code);
    it.price = p;
    it.asOf = d.now;
    s.editing = null;
    s.ops = s.ops.filter(function (o) { return !(o.t === "price" && o.code === code); });
    addOp({ t: "price", code: code, price: p });
    s.msg = it.name + " の価格を " + p + " に変えました";
    save();
    render();
  };

  // ---------- 買付 ----------
  function buyView() {
    var opts = s.market.map(function (m) { return '<option value="' + E(m.code) + '">' + E(m.name) + '（' + E(m.kind) + '）</option>'; }).join("");
    return '<div class="card"><h2>買付</h2>' +
      '<label>銘柄</label><select id="bc" onchange="secBuyCalc()">' + opts + '</select>' +
      '<div id="bprice" class="note"></div>' +
      '<label id="blabel">金額</label><input type="number" id="bq" oninput="secBuyCalc()">' +
      (s.sec.nisa ? '<label class="check"><input type="checkbox" id="bn" onchange="secBuyCalc()"> NISA で買う</label>' : '<p class="note">NISA で買うには、NISA のお申込みが必要です。</p>') +
      '<div id="bcalc" class="ok" style="margin-top:8px"></div>' +
      '<div id="err" class="err"></div><button class="btn" onclick="secBuy()">買い付ける</button>' +
      (s.msg ? '<div class="ok" style="margin-top:8px">' + E(s.msg) + '</div>' : "") + '</div>' + caution();
  }
  function buyCalc() {
    var it = item(document.getElementById("bc").value);
    var q = Math.floor(Number(document.getElementById("bq").value) || 0);
    var fund = it.kind === FUND;
    document.getElementById("blabel").textContent = fund ? "買付金額（円）" : "株数（100 株単位）";
    document.getElementById("bprice").textContent = "現在価格 " + it.price + (fund ? "（1 万口あたり）" : "（1 株）") + "　基準 " + YC.dt(it.asOf);
    var qty = fund ? Math.floor(q * 10000 / it.price) : q;
    var amount = fund ? q : Math.floor(q * it.price);
    document.getElementById("bcalc").textContent = q > 0 ? "代金 " + yen(amount) + "（" + YC.num(qty) + (fund ? "口" : "株") + "）。代金は銀行の普通預金から引き落とします" : "数量を入力してください";
    return { it: it, qty: qty, amount: amount, fund: fund, raw: q };
  }
  window.secBuyCalc = buyCalc;
  window.secBuy = function () {
    var c = buyCalc();
    var nisa = !!(document.getElementById("bn") && document.getElementById("bn").checked);
    var err = "";
    if (c.raw <= 0 || c.qty <= 0) err = "数量を入力してください";
    else if (!c.fund && c.qty % 100 !== 0) err = "株式は 100 株単位でご注文ください";
    else if (c.amount > s.cash) err = "普通預金の残高が足りません（残高 " + yen(s.cash) + "）";
    else if (nisa && c.fund && s.sec.tsumitateUsed + c.amount > NISA.TSUMITATE) err = "NISA つみたて投資枠を超えます";
    else if (nisa && !c.fund && s.sec.growthUsed + c.amount > NISA.GROWTH) err = "NISA 成長投資枠を超えます";
    if (err) { document.getElementById("err").textContent = err; return; }
    YC.ask("買付の確認", c.it.name + "\n代金 " + yen(c.amount) + "（普通預金から引き落とし）" + (nisa ? "\nNISA" : ""), "買い付ける", function () {
      s.cash -= c.amount;
      if (nisa) { if (c.fund) s.sec.tsumitateUsed += c.amount; else s.sec.growthUsed += c.amount; }
      var h = holding(c.it.code, nisa);
      if (!h) s.holdings.push({ code: c.it.code, qty: c.qty, avgCost: c.fund ? c.amount * 10000 / c.qty : c.amount / c.qty, nisa: nisa });
      else {
        var old = YC.marketValue(c.it.kind, h.qty, h.avgCost);
        h.qty += c.qty;
        h.avgCost = c.fund ? (old + c.amount) * 10000 / h.qty : (old + c.amount) / h.qty;
      }
      addOp({ t: "buy", code: c.it.code, qty: c.qty, amount: c.amount, nisa: nisa },
        { title: "取引報告書（買付）" + c.it.name, body: "銘柄: " + c.it.name + "\n数量: " + YC.num(c.qty) + (c.fund ? "口" : "株") + "\n約定代金: " + yen(c.amount) + "\n口座区分: " + (nisa ? "NISA" : "特定口座") });
      s.msg = c.it.name + " を買い付けました（" + yen(c.amount) + "）";
      save();
      render();
    });
  };

  // ---------- 解約・売却 ----------
  function sellView() {
    if (!s.holdings.length) return '<div class="card"><h2>解約・売却</h2><p>保有している銘柄はありません。</p>' + (s.msg ? '<div class="ok">' + E(s.msg) + '</div>' : "") + '</div>';
    var opts = s.holdings.map(function (h, i) {
      var it = item(h.code) || { name: h.code };
      return '<option value="' + i + '">' + E(it.name) + (h.nisa ? "（NISA）" : "") + '　' + YC.num(h.qty) + (it.kind === FUND ? "口" : "株") + '</option>';
    }).join("");
    return '<div class="card"><h2>解約・売却</h2>' +
      '<label>銘柄</label><select id="sh" onchange="secSellCalc()">' + opts + '</select>' +
      '<label id="slabel">数量</label><input type="number" id="sq" oninput="secSellCalc()">' +
      '<button class="btn sub" onclick="secSellAll()">全部を指定する</button>' +
      '<div id="scalc" class="ok" style="margin-top:8px"></div>' +
      '<div id="err" class="err"></div><button class="btn" onclick="secSell()">解約・売却する</button>' +
      (s.msg ? '<div class="ok" style="margin-top:8px">' + E(s.msg) + '</div>' : "") + '</div>' + caution();
  }
  function sellCalc() {
    var h = s.holdings[Number(document.getElementById("sh").value)];
    var it = item(h.code);
    var fund = it.kind === FUND;
    var q = Math.floor(Number(document.getElementById("sq").value) || 0);
    document.getElementById("slabel").textContent = fund ? "口数（保有 " + YC.num(h.qty) + "口）" : "株数（100 株単位・保有 " + YC.num(h.qty) + "株）";
    var amount = YC.marketValue(it.kind, q, it.price);
    document.getElementById("scalc").textContent = q > 0 ? "受取金額 " + yen(amount) + "。銀行の普通預金に入金します" : "数量を入力してください";
    return { h: h, it: it, qty: q, amount: amount, fund: fund };
  }
  window.secSellCalc = sellCalc;
  window.secSellAll = function () { var h = s.holdings[Number(document.getElementById("sh").value)]; document.getElementById("sq").value = h.qty; sellCalc(); };
  window.secSell = function () {
    var c = sellCalc();
    var err = "";
    if (c.qty <= 0) err = "数量を入力してください";
    else if (c.qty > c.h.qty) err = "保有数量を超えています";
    else if (!c.fund && c.qty !== c.h.qty && c.qty % 100 !== 0) err = "株式は 100 株単位でご注文ください";
    if (err) { document.getElementById("err").textContent = err; return; }
    YC.ask("解約・売却の確認", c.it.name + "\n受取金額 " + yen(c.amount) + "（普通預金に入金）", "解約・売却する", function () {
      s.cash += c.amount;
      c.h.qty -= c.qty;
      if (c.h.qty === 0) s.holdings.splice(s.holdings.indexOf(c.h), 1);
      addOp({ t: "sell", code: c.it.code, qty: c.qty, amount: c.amount, nisa: !!c.h.nisa },
        { title: "取引報告書（解約・売却）" + c.it.name, body: "銘柄: " + c.it.name + "\n数量: " + YC.num(c.qty) + (c.fund ? "口" : "株") + "\n受渡金額: " + yen(c.amount) });
      s.msg = c.it.name + " を解約・売却しました（" + yen(c.amount) + "）";
      save();
      render();
    });
  };

  // ---------- 積立 ----------
  function tsumiView() {
    var funds = s.market.filter(function (m) { return m.kind === FUND; });
    var cur = s.tsumitate.map(function (t) {
      var it = item(t.code) || { name: t.code };
      return '<div class="row"><span class="k">' + E(it.name) + (t.nisa ? '<span class="pill">NISA</span>' : "") + '</span><span class="v">毎月' + t.day + '日 ' + yen(t.amount) + '</span></div>';
    }).join("") || '<p class="note">設定中の積立はありません。</p>';
    var opts = funds.map(function (m) { return '<option value="' + E(m.code) + '">' + E(m.name) + '</option>'; }).join("");
    var days = ""; for (var i = 1; i <= 28; i++) days += '<option' + (i === 10 ? " selected" : "") + '>' + i + '</option>';
    return '<div class="card"><h2>積立の設定</h2><h3>設定中の積立</h3>' + cur +
      '<h3>新しく設定する・変える</h3><label>銘柄（投資信託）</label><select id="tc">' + opts + '</select>' +
      '<label>毎月の金額（円・0 にすると解除）</label><input type="number" id="ta" value="10000">' +
      '<label>引落日</label><select id="td">' + days + '</select>' +
      (s.sec.nisa ? '<label class="check"><input type="checkbox" id="tn" checked> NISA（つみたて投資枠）で積み立てる</label>' : "") +
      '<p class="note">毎月の引落日に、銀行の普通預金から代金を引き落として買い付けます。</p>' +
      '<div id="err" class="err"></div><button class="btn" onclick="secTsumi()">設定する</button>' +
      (s.msg ? '<div class="ok" style="margin-top:8px">' + E(s.msg) + '</div>' : "") + '</div>' + caution();
  }
  window.secTsumi = function () {
    var code = document.getElementById("tc").value;
    var amount = Math.floor(Number(document.getElementById("ta").value) || 0);
    var day = Number(document.getElementById("td").value);
    var nisa = !!(document.getElementById("tn") && document.getElementById("tn").checked);
    if (amount < 0 || (amount > 0 && amount < 1000)) { document.getElementById("err").textContent = "積立は 1,000 円以上で設定してください（0 で解除）"; return; }
    if (nisa && amount * 12 > NISA.TSUMITATE) { document.getElementById("err").textContent = "年間の積立額が NISA つみたて投資枠（120 万円）を超えます"; return; }
    s.tsumitate = s.tsumitate.filter(function (t) { return t.code !== code; });
    if (amount > 0) s.tsumitate.push({ code: code, amount: amount, day: day, nisa: nisa });
    s.ops = s.ops.filter(function (o) { return !(o.t === "tsumitate" && o.code === code); });
    var name = (item(code) || {}).name;
    addOp({ t: "tsumitate", code: code, amount: amount, day: day, nisa: nisa },
      { title: "積立設定のお知らせ " + name, body: amount > 0 ? "毎月" + day + "日に " + yen(amount) + " を積み立てます" + (nisa ? "（NISA）" : "") : "積立を解除しました" });
    s.msg = amount > 0 ? name + " の積立を設定しました" : name + " の積立を解除しました";
    save();
    render();
  };

  // ---------- NISA ----------
  function nisaView() {
    if (!s.sec.nisa) {
      return '<div class="card"><h2>NISA</h2><p>NISA を使うと、運用で得た利益に税金がかかりません。</p>' +
        '<div class="row"><span class="k">つみたて投資枠（年間）</span><span class="v">' + yen(NISA.TSUMITATE) + '</span></div>' +
        '<div class="row"><span class="k">成長投資枠（年間）</span><span class="v">' + yen(NISA.GROWTH) + '</span></div>' +
        '<div class="row"><span class="k">生涯の上限</span><span class="v">' + yen(NISA.LIFETIME) + '</span></div>' +
        '<label class="check"><input type="checkbox" id="nc"> NISA の説明を読み、他の金融機関で NISA 口座を持っていないことを確認しました</label>' +
        '<div id="err" class="err"></div><button class="btn" onclick="secNisa()">NISA を申し込む</button></div>';
    }
    var used = s.sec.tsumitateUsed + s.sec.growthUsed;
    return '<div class="card"><h2>NISA の利用状況</h2>' +
      '<div class="row"><span class="k">つみたて投資枠</span><span class="v">' + yen(s.sec.tsumitateUsed) + ' / ' + yen(NISA.TSUMITATE) + '</span></div>' +
      '<div class="row"><span class="k">成長投資枠</span><span class="v">' + yen(s.sec.growthUsed) + ' / ' + yen(NISA.GROWTH) + '</span></div>' +
      '<div class="row"><span class="k">生涯の上限</span><span class="v">' + yen(used) + ' / ' + yen(NISA.LIFETIME) + '</span></div>' +
      '<p class="note">デモでは、投資信託はつみたて投資枠、株式は成長投資枠を使います。</p>' +
      (s.msg ? '<div class="ok">' + E(s.msg) + '</div>' : "") + '</div>';
  }
  window.secNisa = function () {
    if (!document.getElementById("nc").checked) { document.getElementById("err").textContent = "確認にチェックしてください"; return; }
    s.sec.nisa = true;
    addOp({ t: "nisa" }, { title: "NISA 口座開設のお知らせ", body: "NISA のお申込みを受け付けました。" });
    s.msg = "NISA を申し込みました";
    save();
    render();
  };

  // ---------- 電子交付書類 ----------
  var BASE_DOCS = [
    { title: "取引残高報告書（前回分）", body: "前回の報告日時点のお預り残高をお知らせします。\n（デモ用の見本の文章です）" },
    { title: "目論見書（ゆうやけ全世界株式インデックス）", body: "ファンドの目的・特色、投資リスク、手続・手数料等を記載しています。\n（デモ用の見本の文章です）" }
  ];
  function allDocs() { return s.docs.concat(BASE_DOCS.map(function (b) { return { title: b.title, date: d.today, body: b.body }; })); }
  function docsView() {
    return '<div class="card"><h2>電子交付書類</h2>' + allDocs().map(function (doc, i) {
      return '<div class="list-item" onclick="secDoc(' + i + ')"><div class="t">' + E(doc.title) + '</div><div class="s">' + E(YC.dt(doc.date)) + '</div></div>';
    }).join("") + '<p class="note">証券会社の書類は、このサイトでご覧ください。銀行アプリの電子交付サービスには表示されません。</p></div>';
  }
  window.secDoc = function (i) { var doc = allDocs()[i]; YC.dialog(doc.title, doc.body); };

  function render() {
    if (s.sec.status !== "開設済" && s.tab !== "docs") s.tab = "open";
    var body = { open: openView, hold: holdView, buy: buyView, sell: sellView, tsumi: tsumiView, nisa: nisaView, docs: docsView }[s.tab] || holdView;
    main.innerHTML = header() + tabs() + body();
    if (s.tab === "buy") buyCalc();
    if (s.tab === "sell" && s.holdings.length) sellCalc();
    YC.returnBar(d, s.ops);
  }
  save();
  render();
})();

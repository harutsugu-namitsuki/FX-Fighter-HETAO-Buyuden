// 模擬保険サイト（要件 §5-9）。商品詳細 → 見積 → 申込 → 告知（ダミー） → 契約完了
(function () {
  var E = YC.esc, yen = YC.yen;
  var main = document.getElementById("main");
  var r = YC.load("ins");
  if (r.error) { main.innerHTML = YC.errorPage(r.error, "こもれび生命"); return; }
  var d = r.data;
  if (d.provider) document.getElementById("brand").textContent = d.provider;

  // 保険料は年齢と保障の大きさで決まる（デモ用の簡単な式）
  function band(age, table) { return age < 30 ? table[0] : age < 40 ? table[1] : age < 50 ? table[2] : age < 60 ? table[3] : table[4]; }
  var PRODUCTS = [
    { id: "med", name: "こもれび医療保険", type: "保障型", lead: "入院・手術にそなえる保険です。",
      detail: "入院 1 日あたりの給付金と、手術の給付金をお支払いします。保障は一生涯続きます。",
      option: { label: "入院給付金（日額）", choices: [5000, 10000], unit: "円" },
      premium: function (age, v) { return Math.floor(v * band(age, [0.32, 0.42, 0.58, 0.82, 1.15])); } },
    { id: "term", name: "こもれび定期保険", type: "保障型", lead: "万一のとき、ご家族に保険金を残す保険です。",
      detail: "保険期間 10 年。期間中に亡くなられたとき、または高度障害状態になられたときに保険金をお支払いします。満期保険金はありません。",
      option: { label: "保険金額", choices: [10000000, 20000000, 30000000], unit: "円" },
      premium: function (age, v) { return Math.floor(v / 10000 * band(age, [0.6, 1.0, 1.8, 3.5, 6.0])); } },
    { id: "fx", name: "こもれび外貨建終身保険", type: "資産形成型", lead: "米ドルで運用しながら、一生涯の保障を持つ保険です。",
      detail: "保険料を米ドルに換えて運用します。受け取るときの円の金額は、そのときの為替相場によって変わります。",
      option: { label: "月々の保険料", choices: [10000, 20000, 30000], unit: "円" },
      extraCaution: "為替相場の変動により、円で受け取る金額が払い込んだ保険料を下回るおそれがあります",
      premium: function (age, v) { return v; } },
    { id: "pension", name: "こもれび個人年金保険", type: "資産形成型", lead: "65 歳から 10 年間、年金を受け取れる保険です。",
      detail: "65 歳まで保険料を払い込み、65 歳から 10 年間、毎年年金を受け取ります。早い時期に解約すると、解約返戻金が払込保険料を下回ります。",
      option: { label: "月々の保険料", choices: [10000, 15000, 20000], unit: "円" },
      extraCaution: "早期に解約すると、解約返戻金が払込保険料の合計を下回ることがあります",
      premium: function (age, v) { return v; } }
  ];
  function product(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; }

  var s = YC.loadSession(d.code) || { view: "list", pid: null, age: 35, opt: null, day: 27, ops: [], contracts: d.contracts || [], done: null };
  function save() { YC.saveSession(d.code, s); }
  function go(view) { s.view = view; save(); render(); window.scrollTo(0, 0); }
  window.insGo = go;

  function caution(p) {
    return '<div class="caution"><ul><li>保険は預金ではありません。預金保険の対象ではありません</li>' +
      '<li>保険のご加入の有無は、銀行の他のお取引に影響しません</li>' +
      (p && p.extraCaution ? '<li>' + E(p.extraCaution) + '</li>' : "") + '</ul></div>';
  }
  function steps(n) {
    return '<div class="steps">' + ["商品", "見積", "申込", "告知", "完了"].map(function (t, i) { return '<span class="' + (i <= n ? "on" : "") + '">' + t + '</span>'; }).join("") + '</div>';
  }

  function listView() {
    var c = d.customer || {};
    var mine = s.contracts.map(function (k) {
      return '<div class="row"><span class="k">' + E(k.product) + '（' + E(k.type) + '）</span><span class="v">月 ' + yen(k.premium) + '</span></div>';
    }).join("") || '<p class="note">ご契約中の保険はありません。</p>';
    var groups = ["保障型", "資産形成型"].map(function (g) {
      return '<h3>' + g + '</h3>' + PRODUCTS.filter(function (p) { return p.type === g; }).map(function (p) {
        return '<div class="list-item" onclick="insPick(\'' + p.id + '\')"><div class="t">' + E(p.name) + '</div><div class="s">' + E(p.lead) + '</div></div>';
      }).join("");
    }).join("");
    return '<div class="card"><div class="row"><span class="k">お客さま</span><span class="v">' + E(c.name) + ' 様</span></div>' +
      '<h3>ご契約中の保険</h3>' + mine + '</div>' +
      '<div class="card"><h2>商品を選ぶ</h2>' + groups + '</div>' + caution();
  }
  window.insPick = function (id) { s.pid = id; s.opt = product(id).option.choices[0]; go("detail"); };

  function detailView() {
    var p = product(s.pid);
    return steps(0) + '<div class="card"><h2>' + E(p.name) + '<span class="pill">' + E(p.type) + '</span></h2><p>' + E(p.detail) + '</p>' +
      caution(p) + '<button class="btn" onclick="insGo(\'quote\')">保険料を見積もる</button><button class="btn sub" onclick="insGo(\'list\')">商品一覧に戻る</button></div>';
  }

  function quoteView() {
    var p = product(s.pid);
    var ages = ""; for (var a = 20; a <= 70; a++) ages += '<option' + (a === s.age ? " selected" : "") + '>' + a + '</option>';
    var opts = p.option.choices.map(function (v) { return '<option value="' + v + '"' + (v === s.opt ? " selected" : "") + '>' + YC.num(v) + p.option.unit + '</option>'; }).join("");
    return steps(1) + '<div class="card"><h2>見積 ' + E(p.name) + '</h2>' +
      '<label>ご契約時の年齢</label><select id="age" onchange="insQuote()">' + ages + '</select>' +
      '<label>' + E(p.option.label) + '</label><select id="opt" onchange="insQuote()">' + opts + '</select>' +
      '<div class="ok" style="margin-top:12px">月々の保険料 <b id="prem"></b></div>' +
      '<p class="note">見積はデモ用の簡単な計算です。</p>' +
      '<button class="btn" onclick="insGo(\'apply\')">この内容で申し込む</button><button class="btn sub" onclick="insGo(\'detail\')">戻る</button></div>';
  }
  window.insQuote = function () {
    s.age = Number(document.getElementById("age").value);
    s.opt = Number(document.getElementById("opt").value);
    document.getElementById("prem").textContent = yen(product(s.pid).premium(s.age, s.opt));
    save();
  };

  function applyView() {
    var p = product(s.pid), c = d.customer || {};
    var days = ""; for (var i = 1; i <= 28; i++) days += '<option' + (i === s.day ? " selected" : "") + '>' + i + '</option>';
    return steps(2) + '<div class="card"><h2>お申込み</h2>' +
      '<div class="row"><span class="k">商品</span><span class="v">' + E(p.name) + '</span></div>' +
      '<div class="row"><span class="k">月々の保険料</span><span class="v">' + yen(p.premium(s.age, s.opt)) + '</span></div>' +
      '<div class="row"><span class="k">ご契約者</span><span class="v">' + E(c.name) + ' 様</span></div>' +
      '<h3>保険料のお支払い（口座振替）</h3>' +
      '<div class="row"><span class="k">引落口座</span><span class="v">' + E(c.branch) + ' 普通 ' + E(c.account) + '</span></div>' +
      '<label>引落日（毎月）</label><select id="day">' + days + '</select>' +
      '<p class="note">保険料は来月から、銀行の普通預金から毎月引き落とします。銀行アプリの口座振替の一覧にも表示されます。</p>' +
      '<label class="check"><input type="checkbox" id="c1"> 重要事項説明書・契約概要・注意喚起情報を読みました</label>' +
      caution(p) + '<div id="err" class="err"></div><button class="btn" onclick="insApply()">告知へ進む</button><button class="btn sub" onclick="insGo(\'quote\')">戻る</button></div>';
  }
  window.insApply = function () {
    if (!document.getElementById("c1").checked) { document.getElementById("err").textContent = "書面の確認にチェックしてください"; return; }
    s.day = Number(document.getElementById("day").value);
    go("declare");
  };

  var QUESTIONS = ["最近 3 か月以内に、医師の診察・検査・治療・投薬を受けたことがありますか", "過去 5 年以内に、病気やけがで 7 日以上の入院をしたことがありますか", "過去 2 年以内に、健康診断で異常を指摘されたことがありますか"];
  function declareView() {
    return steps(3) + '<div class="card"><h2>健康状態の告知（ダミー）</h2>' +
      QUESTIONS.map(function (q, i) {
        return '<label>' + (i + 1) + '. ' + E(q) + '</label><select id="q' + i + '"><option value="">選んでください</option><option>いいえ</option><option>はい</option></select>';
      }).join("") +
      '<p class="note">デモのため、回答の内容にかかわらずお申込みを続けられます（実際には、お引受けできない場合があります）。</p>' +
      '<div id="err" class="err"></div><button class="btn" onclick="insDeclare()">申込を確定する</button><button class="btn sub" onclick="insGo(\'apply\')">戻る</button></div>';
  }
  window.insDeclare = function () {
    for (var i = 0; i < QUESTIONS.length; i++) if (!document.getElementById("q" + i).value) { document.getElementById("err").textContent = "すべての質問にお答えください"; return; }
    var p = product(s.pid);
    var premium = p.premium(s.age, s.opt);
    s.ops.push({ t: "ins", product: p.name, type: p.type, premium: premium, day: s.day });
    s.contracts.push({ product: p.name, type: p.type, premium: premium });
    s.done = { product: p.name, premium: premium, day: s.day };
    go("done");
  };

  function doneView() {
    var k = s.done;
    return steps(4) + '<div class="card"><h2>ご契約が完了しました</h2><div class="ok">' + E(k.product) + '<br>月々の保険料 ' + yen(k.premium) + '（毎月' + k.day + '日に普通預金から引落）</div>' +
      '<p class="note">下の「アプリに戻る」を押すと、銀行アプリの保険の一覧と口座振替に反映されます。</p>' +
      '<button class="btn sub" onclick="insGo(\'list\')">ほかの商品を見る</button></div>';
  }

  function render() {
    var v = { list: listView, detail: detailView, quote: quoteView, apply: applyView, declare: declareView, done: doneView }[s.view] || listView;
    if (s.view !== "list" && s.view !== "done" && !product(s.pid)) s.view = "list", v = listView;
    main.innerHTML = v();
    if (s.view === "quote") window.insQuote();
    YC.returnBar(d, s.ops);
  }
  save();
  render();
})();

// 自行 Web（アプリ内の WebView で開く）。住宅ローンの仮審査申込・団信の告知・契約手続き（ダミー）（要件 §5-10）
(function () {
  var E = YC.esc, yen = YC.yen;
  var main = document.getElementById("main");
  var r = YC.load("bank");
  if (r.error) { main.innerHTML = YC.errorPage(r.error, "住宅ローン 仮審査のお申込み"); return; }
  var d = r.data;
  var rates = d.rates && d.rates.length ? d.rates : [{ rateType: "変動", rate: 0.775 }, { rateType: "固定", rate: 1.85 }];
  var s = YC.loadSession(d.code) || { view: "form", man: 3000, years: 35, rateType: rates[0].rateType, income: 600, work: "", kind: "新築マンション", ops: [] };
  function save() { YC.saveSession(d.code, s); }
  function go(v) { s.view = v; save(); render(); window.scrollTo(0, 0); }
  window.loanGo = go;
  function rateOf(t) { for (var i = 0; i < rates.length; i++) if (rates[i].rateType === t) return rates[i].rate; return 0; }

  // 元利均等返済の毎月の返済額（円未満切り捨て。アプリの返済シミュレーションと同じ式）
  function monthly(principal, rate, months) {
    var m = rate / 100 / 12;
    if (m === 0) return Math.floor(principal / months);
    var p = Math.pow(1 + m, months);
    return Math.floor(principal * m * p / (p - 1));
  }
  function steps(n) {
    return '<div class="steps">' + ["お借入れ", "団信の告知", "確認", "受付"].map(function (t, i) { return '<span class="' + (i <= n ? "on" : "") + '">' + t + '</span>'; }).join("") + '</div>';
  }

  function formView() {
    var c = d.customer || {};
    var rt = rates.map(function (x) { return '<option value="' + E(x.rateType) + '"' + (x.rateType === s.rateType ? " selected" : "") + '>' + E(x.rateType) + '金利（年 ' + x.rate + '%）</option>'; }).join("");
    var yrs = ""; for (var y = 1; y <= 35; y++) yrs += '<option' + (y === s.years ? " selected" : "") + '>' + y + '</option>';
    return steps(0) + '<div class="card"><h2>お借入れの内容</h2>' +
      '<div class="row"><span class="k">お申込者</span><span class="v">' + E(c.name) + ' 様</span></div>' +
      '<div class="row"><span class="k">返済用口座</span><span class="v">' + E(c.branch) + ' 普通 ' + E(c.account) + '</span></div>' +
      '<label>お借入れ希望額（万円）</label><input type="number" id="man" value="' + s.man + '" oninput="loanCalc()">' +
      '<label>お借入れ期間（年）</label><select id="years" onchange="loanCalc()">' + yrs + '</select>' +
      '<label>金利タイプ</label><select id="rt" onchange="loanCalc()">' + rt + '</select>' +
      '<div class="ok" style="margin-top:12px" id="calc"></div>' +
      '<h3>お客さまのこと（ダミー）</h3>' +
      '<label>年収（万円）</label><input type="number" id="income" value="' + s.income + '">' +
      '<label>お勤め先</label><input type="text" id="work" value="' + E(s.work) + '" placeholder="例: ○○株式会社">' +
      '<label>物件の種類</label><select id="kind">' + ["新築マンション", "中古マンション", "新築一戸建て", "中古一戸建て", "土地と建物"].map(function (k) { return '<option' + (k === s.kind ? " selected" : "") + '>' + k + '</option>'; }).join("") + '</select>' +
      '<p class="note">金利は審査の結果やお借入れの時期によって変わります。変動金利は半年ごとに見直します。</p>' +
      '<div id="err" class="err"></div><button class="btn" onclick="loanNext()">団信の告知へ進む</button></div>';
  }
  window.loanCalc = function () {
    var man = Math.floor(Number(document.getElementById("man").value) || 0);
    var years = Number(document.getElementById("years").value);
    var rt = document.getElementById("rt").value;
    var el = document.getElementById("calc");
    if (man <= 0) { el.textContent = "お借入れ希望額を入力してください"; return; }
    var m = monthly(man * 10000, rateOf(rt), years * 12);
    el.innerHTML = "毎月の返済額のめやす <b>" + yen(m) + "</b><br>総返済額 " + yen(m * years * 12);
  };
  window.loanNext = function () {
    var man = Math.floor(Number(document.getElementById("man").value) || 0);
    var err = "";
    if (man < 100 || man > 20000) err = "お借入れ希望額は 100 万円から 2 億円の間で入力してください";
    else if (!document.getElementById("work").value.trim()) err = "お勤め先を入力してください（ダミーで構いません）";
    if (err) { document.getElementById("err").textContent = err; return; }
    s.man = man;
    s.years = Number(document.getElementById("years").value);
    s.rateType = document.getElementById("rt").value;
    s.income = Number(document.getElementById("income").value) || 0;
    s.work = document.getElementById("work").value.trim();
    s.kind = document.getElementById("kind").value;
    go("dansin");
  };

  var QUESTIONS = ["最近 3 か月以内に、医師の治療・投薬を受けたことがありますか", "過去 3 年以内に、手術を受けたこと、または 2 週間以上の治療・投薬を受けたことがありますか", "手や足の欠損・機能障害、視力・聴力の障害がありますか"];
  function dansinView() {
    return steps(1) + '<div class="card"><h2>団体信用生命保険（団信）の告知（ダミー）</h2>' +
      '<p class="note">住宅ローンのご返済中に万一のことがあったとき、保険金でローンの残りを返済する保険です。ご加入がお借入れの条件です。</p>' +
      QUESTIONS.map(function (q, i) { return '<label>' + (i + 1) + '. ' + E(q) + '</label><select id="q' + i + '"><option value="">選んでください</option><option>いいえ</option><option>はい</option></select>'; }).join("") +
      '<p class="note">デモのため、回答の内容にかかわらずお申込みを続けられます。</p>' +
      '<div id="err" class="err"></div><button class="btn" onclick="loanDansin()">確認へ進む</button><button class="btn sub" onclick="loanGo(\'form\')">戻る</button></div>';
  }
  window.loanDansin = function () {
    for (var i = 0; i < QUESTIONS.length; i++) if (!document.getElementById("q" + i).value) { document.getElementById("err").textContent = "すべての質問にお答えください"; return; }
    go("confirm");
  };

  function confirmView() {
    var m = monthly(s.man * 10000, rateOf(s.rateType), s.years * 12);
    return steps(2) + '<div class="card"><h2>お申込み内容の確認</h2>' +
      '<div class="row"><span class="k">お借入れ希望額</span><span class="v">' + yen(s.man * 10000) + '</span></div>' +
      '<div class="row"><span class="k">お借入れ期間</span><span class="v">' + s.years + ' 年</span></div>' +
      '<div class="row"><span class="k">金利タイプ</span><span class="v">' + E(s.rateType) + '（年 ' + rateOf(s.rateType) + '%）</span></div>' +
      '<div class="row"><span class="k">毎月の返済額のめやす</span><span class="v">' + yen(m) + '</span></div>' +
      '<div class="row"><span class="k">年収・お勤め先</span><span class="v">' + YC.num(s.income) + ' 万円・' + E(s.work) + '</span></div>' +
      '<div class="row"><span class="k">物件の種類</span><span class="v">' + E(s.kind) + '</span></div>' +
      '<label class="check"><input type="checkbox" id="c1"> 個人信用情報機関への照会と、審査のための情報の利用に同意します</label>' +
      '<div id="err" class="err"></div><button class="btn" onclick="loanSubmit()">仮審査を申し込む</button><button class="btn sub" onclick="loanGo(\'dansin\')">戻る</button></div>';
  }
  window.loanSubmit = function () {
    if (!document.getElementById("c1").checked) { document.getElementById("err").textContent = "同意にチェックしてください"; return; }
    s.ops = [];
    if (!YC.record(d, s, { t: "loan", amount: s.man * 10000, years: s.years, rateType: s.rateType })) return;
    go("done");
  };

  function doneView() {
    return steps(3) + '<div class="card"><h2>仮審査のお申込みを受け付けました</h2>' +
      '<div class="ok">審査の状況は、アプリの「住宅ローン」でご確認いただけます。状況が変わるとお知らせが届きます。</div>' +
      '<h3>この後の流れ</h3>' +
      '<div class="row"><span class="k">1. 仮審査</span><span class="v">結果をお知らせします</span></div>' +
      '<div class="row"><span class="k">2. 本審査</span><span class="v">アプリから書類を提出</span></div>' +
      '<div class="row"><span class="k">3. ご契約手続き</span><span class="v">このサイトで行います</span></div>' +
      '<div class="row"><span class="k">4. お借入れ</span><span class="v">普通預金に入金</span></div>' +
      '<button class="btn sub" onclick="loanGo(\'contract\')">ご契約手続きの画面を見る（見本）</button></div>';
  }

  function contractView() {
    return '<div class="card"><h2>ご契約手続き（見本）</h2>' +
      '<p>本審査の承認後に、金銭消費貸借契約と抵当権設定契約を、このサイトで電子契約します。</p>' +
      '<label class="check"><input type="checkbox" disabled> 金銭消費貸借契約書の内容を確認しました</label>' +
      '<label class="check"><input type="checkbox" disabled> 抵当権設定契約書の内容を確認しました</label>' +
      '<button class="btn" disabled>電子署名する</button>' +
      '<p class="note">デモでは手続きはできません。お借入れの実行はアプリの管理画面で「承認」のあと「返済中」に進めると再現できます。</p>' +
      '<button class="btn sub" onclick="loanGo(\'done\')">戻る</button></div>';
  }

  function render() {
    var v = { form: formView, dansin: dansinView, confirm: confirmView, done: doneView, contract: contractView }[s.view] || formView;
    main.innerHTML = v();
    if (s.view === "form") window.loanCalc();
    YC.returnBar(d, s);
  }
  save();
  render();
})();

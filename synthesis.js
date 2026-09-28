// ==========================================================================
// 羅占盤 総合鑑定のまとめ（9占術の一致を見せる）
// ==========================================================================
// なぜ要るか
//   9つの占術を同時に使う意味は「複数の占術が同じことを言っている」ことにある。
//   16タイプ判定（type-judge.js）は軸ごとにどの占術が投票したかを持っているのに、
//   これまで画面には出していなかった。結果の冒頭でそれを見せる。
//
// 数え方
//   「何票か」ではなく「何種類の占術が一致したか」で数える。
//   西洋占星術は太陽・月・火星…と1人で何票も入れるので、票数で数えると一致しているように見えてしまう。
//
// 入口: buildSynthesisHtml(d)  … 総合タブの冒頭に差し込むHTML
//       buildSynthesis(d)      … 画面を作らずに中身だけ返す（テスト用）
// 依存: index.html の calcJintai / calcNumerology / calcKyusei / calcMaya / calcShukuyo /
//       ayanamsha / norm360 / calcPersonalityRadar / calcDayun / calcZiweiDayun / calcDasha /
//       tenGod / getCurrentAge / buildParadoxLines と TypeJudge
// ==========================================================================
(function (global) {
  'use strict';

  const SYS = ["西洋占星術", "四柱推命", "紫微斗数", "算命学", "数秘術", "九星気学", "マヤ暦", "宿曜", "インド占星術"];
  const SHORT = { "西洋占星術": "西洋", "四柱推命": "四柱", "紫微斗数": "紫微", "算命学": "算命", "数秘術": "数秘", "九星気学": "九星", "マヤ暦": "マヤ", "宿曜": "宿曜", "インド占星術": "インド" };

  // 16タイプ判定のルール名 → どの占術か（順番が大事: 九星の「三碧木星」を西洋の「木星」と取り違えない）
  function systemOfRule(name) {
    const n = String(name).replace(/^\[副\]/, "");
    if (/[一二三四五六七八九][白黒碧緑黄赤紫](水|土|木|金|火)星|本命星/.test(n)) return "九星気学";
    if (/(貫索|石門|鳳閣|調舒|禄存|司禄|車騎|牽牛|龍高|玉堂)星|天(南|禄|胡|極|馳|恍|貴|将|印|庫|堂|報)星/.test(n)) return "算命学";
    if (/命宮|化忌|紅鸞|文昌/.test(n)) return "紫微斗数";
    if (/ラグナ|ラーシ|ダヌ|シンハ|クンバ|カンニャー|マカラ/.test(n)) return "インド占星術";
    if (/紋章|^(赤い|白い|青い|黄色い)/.test(n)) return "マヤ暦";
    if (/宿/.test(n)) return "宿曜";
    if (/^(LP|BD)/.test(n)) return "数秘術";
    if (/透干|日主|日支|五行|^(水|火|木|金)が|柱の十神/.test(n)) return "四柱推命";
    return "西洋占星術";
  }
  // 性格レーダーの投票者名（"西洋☽" など）→ どの占術か
  function systemOfVoter(v) {
    const pre = [["西洋", "西洋占星術"], ["四柱", "四柱推命"], ["紫微", "紫微斗数"], ["算命", "算命学"], ["数秘", "数秘術"], ["九星", "九星気学"], ["マヤ", "マヤ暦"], ["宿曜", "宿曜"], ["印度", "インド占星術"]];
    for (const [p, s] of pre) if (String(v).indexOf(p) === 0) return s;
    return null;
  }
  const uniq = arr => SYS.filter(s => arr.indexOf(s) >= 0);   // 9占術の並び順にそろえる

  // 4つの軸（16タイプの元）。左右のどちらに寄ったかを、ふつうの言葉で言う
  const AXES = [
    { k: "a1", q: "価値観", pole: { "革新": "新しいやり方を自分で作る", "継承": "受け継いだものを磨き上げる" }, short: { "革新": "自分で作る", "継承": "受け継ぐ" } },
    { k: "a2", q: "興味の向き", pole: { "広い": "興味を広く持ち、人や物事をつなぐ", "狭い": "一つのことを深く掘り下げる" }, short: { "広い": "広く持つ", "狭い": "深く掘る" } },
    { k: "a3", q: "役割", pole: { "リーダー": "自分が先頭に立つ", "参謀": "支える側・裏で動かす側に回る" }, short: { "リーダー": "先頭に立つ", "参謀": "支える" } },
    { k: "a4", q: "気質", pole: { "楽天": "まず楽観的に動いてみる", "慎重": "動く前に慎重に構える" }, short: { "楽天": "楽観的", "慎重": "慎重" } },
  ];
  // 性格レーダーの8つの資質
  const TRAITS = {
    action: { label: "行動力", desc: "考えるより先に動き、現場で突破する" },
    think: { label: "思考力", desc: "情報を集めて整理し、筋道を立てて判断する" },
    social: { label: "社交性", desc: "人とつながることで力が出る" },
    creative: { label: "創造性", desc: "今までにない組み合わせを生み出す" },
    stable: { label: "粘り強さ", desc: "動じずに、長い時間をかけて積み上げる" },
    intuition: { label: "感受性", desc: "言葉になる前の空気や違和感をつかむ" },
    leadership: { label: "統率力", desc: "方向を示し、人を動かし、責任を引き受ける" },
    nurture: { label: "面倒見", desc: "人の気持ちを汲み、育て、安心させる" },
  };

  function inputs(d) {
    const sm = calcJintai(d);
    const nu = calcNumerology(d.y, d.m, d.d);
    const ky = calcKyusei(d.y, d.m, d);
    const ma = calcMaya(d.y, d.m, d.d);
    const si = calcShukuyo(d.moonLon);
    let jy = null;
    if (typeof ayanamsha === "function") {
      const ay = ayanamsha(d.jd);
      jy = {
        sunRashi: Math.floor(norm360(d.sunLon - ay) / 30),
        moonRashi: Math.floor(norm360(d.moonLon - ay) / 30),
        lagnaRashi: d.ascLon !== null ? Math.floor(norm360(d.ascLon - ay) / 30) : null,
      };
    }
    return { sm, nu, ky, ma, si, jy };
  }

  // ① 4つの軸で、どの占術がどちらに入れたか
  function axisAgreement(tj) {
    return AXES.map(ax => {
      const a = tj[ax.k];
      const plusSys = uniq(a.plusEv.map(e => systemOfRule(e.n)));
      const minusSys = uniq(a.minusEv.map(e => systemOfRule(e.n)));
      const winIsPlus = a.winner === a.pn;
      const winSys = winIsPlus ? plusSys : minusSys;
      const loseSys = winIsPlus ? minusSys : plusSys;
      const tot = a.plus + a.minus;
      const share = tot ? Math.round((winIsPlus ? a.plus : a.minus) / tot * 100) : 50;
      // 強さは「画面に出す占術の数」で決める。判定エンジンは重みの合計で勝ち負けを決めるので、
      // 勝った側の占術が反対側より少ないこともある。そのときに「一致した」と言い切らない。
      const nW = winSys.length, nL = loseSys.length;
      const level = (a.ambiguous || nW <= nL) ? "split" : (nW - nL >= 2 && a.label.indexOf("絶対") === 0 ? "clear" : "lean");
      return {
        q: ax.q, winner: a.winner, loser: winIsPlus ? a.mn : a.pn,
        text: ax.pole[a.winner], otherText: ax.pole[winIsPlus ? a.mn : a.pn],
        short: ax.short[a.winner], otherShort: ax.short[winIsPlus ? a.mn : a.pn],
        winSys, loseSys, share, level,
      };
    });
  }

  // ② 複数の占術がそろって示す資質（占術の種類で数える）
  function traitAgreement(d, sm, nu) {
    const votes = calcPersonalityRadar(d, sm, nu);
    const voters = votes.__voters || {};
    return Object.keys(TRAITS).map(id => {
      const sys = uniq([...(voters[id] || [])].map(systemOfVoter).filter(Boolean));
      return { id, label: TRAITS[id].label, desc: TRAITS[id].desc, sys, n: sys.length };
    }).sort((a, b) => b.n - a.n || Object.keys(TRAITS).indexOf(a.id) - Object.keys(TRAITS).indexOf(b.id));
  }

  // ③ 今の時期と、次に複数の占術が同時に「変わり目」を示す年齢
  function timing(d, nu) {
    const age = getCurrentAge(d.y, d.m, d.d);
    const now = [];
    // 四柱推命: 今の大運の十神
    const dy = calcDayun(d);
    const cur = dy.find(du => age >= du.startAge && age < du.endAge);
    if (cur) {
      const ten = tenGod(d.day.stem, cur.stem);
      const TEN = { "比肩": "自分の力で立つ", "劫財": "競争の中で磨かれる", "食神": "楽しみ、作り出す", "傷官": "才能があふれ出す", "偏財": "チャンスが広がる", "正財": "安定を築く", "偏官": "試練を超えて伸びる", "正官": "地位と信頼を得る", "偏印": "新しく学び直す", "正印": "知恵が深まる" };
      const act = ["比肩", "劫財", "食神", "傷官", "偏財", "正財"].indexOf(ten) >= 0 ? "動く" : ["偏印", "正印"].indexOf(ten) >= 0 ? "待つ" : "慎重";
      now.push({ sys: "四柱推命", say: act, why: (TEN[ten] || ten) + "時期（" + cur.startAge + "〜" + (cur.endAge - 1) + "歳）" });
    }
    // 数秘術: 今年の個人年
    const PY = { 1: "始める年", 2: "人との関係を育てる年", 3: "表に出す年", 4: "土台を固める年", 5: "変化に乗る年", 6: "責任を果たす年", 7: "内側を見つめる年", 8: "成果を受け取る年", 9: "区切りをつけて手放す年" };
    const pyAct = [1, 5].indexOf(nu.personalYear) >= 0 ? "動く" : [2, 7].indexOf(nu.personalYear) >= 0 ? "待つ" : null;
    now.push({ sys: "数秘術", say: pyAct, why: (PY[nu.personalYear] || "") });
    const cnt = { "動く": 0, "待つ": 0, "慎重": 0 };
    now.forEach(x => { if (x.say) cnt[x.say]++; });
    const verdict = cnt["動く"] > cnt["待つ"] && cnt["動く"] > cnt["慎重"] ? "動く時期" : cnt["待つ"] > cnt["動く"] && cnt["待つ"] > cnt["慎重"] ? "待つ時期" : "慎重に動く時期";

    // 10年単位の運を持つ3つの占術が、同時に「変わり目」を示す年齢
    const MAX = 90;
    const flags = Array.from({ length: MAX }, () => []);
    const mark = (from, to, sys) => { for (let a = Math.max(0, Math.floor(from)); a < Math.min(MAX, Math.floor(to)); a++) if (flags[a].indexOf(sys) < 0) flags[a].push(sys); };
    dy.forEach(du => { if (["偏官", "傷官", "劫財", "偏印"].indexOf(tenGod(d.day.stem, du.stem)) >= 0) mark(du.startAge, du.endAge, "四柱推命"); });
    try { calcZiweiDayun(d, d.lifeIdx).forEach(du => { if (["遷移宮", "疾厄宮", "官禄宮", "命宮"].indexOf(du.palaceName) >= 0) mark(du.startAge, du.endAge, "紫微斗数"); }); } catch (e) { }
    try {
      const ds = calcDasha(norm360(d.moonLon - ayanamsha(d.jd)), d.y);
      ds.dashas.forEach(x => { if (["ラーフ", "ケートゥ", "土星", "火星"].indexOf(x.lord) >= 0) mark(x.startAge, x.endAge, "インド占星術"); });
    } catch (e) { }
    const spans = [];
    for (let a = 0; a < MAX; a++) {
      if (flags[a].length >= 2) {
        const last = spans[spans.length - 1];
        const sys = uniq(flags[a]);
        if (last && last.end === a) { last.end = a + 1; last.sys = uniq(last.sys.concat(sys)); }
        else spans.push({ start: a, end: a + 1, sys });
      }
    }
    const nowSpan = spans.find(s => age >= s.start && age < s.end) || null;
    const nextSpan = spans.find(s => s.start > age) || null;
    return { age, now, verdict, nowSpan, nextSpan };
  }

  function buildSynthesis(d) {
    const { sm, nu, ky, ma, si, jy } = inputs(d);
    const tj = TypeJudge.judge(d, sm, nu, ky, ma, si, jy);
    const axes = axisAgreement(tj);
    const traits = traitAgreement(d, sm, nu);
    let paradox = [];
    try { paradox = buildParadoxLines(d, tj, tj.type); } catch (e) { }
    return { tj, type: tj.type, axes, traits, top: traits.slice(0, 3), timing: timing(d, nu), paradox };
  }

  // ===== 画面 =====
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const IMG = {
    "ヒーロー": "0Hero01.png", "レボリューショナリー": "0Revolutionary01.png", "トリックスター": "0Trickster01.png", "ヴィジョナリー": "0Visionary01.png",
    "パイオニア": "0Pioneer01.png", "ローンウルフ": "0Lonewolf01.png", "シーカー": "0Seeker01.png", "マーベリック": "0Maverick01.png",
    "ソブリン": "0Sovereign01.png", "エンペラー": "0Emperor01.png", "セージ": "0Sage01.png", "オラクル": "0Oracle01.png",
    "アルチザン": "0Artisan01.png", "ガーディアン": "0Guardian01.png", "ケアテイカー": "0Caretaker01.png", "ハーミット": "0Hermit01.png",
  };
  // 9つの占術の丸（一致した占術だけ色が付く）
  function dots(sys, cls) {
    return '<span class="rs-dots">' + SYS.map(s => '<i class="' + (sys.indexOf(s) >= 0 ? cls : "") + '" title="' + s + '"></i>').join("") + "</span>";
  }
  // 占術名は押すとその占術のタブの「根拠」へ飛ぶ
  const names = sys => sys.map(s => '<a class="rs-go" onclick="RSynth.goTab(' + SYS.indexOf(s) + ')">' + SHORT[s] + "</a>").join("・");

  function buildSynthesisHtml(d) {
    const r = buildSynthesis(d);
    const t = r.type;
    const img = IMG[t.name] ? "16typecard/" + IMG[t.name] : "";
    const LEVEL = { clear: "はっきり一致", lean: "やや一致", split: "意見が割れた" };
    let h = '<div id="type-result-section" class="rs">';

    // ── 1. 答え（タイプ＋一言） ──
    h += '<div class="rs-hero">' +
      (img ? '<img src="' + img + '" alt="' + esc(t.name) + '" class="rs-img">' : "") +
      '<div class="rs-hero-txt">' +
      '<div class="rs-kicker">9つの占術をまとめると、あなたは</div>' +
      '<div class="rs-type">' + esc(t.name) + "</div>" +
      '<div class="rs-desc">' + esc(t.desc) + "</div>" +
      (r.paradox.length ? '<ul class="rs-paradox">' + r.paradox.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "") +
      "</div></div>";

    // ── 2. 占術が一致したところ（4つの軸） ──
    h += '<section class="rs-sec"><h3>9つの占術が一致したところ</h3>' +
      '<p class="rs-lead">占術ごとに見方は違う。それでも同じ方向を指した占術が多いほど、その傾向は確かだと読める。<b>占術の名前を押すと、その占術が何を見てそう判断したかが分かる。</b></p>' +
      '<div class="rs-axes">' +
      r.axes.map(a => {
        // 割れたときは片方に言い切らず、両方の顔があると言う
        const main = a.level === "split"
          ? "両方の顔がある：「" + esc(a.text) + "」と「" + esc(a.otherText) + "」"
          : esc(a.text);
        const side = (label, sys, cls) => '<div class="rs-side rs-side-' + cls + '"><span class="rs-side-l">' + label + "</span>" + dots(sys, cls) +
          '<span class="rs-n"><b>' + sys.length + "</b></span>" + '<span class="rs-names">' + (sys.length ? names(sys) : "なし") + "</span></div>";
        return '<div class="rs-axis rs-' + a.level + '">' +
          '<div class="rs-axis-head"><span class="rs-q">' + a.q + '</span><span class="rs-badge">' + LEVEL[a.level] + "</span></div>" +
          '<div class="rs-axis-main">' + main + "</div>" +
          side(a.short, a.winSys, "on") +
          side(a.otherShort, a.loseSys, "off") +
          "</div>";
      }).join("") +
      "</div></section>";

    // ── 3. そろって示す強み ──
    h += '<section class="rs-sec"><h3>複数の占術がそろって示す強み</h3><ol class="rs-traits">' +
      r.top.map(x => '<li><div class="rs-trait-head"><b>' + x.label + '</b><span class="rs-n"><b>' + x.n + "</b>/9の占術</span></div>" +
        '<div class="rs-trait-desc">' + x.desc + "</div>" +
        '<div class="rs-axis-sys">' + dots(x.sys, "on") + '<span class="rs-names">' + names(x.sys) + "</span></div></li>").join("") +
      "</ol></section>";

    // ── 4. 今の時期 ──
    const tm = r.timing;
    const vcls = tm.verdict === "動く時期" ? "go" : tm.verdict === "待つ時期" ? "wait" : "care";
    let turn = "";
    if (tm.nowSpan) turn = "<b>今はちょうど変わり目</b>（" + tm.nowSpan.start + "〜" + (tm.nowSpan.end - 1) + "歳・" + names(tm.nowSpan.sys) + "がそろって示す）。";
    else if (tm.nextSpan) turn = "次の大きな変わり目は <b>" + tm.nextSpan.start + "〜" + (tm.nextSpan.end - 1) + "歳</b>（" + names(tm.nextSpan.sys) + "がそろって示す）。";
    else turn = "この先、複数の占術が同時に大きな変わり目を示す時期は見当たらない。";
    h += '<section class="rs-sec"><h3>今の時期</h3>' +
      '<div class="rs-time rs-' + vcls + '"><div class="rs-verdict">' + tm.verdict + "</div>" +
      '<ul class="rs-why">' + tm.now.map(x => "<li><b>" + SHORT[x.sys] + "</b> " + esc(x.why) + (x.say ? "（" + x.say + "）" : "") + "</li>").join("") + "</ul>" +
      '<p class="rs-turn">' + turn + "</p></div>" +
      '<p class="rs-small">変わり目は、10年ごとの運を持つ3つの占術（四柱推命・紫微斗数・インド占星術）のうち2つ以上が同時に「変化」を示す年齢。</p>' +
      "</section>";

    // ── 5. 信頼度とシェア ──
    const conf = r.tj.confidence;
    const confNote = d.tm === "unknown" ? "出生時刻が不明なので、時刻が要る判定（アセンダント・命宮など）は使っていない。" : "";
    h += '<div class="rs-foot"><span class="rs-conf">判定の確かさ: <b>' + conf + "</b></span>" + (confNote ? '<span class="rs-small">' + confNote + "</span>" : "") +
      '<button class="rs-share" onclick="shareTypeResult()">結果をシェア</button><div id="share-status" class="rs-small"></div></div>';

    h += "</div>";
    return h;
  }

  // ===== 各占術のタブの冒頭：「総合鑑定の中でのこの占術」 =====
  // 総合鑑定で「役割＝支える（西洋・インド）」と出たとき、西洋のタブで「なぜそう判断したか」を見せる。
  // 根拠は16タイプ判定のルール名（type-judge.js）と、資質レーダーの投票（calcPersonalityRadar）をそのまま使う。

  // 資質レーダーの投票者名 → 何を見て投票したか
  const PART = {
    "西洋": "太陽の星座", "西洋☽": "月の星座", "西洋ASC": "上昇点", "西洋♂": "火星", "西洋♀": "金星", "西洋♆合": "海王星と個人天体の重なり",
    "四柱": "日主", "四柱官": "官星（正官・偏官）", "四柱食傷": "食神・傷官", "四柱財": "財星（正財・偏財）",
    "四柱水": "五行の偏り（水）", "四柱火": "五行の偏り（火）", "四柱木": "五行の偏り（木）", "四柱金": "五行の偏り（金）",
    "紫微": "命宮の主星", "紫微武": "命宮の武曲", "紫微官禄": "官禄宮の星",
    "算命中": "中央の星", "算命石門": "中央の石門星", "算命東": "東の星", "算命南": "南の星",
    "数秘LP": "ライフパスナンバー", "数秘LP11": "ライフパス11", "数秘LP33": "ライフパス33", "数秘BD": "バースデーナンバー",
    "九星": "本命星", "マヤ紋": "太陽の紋章", "マヤ黄人": "黄色い人の紋章", "マヤ地球": "赤い地球の紋章", "マヤWS": "ウェイブスペル",
    "宿曜": "本命宿", "印度": "月のナクシャトラ",
  };
  // 出生時刻がないと使えない材料
  const NEED_TIME = {
    "西洋占星術": "出生時刻が不明なので、上昇点（ASC）を使う判定はしていない。",
    "紫微斗数": "出生時刻が不明なので、命宮を使う判定はしていない。紫微斗数の票が少ないのはそのため。",
    "インド占星術": "出生時刻が不明なので、ラグナ（上昇宮）を使う判定はしていない。",
  };
  const ruleText = n => String(n).replace(/^\[副\]/, "").replace(/\(/g, "（").replace(/\)/g, "）") + (/^\[副\]/.test(n) ? "〔補助〕" : "");

  function bridgeFor(d, r, sys) {
    // 4つの軸：この占術がどちらに入れたか
    const axes = AXES.map((ax, i) => {
      const a = r.tj[ax.k], all = r.axes[i];
      const plus = a.plusEv.filter(e => systemOfRule(e.n) === sys), minus = a.minusEv.filter(e => systemOfRule(e.n) === sys);
      const wp = plus.reduce((s, e) => s + e.p, 0), wm = minus.reduce((s, e) => s + e.p, 0);
      let side = null;
      if (wp || wm) side = wp > wm ? a.pn : wm > wp ? a.mn : "both";
      return {
        q: ax.q, overall: all, side, agree: side && side !== "both" ? side === a.winner : null,
        sideShort: side && side !== "both" ? ax.short[side] : null,
        plus: plus.map(e => ruleText(e.n)), minus: minus.map(e => ruleText(e.n)),
        pShort: ax.short[a.pn], mShort: ax.short[a.mn],
      };
    });
    // 資質：この占術が何に投票したか
    const pre = { "西洋占星術": "西洋", "四柱推命": "四柱", "紫微斗数": "紫微", "算命学": "算命", "数秘術": "数秘", "九星気学": "九星", "マヤ暦": "マヤ", "宿曜": "宿曜", "インド占星術": "印度" }[sys];
    const topIds = r.top.map(x => x.id);
    const traits = [];
    let voters = {};
    try { voters = calcPersonalityRadar(d, calcJintai(d), calcNumerology(d.y, d.m, d.d)).__voters || {}; } catch (e) { }
    Object.keys(TRAITS).forEach(id => {
      const parts = [...(voters[id] || [])].filter(v => v.indexOf(pre) === 0).map(v => PART[v] || v);
      if (parts.length) traits.push({ id, label: TRAITS[id].label, parts, top: topIds.indexOf(id) >= 0 });
    });
    traits.sort((a, b) => (b.top - a.top) || (topIds.indexOf(a.id) - topIds.indexOf(b.id)));
    // 時期
    const tm = r.timing, when = [];
    tm.now.filter(x => x.sys === sys).forEach(x => when.push("今の時期の判断に参加：" + esc(x.why) + (x.say ? "（" + x.say + "）" : "")));
    const span = tm.nowSpan && tm.nowSpan.sys.indexOf(sys) >= 0 ? tm.nowSpan : tm.nextSpan && tm.nextSpan.sys.indexOf(sys) >= 0 ? tm.nextSpan : null;
    if (span) when.push((span === tm.nowSpan ? "今の変わり目" : "次の変わり目") + "（" + span.start + "〜" + (span.end - 1) + "歳）を示した占術の1つ");
    return { axes, traits, when };
  }

  function bridgeHtml(d, r, sys) {
    const b = bridgeFor(d, r, sys), i = SYS.indexOf(sys);
    // 総合で「意見が割れた」軸は、同じ・反対とは言わずに別に数える
    const voted = b.axes.filter(a => a.side);
    const settled = voted.filter(a => a.overall.level !== "split");
    const agree = settled.filter(a => a.agree === true), against = settled.filter(a => a.agree === false);
    const split = voted.filter(a => a.overall.level === "split");
    let sum;
    if (!voted.length) sum = "4つの軸のどれにも、この占術の判定は入っていない。";
    else sum = "4つの軸のうち <b>" + voted.length + "つ</b>に判定を出した。" +
      (settled.length ? "総合と同じ方向が <b>" + agree.length + "つ</b>" + (against.length ? "、<b class=\"rs-against\">反対が " + against.length + "つ</b>（" + against.map(a => a.q).join("・") + "）。反対の軸は、この占術だけ別の顔を見ている。" : "。") : "") +
      (split.length ? "（" + split.map(a => a.q).join("・") + "は、占術全体で意見が割れた軸）" : "");
    let h = '<div class="rs-bridge" id="rs-bridge-' + i + '">' +
      '<div class="rs-bridge-top"><span class="rs-kicker">総合鑑定の中での' + sys + '</span><a class="rs-go rs-back" onclick="RSynth.goSummary()">← 総合鑑定に戻る</a></div>' +
      '<p class="rs-bridge-sum">' + sum + "</p>";
    h += '<div class="rs-brows">' + b.axes.map(a => {
      const ov = a.overall;
      const ovTxt = ov.level === "split" ? "意見が割れた" : ov.short;
      let mark, cls;
      if (!a.side) { mark = "判定なし"; cls = "none"; }
      else if (a.side === "both") { mark = "両方に入れた"; cls = "both"; }
      else if (ov.level === "split") { mark = a.agree ? "多い側と同じ" : "少ない側"; cls = "both"; }
      else if (a.agree) { mark = "✓ 総合と同じ"; cls = "agree"; }
      else { mark = "総合と反対"; cls = "against"; }
      const ev = [];
      if (a.plus.length) ev.push('<span class="rs-ev-l">' + a.pShort + "：</span>" + a.plus.join("、"));
      if (a.minus.length) ev.push('<span class="rs-ev-l">' + a.mShort + "：</span>" + a.minus.join("、"));
      return '<div class="rs-brow rs-b-' + cls + '">' +
        '<div class="rs-bq">' + a.q + '<span class="rs-bov">総合：' + ovTxt + "</span></div>" +
        '<div class="rs-bme"><b>' + (a.sideShort || (a.side === "both" ? "両方" : "—")) + '</b><span class="rs-bmark">' + mark + "</span></div>" +
        '<div class="rs-bev">' + (ev.length ? ev.join("<br>") : "この占術の材料には、この軸に効くものがなかった") + "</div></div>";
    }).join("") + "</div>";
    if (b.traits.length) {
      h += '<div class="rs-btraits"><span class="rs-bt-h">資質への投票</span>' + b.traits.map(t =>
        '<span class="rs-bt' + (t.top ? " rs-bt-top" : "") + '">' + t.label + (t.top ? "★" : "") + '<small>（' + t.parts.join("・") + "）</small></span>").join("") +
        (b.traits.some(t => t.top) ? '<span class="rs-small">★＝総合鑑定の「そろって示す強み」トップ3に入った資質</span>' : "") + "</div>";
    }
    if (b.when.length) h += '<ul class="rs-bwhen">' + b.when.map(w => "<li>" + w + "</li>").join("") + "</ul>";
    if (d.tm === "unknown" && NEED_TIME[sys]) h += '<p class="rs-small">' + NEED_TIME[sys] + "</p>";
    return h + "</div>";
  }

  // 9つのタブの先頭に差し込む（renderAll の最後で呼ぶ）
  function decorateTabs(d) {
    const r = buildSynthesis(d);
    SYS.forEach((sys, i) => {
      const el = document.getElementById("tab" + i);
      if (!el) return;
      const old = el.querySelector(".rs-bridge");
      if (old) old.remove();
      el.insertAdjacentHTML("afterbegin", bridgeHtml(d, r, sys));
    });
    Object.keys(TAB_FOLDS).forEach(i => foldTab(document.getElementById("tab" + i), TAB_FOLDS[i]));
  }

  // 長いタブ：要点の節は上に残し、詳しい節を末尾の「もっと詳しく」に畳む（消さない）
  const TAB_FOLDS = {
    6: { // マヤ暦
      fold: [
        { t: "マヤ暦の仕組み", hint: "260日のカレンダーと、紋章と音の組み合わせ方" },
        { t: "ツォルキン表", hint: "260マスの中のあなたの位置と、縁のある紋章の場所" },
        { t: "関係KIN", hint: "ガイド・類似・反対・神秘の4つの紋章と、その人との付き合い方" },
        { t: "人生の時間軸", hint: "52歳の生まれ直しと、毎年の誕生日に巡る年のKIN" },
      ],
    },
    8: { // インド占星術
      fold: [
        { t: "インド占星術の読み方", hint: "西洋と約24°ずれる理由と、月を重く見る理由" },
        { t: "西洋占星術との比較", hint: "太陽・月・上昇点が西洋とインドでどう変わるか" },
        { t: "ラーシチャート", hint: "南インド式の命盤" },
        { t: "惑星の配置", hint: "9つの惑星それぞれの星座と読み方" },
      ],
      split: { t: "ダシャー", from: "アンタルダシャー（小運）", title: "ダシャーの詳細 — 小運と全期間の一覧", hint: "いまの大運の中の小運と、0〜120歳の大運の並び" },
    },
  };

  function foldTab(el, cfg) {
    if (!el || el.querySelector(".rs-tabfold")) return;
    // 節＝.section-title から次の .section-title（または .note）の手前まで
    const kids = Array.from(el.children);
    const sections = [];
    kids.forEach(k => {
      if (k.classList.contains("section-title")) sections.push({ title: k, nodes: [] });
      else if (k.classList.contains("note")) sections.push(null);
      else if (sections.length && sections[sections.length - 1]) sections[sections.length - 1].nodes.push(k);
    });
    const secs = sections.filter(Boolean);
    const find = t => secs.find(s => s.title.textContent.indexOf(t) >= 0);
    const groups = [];
    cfg.fold.forEach(f => {
      const s = find(f.t);
      if (s) groups.push({ order: kids.indexOf(s.title), title: s.title.textContent.trim(), hint: f.hint, drop: [s.title], nodes: s.nodes });
    });
    if (cfg.split) {
      const s = find(cfg.split.t);
      const at = s ? s.nodes.findIndex(n => n.textContent.indexOf(cfg.split.from) >= 0) : -1;
      if (at >= 0) groups.push({ order: kids.indexOf(s.nodes[at]), title: cfg.split.title, hint: cfg.split.hint, drop: [], nodes: s.nodes.slice(at) });
    }
    if (!groups.length) return;
    groups.sort((a, b) => a.order - b.order);
    const wrap = document.createElement("div");
    wrap.className = "rs-tabfolds";
    wrap.innerHTML = '<div class="rs-more-title">もっと詳しく</div>';
    groups.forEach(g => {
      const det = document.createElement("details");
      det.className = "rs-fold rs-tabfold";
      det.innerHTML = "<summary>" + g.title + "<span>" + g.hint + '</span></summary><div class="rs-fold-body"></div>';
      const body = det.querySelector(".rs-fold-body");
      g.nodes.forEach(n => body.appendChild(n));
      g.drop.forEach(n => n.remove());
      wrap.appendChild(det);
    });
    const note = Array.from(el.children).find(k => k.classList.contains("note"));
    el.insertBefore(wrap, note || null);
  }
  function goTab(i) {
    if (typeof setTab === "function") setTab(i);
    const el = document.getElementById("rs-bridge-" + i);
    if (el) {
      const tabs = document.querySelector(".tabs");
      const off = (tabs ? tabs.getBoundingClientRect().bottom : 0) + 12;
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - off });
      el.classList.remove("rs-flash"); void el.offsetWidth; el.classList.add("rs-flash");
    }
  }
  function goSummary() {
    if (typeof setTab === "function") setTab(10);
    const el = document.querySelector(".rs-axes");
    if (el) {
      const tabs = document.querySelector(".tabs");
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - (tabs ? tabs.getBoundingClientRect().bottom : 0) - 60 });
    }
  }

  global.RSynth = { buildSynthesis, buildSynthesisHtml, systemOfRule, systemOfVoter, SYS, bridgeFor, decorateTabs, goTab, goSummary };
  global.buildSynthesisHtml = buildSynthesisHtml;
})(typeof window !== "undefined" ? window : globalThis);

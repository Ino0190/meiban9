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

  // 人格の4段（動機→思考→行動→葛藤）。2026-10-23 外部レビュー「16タイプの名前よりも、動機・思考・行動・葛藤の
  //   構造のほうが、9占術を並べるより人格アーキテクチャとして説得力がある」。4つの軸を「どう動く人か」の順に言い直す
  const ARCH_MOT = {
    "革新": "いまのやり方に違和感を持つと、黙っていられない。批判で終わらせず、自分で代わりを作りたくなる。",
    "継承": "受け継いだものを守り、磨き上げたい。質を落とさないことが動機になる。急に変えることには慎重になる。",
  };
  const ARCH_THINK = {   // [反対が1つ以下, 反対が2つ以上]
    "広い": ["まず広く見渡し、違う分野のものをつなげて考える。", "広く探索し、気になったものは深く掘って確かめる。"],
    "狭い": ["一つのことを深く掘り下げ、確かめてから次に進む。", "深く掘るのが基本だが、周りを見渡して位置を確かめる目も持っている。"],
  };
  const ARCH_ACT = {   // 役割 × 価値観
    "リーダー_革新": "自分で新しい方法を試作し、形にしてから人を巻き込む。説明より、動くものを見せて進める。",
    "リーダー_継承": "人の前に立ち、確かな形を積み上げる。決めたことを続ける力が信用になる。",
    "参謀_革新": "表に立たずに、仕組みのほうを作り替えて動かす。目立つ場所より、効く場所を選ぶ。",
    "参謀_継承": "支える側から、続く形を整える。人が動きやすいように段取りを作る。",
  };
  const ARCH_CONF = {   // 価値観 × 気質
    "革新_慎重": "自由に変えたいのに、いまある安定も失いたくない。だから動く前に長く考える。考えている時間は、迷いではなく準備と見てよい。",
    "革新_楽天": "次々に新しくしたくなり、ひとつを仕上げる前に手が離れる。始める力は強いので、終わらせる仕組みを外側に作ると噛み合う。",
    "継承_慎重": "守りたいのに、変えなければ続かないとも分かっている。そのあいだで止まりやすい。守る部分と変える部分を先に分けると進む。",
    "継承_楽天": "型を大事にしたいのに、その場の勢いで崩してしまうことがある。崩してよい線を自分で決めておくと楽になる。",
  };
  const ARCH_Q = [["動機", "なぜ動くか"], ["思考", "どう考えるか"], ["行動", "どう形にするか"], ["葛藤", "何に引き裂かれるか"]];
  function archLines(r) {
    const [v, t, a, k] = r.axes;
    const split = r.axes.filter(x => x.level === "split").map(x => x.q);
    return {
      lines: [ARCH_MOT[v.winner], ARCH_THINK[t.winner][t.loseSys.length >= 2 ? 1 : 0],
              ARCH_ACT[a.winner + "_" + v.winner], ARCH_CONF[v.winner + "_" + k.winner]].map(s => s || ""),
      note: "4つの軸（価値観・興味の向き・役割・気質）を、動き方の順に言い直したものです。" +
        (split.length ? split.join("と") + "の軸は占術の間で意見が割れているので、上の文はルールの票が多い側で書いています。場面によって反対の顔も出ます。" : ""),
    };
  }

  // 判定ルールの版。ルールを変えたらここを上げる（前に出したタイプと違う理由を説明するため）。
  //   2026-10-20 「視野」の軸の数え方を見直した（ほぼ全員に当たるルールと、対の無いルールを外した）
  const TYPE_RULE_VER = "2026-10-20";
  const LAST_TYPE_KEY = "sanmeiban_last_type";
  // 前にこの端末で出したタイプと違っていたら、どの軸がどう動いたか・なぜ変わったかを書く（2026-10-23 外部レビュー
  //   「同じ人がマーベリックからレボリューショナリーになった。なぜ前回と判定が変わったかまで説明する機能があると信頼性が上がる」）
  function typeChangeNote(tj, d) {
    if (typeof localStorage === "undefined") return "";
    const now = { k: tj.key, n: tj.type.name, v: TYPE_RULE_VER, p: profileOf(d), d: [d.y, d.m, d.d].join("-") };
    let prev = null;
    try { prev = JSON.parse(localStorage.getItem(LAST_TYPE_KEY) || "null"); } catch (e) { }
    try { localStorage.setItem(LAST_TYPE_KEY, JSON.stringify(now)); } catch (e) { }
    if (!prev || !prev.k || prev.d !== now.d || prev.k === now.k) return "";   // 同じ生年月日で、前と違うタイプのときだけ
    const AX = ["価値観", "興味の向き", "役割", "気質"];
    const a = String(prev.k).split("_"), b = now.k.split("_");
    const moved = AX.map((q, i) => a[i] !== b[i] ? q + "（" + a[i] + " → " + b[i] + "）" : null).filter(Boolean);
    const why = prev.v !== now.v
      ? "判定ルールを見直したためです（" + prev.v + " → " + now.v + "）。前の判定が間違いだったのではなく、票の数え方を変えました。"
      : prev.p !== now.p
      ? "生まれた時刻・性別・出生地の入力が変わったためです。これらは材料そのものを変えるので、タイプも変わります。"
      : "日の変わり目の流派の設定を変えたか、計算を直したためです。";
    return '<p class="rs-small rs-changed">前にこの端末で出たタイプは<b>' + esc(prev.n) + "</b>でした（今回は<b>" + esc(now.n) +
      "</b>）。変わった軸は" + moved.join("・") + "。" + why +
      "材料は同じで、僅差の軸が反転しています。前のタイプの特徴も残っていると読んでください。</p>";
  }

  // 占術が何を材料にしているか。9つは独立した9つの証拠ではない（2026-10-23 外部レビュー「四柱推命と算命学は干支体系を
  //   共有し、西洋占星術とインド占星術も同じ天体位置を異なる方式で読んでいる。9占術の一致を、そのまま9つの独立した
  //   証拠とは扱えない」）。一致の数と一緒に「材料が何通りか」も出す
  const MATERIAL = {
    "西洋占星術": "天体の位置", "インド占星術": "天体の位置",
    "四柱推命": "干支", "算命学": "干支", "九星気学": "干支",
    "紫微斗数": "旧暦の日", "宿曜": "旧暦の日",
    "数秘術": "生年月日の数字", "マヤ暦": "260日の周期",
  };
  const matsOf = sys => { const o = []; (sys || []).forEach(s => { const m = MATERIAL[s]; if (m && o.indexOf(m) < 0) o.push(m); }); return o; };
  // 「n個そろった」の後ろに付ける、材料の重なりの但し書き（材料の数が占術の数より少ないときだけ）
  function matNote(sys, label) {
    const m = matsOf(sys);
    if (!sys || sys.length < 2 || m.length >= sys.length) return "";
    return (label ? label + "側の" : "") + "この" + sys.length + "つは材料が" + m.length + "通り（" + m.join("・") + "）。" +
      "同じ材料を別の方式で読んでいる組があるので、独立した" + sys.length + "つの根拠ではない。";
  }

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
    const si = calcShukuyo(d);
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
        // 判定ルールの票（タイプ名を決めるのはこちら）。占術の種類の数と結論が違うことがあるので、両方を画面に出す（2026-10-23）
        votes: winIsPlus ? [a.plus, a.minus] : [a.minus, a.plus],
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
    // 大運・大限の向き（順行・逆行）は性別で決まる。性別を選んでいないと決まらないので、時期の判断と変わり目に入れない。
    // 紫微の大限は命宮から数えるので、時刻が分からないときも入れない（2026-10-20 監査: 仮の値で「次の変わり目」が出ていた）
    const dirKnown = typeof dayunDirKnown === "function" ? dayunDirKnown(d) : true;
    // 四柱推命: 今の大運の十神
    const dy = calcDayun(d);
    const cur = dirKnown ? dy.find(du => age >= du.startAge && age < du.endAge) : null;
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
    if (dirKnown) dy.forEach(du => { if (["偏官", "傷官", "劫財", "偏印"].indexOf(tenGod(d.day.stem, du.stem)) >= 0) mark(du.startAge, du.endAge, "四柱推命"); });
    if (dirKnown && d.tm === "known") try { calcZiweiDayun(d, d.lifeIdx).forEach(du => { if (["遷移宮", "疾厄宮", "官禄宮", "命宮"].indexOf(du.palaceName) >= 0) mark(du.startAge, du.endAge, "紫微斗数"); }); } catch (e) { }
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
    const left = [dirKnown ? "" : "性別", d.tm === "known" ? "" : "時刻"].filter(Boolean);
    return { age, now, verdict, nowSpan, nextSpan, left };
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

  // ===== 今日の羅占盤 =====
  // 日ごとの運を持つ5つの占術（四柱推命の日干支・九星の日盤・宿曜の日の宿・マヤ暦の今日のKIN・数秘術のパーソナルデイ）を
  // 「動く／整える／慎重」の3つに振り分け、何種類の占術が同じ側に入ったかを数える
  const DAYKIND = {
    go: { label: "動く日", short: "動く", tip: "始める・会う・決めることに向く。", cls: "go" },
    keep: { label: "整える日", short: "整える", tip: "片づける・続ける・学ぶことに向く。", cls: "keep" },
    care: { label: "慎重な日", short: "慎重", tip: "無理をせず、大きな決断は先に延ばす。", cls: "care" },
  };
  const TEN_DAY = {
    比肩: ["go", "自分で決めて進めやすい"], 劫財: ["care", "張り合いや出費が増えやすい"],
    食神: ["go", "楽しむこと・表現が実を結ぶ"], 傷官: ["care", "言葉がとがりやすい"],
    偏財: ["go", "人と会い、話を広げやすい"], 正財: ["keep", "コツコツ積み、お金を整える"],
    偏官: ["care", "圧がかかりやすい。無理をしない"], 正官: ["keep", "約束や筋を通すと評価される"],
    偏印: ["keep", "ひらめきが来る。一人で考える"], 正印: ["keep", "学ぶ・教わる・受け取る"],
  };
  const KY_DAY = {
    1: ["care", "坎宮（北）", "停滞しやすい。内側を整える"], 2: ["keep", "坤宮（南西）", "準備と地道な作業に向く"],
    3: ["go", "震宮（東）", "動き出しと発信に向く"], 4: ["go", "巽宮（南東）", "人とのつながり・信用が広がる"],
    5: ["care", "中宮", "良くも悪くも極端に出る"], 6: ["go", "乾宮（北西）", "目上の引き立て。決断に向く"],
    7: ["keep", "兌宮（西）", "楽しみと実り。使いすぎに注意"], 8: ["care", "艮宮（北東）", "変化と切り替え。予定が動きやすい"],
    9: ["go", "離宮（南）", "注目される。表に出ると吉"],
  };
  const TONE_DAY = { 1: "go", 2: "care", 3: "go", 4: "keep", 5: "go", 6: "keep", 7: "keep", 8: "keep", 9: "go", 10: "go", 11: "care", 12: "keep", 13: "care" };
  const PD_DAY = {
    1: ["go", "始まりの日"], 2: ["keep", "待つ・合わせる日"], 3: ["go", "表現する日"], 4: ["keep", "積み上げる日"], 5: ["go", "変化の日"],
    6: ["keep", "人の世話をする日"], 7: ["care", "一人で考える日"], 8: ["go", "成果を取りに行く日"], 9: ["care", "手放す・片づける日"],
  };
  const digitSum = n => String(n).split("").reduce((a, b) => a + Number(b), 0);
  const WEEK = "日月火水木金土";

  function buildToday(d, date) {
    const y = date.getFullYear(), m = date.getMonth() + 1, dd = date.getDate();
    const rows = [];
    // 四柱推命：今日の日干支を日主から見た十神
    const dp = getDayPillar(y, m, dd), ten = tenGod(d.day.stem, dp.stem), t = TEN_DAY[ten];
    if (t) rows.push({ sys: "四柱推命", what: "今日は" + dp.stem + dp.branch + "の日。日主" + d.day.stem + "から見て" + (ten === "正印" ? "印綬" : ten), kind: t[0], say: t[1] });
    // 九星気学：日盤で本命星が入る宮
    const ky = calcKyusei(d.y, d.m, d), ds = kyuseiDayStar(y, m, dd);
    if (ds) {
      const k = KY_DAY[kyuseiPalaceOf(ky.honmei, ds)];
      rows.push({ sys: "九星気学", what: "日盤の中宮は" + KYUSEI_NAMES[ds].name + "。" + KYUSEI_NAMES[ky.honmei].name + "は" + k[1] + "に入る", kind: k[0], say: k[2] });
    }
    // 宿曜：今日の宿があなたの宿から見て何にあたるか
    const mine = calcShukuyo(d), td = calcShukuyoTrad(y, m, dd);
    if (td !== null) {
      const role = SHUKUYO_SEQ[((td - mine) % 27 + 27) % 27], sd = SHUKUYO_DAY[role];
      rows.push({ sys: "宿曜", what: "今日は" + SHUKUYO_27[td].n + "。あなたの" + SHUKUYO_27[mine].n + "から見て「" + role + "」の日", kind: sd[0], say: sd[1].split("。").slice(1).join("。").replace(/。$/, "") });
    }
    // マヤ暦：今日のKINの音。紋章があなたの関係KINなら添える
    const me = calcMaya(d.y, d.m, d.d), tk = calcMaya(y, m, dd);
    const rel = tk.seal === me.seal ? "あなたと同じ紋章" : tk.seal === me.guideSeal ? "あなたのガイドの紋章" : tk.seal === me.analogSeal ? "あなたの類似の紋章"
      : tk.seal === me.occultSeal ? "あなたの神秘の紋章" : tk.seal === me.antipodeSeal ? "あなたの反対の紋章" : "";
    rows.push({ sys: "マヤ暦", what: "今日はKIN" + tk.kin + "（" + MAYA_SEALS[tk.seal].n + "・音" + tk.tone + "）" + (rel ? "。" + rel + "の日" : ""), kind: TONE_DAY[tk.tone], say: MAYA_TONES[tk.tone].split("。")[0] });
    // 数秘術：パーソナルデイ（年＋誕生月日 → ＋今月 → ＋今日）
    const py = reduceToSingle(digitSum(y) + digitSum(d.m) + digitSum(d.d));
    const pm = reduceToSingle(py + m), pdRaw = reduceToSingle(pm + dd);
    const pdKey = pdRaw > 9 ? digitSum(pdRaw) : pdRaw;   // 11・22・33 は 2・4・6 の日として読む
    rows.push({ sys: "数秘術", what: "パーソナルデイ" + pdRaw + "（" + PD_DAY[pdKey][1] + "）", kind: PD_DAY[pdKey][0], say: "個人年" + py + "・個人月" + pm });
    const cnt = { go: 0, keep: 0, care: 0 };
    rows.forEach(r => cnt[r.kind]++);
    const top = ["go", "keep", "care"].sort((a, b) => cnt[b] - cnt[a])[0];
    return { date, rows, cnt, top, clear: cnt[top] >= 3 && Object.values(cnt).filter(v => v === cnt[top]).length === 1 };
  }

  function todayPanelHtml(t) {
    const k = DAYKIND[t.top];
    const line = t.clear
      ? t.rows.length + "つの占術のうち <b>" + t.cnt[t.top] + "つ</b> が「" + k.label + "」。" + k.tip
      : "占術ごとに割れた日（動く" + t.cnt.go + "・整える" + t.cnt.keep + "・慎重" + t.cnt.care + "）。迷ったら、いつもどおりに過ごすのがよい。";
    return '<div class="rs-time rs-' + (t.clear ? k.cls : "keep") + '"><div class="rs-verdict">' + (t.clear ? k.label : "割れた日") + "</div>" +
      '<p class="rs-dayline">' + line + "</p><ul class=\"rs-dayrows\">" +
      t.rows.map(r => '<li><span class="rs-dk rs-dk-' + r.kind + '">' + DAYKIND[r.kind].short + '</span><b class="rs-dsys">' + r.sys + '</b><span class="rs-dwhat">' + esc(r.what) + "<small>" + esc(r.say) + "</small></span></li>").join("") +
      "</ul></div>";
  }

  function todayHtml(d) {
    const base = new Date();
    const days = [0, 1].map(i => { const x = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i); return { x, t: buildToday(d, x) }; });
    const label = (i, x) => (i ? "明日" : "今日") + " " + (x.getMonth() + 1) + "/" + x.getDate() + "（" + WEEK[x.getDay()] + "）";
    const t0 = days[0].t, k0 = DAYKIND[t0.top];
    const head = t0.clear ? k0.label : "割れた日";
    const cls = t0.clear ? k0.cls : "keep";
    const sub = t0.clear ? k0.tip : "迷ったら、いつもどおりに過ごすのがよい。";
    return '<details class="rs-today rs-strip rs-' + cls + '"><summary>' +
      '<span class="rs-strip-date">' + label(0, days[0].x) + '</span>' +
      '<span class="rs-verdict">' + head + '</span>' +
      '<span class="rs-strip-tip">' + sub + '</span>' +
      '<span class="rs-strip-more">' + (t0.clear ? t0.rows.length + "つの占術のうち" + t0.cnt[t0.top] + "つ" : "占術ごとに割れた") + "・内訳と明日を見る</span>" +
      "</summary><div class=\"rs-strip-body\">" +
      '<div class="rs-today-tabs">' + days.map((o, i) => '<button type="button" class="' + (i ? "" : "on") + '" onclick="RSynth.showDay(' + i + ',this)">' + label(i, o.x) + "</button>").join("") + "</div>" +
      days.map((o, i) => '<div class="rs-day"' + (i ? " hidden" : "") + ">" + todayPanelHtml(o.t) + "</div>").join("") +
      '<p class="rs-small">日ごとの運を持つ5つの占術で見ている。四柱推命＝その日の干支を日主から見た関係、九星気学＝日盤で本命星が入る宮、宿曜＝その日の宿との関係、マヤ暦＝その日のKINの音、数秘術＝パーソナルデイ。</p>' +
      "</div></details>";
  }
  function showDay(i, btn) {
    const sec = btn.closest(".rs-today");
    sec.querySelectorAll(".rs-today-tabs button").forEach((b, j) => b.classList.toggle("on", j === i));
    sec.querySelectorAll(".rs-day").forEach((p, j) => { p.hidden = j !== i; });
  }

  // ===== 画面 =====
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const IMG = {
    "ヒーロー": "web/0Hero01.webp", "レボリューショナリー": "web/0Revolutionary01.webp", "トリックスター": "web/0Trickster01.webp", "ヴィジョナリー": "web/0Visionary01.webp",
    "パイオニア": "web/0Pioneer01.webp", "ローンウルフ": "web/0Lonewolf01.webp", "シーカー": "web/0Seeker01.webp", "マーベリック": "web/0Maverick01.webp",
    "ソブリン": "web/0Sovereign01.webp", "エンペラー": "web/0Emperor01.webp", "セージ": "web/0Sage01.webp", "オラクル": "web/0Oracle01.webp",
    "アルチザン": "web/0Artisan01.webp", "ガーディアン": "web/0Guardian01.webp", "ケアテイカー": "web/0Caretaker01.webp", "ハーミット": "web/0Hermit01.webp",
  };
  // 9つの占術の丸（一致した占術だけ色が付く）
  function dots(sys, cls) {
    return '<span class="rs-dots">' + SYS.map(s => '<i class="' + (sys.indexOf(s) >= 0 ? cls : "") + '" title="' + s + '"></i>').join("") + "</span>";
  }
  // 占術名は押すとその占術のタブの「根拠」へ飛ぶ
  const names = sys => sys.map(s => '<a class="rs-go" onclick="RSynth.goTab(' + SYS.indexOf(s) + ')">' + SHORT[s] + "</a>").join("・");

  // 僅差の軸があれば、その軸を反対にしたときのタイプ（「〇〇寄り」として一緒に見せる）
  const AXIS_Q = ["価値観", "興味の向き", "役割", "気質"];
  function neighborType(tj) {
    const ax = [tj.a1, tj.a2, tj.a3, tj.a4];
    let best = -1, bestR = 2;
    ax.forEach((a, i) => {
      const tot = a.plus + a.minus, r = tot ? Math.abs(a.plus - a.minus) / tot : 0;
      if (a.ambiguous && r < bestR) { bestR = r; best = i; }
    });
    if (best < 0) return null;
    const parts = tj.key.split("_"), a = ax[best];
    parts[best] = parts[best] === a.pn ? a.mn : a.pn;
    const t = ((global.TypeJudge || {}).TYPES || {})[parts.join("_")];
    return t ? { name: t.name, desc: t.desc, axis: AXIS_Q[best] } : null;
  }

  function buildSynthesisHtml(d) {
    const r = buildSynthesis(d);
    const t = r.type;
    const img = IMG[t.name] ? "16typecard/" + IMG[t.name] : "";
    const LEVEL = { clear: "はっきり一致", lean: "やや一致", split: "意見が割れた" };
    const nb = neighborType(r.tj);
    const selfMode = typeof currentMode === "undefined" || currentMode !== "compat";
    viewerTj = r.tj;
    let h = '<div id="type-result-section" class="rs">';

    // ── 1. 答え（絵・タイプ名・寄り・一言・あなたらしさ3つ・シェア） ──
    h += '<div class="rs-hero">' +
      (img ? '<button type="button" class="rs-img-btn" onclick="RSynth.openType(\'' + r.tj.key + '\')" aria-label="' + esc(t.name) + 'をくわしく見る"><img src="' + img + '" alt="' + esc(t.name) + '" class="rs-img"></button>' : "") +
      '<div class="rs-hero-txt">' +
      '<div class="rs-kicker">あなたは</div>' +
      '<div class="rs-type">' + esc(t.name) + "</div>" +
      (nb ? '<div class="rs-near" title="' + esc(nb.axis) + 'の軸が僅差">' + esc(nb.name) + "寄り</div>" : "") +
      '<div class="rs-desc">' + esc(t.desc) + "</div>" +
      (r.paradox.length && !/undefined/.test(r.paradox[0]) ? '<p class="rs-para1">' + esc(r.paradox[0]) + "</p>" : "") +
      (() => { try { const A = archLines(r);
        return '<div class="rs-arch"><div class="rs-arch-h">どう動く人か</div><dl>' +
          ARCH_Q.map(([q, sub], i) => "<dt>" + q + "<span>" + sub + "</span></dt><dd>" + esc(A.lines[i]) + "</dd>").join("") +
          '</dl><p class="rs-small">' + esc(A.note) + "</p></div>";
      } catch (e) { console.warn("人格の4段の描画エラー:", e); return ""; } })() +
      '<div class="rs-self"><div class="rs-self-h">あなたらしさ 3つ</div><ol>' +
      r.top.map(x => "<li><b>" + x.label + "</b>　" + x.desc + "<small>" + x.n + "つの占術がそろって示す</small></li>").join("") +
      "</ol></div>" +
      (nb ? '<p class="rs-small">' + esc(nb.axis) + "の軸が僅差なので、" + esc(nb.name) + "（" + esc(nb.desc) + "）の顔も持っている。</p>" : "") +
      (selfMode ? (() => { try { return typeChangeNote(r.tj, d); } catch (e) { console.warn("前のタイプとの比較でエラー:", e); return ""; } })() : "") +
      '<div class="rs-actions">' +
      '<button type="button" class="rs-share" onclick="shareTypeResult()">結果をシェア</button>' +
      (selfMode ? '<button type="button" class="rs-share rs-share-sub" onclick="RSynth.startCompat()">相性を見る</button>' : "") +
      '</div><button type="button" class="rs-story-link" onclick="saveStoryImage()">ストーリー用の縦長画像を保存</button>' +
      '<div id="share-status" class="rs-small"></div>' +
      "</div></div>";

    // ── 2. 今日の羅占盤（1行の帯・自分モードだけ） ──
    if (selfMode) {
      try { h += todayHtml(d); } catch (e) { console.warn("今日の羅占盤の描画エラー:", e); }
    }

    // ── 2.5 実はこれも近い／このタイプと相性がいいタイプ（自分モードだけ） ──
    if (selfMode) {
      try { h += otherTypesHtml(r.tj); } catch (e) { console.warn("近いタイプの描画エラー:", e); }
    }

    // ── 3. なぜこのタイプ？（4つの軸と占術の一致・強みの内訳）──畳む
    const conf = r.tj.confidence;
    const confNote = (d.tm === "unknown" ? "出生時刻が不明なので、時刻が要る判定（アセンダント・命宮・時柱）は使っていない。生まれた時刻を入れると確かさが上がる。" : "") +
      "羅占盤タイプは、9つの占術の結果を4つの軸に振り分けて数える、羅占盤が独自に作った16の分類です（伝統的な占術そのものではありません）。" +
      "2026年10月に「視野」の軸の数え方を見直しました（16タイプの出方が偏っていたため）。前と違うタイプが出ることがあります。";
    h += '<details class="rs-fold rs-why-fold"><summary>なぜ' + esc(t.name) + "？<span>9つの占術がそれぞれ何を見てそう判断したか（判定の確かさ: " + conf + "）</span></summary><div class=\"rs-fold-body\">";
    h += '<section class="rs-sec"><h3>9つの占術が一致したところ</h3>' +
      '<p class="rs-lead">占術ごとに見方は違う。同じ方向を指した占術が多いほど、その傾向がはっきり出ている。<b>占術の名前を押すと、その占術が何を見てそう判断したかが分かる。</b></p>' +
      '<div class="rs-axes">' +
      r.axes.map(a => {
        const main = a.level === "split"
          ? "両方の顔がある：「" + esc(a.text) + "」と「" + esc(a.otherText) + "」"
          : esc(a.text);
        const side = (label, sys, cls) => '<div class="rs-side rs-side-' + cls + '"><span class="rs-side-l">' + label + "</span>" + dots(sys, cls) +
          '<span class="rs-n"><b>' + sys.length + "</b></span>" + '<span class="rs-names">' + (sys.length ? names(sys) : "なし") + "</span></div>";
        // 数え方を両方書く。タイプ名は判定ルールの票で決まるので、占術の数と結論が違って見えることがある（2026-10-23）
        const note = "数え方：上の数は<b>占術の種類</b>。判定ルールの数では <b>" + a.votes[0] + " 対 " + a.votes[1] +
          "</b>（タイプ名はこちらで決めている" + (a.level === "split" ? "ので、タイプ名とこの「意見が割れた」は食い違って見える" : "") + "）。" +
          matNote(a.winSys, esc(a.short));
        return '<div class="rs-axis rs-' + a.level + '">' +
          '<div class="rs-axis-head"><span class="rs-q">' + a.q + '</span><span class="rs-badge">' + LEVEL[a.level] + "</span></div>" +
          '<div class="rs-axis-main">' + main + "</div>" +
          side(a.short, a.winSys, "on") +
          side(a.otherShort, a.loseSys, "off") +
          '<p class="rs-small rs-count-note">' + note + "</p>" +
          "</div>";
      }).join("") +
      "</div></section>";
    h += '<section class="rs-sec"><h3>あなたらしさ3つの内訳</h3><ol class="rs-traits">' +
      r.top.map(x => '<li><div class="rs-trait-head"><b>' + x.label + '</b><span class="rs-n"><b>' + x.n + "</b>/9の占術</span></div>" +
        '<div class="rs-trait-desc">' + x.desc + "</div>" +
        '<div class="rs-axis-sys">' + dots(x.sys, "on") + '<span class="rs-names">' + names(x.sys) + "</span></div>" +
        (matNote(x.sys) ? '<p class="rs-small rs-count-note">' + matNote(x.sys) + "</p>" : "") + "</li>").join("") +
      "</ol></section>";
    h += '<p class="rs-small">判定の確かさ: <b>' + conf + "</b>。" + confNote + "</p>";
    h += "</div></details>";

    // ── 4. これからの流れ（今の時期と次の変わり目）──畳む
    const tm = r.timing;
    const vcls = tm.verdict === "動く時期" ? "go" : tm.verdict === "待つ時期" ? "wait" : "care";
    let turn = "";
    if (tm.nowSpan) turn = "<b>今はちょうど変わり目</b>（" + tm.nowSpan.start + "〜" + (tm.nowSpan.end - 1) + "歳・" + names(tm.nowSpan.sys) + "がそろって示す）。";
    else if (tm.nextSpan) turn = "次の大きな変わり目は <b>" + tm.nextSpan.start + "〜" + (tm.nextSpan.end - 1) + "歳</b>（" + names(tm.nextSpan.sys) + "がそろって示す）。";
    else turn = "この先、複数の占術が同時に大きな変わり目を示す時期は見当たらない。";
    h += '<details class="rs-fold"><summary>これからの流れ<span>今は「' + tm.verdict + "」。" + (tm.nowSpan ? "ちょうど変わり目" : tm.nextSpan ? "次の変わり目は" + tm.nextSpan.start + "歳ごろ" : "") + "</span></summary><div class=\"rs-fold-body\">" +
      '<div class="rs-time rs-' + vcls + '"><div class="rs-verdict">' + tm.verdict + "</div>" +
      '<ul class="rs-why">' + tm.now.map(x => "<li><b>" + SHORT[x.sys] + "</b> " + esc(x.why) + (x.say ? "（" + x.say + "）" : "") + "</li>").join("") + "</ul>" +
      '<p class="rs-turn">' + turn + "</p></div>" +
      '<p class="rs-small">変わり目は、10年ごとの運を持つ3つの占術（四柱推命・紫微斗数・インド占星術）のうち2つ以上が同時に「変化」を示す年齢。' +
      (tm.left && tm.left.length ? "今回は" + tm.left.join("と") + "が入っていないので、" + (tm.left.indexOf("性別") >= 0 ? "四柱推命の大運と紫微斗数の大限" : "紫微斗数の大限") + "を外して数えています（向きや命宮が決まらないため）。" + tm.left.join("・") + "を入れると加わります。" : "") + "</p>" +
      "</div></details>";

    h += "</div>";
    return h;
  }

  // 16タイプそれぞれとの近さ。軸ごとの票の割合（例: 役割でリーダー6点・参謀3点ならリーダー側0.67）を
  // そのタイプの側で拾って4軸で平均する。自分のタイプがいちばん高く、票が割れた軸を反対にしたタイプが次に来る
  function typeCloseness(tj) {
    const ax = [tj.a1, tj.a2, tj.a3, tj.a4];
    const share = ax.map(a => { const tot = a.plus + a.minus; return tot ? a.plus / tot : 0.5; });
    const TYPES = (global.TypeJudge || {}).TYPES || {};
    const mine = tj.key.split("_");
    return Object.keys(TYPES).map(k => {
      const parts = k.split("_");
      const sh = parts.map((p, i) => p === ax[i].pn ? share[i] : 1 - share[i]);
      return { key: k, type: TYPES[k], score: sh.reduce((a, b) => a + b, 0) / 4, sh, diff: parts.map((p, i) => p !== mine[i] ? i : -1).filter(i => i >= 0), parts };
    }).sort((a, b) => b.score - a.score);
  }

  // 自分のタイプから見た相性のいいタイプ（1つの軸だけ違う3タイプと、全部違う1タイプ）
  const PAIRS = [
    { axis: 2, label: "ベストパートナー", desc: "役割だけが違う。自然に補い合える" },
    { axis: 1, label: "新しい発見をくれる", desc: "興味の向きだけが違う。見えない景色を見せてくれる" },
    { axis: 3, label: "アクセルとブレーキ", desc: "気質だけが違う。勢いと慎重さを分け合える" },
    { axis: -1, label: "惹かれ合う対極", desc: "4つとも逆。強く惹かれ、強くぶつかる" },
  ];
  const thumb = name => IMG[name] ? "16typecard/" + IMG[name].replace(".webp", "-S.webp") : "";

  function otherTypesHtml(tj) {
    const all = typeCloseness(tj);
    const me = all.find(x => x.key === tj.key);
    const others = all.filter(x => x.key !== tj.key).slice(0, 3);
    const pct = x => Math.round(x.score * 100);
    const why = x => x.diff.map(i => {
      const other = x.parts[i];
      return AXES[i].q + "では「" + AXES[i].short[other] + "」の票も" + Math.round(x.sh[i] * 10) + "割";
    }).join("、");
    // 押すと図鑑でそのタイプを開く
    const card = (x, top, sub, extra) => '<button type="button" class="rs-tcard" onclick="RSynth.openType(\'' + x.key + '\')">' +
      (thumb(x.type.name) ? '<img src="' + thumb(x.type.name) + '" alt="" loading="lazy" decoding="async">' : "") +
      '<span class="rs-tcard-txt">' + (top ? '<span class="rs-tcard-top">' + top + "</span>" : "") +
      '<span class="rs-tcard-name">' + esc(x.type.name) + (extra || "") + "</span>" +
      '<span class="rs-tcard-desc">' + esc(x.type.desc) + "</span>" +
      (sub ? '<span class="rs-tcard-sub">' + sub + "</span>" : "") +
      '<span class="rs-tcard-go">くわしく見る ›</span></span></button>';

    let h = '<section class="rs-sec"><h3>実はこのタイプも近い</h3>' +
      '<p class="rs-lead">あなたの票は、ほかのタイプにも少しずつ入っている。' + esc(tj.type.name) + "との近さを100としたときの数字。</p>" +
      '<div class="rs-tgrid rs-tgrid3">' +
      others.map(x => card(x, "", why(x), '<span class="rs-tcard-pct">' + Math.round(pct(x) / pct(me) * 100) + "</span>")).join("") +
      "</div></section>";

    const mine = tj.key.split("_");
    const byKey = {};
    all.forEach(x => { byKey[x.key] = x; });
    const flip = (parts, i) => { const a = [tj.a1, tj.a2, tj.a3, tj.a4][i]; return parts[i] === a.pn ? a.mn : a.pn; };
    h += '<section class="rs-sec"><h3>' + esc(tj.type.name) + "と相性がいいタイプ</h3>" +
      '<p class="rs-lead">16タイプの組み合わせで見た相性。気になる人がいたら、生年月日を入れて実際の相性を確かめられる。</p>' +
      '<div class="rs-tgrid">' +
      PAIRS.map(pr => {
        const parts = mine.slice();
        if (pr.axis >= 0) parts[pr.axis] = flip(parts, pr.axis);
        else for (let i = 0; i < 4; i++) parts[i] = flip(parts, i);
        const x = byKey[parts.join("_")];
        return x ? card(x, pr.label, pr.desc) : "";
      }).join("") +
      '</div><div class="rs-actions">' +
      '<button type="button" class="rs-share rs-share-sub" onclick="RSynth.startCompat()">気になる人との相性を見る</button>' +
      '<button type="button" class="rs-share rs-share-sub" onclick="RSynth.openType(\'' + tj.key + '\')">16タイプを全部見る</button>' +
      "</div></section>";
    return h;
  }

  // ===== 16タイプ図鑑（ほかのキャラを見る） =====
  // 入口: 近いタイプ・相性がいいタイプのカード、「16タイプを全部見る」、トップの「16タイプ図鑑」、URL の #type=hero
  const slugOf = name => (IMG[name] || "").replace(/^web\/0|01\.webp$/g, "").toLowerCase();
  const typeKeys = () => Object.keys(((global.TypeJudge || {}).TYPES) || {});
  let viewerTj = null;   // 結果を出した人の判定（あなたとの関係を出すため）

  function relationTo(key) {
    if (!viewerTj) return null;
    const mine = viewerTj.key.split("_"), parts = key.split("_");
    const diff = parts.map((p, i) => p !== mine[i] ? i : -1).filter(i => i >= 0);
    const c = typeCloseness(viewerTj);
    const me = c.find(x => x.key === viewerTj.key), it = c.find(x => x.key === key);
    const near = me && it ? Math.round(it.score / me.score * 100) : null;
    let label;
    if (!diff.length) label = "あなたのタイプ";
    else if (diff.length === 4) label = PAIRS[3].label + "（" + PAIRS[3].desc + "）";
    else if (diff.length === 1) {
      const pr = PAIRS.find(p => p.axis === diff[0]);
      label = pr ? pr.label + "（" + pr.desc + "）" : AXES[diff[0]].q + "だけが違う、いちばん近いタイプの一つ";
    } else label = diff.map(i => AXES[i].q).join("・") + "の" + diff.length + "つの軸が違う";
    return { label, near, same: !diff.length };
  }

  function typeViewHtml(key) {
    const T = global.TypeJudge.TYPES, t = T[key];
    const keys = typeKeys(), i = keys.indexOf(key);
    const prev = keys[(i + keys.length - 1) % keys.length], next = keys[(i + 1) % keys.length];
    const img = IMG[t.name] ? "16typecard/" + IMG[t.name] : "";
    const rel = relationTo(key);
    const list = a => "<ul>" + (a || []).map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
    const sec = (h, body) => body ? '<div class="tv-sec"><h4>' + h + "</h4>" + body + "</div>" : "";
    return '<div class="tv-head"><button type="button" class="tv-nav" onclick="RSynth.openType(\'' + prev + '\')" aria-label="前のタイプ">‹</button>' +
      '<div class="tv-count">' + (i + 1) + " / " + keys.length + '</div>' +
      '<button type="button" class="tv-nav" onclick="RSynth.openType(\'' + next + '\')" aria-label="次のタイプ">›</button>' +
      '<button type="button" class="tv-close" onclick="RSynth.closeType()" aria-label="閉じる">×</button></div>' +
      '<div class="tv-main">' + (img ? '<img src="' + img + '" alt="' + esc(t.name) + '" class="tv-img">' : "") +
      '<div class="tv-txt"><div class="tv-name" id="tv-title">' + esc(t.name) + "</div>" +
      '<div class="tv-desc">' + esc(t.desc) + "</div>" +
      (t.paradox ? '<p class="tv-para">' + esc(t.paradox) + "</p>" : "") +
      (rel ? '<div class="tv-rel' + (rel.same ? " tv-rel-me" : "") + '"><b>あなたとの関係</b>' + esc(rel.label) + (rel.near !== null && !rel.same ? "<span>あなたとの近さ " + rel.near + "</span>" : "") + "</div>"
        : '<button type="button" class="rs-share tv-cta" onclick="RSynth.closeType(); var b = document.getElementById(\'birthdate\'); if (b) { b.scrollIntoView({block:\'center\'}); b.focus(); }">あなたは何タイプ？ 生年月日で占う</button>') +
      (t.personality ? "<p>" + esc(t.personality) + "</p>" : "") +
      "</div></div>" +
      '<div class="tv-grid2">' + sec("強み", list(t.strengths)) + sec("気をつけたいこと", list(t.challenges)) + "</div>" +
      sec("向いている仕事", t.careerFit ? "<p>" + esc(t.careerFit) + "</p>" : "") +
      sec("このタイプの人との付き合い方", t.howToRelate ? "<p>" + esc(t.howToRelate) + "</p>" : "") +
      (t.etymology ? '<details class="tv-more"><summary>名前の由来</summary><p>' + esc(t.etymology) + "</p></details>" : "") +
      '<div class="tv-all"><div class="tv-all-h">16タイプ</div><div class="tv-thumbs">' +
      keys.map(k => { const n = T[k].name; return '<button type="button" class="tv-th' + (k === key ? " on" : "") + '" onclick="RSynth.openType(\'' + k + '\')" title="' + esc(n) + '">' +
        (thumb(n) ? '<img src="' + thumb(n) + '" alt="" loading="lazy" decoding="async">' : "") + "<span>" + esc(n) + "</span></button>"; }).join("") +
      "</div></div>";
  }

  let lastFocus = null;
  function openType(key) {
    const T = ((global.TypeJudge || {}).TYPES) || {};
    if (!T[key]) {   // 名前・英名でも開ける
      key = Object.keys(T).find(k => T[k].name === key || slugOf(T[k].name) === String(key).toLowerCase()) || Object.keys(T)[0];
    }
    let box = document.getElementById("type-viewer");
    if (!box) {
      box = document.createElement("div");
      box.id = "type-viewer";
      box.className = "tv-back";
      box.innerHTML = '<div class="tv-box" role="dialog" aria-modal="true" aria-labelledby="tv-title" tabindex="-1"></div>';
      box.addEventListener("click", e => { if (e.target === box) closeType(); });
      document.addEventListener("keydown", e => {
        if (!document.getElementById("type-viewer") || document.getElementById("type-viewer").hidden) return;
        if (e.key === "Escape") closeType();
        const ks = typeKeys(), cur = box.dataset.key, i = ks.indexOf(cur);
        if (e.key === "ArrowRight") openType(ks[(i + 1) % ks.length]);
        if (e.key === "ArrowLeft") openType(ks[(i + ks.length - 1) % ks.length]);
      });
      document.body.appendChild(box);
      lastFocus = document.activeElement;
    }
    if (box.hidden) lastFocus = document.activeElement;
    box.hidden = false;
    box.dataset.key = key;
    const inner = box.querySelector(".tv-box");
    inner.innerHTML = typeViewHtml(key);
    inner.scrollTop = 0;
    inner.focus();
    document.body.classList.add("tv-open");
    try { history.replaceState(null, "", "#type=" + slugOf(T[key].name)); } catch (e) { }
  }
  function closeType() {
    const box = document.getElementById("type-viewer");
    if (box) box.hidden = true;
    document.body.classList.remove("tv-open");
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  // URL の #type=hero で図鑑を開く（SNSから来た人用）
  function openFromHash() {
    const m = /#type=([a-z]+)/.exec(location.hash);
    if (m) openType(m[1]);
  }
  if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", () => setTimeout(openFromHash, 0));

  // 「相性を見る」: 入力欄を相性モードにして、お相手の生年月日へ
  function startCompat() {
    const r = document.getElementById("mode-compat");
    if (!r) return;
    r.checked = true;
    if (typeof toggleMode === "function") toggleMode();
    const el = document.getElementById("birthdate-b");
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => el.focus(), 400); }
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
      '<div class="rs-bridge-top"><span class="rs-kicker">総合鑑定の中での' + sys + '</span><span class="rs-bridge-links">' +
      '<a class="rs-go rs-to-consult" onclick="RSynth.goConsult(' + i + ')">' + sys + "でAIに相談 ↓</a>" +
      '<a class="rs-go rs-back" onclick="RSynth.goSummary()">← 総合鑑定に戻る</a></span></div>' +
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
    // 各タブの終わりに「この占いでAIに相談する」（畳んだ節の後ろ・注記の前）
    SYS.forEach((sys, i) => addConsult(i, sys));
    // 各タブの冒頭（総合鑑定の中での〇〇 の下）に「知りたいことに、この占術で答えると」。相性モードは出さない
    if (!(typeof currentMode !== "undefined" && currentMode === "compat")) SYS.forEach((sys, i) => addQa(d, i, sys));
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
    el.insertBefore(wrap, footNote(el));
  }
  // ===== 占術ごとにAIへ相談する（2026-10-15 井内さん「個別の１つ１つの占いの結果も詳しく書いて、AIに相談できるといい」）=====
  //   そのタブに出ている結果を全部（畳んだ節も）文にして、相談のテーマと質問を添えた相談文をコピーする。
  //   AIの答えはそのタブに貼って残せる（この端末の localStorage だけ。AIの答えは信頼しない入力として扱い、エスケープしてから整形）
  // 占術ごとの本来の読む順（2026-10-20 外部レビュー「占術ごとの文章量を均等にするより、何を読む体系かを構造に反映」）。AIにこの順で根拠を組み立ててもらう
  const READ_ORDER = {
    "西洋占星術": "太陽・月・ASC（3つの核）→ 天体の星座とハウス → 主要アスペクト（太陽・月に絡むものを先に）→ 元素のかたより。時刻が無いときはASCとハウスを使わない",
    "四柱推命": "日主（日干）→ 月支（月令）と日主の強弱 → 十神のかたより（天干と蔵干を分けて）→ 用神・忌神 → 地支の関係（合・冲・刑・害）→ 大運",
    "紫微斗数": "命宮の主星 → 三方四正（命宮・財帛宮・官禄宮・遷移宮）→ 夫妻宮・福徳宮・疾厄宮 → 生年四化（化忌の入る宮を重く）→ 大限と大限四化 → 流年四化。時刻が無いときは命盤全体が仮",
    "算命学": "中心星（本質）→ 東西南北の星（場面ごとの顔）→ 十二大従星（エネルギーの量と人生の前半・中年・晩年）→ 天中殺（枠が外れる領域と年）",
    "数秘術": "ライフパス → バースデーナンバー → ピナクルとチャレンジ（今いる時期）→ パーソナルイヤー",
    "九星気学": "本命星（社会の顔）→ 月命星（内面）→ 傾斜宮 → 今年の回座 → 方位の吉凶",
    "マヤ暦": "太陽の紋章 → 銀河の音（紋章の力の出し方）→ ウェイブスペル（裏の顔）→ 関係KIN（ガイド・類似・反対・神秘）→ 52年の周期",
    "宿曜": "本命宿の性質 → 七曜 → 三九の秘法（ほかの宿との関係）→ 今日の運勢",
    "インド占星術": "ラグナ（時刻があるとき）と月のラーシ・ナクシャトラ → 太陽のラーシ → 惑星の強弱（高揚・減衰・自室）→ ダシャー（大運と小運）",
  };
  const THEMES = [
    { id: "detail", label: "この占いの鑑定を詳しく", ask: s => "この人の" + s + "の鑑定を、読み物として詳しく書いてください。順番は「性格の核」「才能と強み」「仕事とお金」「人間関係」「今の時期とこれから」。全体で2,000〜3,000字。" },
    { id: "self", label: "性格・本当の自分", ask: s => s + "の見方で、この人の性格の核と、本人も気づきにくい面を詳しく教えてください。強みが裏目に出る場面と、その時の向き合い方も。" },
    { id: "work", label: "仕事・お金", ask: s => s + "の見方で、この人に向いている仕事・働き方と、避けたい働き方を教えてください。お金との付き合い方と、今の時期の仕事の動き方も。" },
    { id: "love", label: "恋愛・人間関係", ask: s => s + "の見方で、この人の恋愛・パートナー・友人・職場の人間関係の傾向を教えてください。うまくいく相手と、こじれやすい場面も。" },
    { id: "time", label: "今の時期とこれから", ask: s => s + "の見方で、今がどんな時期か、この先5〜10年の流れを教えてください。動くとよい時期と、待つとよい時期を年齢か年で。" },
    { id: "free", label: "自由に相談", ask: null },
  ];
  const THEMES_COMPAT = [
    { id: "detail", label: "2人の相性を詳しく", ask: s => s + "の見方で、2人の相性を詳しく書いてください。順番は「2人それぞれの性質」「惹かれ合うところ」「ぶつかりやすいところ」「うまくいく付き合い方」。全体で2,000〜3,000字。" },
    { id: "love", label: "関係をよくするには", ask: s => s + "の見方で、2人の関係をよくするために、それぞれが気をつけるとよいことを具体的に教えてください。" },
    { id: "time", label: "2人のこれから", ask: s => s + "の見方で、2人の関係がこの先どう動きそうか、節目になる時期を教えてください。" },
    { id: "free", label: "自由に相談", ask: null },
  ];
  // 総合鑑定（i=10）の相談。既定は相談文の「鑑定依頼」（8つの章）をそのまま使う。ほかは依頼の部分だけ差し替える
  const SUM_I = 10, SUM_SYS = "9つの占い";
  const THEMES_SUM = [
    { id: "detail", label: "総合鑑定（8つの章）", ask: null },
    { id: "self", label: "性格・本当の自分", ask: () => "9つの占いを合わせて、この人の性格の核と、本人も気づきにくい面を詳しく教えてください。占いによって違う面が出ているところは、場面ごとの顔として説明してください。" },
    { id: "work", label: "仕事・お金", ask: () => "9つの占いを合わせて、この人に向いている仕事・働き方と、お金との付き合い方を教えてください。今の時期の仕事の動き方も。" },
    { id: "love", label: "恋愛・人間関係", ask: () => "9つの占いを合わせて、この人の恋愛・パートナー・友人・職場の人間関係の傾向を教えてください。うまくいく相手と、こじれやすい場面も。" },
    { id: "time", label: "今の時期とこれから", ask: () => "9つの占いを合わせて、今がどんな時期か、この先5〜10年の流れを教えてください。占いによって「動く」「待つ」が分かれるときは、どの領域で動き、どの領域で待つかを。" },
    { id: "free", label: "自由に相談", ask: null },
  ];
  // 相性モードの総合（i=10）。既定は相性の相談文の「鑑定依頼」（6つの章）をそのまま使う
  const THEMES_SUM_COMPAT = [
    { id: "detail", label: "2人の相性鑑定（6つの章）", ask: null },
    { id: "love", label: "恋愛・パートナーとして", ask: () => "9つの占いを合わせて、2人が恋愛・パートナーとしてどう惹かれ合い、どこでぶつかりやすいかを教えてください。長く続けるために、それぞれが気をつけるとよいことも具体的に。" },
    { id: "work", label: "仕事・友人として", ask: () => "9つの占いを合わせて、2人が仕事仲間・友人としてどう組むとうまくいくかを教えてください。役割の分け方と、すれ違いやすい場面も。" },
    { id: "better", label: "関係をよくするには", ask: () => "9つの占いを合わせて、2人の関係をよくするために、それぞれが今日からできることを具体的に教えてください。" },
    { id: "time", label: "2人のこれから", ask: () => "9つの占いを合わせて、2人の関係がこの先どう動きそうか、節目になる時期を年か年齢で教えてください。2人それぞれの大運・個人年なども使って。" },
    { id: "free", label: "自由に相談", ask: null },
  ];
  const isCompat = () => typeof currentMode !== "undefined" && currentMode === "compat" && typeof dataB !== "undefined" && !!dataB;
  const themesNow = i => i === SUM_I ? (isCompat() ? THEMES_SUM_COMPAT : THEMES_SUM) : isCompat() ? THEMES_COMPAT : THEMES;
  // 総合鑑定の相談文で、AIに渡す量（2026-10-23 井内さん「全部の結果を1つにまとめてくれたら良くない？」）。
  //   要点だけ＝各占術の読みを節を選んで300字ずつ（今までどおり）／全部＝9タブと総合鑑定の画面の文を丸ごと
  //   相性モードは画面に出している文がもともと少なく、丸ごと渡しても約500字しか増えないので、量は選ばせない（要点だけ）
  const man = n => n >= 10000 ? (n / 10000).toFixed(1) + "万" : String(n);
  const amounts = () => [
    { label: "要点だけ", note: "9つの占いの数値と、各占術の読みの要点（約1.9万字）。チャット欄にそのまま貼れます。" },
    { label: "画面の文を全部", note: "上に加えて、9つのタブと総合鑑定の画面に出している文を丸ごと（約5.8万字）。羅占盤が画面に出している読みを、取りこぼしなく渡せます。長い文は貼ると添付ファイルに変わるAIもありますが、そのまま送れます。「テキストファイルで保存」で添付してもかまいません。" },
  ];
  // AIの答えの保存キー。生年月日とタブに加えて、答えを左右する入力（時刻・時刻の有無・性別・出生地、相性なら相手の分と相性の種類）も入れる。
  // 旧版のキーは生年月日とタブだけで、00:00で残した答えが23:30の命盤にも出ていた（2026-10-20 監査）。旧キー（old）は読むだけ
  // 23時台の人が0時の流派を選んでいるときだけ "_d24" を足す（既定の23時の流派と、23時台以外の人のキーは変えない。2026-10-21）
  const profileOf = p => [p.tm === "known" ? String(p.h).padStart(2, "0") + String(p.mi).padStart(2, "0") : "nt", p.sex || "X", p.bp || "-"].join("_") + (p.lateZi && p.dayBoundary === "24" ? "_d24" : "");
  function answerKeys(i) {
    const d = typeof currentData !== "undefined" ? currentData : null;
    if (!d) return null;
    const cp = isCompat(), date = p => p.y + "_" + p.m + "_" + p.d;
    // 総合の旧キーは、前の「総合鑑定の答えを貼る欄」（tab9）と同じ置き場所
    const old = (i === SUM_I ? "sanmeiban_reading_" + date(d) : "sanmeiban_consult_" + date(d) + "_" + i) + (cp ? "_with_" + date(dataB) : "");
    return { key: old + "_p_" + profileOf(d) + (cp ? "_" + profileOf(dataB) + "_" + (dataB.relType || "love") : ""), old };
  }
  function answerKey(i) { const k = answerKeys(i); return k ? k.key : null; }
  // 新しいキーに無いときだけ、前の版で残した答え（入力の区別なし）を注意書き付きで出す
  function savedAnswer(i) {
    const k = answerKeys(i);
    if (!k) return { text: "", legacy: false };
    const t = localStorage.getItem(k.key);
    if (t) return { text: t, legacy: false };
    const o = localStorage.getItem(k.old) || "";
    return { text: o, legacy: !!o };
  }
  const LEGACY_NOTE = '<p class="rs-small">※ この答えは、生まれた時刻・性別・出生地を分けずに保存していた前の版で残したものです。入力を変えていたら、今の入力で聞き直して保存し直してください。</p>';
  // AIの答えを読みやすくする（見出し・太字・箇条書き・段落）。先にエスケープするので、答えの中のタグは動かない
  function answerHtml(text) {
    const out = [];
    let list = false;
    esc(text).split(/\r?\n/).forEach(raw => {
      const line = raw.trim();
      const isItem = /^([-・*]|\d+[.)])\s+/.test(line);
      if (list && !isItem) { out.push("</ul>"); list = false; }
      if (!line) return;
      const b = s => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      const h = line.match(/^#{1,4}\s*(.+)$/);
      if (h) { out.push('<div class="rs-ans-h">' + b(h[1]) + "</div>"); return; }
      if (/^-{3,}$/.test(line)) { out.push("<hr>"); return; }
      if (isItem) { if (!list) { out.push("<ul>"); list = true; } out.push("<li>" + b(line.replace(/^([-・*]|\d+[.)])\s+/, "")) + "</li>"); return; }
      out.push("<p>" + b(line) + "</p>");
    });
    if (list) out.push("</ul>");
    return out.join("");
  }
  function consultHtml(i, sys) {
    const ths = themesNow(i), sv = savedAnswer(i), saved = sv.text;
    const who = isCompat() ? "2人の" + sys + "の結果" : sys + "の結果";
    const lead = i === SUM_I && isCompat()
      ? "2人の9つの占いの数値と相性の判定、この画面と各タブの相性の読み、2人それぞれの知りたいこと別のまとめを、AIへの相談文にします。ChatGPT・Claude・Gemini などに貼って送ると、9つを合わせて2人の相性を読んでくれます。続けて質問すれば、そのまま相談を続けられます。"
      : i === SUM_I
      ? "9つの占いの数値、知りたいこと別のまとめ（何個の占いがそろったか）、各タブの読みをまとめて、AIへの相談文にします。ChatGPT・Claude・Gemini などに貼って送ると、9つを合わせて読んでくれます。続けて質問すれば、そのまま相談を続けられます。"
      : "このタブに出ている" + who + "を全部まとめて、AIへの相談文にします。ChatGPT・Claude・Gemini などに貼って送ると、" + sys + "の見方で詳しく読んでくれます。続けて質問すれば、そのまま相談を続けられます。";
    return '<div class="rs-consult" id="rs-consult-' + i + '" data-theme="' + ths[0].id + '">' +
      '<div class="rs-consult-h">' + sys + "でAIに相談する</div>" +
      '<p class="rs-consult-lead">' + lead + "</p>" +
      '<div class="rs-consult-l" id="rs-cl-' + i + '">相談したいこと</div>' +
      '<div class="rs-chips" role="group" aria-labelledby="rs-cl-' + i + '">' + ths.map((t, k) =>
        '<button type="button" class="rs-chip" aria-pressed="' + (k === 0) + '" onclick="RSynth.pickTheme(' + i + ",'" + t.id + "')\">" + t.label + "</button>").join("") + "</div>" +
      '<label class="rs-consult-l" for="rs-q-' + i + '">聞きたいこと（書かなくても送れます）</label>' +
      '<textarea id="rs-q-' + i + '" class="rs-q" rows="3" maxlength="1000" placeholder="' + (isCompat() ? "例：最近すれ違いが多い。どう接するといいか知りたい" : "例：転職を考えています。今動いていいか知りたい") + '"></textarea>' +
      (i === SUM_I && !isCompat() ? (() => { const A = amounts(), k = digestFull ? 1 : 0;
        return '<div class="rs-consult-l" id="rs-al-' + i + '">AIに渡す量</div>' +
          '<div class="rs-amts" role="group" aria-labelledby="rs-al-' + i + '">' + A.map((a, n) =>
            '<button type="button" class="rs-chip" aria-pressed="' + (n === k) + '" onclick="RSynth.setAmount(' + i + "," + n + ')">' + a.label + "</button>").join("") + "</div>" +
          '<span class="rs-small rs-amt-note">' + A[k].note + "</span>"; })() : "") +
      '<button type="button" class="rs-share rs-consult-copy" onclick="RSynth.copyConsult(' + i + ')">AIへの相談文をコピー</button>' +
      (i === SUM_I ? '<button type="button" class="rs-share rs-share-sub rs-consult-save" onclick="RSynth.saveConsult(' + i + ')">テキストファイルで保存</button>' : "") +
      '<div class="rs-consult-msg" id="rs-cmsg-' + i + '" aria-live="polite"></div>' +
      '<details class="rs-fold rs-answer"' + (saved ? " open" : "") + "><summary>AIの答えをこのタブに残す<span>貼り付けて保存すると、次に開いたときもここで読めます（この端末の中に保存します）</span></summary>" +
      '<div class="rs-fold-body"><div class="rs-ans-view" id="rs-av-' + i + '">' + (saved ? (sv.legacy ? LEGACY_NOTE : "") + answerHtml(saved) : "") + "</div>" +
      '<label class="rs-consult-l" for="rs-at-' + i + '">AIの答え</label>' +
      '<textarea id="rs-at-' + i + '" class="rs-q" rows="5" placeholder="AIの答えをここに貼り付けて「保存」">' + esc(saved) + "</textarea>" +
      '<div class="rs-ans-btns"><button type="button" class="rs-ans-save" onclick="RSynth.saveAnswer(' + i + ')">保存</button>' +
      '<button type="button" class="rs-ans-clear" onclick="RSynth.clearAnswer(' + i + ')">消す</button></div></div></details></div>';
  }
  function pickTheme(i, id) {
    const box = document.getElementById("rs-consult-" + i);
    if (!box) return;
    box.dataset.theme = id;
    const ths = themesNow(i);
    // 「AIに渡す量」のボタンも同じ .rs-chip なので、相談したいことの側（.rs-chips の中）だけを書き換える
    box.querySelectorAll(".rs-chips .rs-chip").forEach((b, k) => b.setAttribute("aria-pressed", String(ths[k] && ths[k].id === id)));
    if (id === "free") { const q = document.getElementById("rs-q-" + i); if (q) q.focus(); }
  }
  function setAmount(i, k) {
    setDigestFull(k === 1);
    const box = document.getElementById("rs-consult-" + i);
    if (!box) return;
    box.querySelectorAll(".rs-amts .rs-chip").forEach((b, n) => b.setAttribute("aria-pressed", String(n === k)));
    const p = box.querySelector(".rs-amt-note");
    if (p) p.textContent = amounts()[k].note;
  }
  // AIに渡さない節の見出し（図・表そのもの。惑星の配置・大運・KINは数値の段と文で別に渡している）
  const SKIP_SEC = ["ツォルキン表", "ラーシチャート", "人生タイムライン", "AIで深く読む"];
  // タブに出ている文を、畳んだ節も開いて取り出す（タブは見えている前提＝ボタンを押したタブ）
  function tabText(i) {
    const el = document.getElementById("tab" + i);
    if (!el) return "";
    // 隠れたタブの innerText は改行も隠す指定も効かないので、読む間だけ見せる
    const hidden = el.classList.contains("hide");
    if (hidden) el.classList.remove("hide");
    const closed = Array.from(el.querySelectorAll("details:not([open])")).filter(x => !x.closest(".rs-consult"));
    closed.forEach(x => { x.open = true; });
    // 操作のための部品は読まない（相談箱・戻る・シェア・画像保存・分類のボタン列・問いの一覧）。
    // 2026-10-23 総合鑑定を丸ごと渡すようにしたとき、「結果をシェア」「16タイプを全部見る」などが相談文に混ざった
    const hide = Array.from(el.querySelectorAll(".rs-consult, .rs-back, .rs-to-consult, .rs-actions, .rs-story-link, .rs-cats, .qe, svg"));
    // 図そのものの節も読まない（中身が座標や記号の羅列で、同じ内容が数値や文で別に入っている）。
    // 2026-10-23 ツォルキン表の260マスの数字、タイムラインの「始待表基変責省穫了」×9、ラーシチャートの格子が相談文に入っていた
    Array.from(el.querySelectorAll(".section-title")).forEach(t => {
      if (!SKIP_SEC.some(w => t.textContent.indexOf(w) >= 0)) return;
      hide.push(t);
      for (let n = t.nextElementSibling; n && !n.classList.contains("section-title"); n = n.nextElementSibling) hide.push(n);
    });
    // 畳んだ節（foldTab が移したもの）は見出しが summary になっているので、その details ごと読まない
    Array.from(el.querySelectorAll("details")).forEach(dt => {
      const s = dt.querySelector(":scope > summary");
      if (s && SKIP_SEC.some(w => s.textContent.indexOf(w) >= 0)) hide.push(dt);
    });
    const prev = hide.map(x => x.style.display);
    hide.forEach(x => { x.style.display = "none"; });
    let t = el.innerText;
    hide.forEach((x, k) => { x.style.display = prev[k]; });
    closed.forEach(x => { x.open = false; });
    if (hidden) el.classList.add("hide");
    return t.replace(/（クリックで開く）/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function personLine(d, label) {
    const t = d.tm === "known" ? String(d.h).padStart(2, "0") + ":" + String(d.mi).padStart(2, "0") : "不明";
    return label + "：" + d.y + "年" + d.m + "月" + d.d + "日生まれ・出生時刻 " + t + "・性別 " + ({ M: "男性", F: "女性", X: "回答なし" }[d.sex] || "回答なし") + (d.bp ? "・出生地 " + d.bp : "");
  }
  // 総合鑑定の相談文：buildExportText（数値＋まとめ＋各タブの読み＋鑑定依頼）。テーマが「8つの章」以外なら鑑定依頼の部分を差し替える
  function summaryPrompt(th, q) {
    const compat = isCompat();
    const base = compat ? (typeof buildCompatExportText === "function" ? buildCompatExportText() : "") : (typeof buildExportText === "function" ? buildExportText() : "");
    if (th.id === "detail") return base + (q ? "\n\n■ 特に聞きたいこと\n" + q + "\n（" + (compat ? "6" : "8") + "つの章のうち関係する章で、この相談にもはっきり答えてください）" : "");
    const k = base.indexOf("━━━━━━━━━━━━━━━━━━━━\n鑑定依頼");
    const head = k >= 0 ? base.slice(0, k) : base;
    return head + ["━━━━━━━━━━━━━━━━━━━━", "相談", "━━━━━━━━━━━━━━━━━━━━",
      th.ask ? th.ask() : "下の相談に、9つの占いを合わせて答えてください。", q ? "相談：" + q : "", "",
      "【答え方】",
      compat ? "- 9つの占いを合わせて答える。根拠にした占いと、2人それぞれの星・数・宿・干支などを、文の中で示す（例：「宿曜ではあなたの危宿から見て相手は成宿なので」）"
        : "- 9つの占いを合わせて答える。根拠にした占いと星・数・宿・干支などを、文の中で示す（例：「四柱推命の日主が庚で、九星も一白なので」）",
      compat ? "- 多くの占いがそろう点ははっきり、占いによって分かれる点は「場面によって違う顔が出る」として書く"
        : "- 【11】の「何個の占いがそろったか」を使い、多くの占いがそろう点ははっきり、そろった数が2つ以下の点は控えめに書く",
      // 2026-10-20 監査: 「計算し直さない」だけだと旧暦・四化などの誤りをAIが止められない。食い違いに気づいたら言ってもらう
      "- 星・干支・宿・数などの計算値は、基本はそのまま使う（天体の位置は Swiss Ephemeris による計算）。ただし計算値どうしが食い違う、暦や占術の決まりと合わないと気づいたら、使う前にその点を指摘する",
      "- " + (compat ? "【相性の画面の読み】" : digestFull ? "【12】【13】" : "【12】") + "など羅占盤の解説文は、確かめてよい参考情報として扱う。計算値と食い違う点や、その占術の一般的な読み方と違う点があれば、指摘して、採用する読みと根拠を示す",
      // 全部モードは5万字を超える。前の方だけで書かれないよう、9つ全部を見てから答えるよう頼む
      ...(digestFull ? ["- 渡した内容は長いですが、9つの占いすべてに目を通してから答える。前半に出てくる占いだけで書かない。どの占いを根拠にしたか分かるように書く"] : []),
      "- 上の内容に無い配置や条件を、確かめた事実のように付け足さない",
      "- 読み手は占いに詳しくない。専門用語は、使ったらその場で一言で説明する",
      "- 決めつけず、毎日の行動・仕事・人づきあいの具体的な形にする。健康・お金・法律のことは一般的な目安にとどめる",
      "- 最後に、" + (compat ? "2人" : "この人") + "が続けて聞くとよい質問を3つ挙げる"].filter((x, n) => x || n !== 4).join("\n");
  }
  function consultPrompt(i) {
    const sys = SYS[i], box = document.getElementById("rs-consult-" + i), d = currentData;
    const th = themesNow(i).find(t => t.id === (box && box.dataset.theme)) || themesNow(i)[0];
    const q = ((document.getElementById("rs-q-" + i) || {}).value || "").trim();
    if (th.id === "free" && !q) return { err: "「自由に相談」は、聞きたいことを書いてからコピーしてください。" };
    if (i === SUM_I) return { text: summaryPrompt(th, q) };
    let type = "", exWhat = "";
    try { type = buildSynthesis(d).tj.type.name; } catch (e) { }
    // 向かいの宮から借りた星は「その宮にある」と書かない（借星の例を、星がある例として渡さない）
    try { const w = workReads(d).find(r => r.sys === sys); if (w) exWhat = w.what.replace(/^(.+?宮)に(.+)（向かいの宮から借りた星）$/, "$1に主星が無く、向かいの宮の$2を借りる").replace(/（[^）]*）$/, ""); } catch (e) { }
    const compat = isCompat();
    const lines = [
      "あなたは" + sys + "に詳しい鑑定士です。以下は占いサイト「羅占盤」で計算した" + (compat ? "2人の相性について" : "ある人") + "の" + sys + "の結果です。画面に出している内容をそのまま渡します。",
      "",
      "■ 相談したいこと",
      th.ask ? th.ask(sys) : "下の相談に、" + sys + "の見方で答えてください。",
    ];
    if (q) lines.push("相談：" + q);
    lines.push("",
      "■ 答え方",
      // 例はこの人の実際の材料から作る。旧版はどの占術・どの人にも「日主が庚なので」で、日主が丙の人や紫微・九星の相談にも庚が出ていた（2026-10-20）
      "- " + sys + "の見方で答える。根拠にした星・数・宿・干支などを、文の中で示す" + (exWhat ? "（例：「" + exWhat + (/借りる$/.test(exWhat) ? "ので" : /宮に[^が]+$/.test(exWhat) ? "があるので" : "なので") + "」）" : ""),
      "- 星・干支・宿・数などの計算値は、基本はそのまま使う" + (/西洋|インド/.test(sys) ? "（天体の位置は Swiss Ephemeris による計算）" : "") + "。ただし計算値どうしが食い違う、暦や" + sys + "の決まりと合わないと気づいたら、使う前にその点を指摘する",
      "- 画面の解説文は、確かめてよい参考情報として扱う。計算値と食い違う点や、" + sys + "の一般的な読み方と違う点があれば、指摘して、採用する読みと根拠を示す",
      "- 下の内容に無い配置や条件を、確かめた事実のように付け足さない",
      "- " + sys + "だけが示す特徴を2つ以上取り上げる。どの占いでも言えそうな一般論だけで終わらせない",
      ...(READ_ORDER[sys] && !compat ? ["- " + sys + "の本来の読む順で根拠を組み立てる：" + READ_ORDER[sys] + "。下の画面の文の並び順にはこだわらない"] : []),
      "- 冒頭の「総合鑑定の中での" + sys + "」は、9つの占いをまとめた結果とこの占いの違い。違う点があれば、それが何を意味するかに触れる",
      "- 読み手は占いに詳しくない。専門用語は、使ったらその場で一言で説明する",
      "- 決めつけず、毎日の行動・仕事・人づきあいの具体的な形にする。健康・お金・法律のことは一般的な目安にとどめる",
      "- 最後に、" + (compat ? "2人" : "この人") + "が続けて聞くとよい質問を3つ挙げる",
      "",
      "■ 基本情報",
      personLine(d, compat ? "あなた" : "本人"));
    if (compat) lines.push(personLine(dataB, "お相手"));
    if (type && !compat) lines.push("羅占盤タイプ（9つの占いの総合）：" + type);
    lines.push("", "■ " + sys + "の結果（羅占盤の画面より）", tabText(i));
    return { text: lines.join("\n") };
  }
  function showMsg(i, s) {
    const m = document.getElementById("rs-cmsg-" + i);
    if (!m) return;
    m.textContent = s;
    clearTimeout(m._t);
    m._t = setTimeout(() => { m.textContent = ""; }, 6000);
  }
  function copyText(i, text) {
    const done = () => showMsg(i, "✓ コピーしました（約" + man(text.length) + "字）。AIの入力欄に貼り付けて送ってください。");
    const fallback = () => {
      // コピーできない環境では、選んだ状態の文を出す（手でコピーしてもらう）
      const ta = document.getElementById("rs-q-" + i);
      const wrap = document.createElement("div");
      wrap.className = "rs-copy-fallback";
      wrap.innerHTML = '<div class="rs-consult-l">自動でコピーできませんでした。下の文を選んでコピーしてください</div><textarea class="rs-q" rows="10" readonly></textarea>';
      wrap.querySelector("textarea").value = text;
      const box = document.getElementById("rs-consult-" + i), old = box && box.querySelector(".rs-copy-fallback");
      if (old) old.remove();
      if (ta) ta.parentNode.insertBefore(wrap, document.getElementById("rs-cmsg-" + i));
      const t2 = wrap.querySelector("textarea"); t2.focus(); t2.select();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  function copyConsult(i) {
    if (typeof currentData === "undefined" || !currentData) return;
    const p = consultPrompt(i);
    if (p.err) { showMsg(i, p.err); return; }
    try {
      const lp = new URLSearchParams({ action: "consult", type: SYS[i] || "総合", typeCode: (document.getElementById("rs-consult-" + i) || {}).dataset.theme || "", userAgent: navigator.userAgent.slice(0, 80) });
      fetch("https://script.google.com/macros/s/AKfycbxLSqZds8AnBUl3MJe6WQuQr1_Q4D1mhf_ik7UHwgWmKEzWaaNdzAqdBuzFfzrMRx0_fg/exec?" + lp.toString(), { mode: "no-cors" }).catch(() => { });
    } catch (e) { }
    // 生年月日が入ることを、最初の1回だけ知らせる（総合鑑定のコピーと同じ印を使う）
    const KEY = "ra_ai_privacy_acknowledged";
    if (!localStorage.getItem(KEY)) {
      const ok = window.confirm("AIへの相談文には、生年月日・出生時刻・出生地が入ります。\n貼り付けた後の扱いは、お使いのAIサービスの決まりによります。\n（羅占盤は、生年月日を外部に送っていません）\n\nコピーしますか？");
      if (!ok) return;
      localStorage.setItem(KEY, "1");
    }
    copyText(i, p.text);
  }
  // 「画面の文を全部」は5万字を超えるので、チャット欄に貼る代わりにファイルで添付できるようにする（2026-10-23）
  function saveConsult(i) {
    if (typeof currentData === "undefined" || !currentData) return;
    const r = consultPrompt(i);
    if (r.err) { showMsg(i, r.err); return; }
    const KEY = "ra_ai_privacy_acknowledged";
    if (!localStorage.getItem(KEY)) {
      if (!window.confirm("相談文には、生年月日・出生時刻・出生地が入ります。\nこの端末にテキストファイルとして保存します。\nAIに渡した後の扱いは、お使いのAIサービスの決まりによります。\n（羅占盤は、生年月日を外部に送っていません）\n\n保存しますか？")) return;
      localStorage.setItem(KEY, "1");
    }
    const d = currentData, z = n => String(n).padStart(2, "0");
    const nm = "羅占盤_相談文_" + d.y + z(d.m) + z(d.d) + (isCompat() && dataB ? "_x" + dataB.y + z(dataB.m) + z(dataB.d) : "") + ".txt";
    try {
      const url = URL.createObjectURL(new Blob([r.text], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = nm; a.style.display = "none";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showMsg(i, "✓ " + nm + "（約" + man(r.text.length) + "字）を保存しました。AIの入力欄にこのファイルを添付して送れます。");
    } catch (e) { showMsg(i, "ファイルに保存できませんでした。「AIへの相談文をコピー」をお使いください。"); }
  }
  function saveAnswer(i) {
    const k = answerKey(i), ta = document.getElementById("rs-at-" + i), v = document.getElementById("rs-av-" + i);
    if (!k || !ta || !v) return;
    const t = ta.value.trim().slice(0, 30000);
    if (!t) { localStorage.removeItem(k); v.innerHTML = ""; return; }
    localStorage.setItem(k, t);
    v.innerHTML = answerHtml(t);
    showMsg(i, "✓ 保存しました");
  }
  function clearAnswer(i) {
    const ks = answerKeys(i);
    if (!ks || !window.confirm("このタブに残したAIの答えを消しますか？")) return;
    // 出ていたのが前の版の答え（新しいキーが空）なら、その旧キーも消す
    if (!localStorage.getItem(ks.key)) localStorage.removeItem(ks.old);
    localStorage.removeItem(ks.key);
    const ta = document.getElementById("rs-at-" + i), v = document.getElementById("rs-av-" + i);
    if (ta) ta.value = "";
    if (v) v.innerHTML = "";
  }
  function goConsult(i) {
    const el = document.getElementById("rs-consult-" + i);
    if (!el) return;
    const tabs = document.querySelector(".tabs");
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - (tabs ? tabs.getBoundingClientRect().bottom : 0) - 12, behavior: "smooth" });
  }
  function addConsult(i, sys) {
    const el = document.getElementById("tab" + i);
    if (!el) return;
    const old = el.querySelector(".rs-consult");
    if (old) old.remove();
    const tmp = document.createElement("div");
    tmp.innerHTML = consultHtml(i, sys);
    el.insertBefore(tmp.firstChild, footNote(el));
  }
  // タブの最後の注記（※…）。節の途中の説明の .note の前に入れないよう、末尾の .note だけを見る
  function footNote(el) {
    const last = el.lastElementChild;
    return last && last.classList.contains("note") ? last : null;
  }
  function summaryConsultHtml() {
    try { return consultHtml(SUM_I, SUM_SYS); } catch (e) { console.warn("総合鑑定の相談欄でエラー:", e); return ""; }
  }

  // ===== 知りたいこと別に、9つの占術をまとめる（2026-10-19 井内さん「そういうのが９つの占いを総合的に判断してどう考えるのかを書いて欲しい」）=====
  //   各占術の材料（宿・星座・数・星…）を、テーマごとの「傾向の札」に振り分け、何種類の占術が同じ札を出したかで数える（16タイプと同じ考え方）。
  //   いちばん多い札を結論に、次に多い札を補い、反対の札が2つ以上あれば「場面で顔が変わる」と書く。まずは仕事から
  const WORK_TAGS = {
    lead:    { label: "人の前に立って率いる", say: "方針を決め、人をまとめて前に進める役", ex: "チームリーダー・管理職・経営・プロジェクトの責任者" },
    support: { label: "人の間に立って支える", say: "人と人をつなぎ、調整し、表に立つ人を支える役", ex: "調整役・秘書・人事・営業事務・コーディネーター" },
    expert:  { label: "専門を深める", say: "一つの分野を掘り下げ、確かな知識や技術で頼られる役", ex: "研究・技術職・分析・法律や医療などの専門職" },
    indep:   { label: "自分で始める", say: "自分の判断で新しく立ち上げ、裁量を持って動く役", ex: "起業・フリーランス・新規事業・独立した専門家" },
    care:    { label: "人を育て、助ける", say: "人の成長や暮らしを支え、教え、助ける役", ex: "教育・医療・福祉・人材育成・相談の仕事" },
    create:  { label: "表現して伝える", say: "言葉・作品・企画で人の心を動かす役", ex: "企画・広報・デザイン・文章・芸術・接客" },
    steady:  { label: "着実に積み上げる", say: "決めたことを続け、仕組みや信用を長く育てる役", ex: "経理・公務・管理部門・製造・不動産・金融" },
    move:    { label: "動き回って広げる", say: "人に会い、場所を変え、変化の中で道を広げる役", ex: "営業・旅行・物流・海外との仕事・メディア" },
  };
  const WORK_OPP = { lead: "support", support: "lead", indep: "steady", steady: "indep", move: "steady" };
  const SIGN_WORK = { "牡羊座": ["lead", "indep"], "牡牛座": ["steady"], "双子座": ["move", "create"], "蟹座": ["care"], "獅子座": ["lead", "create"], "乙女座": ["expert"],
    "天秤座": ["support"], "蠍座": ["expert"], "射手座": ["care", "move"], "山羊座": ["steady", "lead"], "水瓶座": ["indep"], "魚座": ["care", "create"] };
  const RASHI_WORK = { "メーシャ": ["lead", "indep"], "ヴリシャバ": ["steady"], "ミトゥナ": ["move", "create"], "カルカ": ["care"], "シンハ": ["lead"], "カンニャー": ["expert"],
    "トゥラー": ["support"], "ヴリシュチカ": ["expert"], "ダヌ": ["care"], "マカラ": ["steady"], "クンバ": ["indep"], "ミーナ": ["care", "create"] };
  const TEN_WORK = { "比肩": ["indep"], "劫財": ["indep", "move"], "食神": ["create"], "傷官": ["create", "expert"], "偏財": ["move"], "正財": ["steady"],
    "偏官": ["lead"], "正官": ["steady", "lead"], "偏印": ["expert"], "正印": ["care", "expert"] };
  const ZW_WORK = { "紫微": ["lead"], "天府": ["steady"], "太陽": ["lead", "care"], "太陰": ["support", "create"], "武曲": ["expert"], "廉貞": ["indep"], "天機": ["expert"],
    "天同": ["care"], "貪狼": ["create"], "巨門": ["expert"], "天相": ["support"], "天梁": ["care"], "七殺": ["indep"], "破軍": ["indep", "move"] };
  const CENTER_WORK = { "貫索星": ["indep", "expert"], "石門星": ["support"], "鳳閣星": ["create"], "調舒星": ["create", "expert"], "禄存星": ["care"], "司禄星": ["steady"],
    "車騎星": ["move"], "牽牛星": ["steady", "lead"], "龍高星": ["move", "expert"], "玉堂星": ["expert"] };
  const LP_WORK = { 1: ["indep", "lead"], 2: ["support"], 3: ["create"], 4: ["steady"], 5: ["move"], 6: ["care"], 7: ["expert"], 8: ["lead"], 9: ["care"], 11: ["create"], 22: ["lead"], 33: ["care"] };
  const KY_WORK = { 1: ["expert"], 2: ["support", "steady"], 3: ["indep"], 4: ["support"], 5: ["lead"], 6: ["lead", "steady"], 7: ["create"], 8: ["steady"], 9: ["create", "expert"] };
  const SEAL_WORK = [["care"], ["create"], ["create"], ["expert"], ["indep"], ["support"], ["care"], ["create"], ["indep"], ["care"], ["create"], ["indep"], ["move"], ["support"], ["expert"],
    ["indep"], ["support"], ["expert"], ["lead"], ["lead"]];
  const SHUKU_WORK = { "昴宿": ["create"], "畢宿": ["steady", "expert"], "觜宿": ["expert"], "参宿": ["indep", "lead"], "井宿": ["expert", "steady"], "鬼宿": ["create", "care"],
    "柳宿": ["expert", "care"], "星宿": ["lead", "indep"], "張宿": ["create", "move"], "翼宿": ["move"], "軫宿": ["support"], "角宿": ["support", "create"], "亢宿": ["expert"],
    "氐宿": ["steady"], "房宿": ["lead"], "心宿": ["support"], "尾宿": ["expert"], "箕宿": ["indep"], "斗宿": ["lead", "care"], "女宿": ["steady", "expert"], "虚宿": ["expert"],
    "危宿": ["move", "create"], "室宿": ["indep", "lead"], "壁宿": ["support", "create"], "奎宿": ["steady", "expert"], "婁宿": ["support"], "胃宿": ["indep"] };
  const first = s => String(s || "").split("。")[0] + (s ? "。" : "");
  function workReads(d) {
    // index.html の const は window に載らないので、名前で直接読む（無ければ空）
    const TBL = {
      JUSSHU_EXPL: typeof JUSSHU_EXPL !== "undefined" ? JUSSHU_EXPL : {},
      NUMEROLOGY_MEANINGS: typeof NUMEROLOGY_MEANINGS !== "undefined" ? NUMEROLOGY_MEANINGS : {},
      SHUKUYO_READ: typeof SHUKUYO_READ !== "undefined" ? SHUKUYO_READ : {},
      JYOTISH_READ: typeof JYOTISH_READ !== "undefined" ? JYOTISH_READ : {},
    };
    const g = k => TBL[k];
    const rows = [];
    const add = (sys, what, tags, note) => { if (tags && tags.length) rows.push({ sys, what, tags, note: note || "" }); };
    // 西洋：時刻があれば MC（社会での顔）、無ければ太陽の星座
    const mcSign = d.mcLon != null ? SIGNS[signOf(d.mcLon)].n : null, sun = SIGNS[signOf(d.sunLon)].n;
    add("西洋占星術", mcSign ? "MC（天頂）が" + mcSign : "太陽が" + sun, SIGN_WORK[mcSign || sun], mcSign ? "社会での立場を表す天頂の星座で見る" : "生まれた時刻が無いので、太陽の星座で見る");
    // 四柱：月柱の十神（社会・仕事の柱）
    const mt = d.pillars && d.pillars[1] ? d.pillars[1].ten : null;
    add("四柱推命", "月柱の十神が" + mt, TEN_WORK[mt], "月柱は社会に出てからの柱");
    // 紫微：官禄宮の主星（時刻が分かるときだけ）
    if (d.hourKnown !== false && d.tm === "known" && typeof PALACE_NAMES !== "undefined") {
      const i = PALACE_NAMES.indexOf("官禄宮"), bi = (d.lifeIdx - i + 12) % 12;
      let st = (d.ziweiDistrib[bi] || []).filter(s => ZW_WORK[s]), borrow = false;
      if (!st.length) { st = (d.ziweiDistrib[(bi + 6) % 12] || []).filter(s => ZW_WORK[s]); borrow = true; }
      if (st.length) add("紫微斗数", "官禄宮に" + st.join("・") + (borrow ? "（向かいの宮から借りた星）" : ""), [...new Set(st.flatMap(s => ZW_WORK[s]))], "官禄宮は仕事の宮");
    }
    // 算命：中心星
    const sm = calcJintai(d), c = sm.stars.center;
    add("算命学", "中心星が" + c, CENTER_WORK[c], first((g("JUSSHU_EXPL") || {})[c]));
    // 数秘：ライフパス
    const n = calcNumerology(d.y, d.m, d.d), lp = (g("NUMEROLOGY_MEANINGS") || {})[n.lifePath] || {};
    add("数秘術", "ライフパス" + n.lifePath, LP_WORK[n.lifePath], first(lp.career));
    // 九星：本命星
    const ky = calcKyusei(d.y, d.m, d), hn = KYUSEI_NAMES[ky.honmei];
    add("九星気学", "本命星が" + hn.name, KY_WORK[ky.honmei], hn.career ? "向く仕事の例：" + hn.career : "");
    // マヤ：太陽の紋章
    const ma = calcMaya(d.y, d.m, d.d), seal = MAYA_SEALS[ma.seal];
    add("マヤ暦", "太陽の紋章が" + seal.n, SEAL_WORK[ma.seal], "キーワード：" + seal.k);
    // 宿曜：本命宿
    const sh = SHUKUYO_27[calcShukuyo(d)].n;
    add("宿曜", "本命宿が" + sh, SHUKU_WORK[sh], first(((g("SHUKUYO_READ") || {})[sh] || {}).work));
    // インド：太陽のラーシ（仕事・地位）
    const ay = ayanamsha(d.jd), sr = JYOTISH_RASHIS[Math.floor(norm360(d.sunLon - ay) / 30)];
    add("インド占星術", "太陽が" + sr.n + "（" + sr.jp + "）", RASHI_WORK[sr.n], first(((g("JYOTISH_READ") || {})[sr.n] || {}).work));
    return rows;
  }
  function topicSummary(rows, TAGS, OPP) {
    const cnt = {};
    rows.forEach(r => r.tags.forEach(t => { (cnt[t] = cnt[t] || []).push(r.sys); }));
    const order = Object.keys(cnt).sort((a, b) => cnt[b].length - cnt[a].length || Object.keys(TAGS).indexOf(a) - Object.keys(TAGS).indexOf(b));
    const top = order[0], second = order.slice(1).find(t => cnt[t].length >= 2 && OPP[top] !== t);
    const opp = OPP[top] && cnt[OPP[top]] && cnt[OPP[top]].length >= 2 ? OPP[top] : null;
    return { cnt, order, top, second, opp, total: rows.length };
  }
  // 知りたいこと別の「9つの占術をまとめると」。各タブの答え（qaFor）の札を、そのテーマを ◎○ で見られる占術だけで数える
  //   （TOPIC_CFG は QA の後ろで定義。呼ばれるのは描画時なので順番は問わない）
  const qaCache = new WeakMap();
  function qaAll(d) {
    if (!qaCache.has(d)) { const o = {}; SYS.forEach(s => { try { o[s] = qaFor(d, s); } catch (e) { o[s] = {}; } }); qaCache.set(d, o); }
    return qaCache.get(d);
  }
  function renderTopic(d, key) {
    const cfg = TOPIC_CFG[key], T = cfg.tags, qi = QA.findIndex(q => q[0] === key), all = qaAll(d), rows = [], ref = [];
    SYS.forEach(sys => {
      const x = all[sys][key];
      if (!x || !x.tags || !x.tags.length) return;
      const r = { sys, what: x.what || "", tags: x.tags.filter(t => T[t]), note: x.note || "" };
      ("◎○".indexOf(QA_RATE[sys][qi]) >= 0 ? rows : ref).push(r);
    });
    const s = topicSummary(rows, T, cfg.opp || {});
    if (!s.top) return "";
    const nm = list => list.join("・"), nTop = s.cnt[s.top].length, tie = s.second && s.cnt[s.second].length === nTop;
    const nTxt = t => '<span class="rs-topic-n">（' + cfg.who + "占術" + s.total + "つのうち" + s.cnt[t].length + "つ：" + nm(s.cnt[t]) + "）</span>";
    const say = t => cfg.fmt ? cfg.fmt(T[t]) : T[t].say;
    // 同じ札を出した占術が2つ以下なら、見立てが分かれたと書く（盛らない）
    const weak = nTop <= 2 ? "占術ごとに見立てが分かれましたが、" : "";
    let h = '<div class="rs-topic" id="rs-topic-' + key + '"><div class="rs-topic-h">' + cfg.title + " — 9つの占術をまとめると</div>";
    if (tie) {
      h += '<p class="rs-topic-lead">' + weak + cfg.lead + "<b>「" + T[s.top].label + "」</b>と<b>「" + T[s.second].label + "」</b>の二つです。" + say(s.top) + say(s.second) + (cfg.pair || "") +
        '<span class="rs-topic-n">（' + cfg.who + "占術" + s.total + "つのうち、" + [s.top, s.second].map(t => "「" + T[t].label + "」" + s.cnt[t].length + "つ：" + nm(s.cnt[t])).join("／") + "）</span></p>";
    } else {
      h += '<p class="rs-topic-lead">' + weak + cfg.lead + "<b>「" + T[s.top].label + "」</b>です。" + say(s.top) + nTxt(s.top) + "</p>";
      if (s.second) h += '<p class="rs-topic-lead">次に多いのは<b>「' + T[s.second].label + "」</b>。" + say(s.second) + (cfg.pair || "") + nTxt(s.second) + "</p>";
    }
    if (s.opp && cfg.oppText) h += '<p class="rs-topic-lead">一方で<b>「' + T[s.opp].label + "」</b>を示す占術もあります" + '<span class="rs-topic-n">（' + s.cnt[s.opp].length + "つ：" + nm(s.cnt[s.opp]) + "）</span>。" +
      cfg.oppText(T[s.top].label, T[s.opp].label) + "</p>";
    if (cfg.extra) h += cfg.extra(d, s, T);
    h += '<details class="rs-fold rs-topic-why"><summary>それぞれの占術は、何を見てそう言っているか<span>占術ごとの材料と見立て（★＝結論と同じ）</span></summary><div class="rs-fold-body"><ul class="rs-topic-rows">' +
      rows.map(r => '<li><b>' + r.sys + "</b>　" + esc(r.what) + "<br>" + r.tags.map(t => '<span class="rs-bt' + (t === s.top || t === s.second ? " rs-bt-top" : "") + '">' + T[t].label + (t === s.top ? "★" : "") + "</span>").join("") +
        (r.note ? '<span class="rs-topic-note">' + esc(r.note) + "</span>" : "") + "</li>").join("") + "</ul>" +
      (ref.length ? '<p class="rs-small">参考（' + cfg.title + "を直接は見ない占術なので数えていない）：" + ref.map(r => r.sys + "＝" + r.tags.map(t => T[t].label).join("・")).join("、") + "</p>" : "") +
      (d.tm === "unknown" && cfg.timeNote ? '<p class="rs-small">' + cfg.timeNote + "</p>" : "") +
      '<p class="rs-small">' + cfg.who + "占術の材料を" + Object.keys(T).length + "つの" + cfg.unit + "に振り分け、同じ" + cfg.unit + "を示した占術の数で数えています（1つの占術が2つを示すこともあります）。各占術の答えは、それぞれのタブの「知りたいことに、〇〇で答えると」にあります。</p></div></details></div>";
    return h;
  }
  function topicHtml(d, topic) {
    try { return TOPIC_CFG[topic] ? renderTopic(d, topic) : ""; } catch (e) { console.warn("知りたいこと別のまとめでエラー:", e); return ""; }
  }
  // 知りたいこと別の結論を、文字で外へ渡す（タロットへ「命盤から見た材料」として持って行くのに使う。2026-10-23）
  function topicConclusion(d, key) {
    const cfg = TOPIC_CFG[key];
    if (!cfg) return null;
    const T = cfg.tags, qi = QA.findIndex(q => q[0] === key), all = qaAll(d), rows = [];
    SYS.forEach(sys => { const x = all[sys][key]; if (x && x.tags && x.tags.length && "◎○".indexOf(QA_RATE[sys][qi]) >= 0) rows.push({ sys, tags: x.tags.filter(t => T[t]) }); });
    const s = topicSummary(rows, T, cfg.opp || {});
    if (!s.top) return null;
    const t = T[s.top];
    // 文の作り方は知りたいこと別の画面と同じ（fmt がある分類は、それで文を閉じる）
    return { key, title: cfg.title, cat: cfg.cat, label: t.label, text: cfg.fmt ? cfg.fmt(t) : (t.say || "") + (t.adv || ""),
      n: s.cnt[s.top].length, total: s.total, sys: s.cnt[s.top].map(x => SHORT[x] || x) };
  }
  // 総合鑑定の最初の画面に置く「知りたいことから見る」。各テーマの結論を1行ずつ、押すとその分類へ
  function topicIndexHtml(d) {
    const all = qaAll(d), lines = [];
    Object.keys(TOPIC_CFG).forEach(key => {
      const cfg = TOPIC_CFG[key], T = cfg.tags, qi = QA.findIndex(q => q[0] === key), rows = [];
      SYS.forEach(sys => { const x = all[sys][key]; if (x && x.tags && x.tags.length && "◎○".indexOf(QA_RATE[sys][qi]) >= 0) rows.push({ sys, tags: x.tags.filter(t => T[t]) }); });
      const s = topicSummary(rows, T, cfg.opp || {});
      if (!s.top) return;
      const tie = s.second && s.cnt[s.second].length === s.cnt[s.top].length;
      lines.push('<button type="button" class="rs-ti" onclick="setConsultCategory(\'' + cfg.cat + '\')"><span class="rs-ti-k">' + cfg.title + '</span><span class="rs-ti-v">「' + T[s.top].label + "」" + (tie ? "と「" + T[s.second].label + "」" : "") +
        '</span><span class="rs-ti-n">' + s.cnt[s.top].length + "/" + s.total + "つの占術 ›</span></button>");
    });
    if (!lines.length) return "";
    return '<section class="rs-sec rs-ti-sec"><h3>知りたいことから見る</h3><p class="rs-lead">9つの占術を、知りたいことごとにまとめた結論。押すと、根拠と詳しい内容が開く。</p><div class="rs-ti-grid">' + lines.join("") + "</div></section>";
  }

  // ===== 総合のAI相談文に、画面の読みを入れる（2026-10-19 井内さん「１２」）=====
  //   これまで相談文に入る各占術の文は46〜601字で、画面の読みはAIに届いていなかった。
  //   ①知りたいこと別のまとめ（何個の占術がそろったか）②各占術の画面の読み（節を選んで抜粋）③知りたいことへの答え8つ、を足す
  const DIGEST_SEC = { // AIへ渡す節（見出しに含まれる語）。数値の表・用語の説明・早見表は入れない（数値は相談文の上の段にある）
    "西洋占星術": ["3つの核", "10天体"], "四柱推命": ["日主", "守護神法", "位相法"], "紫微斗数": ["命宮 ／", "主要宮の配置"],
    "算命学": ["人体星図", "天中殺"], "数秘術": ["ライフパス", "バースデー", "ピナクル", "仕事", "人間関係", "注意"],
    "九星気学": ["本命星と月命星", "傾斜宮", "人間関係", "今年の運勢", "今後の流れ", "注意"],
    "マヤ暦": ["太陽の紋章", "銀河の音", "ウェイブスペル", "仕事", "人間関係", "注意"],
    "宿曜": ["あなたの宿", "仕事", "人間関係", "注意"], "インド占星術": ["月の星座", "仕事", "人間関係", "注意", "ダシャー"] };
  const SKIP_NODE = ["note", "rs-consult", "rs-tabfolds", "rs-bridge", "rs-qa"];
  // 文の切れ目で n 字までにする
  const cut = (s, n) => { s = s.replace(/[ \t]*\t[ \t]*/g, "：").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim(); if (s.length <= n) return s; const k = s.lastIndexOf("。", n); return (k > n * 0.5 ? s.slice(0, k + 1) : s.slice(0, n) + "…"); };
  const textOf = h => { const t = document.createElement("div"); t.innerHTML = h; return t.textContent; };
  function tabDigest(i, sys) {
    const el = document.getElementById("tab" + i);
    if (!el) return [];
    const hidden = el.classList.contains("hide");
    if (hidden) el.classList.remove("hide");
    const out = [], want = DIGEST_SEC[sys] || [];
    let cur = null;
    const flush = () => { if (cur && cur.parts && cur.parts.length) out.push("◇ " + cur.title + "：" + cut(cur.parts.join(" "), 300)); };
    try { Array.from(el.children).forEach(k => {
      if (k.classList.contains("section-title")) {
        flush();
        const t = k.textContent.trim();
        cur = want.some(w => t.indexOf(w) >= 0) ? { title: t, parts: [] } : { title: t, parts: null };
        return;
      }
      if (k.tagName === "DETAILS" || SKIP_NODE.some(c => k.classList.contains(c))) return;
      // 最初の見出しの前は「ひとことで言うと」の札だけ
      if (!cur) { if (k.classList.contains("hi") && /ひとこと/.test(k.textContent)) out.push("◇ ひとことで言うと：" + cut(k.innerText.replace(/^.*ひとことで言うと\s*/, ""), 240)); return; }
      // 見出しのすぐ下の、クラスの無い1行は占術の説明（「〇〇は、生まれた〜から見ます」）なので入れない
      const firstPlain = !cur.seen && !k.className;
      cur.seen = true;
      if (cur.parts && !firstPlain && !k.classList.contains("maya-tone-grid")) cur.parts.push(k.innerText);
    });
    flush(); } finally { if (hidden) el.classList.add("hide"); }
    return out;
  }
  function qaPlain(d, sys) {
    const a = qaFor(d, sys), rate = QA_RATE[sys];
    return QA.map(([key, label], qi) => {
      const x = a[key] || {}, m = rate[qi];
      // 札（「」）で答えている行は、材料と札まで（札の説明文は共通の文なので、AIに任せる）。札の無い行（性格・人生の流れ）は文を残す
      const t = x.text ? textOf(x.text) : "", lab = t.match(/^(.*?→\s*(?:「[^」]+」)+)/);
      const body = x.text ? (lab ? lab[1] : cut(t, 150)) : x.time ? "生まれた時刻が無いので出していない" : "この占術では見ない";
      return "  " + m + label + "：" + body;
    });
  }
  function topicPlain(d) {
    const all = qaAll(d), lines = [];
    Object.keys(TOPIC_CFG).forEach(key => {
      const cfg = TOPIC_CFG[key], T = cfg.tags, qi = QA.findIndex(q => q[0] === key), rows = [];
      SYS.forEach(sys => { const x = all[sys][key]; if (x && x.tags && x.tags.length && "◎○".indexOf(QA_RATE[sys][qi]) >= 0) rows.push({ sys, tags: x.tags.filter(t => T[t]) }); });
      const s = topicSummary(rows, T, cfg.opp || {});
      if (!s.top) return;
      const one = t => "「" + T[t].label + "」" + s.cnt[t].length + "つ（" + s.cnt[t].join("・") + "）";
      lines.push("◆ " + cfg.title + "（" + cfg.who + "占術" + s.total + "つで数える）：" + one(s.top) + (s.second ? "、次に" + one(s.second) : "") +
        (s.opp ? "、反対の「" + T[s.opp].label + "」も" + s.cnt[s.opp].length + "つ" : "") + (s.cnt[s.top].length <= 2 ? "　※そろった数が少なく、見立てが分かれている" : ""));
    });
    return lines;
  }
  // 相性モードの相談文に足す分（2026-10-19 井内さん「相性モードも直そう」）。
  //   相性総合の画面（tab10）と各タブの相性の読み、2人それぞれの知りたいこと別のまとめ
  function panelRead(i, stopTitle, cap) {
    const el = document.getElementById("tab" + i);
    if (!el) return [];
    const hidden = el.classList.contains("hide");
    if (hidden) el.classList.remove("hide");
    const closed = Array.from(el.querySelectorAll("details:not([open])")).filter(x => !x.closest(".rs-consult, .rs-bridge"));
    closed.forEach(x => { x.open = true; });
    const out = [];
    try {
      let title = "", stop = false;
      Array.from(el.children).some(k => {
        if (k.classList.contains("section-title")) { title = k.textContent.trim(); if (stopTitle && title.indexOf(stopTitle) >= 0) stop = true; return stop; }
        if (SKIP_NODE.some(c => k.classList.contains(c))) return false;
        // 占術の説明（「〇〇とは？」）と、数値だけの比較表は入れない（数値は相談文の上の段にある）
        if (k.tagName === "DETAILS" && /とは？/.test(k.textContent.slice(0, 40))) return false;
        const t = k.innerText.trim();
        if (!t || /^相性\s*相性比較/.test(t)) return false;
        out.push("◇ " + (title ? title + "：" : "") + cut(t, cap));
        return false;
      });
    } finally {
      closed.forEach(x => { x.open = false; });
      if (hidden) el.classList.add("hide");
    }
    return out;
  }
  // 各占術の読みをどこまで渡すか。false＝節を選んで抜粋（総合で約1.9万字）／true＝9タブの画面の文を丸ごと（約5.5万字）
  // 2026-10-23 井内さん「AI鑑定用に、総合だけじゃなく、全部の結果を１つにまとめてくれたら良くない？」
  let digestFull = false;
  const setDigestFull = v => { digestFull = !!v; };
  const isDigestFull = () => digestFull;
  const CAP_FULL = 100000; // 全部モードでは切らない
  function compatDigest(d, db) {
    if (typeof document === "undefined") return "";
    const bar = "━━━━━━━━━━━━━━━━━━━━";
    // 相性モードでは量を選ばせていない（画面の文が少なく、丸ごとでも約500字しか増えない）。
    // ただし自分モードで「全部」を選んだまま相性に切り替えた場合に備えて、切らない側でも通るようにしておく
    const full = digestFull;
    const L = [bar, "【相性の画面の読み】（羅占盤の画面" + (full ? "に出している文を丸ごと" : "の文から抜粋") + "）", bar, "", "■ 相性総合（総合鑑定タブ）"];
    try { L.push(...panelRead(10, "AIで深く読む", full ? CAP_FULL : 600)); } catch (e) { }
    SYS.forEach((sys, i) => {
      L.push("", "■ " + sys + "で見た2人");
      try { L.push(...panelRead(i, "", full ? CAP_FULL : 300)); } catch (e) { }
    });
    L.push("", bar, "【2人それぞれの知りたいこと別のまとめ】", bar,
      "各占術の材料を傾向の札に振り分け、同じ札を出した占術の数で数えたもの。数えるのは、そのテーマを得意（◎）か見られる（○）占術だけ。");
    [["あなた", d], ["お相手", db]].forEach(([who, p]) => {
      L.push("", "■ " + who);
      try { L.push(...topicPlain(p)); } catch (e) { L.push("（まとめを出せませんでした）"); }
      // 2人の物語・これからを書けるよう、人生の流れを得意（◎）とする占術の「今の時期」も添える
      try {
        const qi = QA.findIndex(q => q[0] === "life"), all = qaAll(p);
        SYS.filter(s => QA_RATE[s][qi] === "◎").forEach(s => { const x = all[s].life; if (x && x.text) L.push("◆ 人生の流れ（" + s + "）：" + cut(textOf(x.text), 150)); });
      } catch (e) { }
    });
    return L.join("\n");
  }
  function exportDigest(d) {
    if (typeof document === "undefined") return "";
    const bar = "━━━━━━━━━━━━━━━━━━━━";
    const L = [bar, "【11】知りたいこと別のまとめ（羅占盤の総合鑑定より）", bar,
      "各占術の材料を傾向の札に振り分け、同じ札を出した占術の数で数えたもの。数えるのは、そのテーマを得意（◎）か見られる（○）占術だけ。", ""];
    try { L.push(...topicPlain(d)); } catch (e) { L.push("（まとめを出せませんでした）"); }
    const full = digestFull;
    L.push("", bar, "【12】各占術の読み（羅占盤の画面" + (full ? "に出している文を丸ごと" : "の文から抜粋") + "）", bar,
      full ? "羅占盤が9つのタブに出している読みの全文です。各占術の先頭には「総合鑑定の中でのこの占術」（9つをまとめた結果とこの占術の判定の違い）と「知りたいことに、この占術で答えると」（8つの知りたいことへの答え・印は ◎得意 ○見られる △参考 ×見ない）が入っています。"
        : "上の数値をもとに、羅占盤が各タブに出している読み。「知りたいことへの答え」の印は ◎得意 ○見られる △参考 ×見ない。",
      "各占術の「読む順」は、その占術で根拠を拾う本来の順番。占術ごとに、この順で数値を見て読む。");
    SYS.forEach((sys, i) => {
      L.push("", "■ " + sys);
      if (READ_ORDER[sys]) L.push("◇ 読む順：" + READ_ORDER[sys]);
      if (full) { try { L.push(tabText(i)); } catch (e) { } return; }
      try { L.push(...tabDigest(i, sys)); } catch (e) { }
      try { L.push("◇ 知りたいことへの答え", ...qaPlain(d, sys)); } catch (e) { }
    });
    // 全部モードでは、総合鑑定の画面に出している文も丸ごと渡す（4軸の一致の内訳・強み・今日・今の時期・知りたいこと別のまとめの本文）
    if (full) {
      L.push("", bar, "【13】総合鑑定の画面に出している文（羅占盤が9つを合わせて書いた読み）", bar,
        "羅占盤自身の総合鑑定です。【11】を文にしたものと、16タイプ判定の内訳が入っています。この読みに引きずられず、計算値から読み直してください。食い違う点は指摘してください。");
      try { L.push(tabText(10)); } catch (e) { }
    }
    return L.join("\n");
  }

  // ===== 知りたいことに、この占術で答えると（各タブ・2026-10-19 井内さん「九つの占いごとに書いて欲しい。かけないのもあるかも」）=====
  //   8つの知りたいことを同じ並びで出す。得意（◎）・見られる（○）・参考（△）・見ない（×）を付け、見ないものは得意な占術を案内する。
  //   🕐＝生まれた時刻が要る（時刻が無ければ「時刻を入れると出ます」）
  const QA = [["self", "性格・傾向"], ["like", "好き嫌い・大事なこと"], ["life", "人生の流れ"], ["decide", "迷ったとき"], ["money", "お金"], ["work", "仕事"], ["love", "人間関係・恋愛"], ["health", "健康"]];
  const QA_RATE = { // self like life decide money work love health
    "西洋占星術": "◎○△△○○◎○", "四柱推命": "◎△◎○◎◎○○", "紫微斗数": "◎○◎△◎◎◎○", "算命学": "◎○◎○○○○△", "数秘術": "◎○○△△○○×",
    "九星気学": "○△◎◎○○○○", "マヤ暦": "○○○○×△○×", "宿曜": "○△△○△△◎×", "インド占星術": "○△◎△○○○○" };
  const QA_TIME = { "西洋占星術": ["money"], "紫微斗数": ["self", "like", "life", "decide", "money", "work", "love", "health"], "インド占星術": ["money"] };
  const QA_MARK = { "◎": "得意", "○": "見られる", "△": "参考", "×": "見ない" };
  const VAL_TAGS = {
    freedom: { label: "自由", say: "自分で決め、自分のペースで動けることを何より大事にします。", dislike: "細かく管理されること、決まりで縛られること" },
    stability: { label: "安心と安定", say: "変わらない日常と、信頼できる居場所があることを大事にします。", dislike: "急な予定変更、先の見えない状態" },
    bond: { label: "人とのつながり", say: "大切な人と気持ちが通い合っていることを大事にします。", dislike: "放っておかれること、冷たい言い方" },
    achieve: { label: "達成と成果", say: "目標を立て、やり遂げて形にすることを大事にします。", dislike: "だらだらした進め方、結果の出ない話し合い" },
    joy: { label: "美しさと楽しさ", say: "心が動くこと、美しいもの、楽しい時間を大事にします。", dislike: "楽しさのない作業、殺風景な場所" },
    truth: { label: "知ることと本当のこと", say: "物事の仕組みや本当の理由を知ることを大事にします。", dislike: "根拠のない話、ごまかし" },
    help: { label: "人の役に立つこと", say: "誰かの助けになれている実感を大事にします。", dislike: "自分だけ得をすること、人を見捨てること" },
    respect: { label: "認められること", say: "自分の力や努力が、人に認められることを大事にします。", dislike: "軽く扱われること、手柄を取られること" },
  };
  const MONEY_TAGS = {
    earn: { label: "働いてこつこつ稼ぐ", say: "決まった収入を、続けることで少しずつ大きくしていく流れです。給料や安定した取引が土台になります。",
      adv: "増やすなら、収入の一部を毎月決まった日に先に残します。昇給や資格で土台を上げるのが近道です。" },
    deal: { label: "動いて大きく稼ぐ", say: "チャンスに動き、商売や取引で大きくつかむ流れです。入るときは大きく、波もあります。",
      adv: "入った月に使い切らず、半年分の生活費を別にしておきます。大きく動く前に、失ってもよい額を決めておきます。" },
    save: { label: "守って貯める", say: "使う前に残し、少しずつ積み立てるのが得意です。大きく増やすより、減らさない力が強みです。",
      adv: "貯める力はあるので、増やすほうへ少しずつ回します。使う楽しみも予算に入れると長続きします。" },
    spend: { label: "使って巡らせる", say: "楽しみや人のために使い、使ったぶんが縁や運になって返ってくる流れです。出ていくのも速いほうです。",
      adv: "使い道の上限を月ごとに決め、残りは自動で積み立てます。人のために使うお金は、気持ちよく出せる額にとどめます。" },
    skill: { label: "知識や技をお金に変える", say: "知っていること、できることがお金になります。学びにかけたお金が、後で収入になって返ってきます。",
      adv: "学びや道具にかけるお金は投資と考えてよい流れです。身につけたことを、早めに小さく売ってみます。" },
    people: { label: "人の縁でお金が回る", say: "人とのつながりから仕事やお金の話が入ってきます。紹介や付き合いを大事にするほど豊かになります。",
      adv: "紹介をくれた人へのお礼を欠かさないこと。人と一緒にお金を扱うときは、取り決めを最初に書いておきます。" },
  };
  const REL_TAGS = {
    wide: { label: "広く誰とでも", say: "誰とでも打ち解け、輪を広げていくのが得意です。人に会うほど元気になります。" },
    deep: { label: "少数と深く", say: "信頼できる少数の人と、長く深く付き合います。心を開くまで時間はかかりますが、一度つながった縁は切れません。" },
    give: { label: "尽くして支える", say: "相手のために動き、世話を焼くことで愛情を示します。頼られるほど力が出ます。" },
    lead: { label: "自分から引っ張る", say: "自分から誘い、関係をリードします。迷っている相手の背中を押すのが得意です。" },
    free: { label: "自由と距離を大事に", say: "べったりした関係より、お互いの時間と自由を尊重する関係が合います。" },
    harmony: { label: "和を保って合わせる", say: "争いを避け、相手や場に合わせるのが上手です。周りを穏やかにします。" },
    passion: { label: "情熱的にまっすぐ", say: "好きな人にはまっすぐ気持ちを向け、思ったことをはっきり伝えます。熱いぶん、ぶつかることもあります。" },
  };
  const HEALTH_TAGS = {
    digest: { label: "胃腸", say: "気持ちの疲れが胃腸に出やすいほうです。食事の時間をそろえ、忙しい日ほど温かいものをゆっくり食べるのが目安です。" },
    circ: { label: "冷えと巡り", say: "体が冷えたり、巡りが滞ったりしやすいほうです。首・お腹・足首を冷やさず、軽く体を動かす習慣が目安です。" },
    head: { label: "頭・目・のぼせ", say: "頑張ると頭や目に熱がこもりやすいほうです。画面から離れる時間と、早めに休む日を決めておくのが目安です。" },
    breath: { label: "のど・呼吸・肌", say: "季節の変わり目に、のどや呼吸、肌に出やすいほうです。乾燥を避け、深い呼吸を意識するのが目安です。" },
    bones: { label: "肩・腰・関節", say: "体がこわばりやすく、肩・腰・膝に疲れがたまりやすいほうです。同じ姿勢を続けず、伸ばす時間をとるのが目安です。" },
    nerves: { label: "神経・眠り", say: "考えごとが続くと眠りが浅くなりやすいほうです。寝る前の画面を減らし、眠る時刻をそろえるのが目安です。" },
  };
  const DEC_TAGS = {
    gut: { label: "直感で決める", say: "考えすぎるより、最初に感じたほうを選ぶとうまくいきます。", adv: "具体的には、三秒で答えるつもりで「どちらに惹かれるか」を自分に聞きます。" },
    think: { label: "調べて考えてから決める", say: "情報を集め、比べてから決めると納得できます。", adv: "具体的には、良い点と悪い点を紙に書き出し、一晩おいてから決めます。" },
    talk: { label: "人に話して決める", say: "信頼できる人に話すうちに、自分の答えが見えてきます。", adv: "具体的には、答えをもらうためでなく、話して整理するために人に会います。" },
    act: { label: "まず動いてから直す", say: "小さく試して、やりながら直すほうが向いています。", adv: "具体的には、取り返しのつく形で、一週間だけ試してみます。" },
    wait: { label: "時を待つ", say: "急いで決めず、流れが変わるのを待つほうが結果がよくなります。", adv: "具体的には、決める日を先に決め、その日までは動きません。" },
  };
  // 星座（12）→ 札。インドのラーシも同じ番号で引く
  const SIGN12 = ["牡羊座", "牡牛座", "双子座", "蟹座", "獅子座", "乙女座", "天秤座", "蠍座", "射手座", "山羊座", "水瓶座", "魚座"];
  const BY_SIGN = {
    like: [["freedom", "achieve"], ["stability", "joy"], ["truth", "freedom"], ["bond", "stability"], ["respect", "joy"], ["help", "truth"], ["joy", "bond"], ["truth", "bond"], ["freedom", "truth"], ["achieve", "respect"], ["freedom", "truth"], ["help", "joy"]],
    money: [["deal"], ["save", "earn"], ["skill", "people"], ["save"], ["spend", "deal"], ["earn", "save"], ["people", "spend"], ["deal", "save"], ["spend", "skill"], ["earn", "save"], ["skill", "people"], ["spend", "people"]],
    love: [["lead", "passion"], ["deep", "give"], ["wide"], ["give", "deep"], ["passion", "lead"], ["give"], ["harmony", "wide"], ["deep", "passion"], ["free", "wide"], ["deep"], ["free", "wide"], ["give", "harmony"]],
    health: [["head"], ["breath"], ["nerves", "breath"], ["digest"], ["circ"], ["digest", "nerves"], ["bones", "circ"], ["circ"], ["bones"], ["bones"], ["circ"], ["circ", "nerves"]],
    decide: [["act", "gut"], ["think", "wait"], ["talk", "think"], ["gut", "wait"], ["act", "gut"], ["think", "wait"], ["talk", "think"], ["gut", "wait"], ["act", "gut"], ["think", "wait"], ["talk", "think"], ["gut", "wait"]],
  };
  const BY_STEM = { // 日主（甲〜癸）
    like: { "甲": ["achieve", "respect"], "乙": ["bond", "stability"], "丙": ["joy", "respect"], "丁": ["truth", "help"], "戊": ["stability", "help"], "己": ["help", "stability"], "庚": ["achieve", "freedom"], "辛": ["joy", "respect"], "壬": ["freedom", "truth"], "癸": ["truth", "bond"] },
    love: { "甲": ["lead"], "乙": ["harmony"], "丙": ["wide", "passion"], "丁": ["deep", "give"], "戊": ["give", "deep"], "己": ["give", "harmony"], "庚": ["passion", "lead"], "辛": ["deep", "free"], "壬": ["free", "wide"], "癸": ["harmony", "deep"] },
    decide: { "甲": ["act"], "乙": ["talk"], "丙": ["gut", "act"], "丁": ["think"], "戊": ["wait"], "己": ["talk", "think"], "庚": ["act"], "辛": ["think"], "壬": ["gut"], "癸": ["wait", "gut"] },
  };
  const BY_CENTER = { // 算命学の中心星
    like: { "貫索星": ["freedom"], "石門星": ["bond"], "鳳閣星": ["joy"], "調舒星": ["joy", "truth"], "禄存星": ["help", "respect"], "司禄星": ["stability"], "車騎星": ["achieve"], "牽牛星": ["respect"], "龍高星": ["freedom", "truth"], "玉堂星": ["truth"] },
    money: { "貫索星": ["earn"], "石門星": ["people"], "鳳閣星": ["spend"], "調舒星": ["skill"], "禄存星": ["people", "spend"], "司禄星": ["save"], "車騎星": ["deal"], "牽牛星": ["earn"], "龍高星": ["skill", "deal"], "玉堂星": ["skill", "save"] },
    love: { "貫索星": ["free", "deep"], "石門星": ["wide", "harmony"], "鳳閣星": ["wide"], "調舒星": ["deep"], "禄存星": ["give", "wide"], "司禄星": ["give", "deep"], "車騎星": ["passion"], "牽牛星": ["lead", "deep"], "龍高星": ["free"], "玉堂星": ["deep", "harmony"] },
    decide: { "貫索星": ["gut"], "石門星": ["talk"], "鳳閣星": ["gut"], "調舒星": ["gut", "think"], "禄存星": ["talk"], "司禄星": ["wait"], "車騎星": ["act"], "牽牛星": ["think"], "龍高星": ["gut"], "玉堂星": ["think"] },
  };
  const BY_LP = {
    like: { 1: ["freedom", "achieve"], 2: ["bond"], 3: ["joy"], 4: ["stability"], 5: ["freedom"], 6: ["help", "bond"], 7: ["truth"], 8: ["achieve", "respect"], 9: ["help"], 11: ["truth", "help"], 22: ["achieve"], 33: ["help"] },
    money: { 1: ["deal"], 2: ["people", "save"], 3: ["spend"], 4: ["save", "earn"], 5: ["deal", "spend"], 6: ["save", "people"], 7: ["skill"], 8: ["deal"], 9: ["spend", "people"], 11: ["skill"], 22: ["deal", "earn"], 33: ["people", "spend"] },
    love: { 1: ["lead", "free"], 2: ["harmony", "give"], 3: ["wide"], 4: ["deep"], 5: ["free", "wide"], 6: ["give"], 7: ["deep"], 8: ["lead"], 9: ["wide", "give"], 11: ["deep"], 22: ["lead"], 33: ["give"] },
    decide: { 1: ["act"], 2: ["talk"], 3: ["gut"], 4: ["think"], 5: ["act"], 6: ["talk"], 7: ["think"], 8: ["act"], 9: ["wait", "gut"], 11: ["gut"], 22: ["think"], 33: ["talk"] },
  };
  const BY_KY = { // 本命星 1〜9
    like: { 1: ["truth", "bond"], 2: ["help", "stability"], 3: ["achieve", "freedom"], 4: ["bond", "freedom"], 5: ["respect", "achieve"], 6: ["respect", "achieve"], 7: ["joy", "bond"], 8: ["stability"], 9: ["joy", "respect"] },
    money: { 1: ["skill"], 2: ["save", "earn"], 3: ["deal"], 4: ["people"], 5: ["deal"], 6: ["earn"], 7: ["spend", "people"], 8: ["save"], 9: ["skill", "spend"] },
    love: { 1: ["harmony", "deep"], 2: ["give"], 3: ["passion", "wide"], 4: ["wide", "harmony"], 5: ["lead"], 6: ["lead", "deep"], 7: ["wide"], 8: ["deep"], 9: ["passion"] },
    health: { 1: ["circ"], 2: ["digest"], 3: ["nerves", "breath"], 4: ["breath", "digest"], 5: ["digest"], 6: ["head", "bones"], 7: ["breath"], 8: ["bones"], 9: ["head"] },
    decide: { 1: ["wait", "think"], 2: ["talk", "wait"], 3: ["act"], 4: ["talk"], 5: ["act"], 6: ["think"], 7: ["talk"], 8: ["wait"], 9: ["gut"] },
  };
  const BY_SEAL = { // 太陽の紋章 0〜19
    like: [["help"], ["bond", "truth"], ["joy", "stability"], ["truth"], ["joy"], ["freedom", "bond"], ["help", "achieve"], ["joy"], ["help"], ["bond"], ["joy", "freedom"], ["freedom"], ["freedom", "help"], ["bond"], ["truth", "achieve"], ["achieve", "truth"], ["bond"], ["truth"], ["freedom", "achieve"], ["help", "respect"]],
    love: [["give"], ["wide"], ["deep"], ["deep"], ["passion"], ["harmony", "wide"], ["give"], ["harmony"], ["passion"], ["give", "deep"], ["wide"], ["free"], ["wide", "give"], ["harmony"], ["free"], ["passion"], ["harmony", "wide"], ["deep"], ["passion", "lead"], ["lead", "give"]],
  };
  const TONE_DEC = [null, ["act"], ["think"], ["talk"], ["think"], ["act"], ["wait"], ["gut"], ["talk"], ["act"], ["think"], ["gut"], ["talk"], ["wait"]];
  const BY_SHUKU = {
    like: { "昴宿": ["joy", "respect"], "畢宿": ["stability"], "觜宿": ["truth"], "参宿": ["achieve", "freedom"], "井宿": ["truth", "achieve"], "鬼宿": ["joy", "help"], "柳宿": ["bond", "joy"], "星宿": ["respect"], "張宿": ["joy", "bond"], "翼宿": ["freedom"], "軫宿": ["bond", "stability"], "角宿": ["joy", "bond"], "亢宿": ["truth", "freedom"], "氐宿": ["stability", "bond"], "房宿": ["respect", "stability"], "心宿": ["bond", "truth"], "尾宿": ["achieve"], "箕宿": ["freedom"], "斗宿": ["truth", "achieve"], "女宿": ["achieve", "help"], "虚宿": ["truth"], "危宿": ["freedom", "joy"], "室宿": ["achieve", "freedom"], "壁宿": ["help", "joy"], "奎宿": ["truth", "stability"], "婁宿": ["help", "bond"], "胃宿": ["achieve", "respect"] },
    money: { "昴宿": ["skill"], "畢宿": ["save"], "觜宿": ["deal"], "参宿": ["deal"], "井宿": ["skill"], "鬼宿": ["spend"], "柳宿": ["earn"], "星宿": ["deal"], "張宿": ["spend"], "翼宿": ["earn"], "軫宿": ["people"], "角宿": ["spend"], "亢宿": ["earn"], "氐宿": ["save"], "房宿": ["people", "deal"], "心宿": ["people"], "尾宿": ["earn"], "箕宿": ["deal", "spend"], "斗宿": ["skill"], "女宿": ["save", "earn"], "虚宿": ["skill"], "危宿": ["spend"], "室宿": ["deal"], "壁宿": ["save"], "奎宿": ["save"], "婁宿": ["people"], "胃宿": ["deal"] },
    love: { "昴宿": ["deep"], "畢宿": ["deep"], "觜宿": ["wide"], "参宿": ["passion", "lead"], "井宿": ["free"], "鬼宿": ["give"], "柳宿": ["passion", "give"], "星宿": ["lead"], "張宿": ["wide"], "翼宿": ["free", "deep"], "軫宿": ["harmony"], "角宿": ["wide"], "亢宿": ["deep"], "氐宿": ["harmony", "give"], "房宿": ["wide"], "心宿": ["harmony", "deep"], "尾宿": ["deep"], "箕宿": ["free"], "斗宿": ["lead"], "女宿": ["give"], "虚宿": ["deep"], "危宿": ["wide"], "室宿": ["lead", "give"], "壁宿": ["give", "harmony"], "奎宿": ["harmony"], "婁宿": ["give"], "胃宿": ["lead", "passion"] },
    decide: { "昴宿": ["think"], "畢宿": ["wait"], "觜宿": ["think"], "参宿": ["act"], "井宿": ["think"], "鬼宿": ["gut"], "柳宿": ["gut"], "星宿": ["act"], "張宿": ["talk"], "翼宿": ["act"], "軫宿": ["wait", "talk"], "角宿": ["talk"], "亢宿": ["think"], "氐宿": ["wait"], "房宿": ["talk"], "心宿": ["gut"], "尾宿": ["wait"], "箕宿": ["act"], "斗宿": ["think"], "女宿": ["think"], "虚宿": ["think"], "危宿": ["gut"], "室宿": ["act"], "壁宿": ["talk"], "奎宿": ["think"], "婁宿": ["talk"], "胃宿": ["act"] },
  };
  const ZW_BY = { // 紫微の主星 → 札（宮ごとに使う）
    like: { "紫微": ["respect"], "天府": ["stability"], "太陽": ["help"], "太陰": ["joy", "stability"], "武曲": ["achieve"], "廉貞": ["achieve", "joy"], "天機": ["truth"], "天同": ["joy"], "貪狼": ["joy"], "巨門": ["truth"], "天相": ["bond"], "天梁": ["help"], "七殺": ["freedom", "achieve"], "破軍": ["freedom"] },
    money: { "紫微": ["deal"], "天府": ["save"], "太陽": ["people", "spend"], "太陰": ["save"], "武曲": ["earn", "deal"], "廉貞": ["deal"], "天機": ["skill"], "天同": ["spend"], "貪狼": ["deal", "spend"], "巨門": ["skill"], "天相": ["people", "save"], "天梁": ["people"], "七殺": ["deal"], "破軍": ["spend", "deal"] },
    love: { "紫微": ["lead"], "天府": ["give", "deep"], "太陽": ["wide", "give"], "太陰": ["deep", "give"], "武曲": ["free"], "廉貞": ["passion"], "天機": ["free", "wide"], "天同": ["harmony"], "貪狼": ["wide", "passion"], "巨門": ["deep"], "天相": ["harmony"], "天梁": ["give"], "七殺": ["passion", "lead"], "破軍": ["passion", "free"] },
    health: { "紫微": ["digest"], "天府": ["digest"], "太陽": ["head"], "太陰": ["circ"], "武曲": ["breath"], "廉貞": ["circ"], "天機": ["nerves"], "天同": ["digest"], "貪狼": ["circ"], "巨門": ["digest"], "天相": ["breath"], "天梁": ["digest"], "七殺": ["bones"], "破軍": ["bones"] },
    decide: { "紫微": ["act"], "天府": ["wait"], "太陽": ["act"], "太陰": ["wait"], "武曲": ["act"], "廉貞": ["act"], "天機": ["think"], "天同": ["wait"], "貪狼": ["gut"], "巨門": ["think"], "天相": ["talk"], "天梁": ["wait"], "七殺": ["act"], "破軍": ["act"] },
  };
  const EL_HEALTH = { "木": ["head", "bones"], "火": ["circ", "head"], "土": ["digest"], "金": ["breath"], "水": ["circ"] };
  const YEAR_PALACE = { 1: "坎宮＝低迷・忍耐の年。無理に動かず、学び直しと体づくりに向く", 2: "坤宮＝準備・基盤固めの年。地道な努力が数年後の実りを決める", 3: "震宮＝発展・スタートの年。新しく始めることに向く", 4: "巽宮＝整備・信用の年。人の紹介や遠方からの話が来やすい",
    5: "中宮＝9年に一度の節目の年。新しく始めるより、今あるものを整える", 6: "乾宮＝充実・完成の年。責任ある役が回ってくる", 7: "兌宮＝収穫・喜びの年。人との交流が増え、お金の巡りもよい", 8: "艮宮＝変化・転換の年。続けるかやめるかを決める場面がある", 9: "離宮＝注目・表舞台の年。努力が人に知られ、名前が出る" };
  // 総合鑑定の「9つの占術をまとめると」の設定（cat＝総合鑑定の分類）
  const TOPIC_CFG = {
    work: { title: "仕事", cat: "work", tags: WORK_TAGS, opp: WORK_OPP, who: "仕事を見られる", unit: "働き方", lead: "あなたの仕事の軸は",
      fmt: t => t.say + "で、いちばん力が出ます。", pair: "二つを合わせた働き方を選ぶと、持ち味がいちばん生きます。",
      oppText: (a, c) => "場面で顔が変わるタイプです。普段は「" + a + "」側で動き、「" + c + "」側の力は、任された場面や慣れた場所で出すと無理がありません。",
      extra: (d, s, T) => '<p class="rs-topic-ex"><span>向く場の例</span>' + T[s.top].ex + (s.second ? "／" + T[s.second].ex : "") + "</p>",
      timeNote: "紫微斗数は仕事の宮（官禄宮）が生まれた時刻で決まるので、時刻が分からないときは数えていません。" },
    money: { title: "お金", cat: "money", tags: MONEY_TAGS, opp: { save: "spend", spend: "save", earn: "deal", deal: "earn" }, who: "お金を見られる", unit: "流れ", lead: "あなたのお金の流れは",
      oppText: (a, c) => "お金に二つの面があります。普段は「" + a + "」で、ここぞというときに「" + c + "」の面が出ます。口座や財布を分けておくと、迷いが減ります。",
      extra: (d, s, T) => '<p class="rs-topic-ex"><span>増やし方の目安</span>' + T[s.top].adv + (s.second ? T[s.second].adv : "") + "</p>",
      timeNote: "西洋・紫微・インドのお金の部屋（2ハウス・財帛宮）は生まれた時刻で決まるので、時刻が分からないときは数えていません。" },
    love: { title: "人間関係・恋愛", cat: "relations", tags: REL_TAGS, opp: { wide: "deep", deep: "wide", give: "free", free: "give", lead: "harmony", harmony: "lead", passion: "harmony" },
      who: "人間関係を見られる", unit: "関わり方", lead: "あなたの人との関わり方の軸は",
      oppText: (a, c) => "相手や場面で顔が変わります。普段は「" + a + "」ですが、心を許した相手や慣れた場では「" + c + "」の面が出ます。",
      extra: () => '<p class="rs-small">特定の相手との相性は、サイドバーの「相性について」でお相手の生年月日を入れると、9つの占術で見られます。</p>',
      timeNote: "紫微斗数（夫妻宮）は生まれた時刻で決まるので、時刻が分からないときは数えていません。" },
    health: { title: "健康", cat: "health", tags: HEALTH_TAGS, opp: {}, who: "体の傾向を見られる", unit: "体の場所", lead: "体の気をつけどころは",
      extra: () => '<p class="rs-small">占いから見た体質の傾向で、生活の目安です。病気の診断ではありません。気になる症状があるときは、医療機関で相談してください。</p>',
      timeNote: "紫微斗数（疾厄宮）は生まれた時刻で決まるので、時刻が分からないときは数えていません。" },
    like: { title: "好き嫌い・大事なこと", cat: "values", tags: VAL_TAGS, opp: { freedom: "stability", stability: "freedom" }, who: "好き嫌いを見られる", unit: "大事なこと", lead: "あなたがいちばん大事にしているのは",
      oppText: (a, c) => "二つの気持ちを両方持っています。「" + a + "」を大事にしながら、「" + c + "」も手放したくない。どちらを優先するか迷ったら、長く続くほうを選ぶと後悔が少なくなります。",
      extra: (d, s, T) => '<p class="rs-topic-ex"><span>苦手になりやすいこと</span>' + T[s.top].dislike + (s.second && s.second !== s.opp ? "、" + T[s.second].dislike : "") + "。苦手な場面が続くと疲れやすいので、避けられるときは避けてよい。</p>",
      timeNote: "紫微斗数（福徳宮）は生まれた時刻で決まるので、時刻が分からないときは数えていません。" },
    decide: { title: "迷ったとき", cat: "decision", tags: DEC_TAGS, opp: { gut: "think", think: "gut", act: "wait", wait: "act" }, who: "決め方を見られる", unit: "決め方", lead: "迷ったときのあなたの決め方は",
      fmt: t => t.say + t.adv, oppText: (a, c) => "決め方に二つの面があります。小さなことは「" + a + "」、大きなことは「" + c + "」で決めると、迷いが減ります。",
      extra: d => {
        let tm = null; try { tm = buildSynthesis(d).timing; } catch (e) { }
        if (!tm) return "";
        const TIP = { "動く時期": "決めたことは、早めに動きに移すとよい時期です。", "待つ時期": "大きな決断は少し先にし、準備と情報集めに時間を使うとよい時期です。", "慎重に動く時期": "動くなら小さく、取り返しのつく形で動くとよい時期です。" };
        return '<p class="rs-topic-ex"><span>今の時期</span>「' + tm.verdict + "」。" + (TIP[tm.verdict] || "") + (tm.nowSpan ? "今はちょうど人生の変わり目なので、大きな選択ほど時間をかけてよい。" : tm.nextSpan ? "次の大きな変わり目は" + tm.nextSpan.start + "歳ごろ。" : "") +
          "日を選ぶなら、総合鑑定の「今日」（5つの占術の日ごとの運）を使います。</p>";
      },
      timeNote: "紫微斗数（命宮）は生まれた時刻で決まるので、時刻が分からないときは数えていません。" },
  };
  // 宮の名前は表記ゆれ（福徳宮／福德宮）があるので両方で探す
  const PAL_IDX = n => (typeof PALACE_NAMES !== "undefined" ? [n, n.replace("徳", "德"), n.replace("德", "徳")].map(x => PALACE_NAMES.indexOf(x)).find(i => i >= 0) ?? -1 : -1);
  // 紫微：宮の主星（無主星なら向かいの宮から借りる）
  function zwPalace(d, name) {
    const i = PAL_IDX(name);
    if (i < 0 || !d.ziweiDistrib) return null;
    const bi = (d.lifeIdx - i + 12) % 12, main = s => ZW_BY.money[s];
    let st = (d.ziweiDistrib[bi] || []).filter(main), borrow = false;
    if (!st.length) { st = (d.ziweiDistrib[(bi + 6) % 12] || []).filter(main); borrow = true; }
    return st.length ? { st, borrow, text: name + "に" + st.join("・") + (borrow ? "（向かいの宮から借りた星）" : "") } : null;
  }
  const tagsOf = (map, keys) => [...new Set(keys.flatMap(k => map[k] || []))];
  // 1つの占術の、8つの知りたいことへの答え。{ mark, text } か { mark, none } か { mark, time }
  function qaFor(d, sys) {
    const rate = QA_RATE[sys], out = {}, needT = QA_TIME[sys] || [], timeKnown = d.tm === "known";
    // 得意な占術（◎が無いテーマは○）
    const good = topic => { const qi = QA.findIndex(q => q[0] === topic), by = m => SYS.filter(s => QA_RATE[s][qi] === m).map(s => SHORT[s]);
      const g = by("◎"); return g.length ? "得意なのは" + g.join("・") + "です。" : "見られるのは" + by("○").join("・") + "です。"; };
    const two = s => String(s || "").split("。").filter(Boolean).slice(0, 2).join("。") + (s ? "。" : "");
    const sm = calcJintai(d), nu = calcNumerology(d.y, d.m, d.d), ky = calcKyusei(d.y, d.m, d), ma = calcMaya(d.y, d.m, d.d);
    const sh = SHUKUYO_27[calcShukuyo(d)].n, ay = ayanamsha(d.jd);
    const sunI = signOf(d.sunLon), moonI = signOf(d.moonLon), venus = d.planets.find(p => p.n === "金星"), mars = d.planets.find(p => p.n === "火星");
    const rSun = Math.floor(norm360(d.sunLon - ay) / 30), rMoon = Math.floor(norm360(d.moonLon - ay) / 30);
    const tens = (d.pillars || []).filter(p => !p.main).map(p => p.ten);
    const tagLine = (TAGS, tags, extra) => (tags = (tags || []).filter(t => TAGS[t])).length ? "「" + tags.map(t => TAGS[t].label).join("」「") + "」。" + TAGS[tags[0]].say + (TAGS[tags[0]].adv || "") + (extra || "") : "";
    // 文と一緒に、札（tags）と材料（what）も持つ＝総合鑑定のまとめで数える
    const set = (topic, what, TAGS, tags, extra) => { const t = tagLine(TAGS, tags, extra); if (t) out[topic] = { text: "<b>" + esc(what) + "</b> → " + t, tags: (tags || []).filter(x => TAGS[x]), what }; };
    const pick = (o, k) => (o && o[k]) || null;
    const rd = n => (typeof n !== "undefined" ? n : null);
    const SR = rd(typeof SHUKUYO_READ !== "undefined" ? SHUKUYO_READ : null), JR = rd(typeof JYOTISH_READ !== "undefined" ? JYOTISH_READ : null);
    const NM = rd(typeof NUMEROLOGY_MEANINGS !== "undefined" ? NUMEROLOGY_MEANINGS : null), JE = rd(typeof JUSSHU_EXPL !== "undefined" ? JUSSHU_EXPL : null);
    const workRow = (workReads(d).find(r => r.sys === sys)) || null;
    if (workRow) out.work = { text: "<b>" + esc(workRow.what) + "</b> → 「" + workRow.tags.map(t => WORK_TAGS[t].label).join("」「") + "」。" + WORK_TAGS[workRow.tags[0]].say + "で力が出ます。" + (workRow.note ? '<span class="rs-qa-note">' + esc(workRow.note) + "</span>" : ""),
      tags: workRow.tags, what: workRow.what, note: workRow.note };
    const tm = timing(d, nu), nowOf = s => tm.now.find(x => x.sys === s);
    // 九星の「今年」は立春で切り替える（旧版は西暦の年で、1月〜立春前は次の年の盤だった。2026-10-20 監査）
    const year = typeof kyuseiNowYear === "function" ? kyuseiNowYear() : new Date().getFullYear();
    if (sys === "西洋占星術") {
      out.self = { text: "<b>太陽が" + SIGN12[sunI] + "、月が" + SIGN12[moonI] + "</b> → " + esc(first(planetInSign("太陽", SIGN12[sunI]))) + "素の自分（月）は" + esc(first(moonCore(SIGN12[moonI]))) };
      if (venus) set("like", "金星が" + SIGN12[signOf(venus.lon)], VAL_TAGS, BY_SIGN.like[signOf(venus.lon)]);
      out.life = { none: "西洋占星術は、10年ごとの運のような区切りを持ちません（今の天体の動きで見るトランジットは、羅占盤ではまだ出していません）。" };
      if (mars) set("decide", "火星が" + SIGN12[signOf(mars.lon)], DEC_TAGS, BY_SIGN.decide[signOf(mars.lon)], "（火星は動き方と決め方を表す）");
      if (d.houses) set("money", "2ハウス（お金の部屋）が" + SIGN12[signOf(d.houses[1])], MONEY_TAGS, BY_SIGN.money[signOf(d.houses[1])]);
      set("love", "月が" + SIGN12[moonI] + (venus ? "、金星が" + SIGN12[signOf(venus.lon)] : ""), REL_TAGS, BY_SIGN.love[moonI], venus ? "恋愛では" + esc(first(planetInSign("金星", SIGN12[signOf(venus.lon)]))) : "");
      const SIGN_BODY = ["頭・顔", "のど・首", "腕・肺・神経", "胃・胸", "心臓・背中", "腸・お腹", "腰・腎臓", "生殖器・排泄", "腿・肝臓", "骨・膝・歯", "足首・血のめぐり", "足・免疫"];
      set("health", "太陽が" + SIGN12[sunI] + "（星座が受け持つ体の場所）", HEALTH_TAGS, BY_SIGN.health[sunI], "西洋占星術では、" + SIGN12[sunI] + "は" + SIGN_BODY[sunI] + "を受け持つとされる。");
    } else if (sys === "四柱推命") {
      out.self = { text: "<b>日主が" + d.day.stem + "</b> → " + esc(two(dayMasterTheme(d.day.stem))) };
      set("like", "日主が" + d.day.stem, VAL_TAGS, BY_STEM.like[d.day.stem]);
      const n0 = nowOf("四柱推命");
      if (n0) out.life = { text: "<b>今の大運</b> → " + esc(n0.why) + "。" + (tm.nextSpan && tm.nextSpan.sys.indexOf(sys) >= 0 ? "次の大きな変わり目は" + tm.nextSpan.start + "歳ごろ。" : "") };
      else if (tm.left && tm.left.indexOf("性別") >= 0) out.life = { none: "性別を選んでいないので、大運の向き（順行・逆行）が決まらず、今の大運からは読みません。性別を選ぶと出ます。" };
      set("decide", "日主が" + d.day.stem, DEC_TAGS, BY_STEM.decide[d.day.stem]);
      const mt = [];
      if (tens.includes("正財")) mt.push("earn", "save");
      if (tens.includes("偏財")) mt.push("deal", "people");
      if (!mt.length && (tens.includes("食神") || tens.includes("傷官"))) mt.push("skill");
      if (!mt.length && (tens.includes("比肩") || tens.includes("劫財"))) mt.push("spend");
      if (!mt.length && (tens.includes("正官") || tens.includes("偏官"))) mt.push("earn");   // 官星＝組織や役目を通して得る
      if (!mt.length && (tens.includes("正印") || tens.includes("偏印"))) mt.push("skill");  // 印星＝学びや資格を通して得る
      const zai = tens.filter(t => t === "正財" || t === "偏財");
      // 天干に無くても、蔵干（地支の中）にある財星は「無い」と言わない（2026-10-20 外部レビューの指摘）
      const hid = typeof ZOUKAN !== "undefined" && typeof tenGod === "function"
        ? [...new Set((d.pillars || []).flatMap(p => (ZOUKAN[p.branch] || []).map(s => tenGod(d.day.stem, s))).filter(t => t === "正財" || t === "偏財"))] : [];
      if (!zai.length && hid.length) { mt.length = 0; if (hid.includes("正財")) mt.push("earn", "save"); if (hid.includes("偏財")) mt.push("deal", "people"); }
      set("money", zai.length ? "天干に" + [...new Set(zai)].join("・") + "（お金の星）" : hid.length ? "財星は天干に無く、蔵干に" + hid.join("・") : "命式に財星（お金の星）が無い（天干・蔵干とも）", MONEY_TAGS, [...new Set(mt)],
        zai.length ? "" : hid.length ? "財星が蔵干にある人は、お金の力が表に出にくく、経験や年齢とともに形になる、と読む。" : "財星が無い人は、技や人とのつながりを通してお金を得る形になりやすい。");
      set("love", "日主が" + d.day.stem + "・日支が" + d.day.branch, REL_TAGS, BY_STEM.love[d.day.stem]);
      const wx = d.wx || {}, els = ["木", "火", "土", "金", "水"], mx = els.reduce((a, b) => wx[b] > wx[a] ? b : a), mn = els.reduce((a, b) => wx[b] < wx[a] ? b : a);
      const EL_BODY = { "木": "木は目・筋・肝", "火": "火は心臓・血のめぐり", "土": "土は胃腸", "金": "金は肺・のど・肌", "水": "水は腎・冷え" };
      set("health", "五行で" + mx + "が多く、" + mn + "が少ない", HEALTH_TAGS, [...new Set([...(EL_HEALTH[mx] || []), ...((wx[mn] || 0) <= 1 ? EL_HEALTH[mn] || [] : [])])],
        "四柱推命では五行が体の場所を受け持つ（" + EL_BODY[mx] + "、" + EL_BODY[mn] + "）。多すぎる五行も少なすぎる五行も、その場所に出やすいと見る。");
    } else if (sys === "紫微斗数") {
      if (timeKnown) {
        const life = zwPalace(d, "命宮"), zl = typeof ZW_LIFE !== "undefined" ? ZW_LIFE : {};
        if (life) out.self = { text: "<b>" + esc(life.text) + "</b> → " + esc(two(zl[life.st[0]])) };
        const fu = zwPalace(d, "福徳宮"); if (fu) set("like", fu.text, VAL_TAGS, tagsOf(ZW_BY.like, fu.st));
        try {
          const age = getCurrentAge(d.y, d.m, d.d), du = calcZiweiDayun(d, d.lifeIdx).find(x => age >= x.startAge && age < x.endAge);
          // 大限の向きは性別で決まる。性別を選んでいないときは出さない（2026-10-20 監査）
          if (tm.left && tm.left.indexOf("性別") >= 0) out.life = { none: "性別を選んでいないので、大限の向き（順行・逆行）が決まらず、今の大限からは読みません。性別を選ぶと出ます。" };
          else if (du) out.life = { text: "<b>今の大限（" + du.startAge + "〜" + (du.endAge - 1) + "歳）</b> → " + du.palaceName + "の10年。" + esc(first(typeof palaceExpl === "function" ? palaceExpl(du.palaceName) : "")) };
        } catch (e) { }
        const ml = zwPalace(d, "命宮"); if (ml) set("decide", ml.text, DEC_TAGS, tagsOf(ZW_BY.decide, ml.st));
        const zc = zwPalace(d, "財帛宮"); if (zc) set("money", zc.text, MONEY_TAGS, tagsOf(ZW_BY.money, zc.st));
        const fq = zwPalace(d, "夫妻宮"); if (fq) set("love", fq.text, REL_TAGS, tagsOf(ZW_BY.love, fq.st));
        const jy = zwPalace(d, "疾厄宮"); if (jy) set("health", jy.text, HEALTH_TAGS, tagsOf(ZW_BY.health, jy.st));
      }
    } else if (sys === "算命学") {
      const c = sm.stars.center;
      out.self = { text: "<b>中心星が" + c + "</b> → " + esc(two(JE && JE[c])) };
      set("like", "中心星が" + c, VAL_TAGS, BY_CENTER.like[c]);
      const yb = ((year - 4) % 12 + 12) % 12;
      let nextT = null; for (let k = 0; k < 12; k++) { const b = ((yb + k) % 12); if (b === sm.k1 || b === sm.k2) { nextT = year + k; break; } }
      out.life = { text: "<b>" + esc(sm.tenchuType.name) + "</b> → " + (nextT === year ? "今年は天中殺の年。新しく大きく始めるより、今あるものを整える年とされる。" : "次の天中殺は" + nextT + "年から2年間。その2年は、大きく始めるより整えることに向く。") };
      set("decide", "中心星が" + c, DEC_TAGS, BY_CENTER.decide[c]);
      set("money", "中心星が" + c, MONEY_TAGS, BY_CENTER.money[c]);
      set("love", "中心星が" + c, REL_TAGS, BY_CENTER.love[c]);
      out.health = { text: "<b>十二大従星のエネルギー</b> → 合計" + (sm.juuniYear.e + sm.juuniMonth.e + sm.juuniDay.e) + "/36点。" + ((sm.juuniYear.e + sm.juuniMonth.e + sm.juuniDay.e) >= 20 ? "体力のある高エネルギー型。無理がきくぶん、休むのを忘れやすい。" : (sm.juuniYear.e + sm.juuniMonth.e + sm.juuniDay.e) >= 12 ? "ほどよいバランス型。疲れたら早めに休めば大きく崩れにくい。" : "省エネ型。体力を一度に使い切らず、こまめに休むと力が続く。") };
    } else if (sys === "数秘術") {
      const lp = nu.lifePath, m = (NM && NM[lp]) || {};
      out.self = { text: "<b>ライフパス" + lp + "（" + esc(m.title || "") + "）</b> → " + esc(two(m.desc)) };
      set("like", "ライフパス" + lp, VAL_TAGS, BY_LP.like[lp]);
      const n1 = nowOf("数秘術");
      out.life = { text: "<b>今年はパーソナルイヤー" + nu.personalYear + "</b> → " + esc(n1 ? n1.why : "") + "。9年で一巡する流れの" + nu.personalYear + "年目。" };
      set("decide", "ライフパス" + lp, DEC_TAGS, BY_LP.decide[lp]);
      set("money", "ライフパス" + lp, MONEY_TAGS, BY_LP.money[lp]);
      set("love", "ライフパス" + lp, REL_TAGS, BY_LP.love[lp], m.relationship ? esc(first(m.relationship)) : "");
    } else if (sys === "九星気学") {
      const hn = KYUSEI_NAMES[ky.honmei];
      out.self = { text: "<b>本命星が" + hn.name + "</b> → " + esc(two(hn.desc)) };
      set("like", "本命星が" + hn.name, VAL_TAGS, BY_KY.like[ky.honmei]);
      const pal = kyuseiPalaceOf(ky.honmei, kyuseiYearStar(year));
      out.life = { text: "<b>" + year + "年は" + (YEAR_PALACE[pal] || "").split("＝")[0] + "に回座</b> → " + esc((YEAR_PALACE[pal] || "").split("＝")[1] || "") + "。" };
      set("decide", "本命星が" + hn.name, DEC_TAGS, BY_KY.decide[ky.honmei], "方位や日を選ぶなら、九星タブの「方位の吉凶」と総合鑑定の「今日」を使う。");
      set("money", "本命星が" + hn.name, MONEY_TAGS, BY_KY.money[ky.honmei]);
      set("love", "本命星が" + hn.name, REL_TAGS, BY_KY.love[ky.honmei]);
      set("health", "本命星が" + hn.name, HEALTH_TAGS, BY_KY.health[ky.honmei], hn.health ? "九星では、" + esc(hn.health) + "とされる。" : "");
    } else if (sys === "マヤ暦") {
      const seal = MAYA_SEALS[ma.seal];
      out.self = { text: "<b>太陽の紋章が" + seal.n + "・音" + ma.tone + "</b> → " + esc(seal.desc) + " 音" + ma.tone + "は「" + esc(first(MAYA_TONES[ma.tone])).replace(/。$/, "") + "」。" };
      set("like", "太陽の紋章が" + seal.n, VAL_TAGS, BY_SEAL.like[ma.seal]);
      const age = getCurrentAge(d.y, d.m, d.d);
      out.life = { text: "<b>52年の周期</b> → マヤ暦では52年で生まれた日と同じKINに戻る（52歳の「生まれ直し」）。" + (age < 52 ? "あと" + (52 - age) + "年で迎える。" : "生まれ直しを過ぎて、2巡目に入っている。") };
      set("decide", "銀河の音" + ma.tone, DEC_TAGS, TONE_DEC[ma.tone], "（音は「どのように動くか」を表す）");
      set("love", "太陽の紋章が" + seal.n, REL_TAGS, BY_SEAL.like && BY_SEAL.love[ma.seal]);
    } else if (sys === "宿曜") {
      out.self = { text: "<b>本命宿が" + sh + "</b> → " + esc(SHUKUYO_27[calcShukuyo(d)].desc) };
      set("like", "本命宿が" + sh, VAL_TAGS, BY_SHUKU.like[sh]);
      out.life = { none: "宿曜は、人生を年代で区切る仕組みを持ちません。日ごとの運（今日の宿）は、総合鑑定の「今日」で見られます。" };
      set("decide", "本命宿が" + sh, DEC_TAGS, BY_SHUKU.decide[sh], "日を選ぶなら、宿曜タブの「今日の宿曜運勢」を使う。");
      set("money", "本命宿が" + sh, MONEY_TAGS, BY_SHUKU.money[sh]);
      const sr = pick(SR, sh);
      out.love = { text: "<b>本命宿が" + sh + "</b> → 「" + (BY_SHUKU.love[sh] || []).map(t => REL_TAGS[t].label).join("」「") + "」。" + esc(sr ? sr.people : "") + " 相手との相性は、宿曜タブの三九の秘法で見られる（宿曜が最も得意な見方）。",
        tags: BY_SHUKU.love[sh] || [], what: "本命宿が" + sh };
    } else if (sys === "インド占星術") {
      const RS = typeof JYOTISH_RASHIS !== "undefined" ? JYOTISH_RASHIS : [];
      out.self = { text: "<b>月のラーシが" + RS[rMoon].n + "（" + RS[rMoon].jp + "）</b> → " + esc(RS[rMoon].desc) + "インド占星術は、心を表す月を最も重く見る。" };
      set("like", "月のラーシが" + RS[rMoon].n, VAL_TAGS, BY_SIGN.like[rMoon]);
      try {
        const ds = calcDasha(norm360(d.moonLon - ay), d.y), age = typeof ageExact === "function" ? ageExact(d.y, d.m, d.d) : getCurrentAge(d.y, d.m, d.d), cur = ds.dashas.find(x => age >= x.startAge && age < x.endAge);
        if (cur) out.life = { text: "<b>今は" + cur.lord + "のダシャー（" + Math.floor(cur.startAge) + "〜" + Math.floor(cur.endAge) + "歳）</b> → " + esc(first(cur.theme)) + (d.tm !== "known" ? "（時刻が分からないので、区切りの年齢は前後する）" : "") };
      } catch (e) { }
      set("decide", "月のラーシが" + RS[rMoon].n, DEC_TAGS, BY_SIGN.decide[rMoon]);
      if (d.ascLon != null) { const r2 = (Math.floor(norm360(d.ascLon - ay) / 30) + 1) % 12; set("money", "ラグナから2番目（お金の部屋）が" + RS[r2].n, MONEY_TAGS, BY_SIGN.money[r2]); }
      const jr = pick(JR, RS[rMoon].n);
      out.love = { text: "<b>月のラーシが" + RS[rMoon].n + "</b> → 「" + (BY_SIGN.love[rMoon] || []).map(t => REL_TAGS[t].label).join("」「") + "」。" + esc(jr ? jr.people : ""),
        tags: BY_SIGN.love[rMoon] || [], what: "月のラーシが" + RS[rMoon].n };
      set("health", "月のラーシが" + RS[rMoon].n, HEALTH_TAGS, BY_SIGN.health[rMoon], jr ? esc(jr.care) : "");
    }
    // 印・時刻・見ないもの
    QA.forEach(([k], i) => {
      const mark = rate[i];
      if (!out[k]) {
        if (needT.indexOf(k) >= 0 && !timeKnown) out[k] = { time: true };
        else out[k] = { none: (mark === "×" ? "この占術では見ません。" : "この占術では、ここに使える材料が少ないので出していません。") + good(k) };
      } else if (out[k].none) out[k].none += good(k);
      out[k].mark = mark;
    });
    return out;
  }
  function qaHtml(d, sys) {
    const a = qaFor(d, sys);
    let h = '<div class="rs-qa" id="rs-qa-' + SYS.indexOf(sys) + '"><div class="rs-qa-h">知りたいことに、' + sys + "で答えると</div>" +
      '<p class="rs-qa-lead">得意・見られる・参考・見ない は、この占術がもともと何を見る占いかで付けています。</p>';
    QA.forEach(([k, label]) => {
      const x = a[k], cls = { "◎": "good", "○": "ok", "△": "weak", "×": "no" }[x.mark];
      h += '<div class="rs-qa-row rs-qa-' + cls + '"><div class="rs-qa-k">' + label + '<span class="rs-qa-m">' + x.mark + QA_MARK[x.mark] + "</span></div>" +
        '<div class="rs-qa-v">' + (x.text ? x.text : x.time ? '<span class="rs-qa-dim">生まれた時刻を入れると出ます（' + sys + "は、ここを生まれた時刻で決めます）。</span>" : '<span class="rs-qa-dim">' + esc(x.none) + "</span>") + "</div></div>";
    });
    if (a.health && a.health.text) h += '<p class="rs-small">健康は、占いから見た体質の傾向で、生活の目安です。気になる症状があるときは、医療機関で相談してください。</p>';
    return h + "</div>";
  }
  // 1つの知りたいことについて、9つの占術の答えを並べる（総合鑑定の分類用）
  function qaListHtml(d, key, folded) {
    const all = qaAll(d), label = (QA.find(q => q[0] === key) || [])[1] || "";
    if (folded) return '<details class="rs-fold"><summary>' + label + "：9つの占術それぞれの答え<span>得意・見られる・参考・見ない と、何を見てそう言っているか</span></summary><div class=\"rs-fold-body\">" + qaListHtml(d, key, false) + "</div></details>";
    return '<div class="rs-qa"><div class="rs-qa-h">' + label + "：占術ごとの答え</div>" +
      SYS.map(sys => {
        const x = all[sys][key] || {}, mark = QA_RATE[sys][QA.findIndex(q => q[0] === key)], cls = { "◎": "good", "○": "ok", "△": "weak", "×": "no" }[mark];
        return '<div class="rs-qa-row rs-qa-' + cls + '"><div class="rs-qa-k">' + sys + '<span class="rs-qa-m">' + mark + QA_MARK[mark] + "</span></div>" +
          '<div class="rs-qa-v">' + (x.text ? x.text : x.time ? '<span class="rs-qa-dim">生まれた時刻を入れると出ます。</span>' : '<span class="rs-qa-dim">' + esc(x.none || "") + "</span>") + "</div></div>";
      }).join("") + "</div>";
  }
  function addQa(d, i, sys) {
    const el = document.getElementById("tab" + i);
    if (!el) return;
    const old = el.querySelector(".rs-qa");
    if (old) old.remove();
    const bridge = el.querySelector(".rs-bridge");
    const tmp = document.createElement("div");
    try { tmp.innerHTML = qaHtml(d, sys); } catch (e) { console.warn(sys + " の知りたいことの描画エラー:", e); return; }
    if (bridge) bridge.insertAdjacentElement("afterend", tmp.firstChild); else el.insertBefore(tmp.firstChild, el.firstChild);
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
    const fold = document.querySelector(".rs-why-fold");
    if (fold) fold.open = true;
    const el = document.querySelector(".rs-axes");
    if (el) {
      const tabs = document.querySelector(".tabs");
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - (tabs ? tabs.getBoundingClientRect().bottom : 0) - 60 });
    }
  }

  global.RSynth = { buildSynthesis, buildSynthesisHtml, systemOfRule, systemOfVoter, SYS, bridgeFor, decorateTabs, goTab, goSummary, topicHtml, topicIndexHtml, topicConclusion, qaListHtml, workReads, exportDigest, compatDigest, tabDigest, summaryConsultHtml, qaFor, archLines, ARCH_Q, pickTheme, setAmount, setDigestFull, isDigestFull, copyConsult, saveConsult, saveAnswer, clearAnswer, answerKey, goConsult, consultPrompt, buildToday, showDay, startCompat, neighborType, typeCloseness, openType, closeType, slugOf };
  global.buildSynthesisHtml = buildSynthesisHtml;
})(typeof window !== "undefined" ? window : globalThis);

// ==========================================================================
// 羅占盤 16タイプ判定ロジック（1ファイル統合版）
// ==========================================================================
//
// 設計原則:
//   1. 各占術要素は「最も関連性の高い1軸」にのみ投票する（重複計上しない）
//   2. 各軸の正負ルール数を概ね均等にする（構造的バイアス回避）
//   3. 占術の原意に沿った配置をする
//   4. 同点時は「両面」扱い（isAmbiguous=true）
//   5. 欠損データを検出して信頼度を出す
//
// 4軸: 革新/継承・広い/狭い・リーダー/参謀・楽天/慎重
// 修飾子: 早咲き/晩成・直感/論理（タイプ選択には使わず表示のみ）
//
// 要素の軸割り当て:
//   太陽星座      → 軸1（革新/継承）のみ
//   月星座        → 軸3（リーダー/参謀）のみ
//   ASC           → 軸4（楽天/慎重）のみ
//   火星          → 軸1（革新/継承）のみ
//   金星          → 軸4（楽天/慎重）のみ
//   木星          → 軸4（楽天/慎重）のみ
//   土星-太陽/水星→ 軸1（継承側）
//   土星-月       → 軸4（慎重側）
//   水星/海王星   → 修飾子2（直感/論理）のみ
//   天王星        → 軸1（革新/継承）のみ
//   冥王星        → 軸2（広い/狭い）のみ
//   四柱:日主陰陽 → 軸3
//   四柱:十神     → 各十神ごとに1軸に固定
//   四柱:五行偏り → 軸2
//   四柱:水強/火0 → 軸4（慎重側）
//   紫微:命宮主星 → 各主星ごとに1軸に固定
//   紫微:化忌     → 軸4（慎重側）
//   算命:中央星   → 各星ごとに1軸に固定
//   算命:十二大従星→ 修飾子1（早咲き/晩成）＋一部軸4
//   数秘:LP       → 各LPごとに1軸に固定
//   数秘:BD       → 修飾子のみ
//   九星:本命星   → 各星ごとに1軸に固定
//   マヤ:紋章     → 各紋章ごとに1軸に固定
//   宿曜:宿       → 各宿ごとに1軸に固定
//   インド:ラーシ → 各ラーシごとに1軸に固定
// ==========================================================================

(function(global) {
'use strict';

// ── 定数 ──
const SIGN_EL = ["火","土","風","水","火","土","風","水","火","土","風","水"];
const SHUKUYO_NAMES = ["昴宿","畢宿","觜宿","参宿","井宿","鬼宿","柳宿","星宿","張宿","翼宿","軫宿","角宿","亢宿","氐宿","房宿","心宿","尾宿","箕宿","斗宿","女宿","虚宿","危宿","室宿","壁宿","奎宿","婁宿","胃宿"];

// ── ヘルパー ──
const signOf = lon => Math.floor(lon / 30);
const norm360 = x => { x = x % 360; return x < 0 ? x + 360 : x; };
const sun = d => signOf(d.sunLon);
const moon = d => signOf(d.moonLon);
const asc = d => d.ascLon !== null ? signOf(d.ascLon) : null;
const planetSign = (d, n) => { const p = d.planets.find(p => p.n === n); return p ? signOf(p.lon) : null; };
const aspectAngle = (d, n1, n2) => {
  const p1 = d.planets.find(p => p.n === n1);
  const p2 = d.planets.find(p => p.n === n2);
  if (!p1 || !p2) return null;
  const diff = Math.abs(p1.lon - p2.lon);
  return diff > 180 ? 360 - diff : diff;
};
const hasAspect = (d, n1, n2, type, orb = 6) => {
  const a = aspectAngle(d, n1, n2);
  if (a === null) return false;
  const target = { 合:0, 衝:180, 三分:120, 四分:90, 六分:60 }[type];
  return Math.abs(a - target) <= orb;
};
const planetsInElement = (d, el) => d.planets.filter(p => SIGN_EL[signOf(p.lon)] === el).length;
const hasTen = (d, ten) => d.pillars && d.pillars.some(p => p.ten === ten);
const lifeStar = (d, star) => {
  if (d.tm === 'unknown') return false;
  if (!d.ziweiDistrib || d.lifeIdx === undefined) return false;
  return (d.ziweiDistrib[d.lifeIdx] || []).includes(star);
};
const smCenter = (sm, star) => sm && sm.stars && sm.stars.center === star;
const smAny = (sm, star) => sm && sm.stars && Object.values(sm.stars).includes(star);
const smJuuni = (sm, star) => sm && [sm.juuniYear, sm.juuniMonth, sm.juuniDay].some(j => j && j.n === star);
const shukuName = i => SHUKUYO_NAMES[i];

// ==========================================================================
// 軸1: 革新 vs 継承 — 価値観の方向性（新しく作る / 受け継いで磨く）
// ==========================================================================
const A1P = [
  // 西洋: 太陽星座・火星・天王星（軸1専任）
  { p:2, n:"太陽が射手座",            t:d => sun(d) === 8 },
  { p:2, n:"太陽が水瓶座",            t:d => sun(d) === 10 },
  { p:1, n:"太陽が牡羊座",            t:d => sun(d) === 0 },
  { p:2, n:"火星が牡羊座/水瓶座",     t:d => [0,10].includes(planetSign(d,'火星')) },
  { p:3, n:"火星-天王星アスペクト",   t:d => hasAspect(d,'火星','天王星','合') || hasAspect(d,'火星','天王星','衝') || hasAspect(d,'火星','天王星','四分') },
  { p:2, n:"天王星-太陽の合",         t:d => hasAspect(d,'天王星','太陽','合') },
  // 四柱: 偏官・傷官（軸1専任）
  { p:3, n:"偏官透干",                t:d => hasTen(d,'偏官') },
  { p:2, n:"傷官透干",                t:d => hasTen(d,'傷官') },
  // 紫微: 武曲・破軍・七殺（軸1専任）
  { p:3, n:"武曲が命宮",              t:d => lifeStar(d,'武曲') },
  { p:3, n:"破軍が命宮",              t:d => lifeStar(d,'破軍') },
  { p:2, n:"七殺が命宮",              t:d => lifeStar(d,'七殺') },
  // 算命: 龍高星（軸1専任）
  { p:3, n:"龍高星が中央",            t:(d,sm) => smCenter(sm,'龍高星') },
  { p:1, n:"龍高星(他位置)",          t:(d,sm) => smAny(sm,'龍高星') },
  // 数秘: LP5（軸1専任）
  { p:2, n:"LP5(変化)",               t:(d,sm,nu) => nu && nu.lifePath === 5 },
  // 九星: 三碧（軸1専任）
  { p:2, n:"三碧木星",                t:(d,sm,nu,ky) => ky && ky.honmei === 3 },
  // マヤ: 青い嵐・赤い空歩く人（軸1専任）
  { p:2, n:"青い嵐紋章",              t:(d,sm,nu,ky,ma) => ma && ma.seal === 18 },
  { p:1, n:"赤い空歩く人",            t:(d,sm,nu,ky,ma) => ma && ma.seal === 12 },
  // 宿曜: 亢宿・危宿・室宿・箕宿（軸1専任）
  { p:3, n:"亢宿(妥協しない)",        t:(d,sm,nu,ky,ma,si) => shukuName(si) === "亢宿" },
  { p:2, n:"危宿(冒険)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "危宿" },
  { p:2, n:"室宿(建設と破壊)",        t:(d,sm,nu,ky,ma,si) => shukuName(si) === "室宿" },
  { p:1, n:"箕宿(自由)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "箕宿" },
];

const A1N = [
  // 西洋: 太陽星座・火星・土星-太陽/水星（軸1専任）
  { p:2, n:"太陽が山羊座",            t:d => sun(d) === 9 },
  { p:2, n:"太陽が牡牛座",            t:d => sun(d) === 1 },
  { p:1, n:"太陽が蟹座",              t:d => sun(d) === 3 },
  { p:2, n:"火星が山羊座/牡牛座",     t:d => [1,9].includes(planetSign(d,'火星')) },
  { p:3, n:"土星が太陽と合",          t:d => hasAspect(d,'土星','太陽','合') },
  { p:1, n:"土星-水星の合",           t:d => hasAspect(d,'土星','水星','合') },
  // 四柱: 正印・正官・偏印（軸1専任）
  { p:3, n:"正印透干",                t:d => hasTen(d,'正印') },
  { p:2, n:"正官透干",                t:d => hasTen(d,'正官') },
  { p:1, n:"偏印透干",                t:d => hasTen(d,'偏印') },
  // 紫微: 紫微・天府・天梁（軸1専任）
  { p:3, n:"紫微が命宮",              t:d => lifeStar(d,'紫微') },
  { p:3, n:"天府が命宮",              t:d => lifeStar(d,'天府') },
  { p:2, n:"天梁が命宮",              t:d => lifeStar(d,'天梁') },
  // 算命: 玉堂星（軸1専任）
  { p:3, n:"玉堂星が中央",            t:(d,sm) => smCenter(sm,'玉堂星') },
  { p:1, n:"玉堂星(他位置)",          t:(d,sm) => smAny(sm,'玉堂星') },
  // 数秘: LP4・LP6（軸1専任）
  { p:2, n:"LP4(基盤)",               t:(d,sm,nu) => nu && nu.lifePath === 4 },
  { p:1, n:"LP6(責任)",               t:(d,sm,nu) => nu && nu.lifePath === 6 },
  // 九星: 八白・六白（軸1専任）
  { p:2, n:"八白土星",                t:(d,sm,nu,ky) => ky && ky.honmei === 8 },
  { p:1, n:"六白金星",                t:(d,sm,nu,ky) => ky && ky.honmei === 6 },
  // マヤ: 白い鏡・白い犬（軸1専任）
  { p:2, n:"白い鏡(秩序)",            t:(d,sm,nu,ky,ma) => ma && ma.seal === 17 },
  { p:1, n:"白い犬(忠実)",            t:(d,sm,nu,ky,ma) => ma && ma.seal === 9 },
  // 宿曜: 畢宿・婁宿・奎宿・尾宿（軸1専任）
  { p:2, n:"畢宿(堅実)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "畢宿" },
  { p:2, n:"婁宿(計画)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "婁宿" },
  { p:1, n:"奎宿(品格)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "奎宿" },
  { p:1, n:"尾宿(継承)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "尾宿" },
];

// ==========================================================================
// 軸2: 広い vs 狭い — 興味・行動範囲（多方面 / 限定的）
// ==========================================================================
const A2P = [
  // 四柱: 偏財・駅馬・五行多種（軸2専任）
  { p:3, n:"偏財透干(多方面の財)",    t:d => hasTen(d,'偏財') },
  { p:1, n:"日支が駅馬(寅申亥巳)",    t:d => d.day && ["寅","申","亥","巳"].includes(d.day.branch) },
  { p:1, n:"五行が4種以上",           t:d => d.wx && Object.values(d.wx).filter(v => v > 0).length >= 4 },
  // 紫微: 貪狼・天機・太陽（軸2専任）
  { p:3, n:"貪狼が命宮(多趣味)",      t:d => lifeStar(d,'貪狼') },
  { p:2, n:"天機が命宮(変化)",        t:d => lifeStar(d,'天機') },
  { p:1, n:"太陽が命宮(広く照らす)",  t:d => lifeStar(d,'太陽') },
  // 算命: 鳳閣星・石門星（軸2専任）
  { p:3, n:"鳳閣星が中央(楽観・表現)", t:(d,sm) => smCenter(sm,'鳳閣星') },
  { p:3, n:"石門星が中央(社交)",      t:(d,sm) => smCenter(sm,'石門星') },
  { p:1, n:"鳳閣星(他位置)",          t:(d,sm) => smAny(sm,'鳳閣星') },
  { p:1, n:"石門星(他位置)",          t:(d,sm) => smAny(sm,'石門星') },
  // 数秘: LP3・LP9・LP11（軸2専任）
  { p:2, n:"LP3(表現)",               t:(d,sm,nu) => nu && nu.lifePath === 3 },
  { p:1, n:"LP9(広い視野)",           t:(d,sm,nu) => nu && nu.lifePath === 9 },
  { p:1, n:"LP11(マスター・拡大)",    t:(d,sm,nu) => nu && nu.lifePath === 11 },
  // 九星: 四緑・七赤（軸2専任）
  { p:3, n:"四緑木星(風)",            t:(d,sm,nu,ky) => ky && ky.honmei === 4 },
  { p:1, n:"七赤金星(楽しみ)",        t:(d,sm,nu,ky) => ky && ky.honmei === 7 },
  // マヤ: 黄色い人・青い猿（軸2専任）
  { p:2, n:"黄色い人(多面性)",        t:(d,sm,nu,ky,ma) => ma && ma.seal === 11 },
  { p:1, n:"青い猿(遊び)",            t:(d,sm,nu,ky,ma) => ma && ma.seal === 10 },
  // 宿曜: 翼宿・張宿（軸2専任）
  { p:2, n:"翼宿(旅・移動)",          t:(d,sm,nu,ky,ma,si) => shukuName(si) === "翼宿" },
  { p:1, n:"張宿(社交)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "張宿" },
  // ── 副軸ルール（他軸の主軸要素が「広い」の側面も持つ場合、p:1で追加投票）──
  { p:1, n:"[副]禄存星(人を引き寄せる)",   t:(d,sm) => smAny(sm,'禄存星') },
  { p:1, n:"[副]月が射手座(広い感受性)",   t:d => moon(d) === 8 },
  { p:1, n:"[副]月が双子座(好奇心)",       t:d => moon(d) === 2 },
  { p:1, n:"[副]太陽がダヌ(射手/拡大)",    t:(d,sm,nu,ky,ma,si,jy) => jy && jy.sunRashi === 8 },
  { p:1, n:"[副]木星-太陽の三分(拡大志向)", t:d => hasAspect(d,'木星','太陽','三分') },
  { p:1, n:"[副]風星座に天体3つ以上(広い知性)", t:d => planetsInElement(d,'風') >= 3 },
  { p:1, n:"[副]火星座に天体3つ以上(広い行動)", t:d => planetsInElement(d,'火') >= 3 },
];

const A2N = [
  // 西洋: 冥王星（軸2専任）
  { p:3, n:"冥王星が太陽/月と合",     t:d => hasAspect(d,'冥王星','太陽','合') || hasAspect(d,'冥王星','月','合') },
  // 四柱: 正財・五行偏り（軸2専任）
  { p:2, n:"正財透干(一点蓄積)",      t:d => hasTen(d,'正財') },
  { p:2, n:"五行に欠如あり(偏り)",    t:d => d.wx && Object.values(d.wx).some(v => v === 0) },
  { p:1, n:"五行が3種以下に偏る",     t:d => d.wx && Object.values(d.wx).filter(v => v > 0).length <= 3 },
  // 四柱: 五行異常偏重（軸2専任）
  { p:1, n:"水が極端に強い(6以上)",   t:d => d.wx && d.wx['水'] >= 6 },
  { p:1, n:"火が完全欠如(0)",         t:d => d.wx && d.wx['火'] === 0 },
  { p:1, n:"木が極端に弱い(1以下)",   t:d => d.wx && d.wx['木'] <= 1 },
  // 紫微: 巨門・廉貞（軸2専任）
  { p:3, n:"巨門が命宮(専門性)",      t:d => lifeStar(d,'巨門') },
  { p:2, n:"廉貞が命宮(深い情熱)",    t:d => lifeStar(d,'廉貞') },
  // 算命: 貫索星・調舒星（軸2専任）
  { p:3, n:"貫索星が中央(自我・専門)", t:(d,sm) => smCenter(sm,'貫索星') },
  { p:3, n:"調舒星が中央(繊細)",      t:(d,sm) => smCenter(sm,'調舒星') },
  { p:1, n:"貫索星(他位置)",          t:(d,sm) => smAny(sm,'貫索星') },
  { p:1, n:"調舒星(他位置)",          t:(d,sm) => smAny(sm,'調舒星') },
  // 数秘: LP7・LP8（軸2専任）
  { p:3, n:"LP7(探究・深化)",         t:(d,sm,nu) => nu && nu.lifePath === 7 },
  { p:1, n:"LP8(達成・専門)",         t:(d,sm,nu) => nu && nu.lifePath === 8 },
  // 九星: 一白（軸2専任）
  { p:2, n:"一白水星(深い知性)",      t:(d,sm,nu,ky) => ky && ky.honmei === 1 },
  // マヤ: 青い夜・黄色い種（軸2専任）
  { p:2, n:"青い夜(夢見る・深さ)",    t:(d,sm,nu,ky,ma) => ma && ma.seal === 2 },
  { p:1, n:"黄色い種(深掘り)",        t:(d,sm,nu,ky,ma) => ma && ma.seal === 3 },
  // 宿曜: 觜宿・尾宿・鬼宿（軸2専任）
  { p:2, n:"觜宿(研究・細部)",        t:(d,sm,nu,ky,ma,si) => shukuName(si) === "觜宿" },
  { p:2, n:"尾宿(職人気質)",          t:(d,sm,nu,ky,ma,si) => shukuName(si) === "尾宿" },
  { p:1, n:"鬼宿(独自世界)",          t:(d,sm,nu,ky,ma,si) => shukuName(si) === "鬼宿" },
  // ── 副軸ルール（他軸の主軸要素が「狭い」の側面も持つ場合、p:1で追加投票）──
  { p:1, n:"[副]武曲が命宮(実務特化)",          t:d => lifeStar(d,'武曲') },
  { p:1, n:"[副]七殺が命宮(独立独歩)",          t:d => lifeStar(d,'七殺') },
  { p:1, n:"[副]偏官透干(深い変容力)",          t:d => hasTen(d,'偏官') },
  { p:1, n:"[副]亢宿(孤高の専門性)",            t:(d,sm,nu,ky,ma,si) => shukuName(si) === "亢宿" },
];

// ==========================================================================
// 軸3: リーダー vs 参謀 — 役割の出方（前に立つ / 後ろで知恵を出す）
// ==========================================================================
const A3P = [
  // 西洋: 月星座（軸3専任・火風側）
  { p:2, n:"月が火の星座(獅子/牡羊/射手)", t:d => [0,4,8].includes(moon(d)) },
  { p:1, n:"月が風の星座(天秤/水瓶/双子)", t:d => [2,6,10].includes(moon(d)) },
  // 四柱: 日主陰陽・比肩（軸3専任）
  { p:1, n:"日主が陽干",              t:d => d.day && ["甲","丙","戊","庚","壬"].includes(d.day.stem) },
  { p:2, n:"比肩透干(自立)",          t:d => hasTen(d,'比肩') },
  // 紫微: 太陽（軸3専任）
  { p:3, n:"太陽が命宮",              t:d => lifeStar(d,'太陽') },
  // 算命: 牽牛星・車騎星（軸3専任）
  { p:3, n:"牽牛星が中央",            t:(d,sm) => smCenter(sm,'牽牛星') },
  { p:2, n:"車騎星が中央",            t:(d,sm) => smCenter(sm,'車騎星') },
  { p:1, n:"牽牛星(他位置)",          t:(d,sm) => smAny(sm,'牽牛星') },
  // 数秘: LP1（軸3専任）
  { p:3, n:"LP1(リーダー)",           t:(d,sm,nu) => nu && nu.lifePath === 1 },
  // 九星: 五黄・九紫（軸3専任）
  { p:2, n:"五黄土星(帝王)",          t:(d,sm,nu,ky) => ky && ky.honmei === 5 },
  { p:1, n:"九紫火星",                t:(d,sm,nu,ky) => ky && ky.honmei === 9 },
  // マヤ: 黄色い太陽（軸3専任）
  { p:2, n:"黄色い太陽",              t:(d,sm,nu,ky,ma) => ma && ma.seal === 19 },
  // 宿曜: 房宿・星宿（軸3専任）
  { p:2, n:"房宿(権力)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "房宿" },
  { p:1, n:"星宿(華やかさ)",          t:(d,sm,nu,ky,ma,si) => shukuName(si) === "星宿" },
  // インド: ラグナがシンハ（軸3専任）
  { p:2, n:"ラグナがシンハ(獅子)",    t:(d,sm,nu,ky,ma,si,jy) => jy && jy.lagnaRashi === 4 },
  { p:1, n:"太陽がシンハ(獅子)",      t:(d,sm,nu,ky,ma,si,jy) => jy && jy.sunRashi === 4 },
];

const A3N = [
  // 西洋: 月星座（軸3専任・土水側）
  { p:2, n:"月が土の星座(乙女/山羊/牡牛)", t:d => [1,5,9].includes(moon(d)) },
  { p:1, n:"月が水の星座(蟹/蠍/魚)", t:d => [3,7,11].includes(moon(d)) },
  // 四柱: 日主陰陽・食神（軸3専任）
  { p:1, n:"日主が陰干",              t:d => d.day && ["乙","丁","己","辛","癸"].includes(d.day.stem) },
  { p:2, n:"食神透干(穏やかな知恵)",  t:d => hasTen(d,'食神') },
  // 紫微: 太陰・天同（軸3専任）
  { p:3, n:"太陰が命宮",              t:d => lifeStar(d,'太陰') },
  { p:2, n:"天同が命宮",              t:d => lifeStar(d,'天同') },
  // 算命: 司禄星（軸3専任）
  { p:3, n:"司禄星が中央",            t:(d,sm) => smCenter(sm,'司禄星') },
  { p:1, n:"司禄星(他位置)",          t:(d,sm) => smAny(sm,'司禄星') },
  // 数秘: LP2・LP11（軸3専任）
  { p:3, n:"LP2(協力)",               t:(d,sm,nu) => nu && nu.lifePath === 2 },
  { p:1, n:"LP11(直感的リード)",      t:(d,sm,nu) => nu && nu.lifePath === 11 },
  // 九星: 二黒（軸3専任）
  { p:2, n:"二黒土星(大地・支え)",    t:(d,sm,nu,ky) => ky && ky.honmei === 2 },
  { p:1, n:"月命一白水星",            t:(d,sm,nu,ky) => ky && ky.getsu === 1 },
  // マヤ: 黄色い種・白い魔法使い（軸3専任）
  { p:2, n:"黄色い種(気づき)",        t:(d,sm,nu,ky,ma) => ma && ma.seal === 3 },
  { p:1, n:"白い魔法使い(受容)",      t:(d,sm,nu,ky,ma) => ma && ma.seal === 13 },
  // 宿曜: 心宿・女宿（軸3専任）
  { p:2, n:"心宿(洞察)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "心宿" },
  { p:1, n:"女宿(奉仕)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "女宿" },
  // インド: ラグナがクンバ/カンニャー（軸3専任）
  { p:2, n:"ラグナがクンバ(独自の知性)", t:(d,sm,nu,ky,ma,si,jy) => jy && jy.lagnaRashi === 10 },
  { p:1, n:"ラグナがカンニャー(分析)",   t:(d,sm,nu,ky,ma,si,jy) => jy && jy.lagnaRashi === 5 },
];

// ==========================================================================
// 軸4: 楽天 vs 慎重 — 物事の捉え方（基本的に楽観 / 慎重・懐疑的）
// ==========================================================================
const A4P = [
  // 西洋: ASC・金星・木星（軸4専任）
  { p:2, n:"ASCが射手座/獅子座",      t:d => asc(d) === 8 || asc(d) === 4 },
  { p:1, n:"ASCが牡羊座",             t:d => asc(d) === 0 },
  { p:2, n:"金星-木星アスペクト",     t:d => hasAspect(d,'金星','木星','合') || hasAspect(d,'金星','木星','三分') || hasAspect(d,'金星','木星','六分') },
  { p:3, n:"木星が太陽/月と合/三分",  t:d => hasAspect(d,'木星','太陽','合') || hasAspect(d,'木星','太陽','三分') || hasAspect(d,'木星','月','合') || hasAspect(d,'木星','月','三分') },
  // 紫微: 紅鸞/天喜（軸4専任）
  { p:1, n:"紅鸞/天喜が命宮",         t:d => lifeStar(d,'紅鸞') || lifeStar(d,'天喜') },
  // 算命: 禄存星・天南星・天禄星（軸4専任）
  { p:3, n:"禄存星が中央(魅力・明るさ)", t:(d,sm) => smCenter(sm,'禄存星') },
  { p:1, n:"天南星を持つ(青年の情熱)", t:(d,sm) => smJuuni(sm,'天南星') },
  { p:1, n:"天禄星を持つ(壮年の安定)", t:(d,sm) => smJuuni(sm,'天禄星') },
  // 九星: 七赤（軸4専任）
  { p:2, n:"七赤金星(喜び)",          t:(d,sm,nu,ky) => ky && ky.honmei === 7 },
  // マヤ: 赤い地球・赤い竜（軸4専任）
  { p:2, n:"赤い地球(共時性)",        t:(d,sm,nu,ky,ma) => ma && ma.seal === 16 },
  { p:1, n:"赤い竜(誕生)",            t:(d,sm,nu,ky,ma) => ma && ma.seal === 0 },
  // 宿曜: 昴宿（軸4専任）
  { p:1, n:"昴宿(華やか)",            t:(d,sm,nu,ky,ma,si) => shukuName(si) === "昴宿" },
  // インド: 太陽ダヌ・月シンハ（軸4専任）
  { p:1, n:"太陽がダヌ(射手)",        t:(d,sm,nu,ky,ma,si,jy) => jy && jy.sunRashi === 8 },
  { p:1, n:"月がシンハ(獅子)",        t:(d,sm,nu,ky,ma,si,jy) => jy && jy.moonRashi === 4 },
];

const A4N = [
  // 西洋: ASC・土星-月（軸4専任）
  { p:2, n:"ASCが魚座/蠍座",          t:d => asc(d) === 11 || asc(d) === 7 },
  { p:1, n:"ASCが山羊座",             t:d => asc(d) === 9 },
  { p:3, n:"土星が月と合/四分",       t:d => hasAspect(d,'土星','月','合') || hasAspect(d,'土星','月','四分') },
  { p:1, n:"火星-天王星の衝",         t:d => hasAspect(d,'火星','天王星','衝') },
  // 四柱: 水の強さ・火欠如（軸4専任）
  { p:2, n:"水が強すぎる(5以上)",     t:d => d.wx && d.wx['水'] >= 5 },
  { p:1, n:"火がゼロ(情熱が表に出にくい)", t:d => d.wx && d.wx['火'] === 0 },
  // 紫微: 化忌（軸4専任）
  { p:2, n:"化忌が命宮",              t:d => {
    if (d.tm === 'unknown') return false;
    if (!d.sihua || d.lifeIdx === undefined || !d.ziweiDistrib) return false;
    const ki = d.sihua.find(s => s.type === '化忌');
    if (!ki || ki.unplaced) return false;
    return (d.ziweiDistrib[d.lifeIdx] || []).includes(ki.star);
  }},
  // 算命: 天胡星・天極星・天馳星（軸4専任）
  { p:2, n:"天胡星(病の星=内面の重さ)", t:(d,sm) => smJuuni(sm,'天胡星') },
  { p:2, n:"天極星(深い内省)",          t:(d,sm) => smJuuni(sm,'天極星') },
  { p:1, n:"天馳星(最小エネルギー)",    t:(d,sm) => smJuuni(sm,'天馳星') },
  // 九星: 月命一白（軸4専任）
  { p:2, n:"月命一白水星(内面の深さ)",  t:(d,sm,nu,ky) => ky && ky.getsu === 1 },
  // マヤ: 赤い月・白い世界の橋渡し（軸4専任）
  { p:2, n:"赤い月(浄化の苦しみ)",     t:(d,sm,nu,ky,ma) => ma && ma.seal === 8 },
  { p:1, n:"白い世界の橋渡し(死と再生)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 5 },
  // 宿曜: 柳宿・虚宿（軸4専任）
  { p:2, n:"柳宿(感受性・感情の起伏)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "柳宿" },
  { p:1, n:"虚宿(理想主義)",           t:(d,sm,nu,ky,ma,si) => shukuName(si) === "虚宿" },
  // インド: ラグナがマカラ/クンバ（軸4専任）
  { p:2, n:"ラグナがマカラ/クンバ(土星支配)", t:(d,sm,nu,ky,ma,si,jy) => jy && (jy.lagnaRashi === 9 || jy.lagnaRashi === 10) },
];

// ==========================================================================
// 修飾子1: 早咲き vs 晩成 — 成功時期
// ==========================================================================
const M1P = [
  { p:3, n:"天恍星が年支/月支(青年期)",    t:(d,sm) => sm && ((sm.juuniYear && sm.juuniYear.n === '天恍星') || (sm.juuniMonth && sm.juuniMonth.n === '天恍星')) },
  { p:3, n:"天貴星が年支/月支(幼少期)",    t:(d,sm) => sm && ((sm.juuniYear && sm.juuniYear.n === '天貴星') || (sm.juuniMonth && sm.juuniMonth.n === '天貴星')) },
  { p:2, n:"天南星が年支(青年期の情熱)",   t:(d,sm) => sm && sm.juuniYear && sm.juuniYear.n === '天南星' },
  { p:2, n:"天将星が年支/月支(若年期の王者)", t:(d,sm) => sm && ((sm.juuniYear && sm.juuniYear.n === '天将星') || (sm.juuniMonth && sm.juuniMonth.n === '天将星')) },
  { p:1, n:"天印星を持つ(若年の輝き)",     t:(d,sm) => smJuuni(sm,'天印星') },
  { p:2, n:"太陽-木星の合/三分",           t:d => hasAspect(d,'太陽','木星','合') || hasAspect(d,'太陽','木星','三分') },
  { p:2, n:"年柱の十神が良い",             t:d => d.pillars && d.pillars[0] && ['食神','正財','正官'].includes(d.pillars[0].ten) },
  { p:2, n:"月柱の十神が良い",             t:d => d.pillars && d.pillars[1] && ['食神','正財','正官'].includes(d.pillars[1].ten) },
  { p:1, n:"BD1/3/5/8",                    t:(d,sm,nu) => nu && [1,3,5,8].includes(nu.birthday) },
  { p:1, n:"本命星が三碧/四緑/九紫",       t:(d,sm,nu,ky) => ky && [3,4,9].includes(ky.honmei) },
];

const M1N = [
  { p:3, n:"天禄星が年支/月支(蓄積→後半開花)", t:(d,sm) => sm && ((sm.juuniYear && sm.juuniYear.n === '天禄星') || (sm.juuniMonth && sm.juuniMonth.n === '天禄星')) },
  { p:3, n:"天禄星/天堂星が日支(晩成の核)",    t:(d,sm) => sm && sm.juuniDay && (sm.juuniDay.n === '天禄星' || sm.juuniDay.n === '天堂星') },
  { p:2, n:"天庫星を持つ(蓄積)",               t:(d,sm) => smJuuni(sm,'天庫星') },
  { p:2, n:"天極星を持つ(深み)",               t:(d,sm) => smJuuni(sm,'天極星') },
  { p:2, n:"天胡星を持つ(精神性)",             t:(d,sm) => smJuuni(sm,'天胡星') },
  { p:2, n:"天将星が日支(晩年の王者)",         t:(d,sm) => sm && sm.juuniDay && sm.juuniDay.n === '天将星' },
  { p:3, n:"時柱の十神が良い",                 t:d => d.pillars && d.pillars[3] && ['食神','正財','偏財','正官'].includes(d.pillars[3].ten) },
  { p:2, n:"太陽-土星の合/三分",               t:d => hasAspect(d,'太陽','土星','合') || hasAspect(d,'太陽','土星','三分') },
  { p:1, n:"BD7/9",                            t:(d,sm,nu) => nu && [7,9].includes(nu.birthday) },
  { p:1, n:"本命星が二黒/八白/六白",           t:(d,sm,nu,ky) => ky && [2,8,6].includes(ky.honmei) },
];

// ==========================================================================
// 修飾子2: 直感 vs 論理 — 情報処理
// ==========================================================================
const M2P = [
  { p:3, n:"海王星が水星と合",        t:d => hasAspect(d,'海王星','水星','合') },
  { p:2, n:"水の星座に天体3つ以上",   t:d => planetsInElement(d,'水') >= 3 },
  { p:1, n:"ASCが水の星座",           t:d => [3,7,11].includes(asc(d)) },
  { p:1, n:"水が強い(5以上)",         t:d => d.wx && d.wx['水'] >= 5 },
  { p:1, n:"天胡星を持つ",            t:(d,sm) => smJuuni(sm,'天胡星') },
  { p:1, n:"BD7",                     t:(d,sm,nu) => nu && nu.birthday === 7 },
  { p:2, n:"月命一白水星",            t:(d,sm,nu,ky) => ky && ky.getsu === 1 },
  { p:1, n:"赤い地球紋章",            t:(d,sm,nu,ky,ma) => ma && ma.seal === 16 },
  { p:2, n:"白い魔法使い紋章",        t:(d,sm,nu,ky,ma) => ma && ma.seal === 13 },
  { p:2, n:"心宿(直観)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "心宿" },
  { p:1, n:"鬼宿(霊感)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "鬼宿" },
];

const M2N = [
  { p:3, n:"水星が風の星座",          t:d => [2,6,10].includes(planetSign(d,'水星')) },
  { p:1, n:"水星-土星アスペクト",     t:d => hasAspect(d,'水星','土星','合') || hasAspect(d,'水星','土星','三分') || hasAspect(d,'水星','土星','六分') },
  { p:1, n:"風の星座に天体3つ以上",   t:d => planetsInElement(d,'風') >= 3 },
  { p:1, n:"金が強い(3以上)",         t:d => d.wx && d.wx['金'] >= 3 },
  { p:2, n:"文昌が命宮",              t:d => lifeStar(d,'文昌') },
  { p:2, n:"LP4",                     t:(d,sm,nu) => nu && nu.lifePath === 4 },
  { p:1, n:"LP1",                     t:(d,sm,nu) => nu && nu.lifePath === 1 },
  { p:2, n:"八白土星",                t:(d,sm,nu,ky) => ky && ky.honmei === 8 },
  { p:1, n:"六白金星",                t:(d,sm,nu,ky) => ky && ky.honmei === 6 },
  { p:2, n:"白い鏡(秩序)",            t:(d,sm,nu,ky,ma) => ma && ma.seal === 17 },
  { p:2, n:"觜宿(研究)",              t:(d,sm,nu,ky,ma,si) => shukuName(si) === "觜宿" },
];

// ==========================================================================
// 16タイプ命名表
// ==========================================================================
const TYPES = {
  "革新_広い_リーダー_楽天":  { name:"ヒーロー",          desc:"前線で人を巻き込み、新しい時代を作るリーダー",
    etymology: "ギリシャ語 hērōs = 半神・守護者。神話では神々と人間の間に立ち、民を守るために立ち上がる存在。転じて「困難に立ち向かい、人々を救う人」を指す。ただし傲慢や自己犠牲の影も背負う古代的な役柄。",
    personality: "前に出ることを恐れず、自ら旗を立てて人を巻き込む。明るく楽観的で、人を信じて未来を語る力がある。理屈より「行けばわかる」のスタイルで、周囲を引っ張る。ただし自分も周囲も強く見えるため、弱さを見せにくい。",
    strengths: [
      "困難な状況でも先頭に立って動き出せる突破力",
      "希望を語り、人を信じさせる人間的な求心力",
      "新しい時代を切り拓くスケールの大きなビジョン"
    ],
    challenges: [
      "自信過剰になり慎重な意見を軽く見がち",
      "自分の影・疲労を隠して無理を重ねる",
      "ついてこれない人への配慮が抜ける"
    ],
    careerFit: "起業家、経営者、プロジェクトリーダー、政治家、スポーツチームのキャプテン、社会運動のオーガナイザー。自分が動くことで周囲が動き出す構造の仕事に向く。ゼロからイチを生む場面で真価を発揮する。",
  },
  "革新_広い_リーダー_慎重":  { name:"レボリューショナリー", desc:"深く考え、世を変えるしかないと突き進む",
    etymology: "英語 Revolutionary = 革命家。ラテン語 revolutio「回転・ひっくり返し」が語源。既存の秩序を根本から覆し、新しい体制を作る人。単なる反抗者ではなく、深い信念と理論に裏打ちされた変革者を指す。",
    personality: "表面は穏やかだが、内側に「この世のままではいけない」という強い違和感を抱えている。長く考え抜いた上で、ここぞという時に腰を据えて動く。理想のためなら自分の安定を投げ出す覚悟があり、一度決めると後戻りしない。",
    strengths: [
      "構造的な矛盾や不正を見抜く深い洞察",
      "長期の苦しさに耐えながら変革を進める持久力",
      "志に共感する仲間を引き寄せる芯の強さ"
    ],
    challenges: [
      "重く考えすぎて行動が遅くなる",
      "敵味方を色分けしすぎて孤立を招く",
      "理想が高く、妥協を受け入れにくい"
    ],
    careerFit: "社会起業家、活動家、改革派の政治家、組織再建を担う経営者、ジャーナリスト、思想家。壊れた仕組みを直す、または作り替える仕事が向いている。保身より大義で動けるポジションが合う。",
  },
  "革新_広い_参謀_楽天":      { name:"トリックスター",    desc:"場に化学反応を起こす陽気な触媒",
    etymology: "神話学用語 Trickster = 世界中の神話に登場する「いたずら者・境界を越える存在」。ギリシャのヘルメス、北欧のロキ、日本のスサノオなど。秩序を揺さぶることで新しい物語を生む役割を担う。",
    personality: "頭の回転が速く、ユーモアで場の空気を変える人。真面目な議論もふざけた雑談もフラットに行き来し、思いもよらない角度から話を動かす。本人は軽く見えるが、観察眼は鋭く、計算された遊びで新しい流れを作る。",
    strengths: [
      "固まった空気を一瞬でほぐすユーモアと機転",
      "異なる分野や立場をつなぐ越境的な発想",
      "堅苦しさを嫌う人や若い世代の心を掴む親しみやすさ"
    ],
    challenges: [
      "真剣な場で軽く見られて損をしやすい",
      "面白さを優先して本質の議論を回避する",
      "飽きっぽく、深掘りが苦手"
    ],
    careerFit: "クリエイティブディレクター、企画職、プロデューサー、コメディアン、MC、ファシリテーター、教育イノベーター。固定観念を壊す必要がある現場に向く。カオスを歓迎する環境でこそ輝く。",
  },
  "革新_広い_参謀_慎重":      { name:"ヴィジョナリー",    desc:"未来を見通し、独自の視点で組織を動かす",
    etymology: "英語 Visionary = ラテン語 visio「見ること」が語源。単に先を読む人ではなく、「他人には見えない未来像を示し、それを現実に引き寄せる人」。夢想家と実行者の中間に立ち、理想を構造として描く。",
    personality: "目の前の流れに乗らず、少し離れた位置から全体像を見ている人。語らないだけで、頭の中には10年先の風景が見えている。動くときは慎重で、確信を持ってから周囲を動かす。静かなのに、判断の射程が長い。",
    strengths: [
      "他人には見えない未来像を具体的に描く構想力",
      "短期の流行に惑わされない独自の判断軸",
      "静かに組織を理想の方向へ導く影響力"
    ],
    challenges: [
      "考えを言語化せず周囲を置き去りにしがち",
      "完璧を求めすぎて機会を逃す",
      "現場の感情より論理で動き、冷たく見られる"
    ],
    careerFit: "戦略コンサルタント、CTO、プロダクト責任者、投資家、都市計画家、研究機関のディレクター。10年スパンで動く仕事が合う。日々の数字より構造を扱うポジションで力を発揮する。",
  },
  "革新_狭い_リーダー_楽天":  { name:"パイオニア",        desc:"自分の領域を切り拓く先駆者",
    etymology: "フランス語 pionnier = 工兵（軍に先立って道を切り開く兵士）が語源。転じて、誰も足を踏み入れていない分野に最初に飛び込み、道を作る人。英語圏では開拓者、新領域の最初の住民を指す。",
    personality: "新しいことに躊躇なく飛び込む行動力と、「自分がやる」という明るい当事者意識を持つ。大人数を率いるより、自分の領域で先駆者になることを選ぶ。失敗しても引きずらず、次の一歩にすぐ踏み出せる回復力がある。",
    strengths: [
      "未知の領域に最初に踏み込む勇気",
      "失敗を引きずらず、すぐ次に動ける切り替えの速さ",
      "自分の領域で圧倒的な先行者利益を築く集中力"
    ],
    challenges: [
      "深く考えず飛び込んで不要な失敗を重ねる",
      "後から来た優秀な後続に追い抜かれやすい",
      "チーム全体の運営より自分の突破を優先する"
    ],
    careerFit: "起業家、新規事業担当、独立系クリエイター、スポーツ選手、探検家、研究者。組織の中でも「誰もやっていない領域」を任されるポジションで輝く。大きな組織の中間管理職には向かない。",
  },
  "革新_狭い_リーダー_慎重":  { name:"ローンウルフ",      desc:"信念だけで戦う孤独な戦士",
    etymology: "英語 Lone Wolf = 群れを離れた一匹狼。狼は本来群れで暮らす動物だが、何らかの理由で単独行動する個体を指す。比喩として「組織に頼らず、自分の信念だけで戦う人」を表す。警察用語では独立したテロリストの意味もあるが、一般には信念の人。",
    personality: "群れることを嫌い、自分の信じる道を一人で歩く。人当たりは悪くないが、深いところでは誰にも寄りかからない。リーダーシップはあるが、組織を背負うより自分の一線を守ることを選ぶ。寡黙で眼光が鋭く、独特の存在感を放つ。",
    strengths: [
      "他人の評価に揺らがない信念の強さ",
      "一人で決断し動き切る独立した実行力",
      "余計な群れや派閥に飲み込まれない潔さ"
    ],
    challenges: [
      "孤独を選びすぎて支援を得られない",
      "不器用で誤解されやすく、敵を作りやすい",
      "内側に抱えすぎて燃え尽きる"
    ],
    careerFit: "フリーランスの専門家、独立調査官、ノンフィクション作家、個人投資家、一匹狼型の営業、独立開業医。組織の論理が通じない領域、または自分の裁量で動ける仕事が合う。",
  },
  "革新_狭い_参謀_楽天":      { name:"シーカー",          desc:"好きなことだけを楽しく深く究める",
    etymology: "英語 Seeker = 探求者。動詞 seek（探す・求める）から。哲学・宗教の文脈では「真理を求め続ける人」を指す。ハリー・ポッターではクィディッチの重要な役割の名でもあり、執念深く探し続ける者の象徴。",
    personality: "好きなことには異常な集中力で没頭し、興味のないことは見向きもしない。重い責任より、自分が面白いと思える謎を解き続けたい。人当たりは柔らかく楽観的だが、譲れない領域では頑固。純粋な知的好奇心で生きている。",
    strengths: [
      "好きな領域を誰より深く楽しく掘り下げる集中力",
      "権威や流行に縛られない自由な発想",
      "長期の探求を楽しみながら続けられる体力"
    ],
    challenges: [
      "興味のない仕事・責任を軽く扱い周囲に迷惑をかける",
      "成果を他人にわかる形で伝えるのが苦手",
      "一人の世界に没頭して人間関係が希薄になる"
    ],
    careerFit: "研究者、学芸員、ニッチ分野の評論家、マニア系YouTuber、職人、エンジニア、趣味を仕事にする人。好きなことを仕事にできる環境で真価を発揮する。納期厳守のルーチンワークには向かない。",
  },
  "革新_狭い_参謀_慎重":      { name:"マーベリック",    desc:"群れを離れ、自分の領域で革命を起こす者",
    etymology: "英語 Maverick = 群れから離れた子牛、転じて「組織に属さない独立した個人」「一匹狼」を指す言葉。19世紀アメリカの牧場主Samuel Maverickが牛に焼印を押さなかった逸話に由来する。既存の枠組みに従わず、自分の道を行く人を表す。",
    personality: "表向きは社交的に見えるが、本質は一人で深く考える人。興味を持った一つの領域を徹底的に掘り下げ、誰も見ていない角度から本質を掴む。慎重で疑い深いが、それが独自の視点を生む源泉。組織の中でも、心は常に外側に置き、自分の基準だけで物事を判断する。",
    strengths: [
      "他人が気づかない本質を見抜く洞察力",
      "一つの領域を誰よりも深く究める集中力",
      "既存の枠組みを疑い、新しい解を生み出す独立した判断力"
    ],
    challenges: [
      "孤独を選びすぎて協力者を失いやすい",
      "完璧主義で動き出しが遅れる",
      "慎重さが「疑い深さ」に転じると人を遠ざける"
    ],
    careerFit: "研究者、専門コンサルタント、独立系エンジニア、分析家、職人気質の技術者、作家。組織にいても一人で深く考える時間が必要な役割が合う。大人数を率いるよりも、自分の専門で突き抜ける道が向いている。",
  },
  "継承_広い_リーダー_楽天":  { name:"ソブリン",          desc:"光で人を集め、伝統を継ぐカリスマ",
    etymology: "英語 Sovereign = 主権者・君主。ラテン語 superanus（上位にある）が語源。王や国家元首だけでなく「最終的な決定権を持ち、かつ人の上に立つことを許される正統な人」を指す。暴力ではなく徳と血統で統べる者の象徴。",
    personality: "人の前に立つことを自然に受け入れ、場の中心にいても気負わない人。伝統や既存の価値を守りながら、そこに新しい光を当てて時代に合わせて発展させる。明るく磊落な表の顔と、深い責任感を両立している。人を信じて任せる度量がある。",
    strengths: [
      "正統性と明るさを兼ね備えた自然な求心力",
      "古いものに新しい意味を与える再生の力",
      "人を信じて任せ、育てる余裕ある度量"
    ],
    challenges: [
      "恵まれた立場を当然と思い、地道な苦労を軽く見る",
      "人を信じすぎて裏切られるリスク",
      "格式にとらわれて身動きが鈍くなる"
    ],
    careerFit: "老舗の経営者、二代目・三代目の跡取り、王室・皇室関係者、文化財の保全リーダー、伝統産業の改革者、公的機関のトップ。正統な地位を引き継ぎ、時代に合わせて発展させる役割が合う。",
  },
  "継承_広い_リーダー_慎重":  { name:"エンペラー",        desc:"重責を担い、組織を率いる威厳の人",
    etymology: "英語 Emperor = 皇帝。ラテン語 imperator（軍の最高指揮官）が語源。複数の国・民族を束ねる最高位の統治者。ソブリンが血統の王なら、エンペラーは実力と責任で帝国を束ねる存在。威厳と孤独を兼ね備える。",
    personality: "大きな責任を引き受けることを運命と受け止める人。表に強い感情を出さず、組織の重みを一人で背負う姿に威厳が宿る。決断は遅いが一度下した判断は揺るがない。周囲は畏敬を抱きつつ、本心はなかなか読めない存在になる。",
    strengths: [
      "巨大な組織を統べる胆力と責任感",
      "感情に流されない冷静な最終判断力",
      "一度決めた方針を貫く威厳と継続力"
    ],
    challenges: [
      "孤独を抱え込み、相談できずに疲弊する",
      "部下に威圧感を与え本音を聞けなくなる",
      "決断が遅く変化のスピードに追いつけない"
    ],
    careerFit: "大企業のCEO、官僚トップ、軍・組織の司令官、大規模プロジェクトの総責任者、老舗の再建屋。人が10人以上の組織を束ねる仕事に向く。技術職や職人肌の仕事には合いにくい。",
  },
  "継承_広い_参謀_楽天":      { name:"セージ",            desc:"楽しみながら教え、人を育てる賢者",
    etymology: "英語 Sage = 賢者。ラテン語 sapiens（知恵ある者）から。単に知識がある人ではなく、「経験と洞察を柔らかく他者に伝えられる人」。ハーブの sage とも同語源で、癒しと知恵を兼ね備えた存在を表す。",
    personality: "豊富な知識と経験を持ちながら、それを威張らず楽しく伝える人。相手のレベルに合わせて話せる柔軟さがあり、周囲に自然と人が集まる。ユーモアを交えながら本質を突く言葉を残し、聞いた人の心に長く残る。教えを楽しむ人。",
    strengths: [
      "難しいことを楽しく伝える教育的センス",
      "相手に合わせて知恵を最適化する柔軟さ",
      "広く長く人を育て、影響を広げる温かさ"
    ],
    challenges: [
      "教えることが好きすぎて押し付けになる",
      "楽観的すぎて深刻な問題を軽く扱う",
      "好かれすぎて八方美人になりやすい"
    ],
    careerFit: "教育者、人材育成コンサルタント、作家、講演家、学校長、メンター。人を育てる仕事全般が合う。特に若い世代に影響を与えるポジションで力を発揮する。",
  },
  "継承_広い_参謀_慎重":      { name:"オラクル",          desc:"重みのある言葉で人を導く知の人",
    etymology: "英語 Oracle = 神託・神託を告げる者。ギリシャのデルフォイ神殿の巫女が有名。ラテン語 orare（語る・祈る）から。普段は寡黙でも、いざというとき口を開けば重みのある真実を告げる存在。",
    personality: "普段は静かで目立たないが、重要な局面で発する言葉に重みがある人。長く深く考え、軽々しく語らない分、口を開けば周囲が耳を傾ける。知識より洞察を重んじ、組織や相手の深層を読み取る能力がある。影響力は静かに広く及ぶ。",
    strengths: [
      "物事の深層を読み取る高い洞察力",
      "重要な局面で適切な一言を差し出す言葉の重み",
      "時流に流されない長期的な視座"
    ],
    challenges: [
      "寡黙すぎて周囲に存在を忘れられる",
      "語らないことで誤解され、責任を回避したと見られる",
      "重い言葉を出しすぎて場を固めてしまう"
    ],
    careerFit: "経営顧問、戦略アドバイザー、評論家、シンクタンクのフェロー、哲学者、専門分野の重鎮。若い時より中年以降に真価が出る。普段は後ろに控え、必要なときに意見を求められる立場が合う。",
  },
  "継承_狭い_リーダー_楽天":  { name:"アルチザン",        desc:"自分の道を究め、後進に伝える名工",
    etymology: "フランス語 artisan = 職人・手工芸の達人。ラテン語 ars（技術・芸術）が語源。単なる労働者ではなく、「自分の技を極め、代々伝えていく手の人」。徒弟制度の中で技を磨き、弟子に渡す系譜を含意する。",
    personality: "自分の手と経験で積み上げた技を誇りに、生涯をかけて一つの道を究める人。派手さはないが、仕事に向き合う姿勢そのものに強い説得力がある。後進を育てることに情熱を持ち、明るく気さくに教えを伝える。技と人柄の両方で慕われる。",
    strengths: [
      "生涯をかけて技を磨き続ける粘り強さ",
      "後進に惜しみなく技を伝える開かれた姿勢",
      "仕事の質で人を黙らせる確かな実力"
    ],
    challenges: [
      "自分のやり方にこだわり新しい技術を拒む",
      "大きな組織運営・経営は苦手",
      "手仕事の価値が評価されにくい環境で苦しむ"
    ],
    careerFit: "伝統工芸の職人、料理人、宮大工、パティシエ、陶芸家、楽器製作者、専門技術者の親方。徒弟制度が残る領域で活躍する。規模拡大より技の継承を優先する生き方が合う。",
  },
  "継承_狭い_リーダー_慎重":  { name:"ガーディアン",      desc:"重い使命を背負って伝統を守る守護者",
    etymology: "英語 Guardian = 守護者・後見人。古フランス語 guarde（見張り）から。単に守るだけでなく、「何かの価値あるものを、次の世代に渡すまで見守り続ける責任を負う人」。ファンタジーでは聖剣や聖域の守り人の意味でも使われる。",
    personality: "先祖から受け継いだもの、組織の伝統、大切な誰かを守ることに強い使命感を持つ人。寡黙で感情を表に出さないが、守るものへの愛は深い。危機のときに最後まで持ち場を離れない信頼感があり、組織や家族の柱として機能する。",
    strengths: [
      "守るべきものへの揺るぎない忠誠",
      "危機でも持ち場を離れない精神的タフネス",
      "長期にわたって組織の柱であり続ける信頼性"
    ],
    challenges: [
      "変化を嫌い、時代遅れのものまで守ろうとする",
      "自己犠牲が過ぎて健康や家庭を損なう",
      "寡黙さが冷たさと誤解される"
    ],
    careerFit: "警察官、自衛官、セキュリティ専門家、文化財保護、老舗の番頭、伝統組織の事務局長、神主・住職。守ることそのものが仕事の価値になる職種が合う。",
  },
  "継承_狭い_参謀_楽天":      { name:"ケアテイカー",      desc:"黙々と支え、人を育てる縁の下の力持ち",
    etymology: "英語 Caretaker = 世話をする人・管理人。take care（気にかける）から。前面に立たず、建物や人や組織の「日々の面倒を見続ける」存在。地味だが、その人がいなくなると全てが立ち行かなくなる縁の下の力持ち。",
    personality: "前に出ることを望まず、人や組織を静かに支えることに喜びを感じる人。相手の変化に細やかに気づき、必要な手を黙って差し伸べる。明るく温かい空気を保ちながら、自分の功績を主張しない。気づけば周囲から深く信頼されている。",
    strengths: [
      "相手の小さな変化に気づく細やかな観察力",
      "見返りを求めず支え続ける献身",
      "温かい空気で場を安定させる包容力"
    ],
    challenges: [
      "自分の意見や欲求を出すのが苦手",
      "尽くしすぎて搾取される関係に入りやすい",
      "過小評価され、昇進機会を逃す"
    ],
    careerFit: "看護師、介護職、秘書、人事担当、保育士、カウンセラー、マネージャー補佐、裏方のプロデューサー。支える側で真価を発揮する。前に立つ役割より、支える役割で幸せを感じる。",
  },
  "継承_狭い_参謀_慎重":      { name:"ハーミット",        desc:"世から離れ、深く一点を究める静かな賢者",
    etymology: "英語 Hermit = 隠者。ギリシャ語 erēmitēs（砂漠に住む人）が語源。初期キリスト教の修道士が荒野で祈りと思索に生きたことに由来する。転じて「世俗から離れ、自分の内面と深く向き合う人」。タロットカードの9番にも登場する象徴的な役。",
    personality: "世の中の喧騒から一歩離れた場所で、自分の内面や専門領域と深く向き合う人。人付き合いは最小限だが、接した人には誠実で深い印象を残す。長年の静かな蓄積が、ある日ふと世に出ると人々を驚かせる。時間のスケールが人と違う。",
    strengths: [
      "誰にも邪魔されず一点を深く究める集中力",
      "世俗の流行に左右されない独自の価値観",
      "長い沈黙の末に放つ重みのある成果"
    ],
    challenges: [
      "孤立が長引くと現実感覚を失う",
      "社会的な評価や成果が遅れて認められにくい",
      "人間関係の維持コストを払えず孤独死リスク"
    ],
    careerFit: "思想家、詩人、独立研究者、長期プロジェクトの専門家、修道者・宗教者、在野の学者。成果を急がされない環境、または一人で完結できる仕事が合う。組織の管理職には向かない。",
  },
};

// ==========================================================================
// 判定エンジン
// ==========================================================================

function vote(rules, d, sm, nu, ky, ma, si, jy) {
  let total = 0;
  const matched = [];
  let skipped = 0;
  for (const rule of rules) {
    try {
      if (rule.t(d, sm, nu, ky, ma, si, jy)) {
        total += rule.p;
        matched.push({ n: rule.n, p: rule.p });
      }
    } catch (e) {
      skipped++;
    }
  }
  return { total, matched, skipped };
}

function strengthLabel(plus, minus, pn, mn) {
  const diff = Math.abs(plus - minus);
  const total = plus + minus;
  if (total === 0) return { winner: pn, label: "判定不能", ambiguous: true };
  if (plus === minus) return { winner: pn, label: `両面（${pn}/${mn}）`, ambiguous: true };
  const winner = plus > minus ? pn : mn;
  const ratio = diff / total;
  if (ratio >= 0.5) return { winner, label: `絶対${winner}`, ambiguous: false };
  if (ratio >= 0.2) return { winner, label: `${winner}寄り`, ambiguous: false };
  return { winner, label: `両面（${winner}寄り）`, ambiguous: true };
}

function mkAxis(s, pos, neg, pn, mn) {
  return {
    winner: s.winner, label: s.label, ambiguous: s.ambiguous,
    plus: pos.total, minus: neg.total,
    plusEv: pos.matched, minusEv: neg.matched,
    skipped: pos.skipped + neg.skipped,
    pn, mn,
  };
}

// 修飾子用ラベル（「絶対晩成」→「晩成型」など、日本語として自然な表現に）
function modifierLabel(s, pn, mn) {
  if (s.label === "判定不能") return "判定不能";
  if (s.ambiguous && s.label.startsWith("両面")) return `${pn}・${mn}の両面`;
  if (s.label.startsWith("絶対")) return `${s.winner}型`;
  if (s.label.endsWith("寄り") && !s.label.startsWith("両面")) return `やや${s.winner}型`;
  return s.label;
}

function judge(d, sm, nu, ky, ma, si, jy) {
  const r1p = vote(A1P, d, sm, nu, ky, ma, si, jy), r1n = vote(A1N, d, sm, nu, ky, ma, si, jy);
  const r2p = vote(A2P, d, sm, nu, ky, ma, si, jy), r2n = vote(A2N, d, sm, nu, ky, ma, si, jy);
  const r3p = vote(A3P, d, sm, nu, ky, ma, si, jy), r3n = vote(A3N, d, sm, nu, ky, ma, si, jy);
  const r4p = vote(A4P, d, sm, nu, ky, ma, si, jy), r4n = vote(A4N, d, sm, nu, ky, ma, si, jy);
  const m1p = vote(M1P, d, sm, nu, ky, ma, si, jy), m1n = vote(M1N, d, sm, nu, ky, ma, si, jy);
  const m2p = vote(M2P, d, sm, nu, ky, ma, si, jy), m2n = vote(M2N, d, sm, nu, ky, ma, si, jy);

  const s1 = strengthLabel(r1p.total, r1n.total, "革新", "継承");
  const s2 = strengthLabel(r2p.total, r2n.total, "広い", "狭い");
  const s3 = strengthLabel(r3p.total, r3n.total, "リーダー", "参謀");
  const s4 = strengthLabel(r4p.total, r4n.total, "楽天", "慎重");
  const sm1 = strengthLabel(m1p.total, m1n.total, "早咲き", "晩成");
  const sm2 = strengthLabel(m2p.total, m2n.total, "直感", "論理");

  const key = [s1.winner, s2.winner, s3.winner, s4.winner].join("_");
  const type = TYPES[key] || { name: "判定不能", desc: "" };

  const a1 = mkAxis(s1, r1p, r1n, "革新", "継承");
  const a2 = mkAxis(s2, r2p, r2n, "広い", "狭い");
  const a3 = mkAxis(s3, r3p, r3n, "リーダー", "参謀");
  const a4 = mkAxis(s4, r4p, r4n, "楽天", "慎重");
  const m1 = mkAxis(sm1, m1p, m1n, "早咲き", "晩成");
  const m2 = mkAxis(sm2, m2p, m2n, "直感", "論理");
  // 修飾子は「○○型」ベースのラベルに差し替え
  m1.label = modifierLabel(sm1, "早咲き", "晩成");
  m2.label = modifierLabel(sm2, "直感", "論理");

  // 欠損データ警告＋信頼度
  const totalSkipped = [a1,a2,a3,a4,m1,m2].reduce((s, x) => s + x.skipped, 0);
  const warnings = [];
  if (totalSkipped > 10) warnings.push(`⚠ ${totalSkipped}個のルールがデータ不足でスキップされました`);
  if (!d.ascLon) warnings.push("⚠ 出生時刻不明: ASC関連の判定が無効です");
  if (!sm) warnings.push("⚠ 算命学データなし");
  if (!jy) warnings.push("⚠ インド占星術データなし");
  // 揺らぎのある軸を特定（どの軸が僅差で決まったか）
  const axisNames4 = ["価値観（変化を求める/伝統を守る）", "視野（広く見たい/深く見たい）", "役割（先頭に立つ/サポートが得意）", "気質（楽観的/慎重）"];
  const ambiguousAxes = [a1, a2, a3, a4].map((a, i) => a.ambiguous ? axisNames4[i] : null).filter(Boolean);
  if (ambiguousAxes.length > 0) {
    warnings.push(`⚠ ${ambiguousAxes.join("・")}が僅差で判定に揺らぎあり`);
  }
  const ambiguousCount = ambiguousAxes.length;
  // 時刻不明時は信頼度を最低でも「中」に格下げ（紫微命宮・ASC・月アスペクトが全て無効化されるため）
  let confidence = ambiguousCount === 0 ? "高" : ambiguousCount <= 1 ? "中" : "低";
  if (d.tm === 'unknown' && confidence === "高") confidence = "中";

  return { type, key, a1, a2, a3, a4, m1, m2, confidence, warnings };
}

// ==========================================================================
// コンソール出力フォーマット
// ==========================================================================
function fmt(r) {
  const L = [];
  L.push("═══════════════════════════════════════════════");
  L.push(`  16タイプ判定: 【${r.type.name}】`);
  L.push(`  ${r.type.desc}`);
  L.push("═══════════════════════════════════════════════");
  L.push("");
  L.push(`  タイプコード: ${r.key}`);
  L.push(`  判定信頼度: ${r.confidence}`);
  if (r.warnings.length > 0) {
    L.push("");
    r.warnings.forEach(w => L.push(`  ${w}`));
  }
  L.push("");
  L.push("─── 軸別強度 ─────────────────────────────────");

  const fa = (k, a) => {
    const tot = a.plus + a.minus;
    const bar = tot === 0 ? "────────────" : (() => {
      const pos = Math.round((a.plus / tot) * 12);
      return "━".repeat(pos) + "●" + "─".repeat(12 - pos);
    })();
    return `  ${k}  ${a.pn} ${bar} ${a.mn}    ${a.label} (${a.plus} vs ${a.minus})`;
  };

  L.push(fa("軸1", r.a1));
  L.push(fa("軸2", r.a2));
  L.push(fa("軸3", r.a3));
  L.push(fa("軸4", r.a4));
  L.push("");
  L.push("─── 修飾子 ──────────────────────────────────");
  L.push(fa("修1", r.m1));
  L.push(fa("修2", r.m2));
  L.push("");
  L.push("─── 詳細投票 ────────────────────────────────");

  const fe = a => {
    const out = [];
    out.push(`  [${a.pn}] ${a.plus}点`);
    a.plusEv.forEach(e => out.push(`    +${e.p}  ${e.n}`));
    out.push(`  [${a.mn}] ${a.minus}点`);
    a.minusEv.forEach(e => out.push(`    +${e.p}  ${e.n}`));
    if (a.skipped > 0) out.push(`  (スキップ: ${a.skipped})`);
    return out.join("\n");
  };

  L.push("【軸1: 革新 vs 継承】"); L.push(fe(r.a1)); L.push("");
  L.push("【軸2: 広い vs 狭い】"); L.push(fe(r.a2)); L.push("");
  L.push("【軸3: リーダー vs 参謀】"); L.push(fe(r.a3)); L.push("");
  L.push("【軸4: 楽天 vs 慎重】"); L.push(fe(r.a4)); L.push("");
  L.push("【修1: 早咲き vs 晩成】"); L.push(fe(r.m1)); L.push("");
  L.push("【修2: 直感 vs 論理】"); L.push(fe(r.m2));

  return L.join("\n");
}

// ==========================================================================
// HTMLから呼び出すエントリ
// ==========================================================================
function runFromHTML() {
  if (typeof currentData === 'undefined' || !currentData) {
    console.error("currentData が未設定です。先に「命盤を立てる」を実行してください。");
    return;
  }
  const d = currentData;
  const sm = (typeof calcJintai === 'function') ? calcJintai(d) : null;
  const nu = (typeof calcNumerology === 'function') ? calcNumerology(d.y, d.m, d.d) : null;
  const ky = (typeof calcKyusei === 'function') ? calcKyusei(d.y, d.m) : null;
  const ma = (typeof calcMaya === 'function') ? calcMaya(d.y, d.m, d.d) : null;
  const si = (typeof calcShukuyo === 'function') ? calcShukuyo(d.moonLon) : null;
  let jy = null;
  if (typeof ayanamsha === 'function') {
    const aya = ayanamsha(d.jd);
    jy = {
      sunRashi: Math.floor(norm360(d.sunLon - aya) / 30),
      moonRashi: Math.floor(norm360(d.moonLon - aya) / 30),
      lagnaRashi: d.ascLon !== null ? Math.floor(norm360(d.ascLon - aya) / 30) : null,
    };
  }
  const r = judge(d, sm, nu, ky, ma, si, jy);
  console.log(fmt(r));
  return r;
}

// ==========================================================================
// エクスポート
// ==========================================================================
global.TypeJudge = {
  judge, fmt, runFromHTML, TYPES,
  rules: { A1P, A1N, A2P, A2N, A3P, A3N, A4P, A4N, M1P, M1N, M2P, M2N },
};
console.log("✓ TypeJudge ロード完了。命盤を立てた後、TypeJudge.runFromHTML() を実行してください。");

})(typeof window !== 'undefined' ? window : globalThis);

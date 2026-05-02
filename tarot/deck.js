// 78枚タロットデッキ（Rider-Waite準拠の短い意味辞書）
// 画像: metabismuth/tarot-json (MIT License), RWS public domain
// 正位置/逆位置の解釈はAI解釈への入力ヒントとして使う
const DECK = [
  // ── 大アルカナ 22枚 ──
  { id:0,  arcana:"major", img:"images/m00.jpg", name:"愚者",          en:"The Fool",           up:"新しい旅立ち、自由、純粋、可能性",               rev:"無謀、迷走、決断できない、未熟" },
  { id:1,  arcana:"major", img:"images/m01.jpg", name:"魔術師",        en:"The Magician",       up:"創造、意志、始まり、スキル",                 rev:"技巧に溺れる、欺瞞、準備不足" },
  { id:2,  arcana:"major", img:"images/m02.jpg", name:"女教皇",        en:"The High Priestess", up:"直感、知恵、静寂、内なる声",                   rev:"秘密、混乱、直感の無視" },
  { id:3,  arcana:"major", img:"images/m03.jpg", name:"女帝",          en:"The Empress",        up:"豊穣、母性、愛情、創造力",                   rev:"過保護、停滞、愛情不足" },
  { id:4,  arcana:"major", img:"images/m04.jpg", name:"皇帝",          en:"The Emperor",        up:"権威、構造、父性、リーダーシップ",             rev:"独裁、硬直、支配欲" },
  { id:5,  arcana:"major", img:"images/m05.jpg", name:"教皇",          en:"The Hierophant",     up:"伝統、教え、信頼、共同体",                   rev:"固定観念、反抗、孤立" },
  { id:6,  arcana:"major", img:"images/m06.jpg", name:"恋人",          en:"The Lovers",         up:"愛、調和、選択、絆",                         rev:"不一致、優柔不断、誘惑" },
  { id:7,  arcana:"major", img:"images/m07.jpg", name:"戦車",          en:"The Chariot",        up:"勝利、意志、前進、制御",                     rev:"暴走、方向喪失、焦り" },
  { id:8,  arcana:"major", img:"images/m08.jpg", name:"力",            en:"Strength",           up:"内なる力、勇気、優しさ、忍耐",                 rev:"自信喪失、衝動、弱さ" },
  { id:9,  arcana:"major", img:"images/m09.jpg", name:"隠者",          en:"The Hermit",         up:"内省、知恵、孤独、導き",                     rev:"孤立、頑固、閉鎖" },
  { id:10, arcana:"major", img:"images/m10.jpg", name:"運命の輪",      en:"Wheel of Fortune",   up:"転機、運命、変化、循環",                     rev:"停滞、悪循環、不運" },
  { id:11, arcana:"major", img:"images/m11.jpg", name:"正義",          en:"Justice",            up:"公正、バランス、因果、真実",                   rev:"不公平、偏見、責任回避" },
  { id:12, arcana:"major", img:"images/m12.jpg", name:"吊るされた男",  en:"The Hanged Man",     up:"視点転換、受容、犠牲、停滞の意味",             rev:"無益な犠牲、停滞、見失い" },
  { id:13, arcana:"major", img:"images/m13.jpg", name:"死神",          en:"Death",              up:"終わりと始まり、変容、解放",                   rev:"抵抗、執着、停滞" },
  { id:14, arcana:"major", img:"images/m14.jpg", name:"節制",          en:"Temperance",         up:"調和、節度、癒し、統合",                     rev:"不調和、過剰、焦燥" },
  { id:15, arcana:"major", img:"images/m15.jpg", name:"悪魔",          en:"The Devil",          up:"執着、誘惑、物質、束縛",                     rev:"解放、気づき、断ち切り" },
  { id:16, arcana:"major", img:"images/m16.jpg", name:"塔",            en:"The Tower",          up:"突然の変化、崩壊、啓示、解放",                 rev:"回避、遅延した崩壊、恐怖" },
  { id:17, arcana:"major", img:"images/m17.jpg", name:"星",            en:"The Star",           up:"希望、癒し、インスピレーション、平穏",         rev:"失望、自信喪失、悲観" },
  { id:18, arcana:"major", img:"images/m18.jpg", name:"月",            en:"The Moon",           up:"不安、幻想、直感、秘密",                     rev:"真実の露見、不安解消、混乱の終息" },
  { id:19, arcana:"major", img:"images/m19.jpg", name:"太陽",          en:"The Sun",            up:"成功、喜び、生命力、純真",                   rev:"一時的な曇り、過信、遅延" },
  { id:20, arcana:"major", img:"images/m20.jpg", name:"審判",          en:"Judgement",          up:"復活、目覚め、決断、赦し",                   rev:"自己批判、後悔、決断の先送り" },
  { id:21, arcana:"major", img:"images/m21.jpg", name:"世界",          en:"The World",          up:"完成、統合、達成、旅の終わり",                 rev:"未完成、停滞、最後の一歩不足" },
];

// 小アルカナのスート情報
const SUITS = [
  { key:"wands",    prefix:"w", name:"ワンド",    element:"火", theme:"情熱・行動・創造" },
  { key:"cups",     prefix:"c", name:"カップ",    element:"水", theme:"感情・愛・関係" },
  { key:"swords",   prefix:"s", name:"ソード",    element:"風", theme:"思考・言葉・葛藤" },
  { key:"pentacles",prefix:"p", name:"ペンタクル",element:"土", theme:"物質・仕事・お金" },
];

// 数札1-10の基本意味（スート共通の骨格）
const PIP_MEANINGS = {
  wands: {
    1:  { up:"新しい情熱、インスピレーション", rev:"始まりの遅れ、やる気の低下" },
    2:  { up:"計画、選択、将来のビジョン",     rev:"迷い、計画の頓挫" },
    3:  { up:"拡大、見通し、成果の兆し",       rev:"遅延、視野狭窄" },
    4:  { up:"祝祭、安定、家庭の喜び",         rev:"移行期、不安定" },
    5:  { up:"競争、衝突、切磋琢磨",           rev:"衝突の回避、内部分裂" },
    6:  { up:"勝利、栄誉、承認",               rev:"挫折、承認不足" },
    7:  { up:"防衛、挑戦への対処",             rev:"圧倒、諦め" },
    8:  { up:"迅速、進展、メッセージ",         rev:"遅延、停滞" },
    9:  { up:"忍耐、最後の守り",               rev:"疲弊、防衛の限界" },
    10: { up:"重責、負担、達成の代償",         rev:"重荷を降ろす、解放" },
  },
  cups: {
    1:  { up:"新しい愛、感情の溢れ、受容",     rev:"感情の空虚、愛の停滞" },
    2:  { up:"結合、パートナーシップ、共感",   rev:"不調和、別れ" },
    3:  { up:"祝祭、友情、喜びの共有",         rev:"過剰、孤立、三角関係" },
    4:  { up:"倦怠、内省、機会の見落とし",     rev:"再始動、目覚め" },
    5:  { up:"喪失、後悔、悲しみ",             rev:"回復、残るものへの気づき" },
    6:  { up:"ノスタルジア、純粋、再会",       rev:"過去への執着、現実逃避" },
    7:  { up:"選択肢、幻想、夢想",             rev:"明晰、決断" },
    8:  { up:"立ち去る、諦め、より深い探求",   rev:"躊躇、引き返す" },
    9:  { up:"願望成就、満足、幸福",           rev:"表面的満足、過信" },
    10: { up:"家族の幸福、感情の完成",         rev:"家庭不和、理想と現実のズレ" },
  },
  swords: {
    1:  { up:"明晰、決断、突破口",             rev:"混乱、判断ミス" },
    2:  { up:"均衡、保留、難しい選択",         rev:"決断、行き詰まりの打破" },
    3:  { up:"悲しみ、失恋、痛み",             rev:"癒し、回復の兆し" },
    4:  { up:"休息、回復、沈黙",               rev:"目覚め、再起動" },
    5:  { up:"対立、勝利のコスト、傲慢",       rev:"和解、撤退" },
    6:  { up:"移行、穏やかな転換、旅立ち",     rev:"停滞、去れない" },
    7:  { up:"策略、裏工作、分離",             rev:"良心、戻ってくる" },
    8:  { up:"束縛、自己制限、行き詰まり",     rev:"解放、気づき" },
    9:  { up:"不安、悪夢、心配",               rev:"不安からの解放、対処" },
    10: { up:"終焉、背負いすぎ、終わり",       rev:"回復、底を打った転換" },
  },
  pentacles: {
    1:  { up:"新しい機会、物質的始まり、実り", rev:"機会の損失、浪費" },
    2:  { up:"バランス、柔軟性、やりくり",     rev:"不均衡、優先順位の混乱" },
    3:  { up:"協働、専門性、建設",             rev:"連携不足、質の低下" },
    4:  { up:"保守、所有、安全への執着",       rev:"手放し、柔軟化" },
    5:  { up:"困窮、孤立、不安",               rev:"回復、援助の発見" },
    6:  { up:"分かち合い、支援、公正",         rev:"不均衡な与え、依存" },
    7:  { up:"評価、忍耐、長期投資",           rev:"焦り、収穫の遅延" },
    8:  { up:"鍛錬、職人気質、集中",           rev:"マンネリ、品質低下" },
    9:  { up:"自立、豊かさ、洗練",             rev:"依存、物質への執着" },
    10: { up:"遺産、家族の繁栄、基盤",         rev:"財産問題、伝統への疑問" },
  },
};

// コートカード（宮廷札）の人物像
const COURT_CARDS = [
  { rank:"page",   name:"ペイジ",   rankJa:"ペイジ",   trait:"学び始め・若さ・メッセンジャー" },
  { rank:"knight", name:"ナイト",   rankJa:"ナイト",   trait:"行動・情熱・追求" },
  { rank:"queen",  name:"クイーン", rankJa:"クイーン", trait:"成熟・受容・育む力" },
  { rank:"king",   name:"キング",   rankJa:"キング",   trait:"完成・統制・リーダーシップ" },
];

// 78枚フルデッキを生成
function buildFullDeck() {
  const deck = [...DECK];
  let id = 22;
  for (const suit of SUITS) {
    // 数札 1-10
    for (let n = 1; n <= 10; n++) {
      const numName = ["エース","2","3","4","5","6","7","8","9","10"][n-1];
      const pip = PIP_MEANINGS[suit.key][n];
      deck.push({
        id: id++,
        arcana: "minor",
        suit: suit.key,
        rank: String(n),
        img: `images/${suit.prefix}${String(n).padStart(2,"0")}.jpg`,
        name: `${suit.name}の${numName}`,
        en: `${numName==="エース"?"Ace":n} of ${suit.key}`,
        up: pip.up,
        rev: pip.rev,
      });
    }
    // コート（ペイジ=11, ナイト=12, クイーン=13, キング=14）
    COURT_CARDS.forEach((court, ci) => {
      const courtNum = 11 + ci;
      deck.push({
        id: id++,
        arcana: "minor",
        suit: suit.key,
        rank: court.rank,
        img: `images/${suit.prefix}${courtNum}.jpg`,
        name: `${suit.name}の${court.rankJa}`,
        en: `${court.name} of ${suit.key}`,
        up: `${suit.theme}を体現する${court.trait}`,
        rev: `${court.trait}が歪む・発揮できない・過剰`,
      });
    });
  }
  return deck;
}

const TAROT_DECK = buildFullDeck(); // 78枚

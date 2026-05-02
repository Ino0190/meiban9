// タロット儀式層：シャッフル・カット・展開
// 原則：この層は悩みテキストを一切受け取らない。乱数のみで動く。

// CSPRNG による安全なランダム整数 [0, max)
function rand(max) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

// Fisher-Yates シャッフル
function shuffleDeck(deck) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 正逆ランダム付与（50%で逆位置）
function assignReversal(deck) {
  return deck.map(card => ({
    ...card,
    reversed: rand(2) === 1,
  }));
}

// ユーザーのマウス/タッチ座標をエントロピー源として蓄積
// （儀式性の演出＋追加の予測不可能性）
const entropyPool = {
  samples: [],
  add(x, y) {
    this.samples.push(x ^ y ^ performance.now());
    if (this.samples.length > 256) this.samples.shift();
  },
  mix(deck) {
    if (this.samples.length === 0) return deck;
    // エントロピーを種にもう一度軽くシャッフル
    const a = deck.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const s = this.samples[i % this.samples.length] ^ rand(0xffffffff);
      const j = Math.abs(s) % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  reset() { this.samples = []; }
};

// カット：山を指定位置で分割して再結合
function cutDeck(deck, position) {
  return [...deck.slice(position), ...deck.slice(0, position)];
}

// スプレッド定義
const SPREADS = {
  one: {
    name: "ワンオラクル",
    count: 1,
    positions: [{ label: "メッセージ", desc: "今このタイミングに必要な気づき" }],
  },
  three: {
    name: "スリーカード",
    count: 3,
    positions: [
      { label: "過去",   desc: "この問いの背景にあるもの" },
      { label: "現在",   desc: "今の状況・心の状態" },
      { label: "未来",   desc: "このまま進んだ先" },
    ],
  },
  yesno: {
    name: "二者択一",
    count: 2,
    positions: [
      { label: "選択肢A", desc: "こちらを選んだ場合" },
      { label: "選択肢B", desc: "こちらを選んだ場合" },
    ],
  },
  cross: {
    name: "ケルト十字",
    count: 10,
    positions: [
      { label: "現状",       desc: "今の核となる状況" },
      { label: "障害",       desc: "立ちはだかるもの" },
      { label: "顕在意識",   desc: "自覚している思い" },
      { label: "潜在意識",   desc: "無意識に抱えているもの" },
      { label: "過去",       desc: "ここに至った流れ" },
      { label: "近い未来",   desc: "次に起こること" },
      { label: "自分自身",   desc: "あなたの姿勢" },
      { label: "周囲の影響", desc: "環境・他者の影響" },
      { label: "希望と恐れ", desc: "内面の葛藤" },
      { label: "最終結果",   desc: "行き着く先" },
    ],
  },
};

// 引く：シャッフル→カット→上からcount枚展開
function drawCards(deckSource, spreadKey) {
  const spread = SPREADS[spreadKey];
  if (!spread) throw new Error(`Unknown spread: ${spreadKey}`);

  let deck = shuffleDeck(deckSource);
  deck = entropyPool.mix(deck);
  const cutPos = rand(deck.length);
  deck = cutDeck(deck, cutPos);
  deck = assignReversal(deck);

  const drawn = deck.slice(0, spread.count).map((card, i) => ({
    ...card,
    position: spread.positions[i],
  }));

  return {
    spread: spread.name,
    spreadKey,
    cards: drawn,
    meta: {
      cutAt: cutPos,
      entropySamples: entropyPool.samples.length,
      drawnAt: new Date().toISOString(),
    },
  };
}

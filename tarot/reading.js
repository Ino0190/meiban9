// 読み手層：確定済みの悩みテキスト＋カード配列を受け取り、解釈を返す
// MVP段階では辞書ベースの素朴な読みと、AI解釈用のプロンプト生成の両方を提供

// 辞書ベースの素朴解釈（Bedrock接続前のフォールバック）
function interpretLocal(reading, question) {
  const lines = [];
  lines.push(`【ご相談】\n${question || "（相談内容なし）"}`);
  lines.push("");
  lines.push(`【スプレッド】${reading.spread}（${reading.cards.length}枚）`);
  lines.push("");

  reading.cards.forEach((card, i) => {
    const posName = card.position?.label || `${i+1}枚目`;
    const posDesc = card.position?.desc || "";
    const meaning = card.reversed ? card.rev : card.up;
    const orient = card.reversed ? "逆位置" : "正位置";
    lines.push(`${i+1}. ${posName}：${card.name}（${orient}）`);
    lines.push(`   ${posDesc}`);
    lines.push(`   → ${meaning}`);
    lines.push("");
  });

  lines.push("【総合】");
  const majorCount = reading.cards.filter(c => c.arcana === "major").length;
  const reversedCount = reading.cards.filter(c => c.reversed).length;
  if (majorCount >= reading.cards.length / 2) {
    lines.push("大アルカナが多く、人生の節目・大きなテーマが動いています。");
  }
  if (reversedCount >= reading.cards.length / 2) {
    lines.push("逆位置が多く、内省や停滞、見直しが求められる局面です。");
  }
  const suits = {};
  reading.cards.forEach(c => { if (c.suit) suits[c.suit] = (suits[c.suit]||0)+1; });
  const suitMax = Object.entries(suits).sort((a,b)=>b[1]-a[1])[0];
  if (suitMax && suitMax[1] >= 2) {
    const themes = {
      wands: "情熱と行動", cups: "感情と関係", swords: "思考と葛藤", pentacles: "物質と実務"
    };
    lines.push(`「${themes[suitMax[0]]}」の領域が全体を通じてハイライトされています。`);
  }

  return lines.join("\n");
}

// AI解釈用プロンプト生成（Kiroやその他LLMにそのまま貼れる形式）
function buildAIPrompt(reading, question) {
  const lines = [];
  lines.push("あなたは経験豊富なタロットリーダーです。以下のカード配列を、相談者の問いに寄り添って読んでください。");
  lines.push("");

  // 九命盤サマリーがあれば含める（localStorage or URLパラメータ）
  try {
    let raw = localStorage.getItem("meiban_summary");
    if (!raw) {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("meiban");
      if (fromUrl) { raw = decodeURIComponent(fromUrl); localStorage.setItem("meiban_summary", raw); }
    }
    if (raw) {
      const mb = JSON.parse(raw);
      lines.push("【相談者の九命盤（この人の土台）】");
      lines.push(mb.text);
      lines.push("※ この命盤情報を踏まえてカードを読んでください。同じカードでも、この人の性格・現在の時期によって意味が変わります。");
      lines.push("");
    }
  } catch(e) {}

  lines.push("【相談内容】");
  lines.push(question || "（相談内容の記入なし。カードが示すメッセージをそのまま読んでください）");
  lines.push("");
  lines.push(`【展開】${reading.spread}`);
  lines.push("");
  lines.push("【引かれたカード】");
  reading.cards.forEach((card, i) => {
    const posName = card.position?.label || `${i+1}枚目`;
    const posDesc = card.position?.desc || "";
    const orient = card.reversed ? "逆位置" : "正位置";
    lines.push(`${i+1}. ${posName}（${posDesc}）：${card.name}／${orient}`);
    lines.push(`   （辞書的意味：${card.reversed ? card.rev : card.up}）`);
  });
  lines.push("");
  lines.push("【お願い】");
  lines.push("1. 各カードをポジションの文脈で個別に読んでください");
  lines.push("2. カード同士の関係性（補完・対立・流れ）を読み解いてください");
  lines.push("3. 九命盤の情報がある場合は、カードの解釈にその人の性格・時期を反映させてください");
  lines.push("4. 相談内容に対する総合的なメッセージで締めてください");
  lines.push("5. 占いの口調で、温かくも率直に。曖昧な慰めより具体的な気づきを。");
  return lines.join("\n");
}

// 監査用：シャッフル〜展開の結果をJSONで出力
// 本物の占い師と同じ順番：カードが先に引かれ、その後で悩みが入力される
// cardsDrawnAt と questionEnteredAt の時系列が、カードが悩みに影響されないことの技術的証明
function exportAuditLog(reading, question) {
  return JSON.stringify({
    _note: "cardsDrawnAt は悩みが入力される前の時刻。カードが質問に影響されないことの証明。",
    cardsDrawnAt: reading.meta.cardsDrawnAt || reading.meta.drawnAt,
    questionEnteredAt: reading.meta.questionEnteredAt || null,
    spread: reading.spread,
    cards: reading.cards.map(c => ({
      position: c.position?.label,
      name: c.name,
      reversed: c.reversed,
    })),
    question,
    meta: reading.meta,
  }, null, 2);
}

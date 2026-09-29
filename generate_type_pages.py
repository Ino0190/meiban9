#!/usr/bin/env python3
"""16タイプの紹介ページ（SNSで共有されたときにそのタイプの絵が出る）と、共有用の画像を作る

出力
  type/<英名>.html    … OGP（題名・説明・画像）を持つ静的ページ。開いた人は index.html#type=<英名>（16タイプ図鑑）へ移る
  type/og/<英名>.jpg  … SNS用の画像 1200×630
タイプの名前・一言・矛盾は type-judge.js の TYPES から読む（node で読み込む）。タイプの文を直したら作り直す。
"""
import json, subprocess, html
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
SITE = "https://rasenban.com"
FONT = "/System/Library/Fonts/ヒラギノ明朝 ProN.ttc"
IMG = {"ヒーロー": "Hero", "レボリューショナリー": "Revolutionary", "トリックスター": "Trickster", "ヴィジョナリー": "Visionary",
       "パイオニア": "Pioneer", "ローンウルフ": "Lonewolf", "シーカー": "Seeker", "マーベリック": "Maverick",
       "ソブリン": "Sovereign", "エンペラー": "Emperor", "セージ": "Sage", "オラクル": "Oracle",
       "アルチザン": "Artisan", "ガーディアン": "Guardian", "ケアテイカー": "Caretaker", "ハーミット": "Hermit"}

JS = r"""
const vm = require('vm'), fs = require('fs');
const ctx = { console: { log() {}, warn() {} } }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('type-judge.js', 'utf8'), ctx);
const T = ctx.TypeJudge.TYPES;
console.info(JSON.stringify(Object.keys(T).map(k => ({ key: k, name: T[k].name, desc: T[k].desc, paradox: T[k].paradox || '' }))));
"""

def load_types():
    out = subprocess.run(["node", "-e", JS.replace("console.info", "process.stdout.write")], cwd=HERE, capture_output=True, text=True, check=True).stdout
    return json.loads(out)

def font(size, bold=False):
    return ImageFont.truetype(FONT, size, index=1 if bold else 0)

def wrap(draw, text, f, width):
    lines, line = [], ""
    for ch in text:
        if draw.textlength(line + ch, font=f) > width:
            lines.append(line); line = ch
        else:
            line += ch
    if line:
        lines.append(line)
    return lines

def og_image(t, slug, dst):
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), (26, 18, 8))
    d = ImageDraw.Draw(im)
    card = Image.open(HERE / f"16typecard/web/0{IMG[t['name']]}01-L.webp").convert("RGB")
    ch = H - 60
    cw = round(card.width * ch / card.height)
    im.paste(card.resize((cw, ch), Image.LANCZOS), (30, 30))
    d.rectangle([24, 24, 30 + cw + 5, 30 + ch + 5], outline=(201, 147, 58), width=4)
    gold, light = (201, 147, 58), (230, 220, 200)
    x, w = 30 + cw + 50, W - (30 + cw + 50) - 50
    d.text((x, 70), "羅占盤の16タイプ", font=font(28), fill=gold)
    size = 76   # 長い名前（レボリューショナリーなど）は枠に収まるまで小さくする
    while d.textlength(t["name"], font=font(size, True)) > w and size > 40:
        size -= 2
    d.text((x, 116 + (76 - size) // 2), t["name"], font=font(size, True), fill=gold)
    y = 230
    for line in wrap(d, t["desc"], font(34, True), w):
        d.text((x, y), line, font=font(34, True), fill=light); y += 50
    y += 14
    d.line([x, y, x + w, y], fill=(120, 95, 40), width=2)
    y += 26
    for line in wrap(d, t["paradox"], font(28), w)[:3]:
        d.text((x, y), line, font=font(28), fill=light); y += 42
    d.text((x, H - 96), "あなたは何タイプ？", font=font(30, True), fill=gold)
    d.text((x, H - 56), "9つの占術で占う｜rasenban.com", font=font(24), fill=(200, 180, 140))
    im.save(dst, "JPEG", quality=86, optimize=True, progressive=True)

PAGE = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{name}｜羅占盤の16タイプ</title>
<meta name="description" content="{desc}。{paradox} あなたは何タイプ？ 9つの占術で占う。">
<link rel="canonical" href="{site}/type/{slug}.html">
<meta property="og:title" content="{name}｜羅占盤の16タイプ">
<meta property="og:description" content="{desc}。{paradox} あなたは何タイプ？ 9つの占術で占う。">
<meta property="og:url" content="{site}/type/{slug}.html">
<meta property="og:type" content="article">
<meta property="og:image" content="{site}/type/og/{slug}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="羅占盤">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{name}｜羅占盤の16タイプ">
<meta name="twitter:description" content="{desc}。あなたは何タイプ？">
<meta name="twitter:image" content="{site}/type/og/{slug}.jpg">
<link rel="icon" href="../icons/favicon.ico" sizes="any">
<script>location.replace("../index.html#type={slug}");</script>
<style>
body{{margin:0;background:#faf8f4;color:#2c2418;font-family:"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif;text-align:center;padding:32px 16px}}
img{{width:240px;max-width:70%;border-radius:8px}}
h1{{font-size:32px;color:#8b6914;margin:16px 0 4px}}
p{{font-size:16px;line-height:1.8;max-width:640px;margin:8px auto}}
a{{display:inline-block;margin-top:16px;padding:12px 28px;background:#8b6914;color:#fff;border-radius:6px;text-decoration:none;font-size:16px;font-weight:700}}
</style>
</head>
<body>
<img src="../16typecard/web/0{img}01.webp" alt="{name}">
<h1>{name}</h1>
<p><b>{desc}</b></p>
<p>{paradox}</p>
<a href="../index.html#type={slug}">羅占盤で{name}を見る・自分のタイプを占う</a>
</body>
</html>
"""

def main():
    types = load_types()
    (HERE / "type/og").mkdir(parents=True, exist_ok=True)
    for t in types:
        slug = IMG[t["name"]].lower()
        og_image(t, slug, HERE / f"type/og/{slug}.jpg")
        e = {k: html.escape(v, quote=True) for k, v in t.items()}
        (HERE / f"type/{slug}.html").write_text(PAGE.format(site=SITE, slug=slug, img=IMG[t["name"]], **e), encoding="utf-8")
        print(slug, t["name"])

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""ランダムな誕生日・時刻・性別・出生地で、アプリの計算を別に計算し直して突き合わせる  python3 _check_random.py [人数]

_check.py（決まった14人＋毎日の正午）で見ていない所を見る。参照は _check.py と同じく、アプリのプログラムを使わず
暦の決まりと Swiss Ephemeris から Python で出す（出生地の緯度経度だけはアプリの表を入力として借りる）。
参照の計算（四柱・旧暦・紫微など）は _check.py のものを import して使う。なので _check.py とこのファイルは
「2本の独立した検算」ではなく「1つの検算を、決まった人とランダムな人で回すもの」（2026-10-20 独立監査の指摘）。
  天体10個・ASC・MC・ハウス（出生地の緯度経度）・四柱（時柱まで）・ナクシャトラ
  四柱の大運（向き・始まる年齢・干支）
  紫微斗数（14主星と副星10個の宮・四化の星・大限の向き・年齢・干）
  インドのダシャー（最初の星・残りの年数・続く星と区切りの年齢）
  九星の方位の吉凶（本命星×年）
  数秘（ライフパス・バースデー・パーソナルイヤー・ピナクルとチャレンジ・第1期の終わり）
  宿曜の相性（27通りの距離の関係名と近・中・遠、向き＝あなたから見た相手・相手から見たあなた）
  相性総合（2人を入れ替えて同じ点・9占術が1行ずつ・四柱の干合・紫微は2人とも時刻ありのときだけ）
"""
import sys, random, datetime as dt
from collections import defaultdict
import swisseph as swe
from playwright.sync_api import sync_playwright
import _check as C

N = int(sys.argv[1]) if len(sys.argv) > 1 else 300
R = random.Random(20261020)
# 九星の「今年」（立春＝太陽黄経315°で切り替え）。今の日本時間の太陽の位置から出す（アプリの kyuseiNowYear は使わない）
_now = dt.datetime.now(dt.timezone(dt.timedelta(hours=9)))
_s = C.lon(C.jd_ut(_now.year, _now.month, _now.day, _now.hour, _now.minute), swe.SUN)
KY_NOW = _now.year - 1 if (_now.month <= 2 and 200 < _s < 315) else _now.year
STEMS, BR = C.STEMS, C.BRANCHES
DASHA = [("ケートゥ", 7), ("金星", 20), ("太陽", 6), ("月", 10), ("火星", 7), ("ラーフ", 18), ("木星", 16), ("土星", 19), ("水星", 17)]
SIHUA = {"甲": "廉貞 破軍 武曲 太陽", "乙": "天機 天梁 紫微 太陰", "丙": "天同 天機 文昌 廉貞", "丁": "太陰 天同 天機 巨門", "戊": "貪狼 太陰 右弼 天機",
         "己": "武曲 貪狼 天梁 文曲", "庚": "太陽 武曲 太陰 天同", "辛": "巨門 太陽 文曲 文昌", "壬": "天梁 紫微 左輔 武曲", "癸": "破軍 巨門 太陰 貪狼"}
KY_DIR = {1: "北", 2: "南西", 3: "東", 4: "南東", 6: "北西", 7: "西", 8: "北東", 9: "南"}
KY_OPP = {1: 9, 9: 1, 2: 8, 8: 2, 3: 7, 7: 3, 4: 6, 6: 4}
KY_EL = {1: "水", 2: "土", 3: "木", 4: "木", 5: "土", 6: "金", 7: "金", 8: "土", 9: "火"}
GEN = {"木": "火", "火": "土", "土": "金", "金": "水", "水": "木"}

def person():
    t = R.random() < 0.75
    h, mi = (R.randint(0, 23), R.randint(0, 59)) if t else (12, 0)
    y, m = R.randint(1950, 2012), R.randint(1, 12)
    d = R.randint(1, [31, 29 if y % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
    return {"bd": f"{y}-{m:02d}-{d:02d}", "bt": f"{h:02d}:{mi:02d}" if t else "", "sex": R.choice("MF"), "bp": R.choice(["東京都", "北海道", "沖縄県", "徳島県", "大阪府", "宮城県"]) if t else ""}

APP_JS = r"""(c) => {
  window._quietRender = true;
  const d = calcPersonData(c.bd, c.bt, c.bt ? 'known' : 'unknown', c.sex, c.bp); currentData = d; dataB = null; currentMode = 'self'; renderAll();
  const txt = i => { const el = document.getElementById('tab' + i); const h = el.classList.contains('hide'); el.classList.remove('hide'); const s = el.innerText; if (h) el.classList.add('hide'); return s; };
  const t4 = txt(4), t3 = txt(3), t5 = txt(5);
  setConsultCategory('decision'); const tdec = txt(10);
  const star = {}; Object.entries(d.ziweiDistrib).forEach(([b, ss]) => ss.forEach(s => { star[s] = +b; }));
  const ds = calcDasha(norm360(d.moonLon - ayanamsha(d.jd)), d.y);
  const nu = calcNumerology(d.y, d.m, d.d), ky = calcKyusei(d.y, d.m, d);
  const dir = [2026, 2027, 1990 + (d.d * 7) % 40].map(Y => { const r = kyuseiDirections(ky.honmei, Y); return { Y, best: r.best.map(x => x.dir).sort(), good: r.good.map(x => x.dir).sort(), bad: r.bad.map(x => x.dir + ':' + x.reasons.slice().sort().join('+')).sort() }; });
  return {
    pil: d.pillars.map(p => p.stem + p.branch), planets: d.planets.map(p => p.lon), asc: d.ascLon, mc: d.mcLon, houses: d.houses, lat: (BIRTHPLACES[d.bp] || {}).lat, lon: (BIRTHPLACES[d.bp] || {}).lon,
    dayun: calcDayun(d).map(x => [x.stem + x.branch, x.startAge]),
    zw: { life: d.lifeIdx, ju: d.ziweiJu, star, sihua: d.sihua.map(s => s.type + s.star), dx: calcZiweiDayun(d, d.lifeIdx).map(x => [x.branchIdx, x.startAge, x.stem]) },
    dasha: { nak: ds.nakshatraIdx, list: ds.dashas.slice(0, 5).map(x => [x.lord, x.startAge, x.endAge]) },
    nu: { lp: nu.lifePath, bd: nu.birthday, py: nu.personalYear, year: nu.currentYear,
      pin: [...t4.matchAll(/ピナクル(\d+)/g)].map(m => +m[1]).slice(0, 4), ch: [...t4.matchAll(/チャレンジ(\d+)：/g)].map(m => +m[1]).slice(0, 4), e1: +((t4.match(/0〜(\d+)歳/) || [])[1] || -1) },
    honmei: ky.honmei, getsu: ky.getsu, dir,
    tenchu: { name: (t3.match(/(\S\S)天中殺/) || [])[1] || '', years: [...((t3.split('天中殺が巡ってくる年')[1] || '').slice(0, 260).matchAll(/(\d{4})年/g))].map(m => +m[1]) },
    keisha: (t5.match(/傾斜宮 — (\S+?宮)傾斜/) || [])[1] || '',
    kaiza: { flow: [...t5.matchAll(/(\d{4})年：(\S+?宮)/g)].map(m => [+m[1], m[2]]), today: (t5.match(/今年の運勢 — \S+は(\S+?宮)/) || [])[1] || '',
      dec: (tdec.match(/は今年(\S+?宮)/) || [])[1] || '', year: new Date().getFullYear() },
  };
}"""
PAIR_JS = r"""(c) => {
  window._quietRender = true;
  currentData = calcPersonData(c[0].bd, c[0].bt, c[0].bt ? 'known' : 'unknown', c[0].sex, c[0].bp);
  dataB = calcPersonData(c[1].bd, c[1].bt, c[1].bt ? 'known' : 'unknown', c[1].sex, c[1].bp); dataB.relType = 'love'; currentMode = 'compat'; renderAll();
  const txt = i => { const el = document.getElementById('tab' + i); el.classList.remove('hide'); const s = el.innerText; el.classList.add('hide'); return s; };
  const row = (t, label) => { const m = t.match(new RegExp('^' + label + '\\t([^\\t\\n]*)\\t?([^\\t\\n]*)', 'm')); return m ? [m[1], m[2]] : null; };
  const t0 = txt(0), t1 = txt(1), t2 = txt(2), t3 = txt(3), t5 = txt(5), t6 = txt(6), t7 = txt(7), t8 = txt(8);
  return {
    sun: row(t0, '太陽（価値観）'), wx: row(t1, '五行関係'), zwRow: row(t2, '命宮主星'),
    zwB: (t2.match(/（命宮主星: (\S+?)）/) || [])[1], spouse: (t2.match(/あなたの夫妻宮: (.+?)。お相手の夫妻宮: (.+?)。/) || []).slice(1),
    tenchu: row(t3, '天中殺'), ky: row(t5, '本命星'), kyNote: (t5.match(/^→ (.+)$/m) || [])[1] || '',
    maya: (t6.match(/紋章の関係（(.+?)）/) || [])[1] || '', shuku: row(t7, '宿'),
    moon: row(t8, '月ラーシ'), moonCard: ((t8.split('月のラーシの関係')[1] || '').trim().split('\n')[0] || ''),
  };
}"""
RULE_JS = r"""() => [...Array(27).keys()].map(k => { const r = shukuyoCompat(0, k); return [k, r.pair || r.type, r.band || '', r.seen, r.type]; })"""
# 相性総合：2人を入れ替えても同じ点か（行ごと・合計）。行の名前と、四柱の行の点も返す
SYM_JS = r"""(c) => { const P = x => calcPersonData(x.bd, x.bt, x.bt ? 'known' : 'unknown', x.sex, x.bp);
  const a = P(c[0]), b = P(c[1]), s1 = compatScore(a, b), s2 = compatScore(b, a);
  return { t: [s1.total, s2.total], rows: s1.rows.map((r, i) => [r.name, r.score, s2.rows[i].score, r.used, s2.rows[i].used]) }; }"""

# ─────────────── 参照計算（_check.py にない分） ───────────────
def sun_cross(target, jd0, step):
    """jd0 から step（+1 未来／-1 過去）の向きに、太陽黄経が target を通る瞬間"""
    t = jd0
    for _ in range(40):                      # 1日ずつ進めて通り過ぎたところを探す
        a, b = C.lon(t, swe.SUN), C.lon(t + step, swe.SUN)
        da, db = (target - a + 540) % 360 - 180, (target - b + 540) % 360 - 180
        if (da >= 0) != (db >= 0) and abs(da - db) < 180:
            break
        t += step
    lo, hi = t, t + step
    for _ in range(50):
        mid = (lo + hi) / 2
        if ((target - C.lon(lo, swe.SUN) + 540) % 360 - 180 >= 0) == ((target - C.lon(mid, swe.SUN) + 540) % 360 - 180 >= 0):
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2

def ref_dayun(jd, year_pillar, month_pillar, sex):
    yang = STEMS.index(year_pillar[0]) % 2 == 0
    fwd = (sex == "M" and yang) or (sex == "F" and not yang)
    s = C.lon(jd, swe.SUN)
    k = (s - 15) % 30                         # 節（立春315°など 15°+30°n）からの角度
    target = (s - k) % 360 if not fwd else (s - k + 30) % 360
    t = sun_cross(target, jd, 1 if fwd else -1)
    exact = abs(jd - t) / 3
    ms, mb = STEMS.index(month_pillar[0]), BR.index(month_pillar[1])
    st = 1 if fwd else -1
    seq = [STEMS[(ms + st * (i + 1)) % 10] + BR[(mb + st * (i + 1)) % 12] for i in range(8)]
    return fwd, exact, seq

def ref_ziwei_full(date, h, sex):
    # 23時台は翌日の旧暦の日（アプリの既定＝23時の流派）。ref_ziwei は元の日付を受け取り、中で同じように翌日にする
    M, D, leap, _, ly = C.lunar_date(C.ziwei_date(date, h))
    H = 0 if (h >= 23 or h < 1) else (h + 1) // 2
    zw = C.ref_ziwei(date, h)
    life, z = BR.index(zw["命宮"]), BR.index(zw["紫微星"])
    ys, yb = (ly - 4) % 10, (ly - 4) % 12
    m12 = lambda x: x % 12
    star = {"紫微": z, "天機": m12(z - 1), "太陽": m12(z - 3), "武曲": m12(z - 4), "天同": m12(z - 5), "廉貞": m12(z - 8)}
    f = m12(4 - z)
    for name, off in (("天府", 0), ("太陰", 1), ("貪狼", 2), ("巨門", 3), ("天相", 4), ("天梁", 5), ("七殺", 6), ("破軍", 10)):
        star[name] = m12(f + off)
    star |= {"左輔": m12(4 + M - 1), "右弼": m12(10 - (M - 1)), "文昌": m12(10 - H), "文曲": m12(4 + H)}
    KUI = {0: (1, 7), 4: (1, 7), 6: (1, 7), 1: (0, 8), 5: (0, 8), 2: (11, 9), 3: (11, 9), 7: (6, 2), 8: (3, 5), 9: (3, 5)}
    star["天魁"], star["天鉞"] = KUI[ys]
    star["禄存"] = {0: 2, 1: 3, 2: 5, 4: 5, 3: 6, 5: 6, 6: 8, 7: 9, 8: 11, 9: 0}[ys]
    star["天馬"] = {8: 2, 0: 2, 4: 2, 2: 8, 6: 8, 10: 8, 5: 11, 9: 11, 1: 11, 11: 5, 3: 5, 7: 5}[yb]
    star["紅鸞"] = m12(3 - yb)
    star["天喜"] = m12(star["紅鸞"] + 6)
    sihua = [t + s for t, s in zip(["化禄", "化権", "化科", "化忌"], SIHUA[STEMS[ys]].split())]
    fwd = (sex == "M" and ys % 2 == 0) or (sex == "F" and ys % 2 == 1)
    yin = {0: 2, 5: 2, 1: 4, 6: 4, 2: 6, 7: 6, 3: 8, 8: 8, 4: 0, 9: 0}[ys]   # 五虎遁：寅の干
    ju = zw["五行局"]
    dx = []
    for i in range(7):
        b = m12(life + (i if fwd else -i))
        dx.append([b, ju + 10 * i, STEMS[(yin + (b - 2) % 12) % 10]])
    return {"life": life, "ju": ju, "star": star, "sihua": sihua, "dx": dx}

def ref_dasha(jd):
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    sm = (C.lon(jd, swe.MOON) - swe.get_ayanamsa_ut(jd)) % 360
    span = 360 / 27
    nak = int(sm // span)
    frac = (sm % span) / span
    i0 = nak % 9
    bal = (1 - frac) * DASHA[i0][1]
    out, age = [[DASHA[i0][0], 0, bal]], bal
    for k in range(1, 5):
        lord, yrs = DASHA[(i0 + k) % 9]
        out.append([lord, age, age + yrs])
        age += yrs
    return nak, out, frac

def ref_dirs(honmei, Y):
    """Y＝西暦の年。年盤の中宮の星は (11 - Y % 9) % 9（0なら9）＝本命星と同じ式"""
    center = (11 - Y % 9) % 9 or 9
    order = [5, 6, 7, 8, 9, 1, 2, 3, 4]         # 中→乾→兌→艮→離→坎→坤→震→巽（後天定位盤の数）
    pal = {((center - 1 + k) % 9) + 1: order[k] for k in range(9)}   # 星 → 宮
    bad = defaultdict(set)
    if pal[5] != 5:
        bad[KY_DIR[pal[5]]].add("五黄殺"); bad[KY_DIR[KY_OPP[pal[5]]]].add("暗剣殺")
    if pal[honmei] != 5:
        bad[KY_DIR[pal[honmei]]].add("本命殺"); bad[KY_DIR[KY_OPP[pal[honmei]]]].add("本命的殺")
    yb = (Y - 4) % 12                            # 歳破＝その年の十二支の向かい
    br_dir = {0: "北", 1: "北東", 2: "北東", 3: "東", 4: "南東", 5: "南東", 6: "南", 7: "南西", 8: "南西", 9: "西", 10: "北西", 11: "北西"}
    opp_dir = {"北": "南", "南": "北", "東": "西", "西": "東", "北東": "南西", "南西": "北東", "南東": "北西", "北西": "南東"}
    bad[opp_dir[br_dir[yb]]].add("歳破")
    best, good = [], []
    for s in range(1, 10):
        if s in (5, honmei) or pal[s] == 5 or KY_DIR[pal[s]] in bad:
            continue
        e, h = KY_EL[s], KY_EL[honmei]
        if GEN[e] == h:
            best.append(KY_DIR[pal[s]])
        elif e == h or GEN[h] == e:
            good.append(KY_DIR[pal[s]])
    return sorted(best), sorted(good), sorted(k + ":" + "+".join(sorted(v)) for k, v in bad.items())

def red(n, keep=True):
    while n > 9 and not (keep and n in (11, 22, 33)):
        n = sum(int(c) for c in str(n))
    return n

def ref_numerology(y, m, d, year):
    lp = red(sum(int(c) for c in f"{y}{m}{d}"))
    py = red(sum(int(c) for c in f"{year}{m}{d}"), keep=False)
    mm, dd, yy = red(m, False), red(d, False), red(sum(int(c) for c in str(y)), False)
    p1, p2, p4 = red(mm + dd), red(dd + yy), red(mm + yy)
    p3 = red(red(p1, False) + red(p2, False))
    c1, c2 = abs(mm - dd), abs(dd - yy)
    return {"lp": lp, "bd": red(d), "py": py, "pin": [p1, p2, p3, p4], "ch": [c1, c2, abs(c1 - c2), abs(mm - yy)], "e1": 36 - red(lp, False)}

def ref_shuku_rule():
    seq = ["命", "栄", "衰", "安", "危", "成", "壊", "友", "親"]
    PAIR = {"栄": "栄親", "親": "栄親", "衰": "友衰", "友": "友衰", "安": "安壊", "壊": "安壊", "危": "危成", "成": "危成"}
    out = {}
    for k in range(27):
        role = seq[k % 9] if k % 9 else ("命" if k == 0 else "業" if k == 9 else "胎")
        out[k] = [PAIR.get(role, "業胎" if role in "業胎" else "命"), ""]
    # 近・中・遠：同じ関係名の中で、前後どちらから数えても近いほうの距離が小さい順に 近・中・遠
    for name in ("栄親", "友衰", "安壊", "危成"):
        ks = sorted({min(k, 27 - k) for k in out if out[k][0] == name})
        for k in out:
            if out[k][0] == name:
                out[k][1] = ["近距離", "中距離", "遠距離"][ks.index(min(k, 27 - k))]
    return out

PALN = {1: "坎宮", 2: "坤宮", 3: "震宮", 4: "巽宮", 5: "中宮", 6: "乾宮", 7: "兌宮", 8: "艮宮", 9: "離宮"}
def ky_palace(star, center):
    order = [5, 6, 7, 8, 9, 1, 2, 3, 4]
    return order[(star - center) % 9]

def ref_tenchu(day_pillar):
    s, b = STEMS.index(day_pillar[0]), BR.index(day_pillar[1])
    i = (6 * s - 5 * b) % 60                     # 六十干支の番号（甲子＝0）
    start = (i - i % 10) % 12                    # 旬の始まりの支
    return BR[(start + 10) % 12] + BR[(start + 11) % 12]

STEM_EL = "木木火火土土金金水水"
def ref_wx_rel(a, b):
    """日主どうしの関係（アプリの言葉）。a＝あなた・b＝お相手の日干"""
    if {a, b} in ({"甲", "己"}, {"乙", "庚"}, {"丙", "辛"}, {"丁", "壬"}, {"戊", "癸"}):
        return "干合"
    ea, eb = STEM_EL[STEMS.index(a)], STEM_EL[STEMS.index(b)]
    KE = {"木": "土", "火": "金", "土": "水", "金": "木", "水": "火"}
    if ea == eb: return "比和"
    if GEN[ea] == eb: return "相生（あなた→相手）"
    if GEN[eb] == ea: return "相生（相手→あなた）"
    return "ぶつかる関係（あなた→相手）" if KE[ea] == eb else "ぶつかる関係（相手→あなた）"

def sign_name(lon):
    return ["牡羊座", "牡牛座", "双子座", "蟹座", "獅子座", "乙女座", "天秤座", "蠍座", "射手座", "山羊座", "水瓶座", "魚座"][int(lon // 30)]

def ref_person(c):
    y, m, d = map(int, c["bd"].split("-"))
    h, mi = map(int, c["bt"].split(":")) if c["bt"] else (12, 0)
    jd = C.jd_ut(y, m, d, h, mi)
    pil, mi_, yy, _ = C.ref_pillars(y, m, d, h, mi, bool(c["bt"]))
    z = ref_ziwei_full(dt.date(y, m, d), h, c["sex"])
    inv = defaultdict(set)
    for s, b in z["star"].items():
        inv[b].add(s)
    MAIN = ["紫微", "天機", "太陽", "武曲", "天同", "廉貞", "天府", "太陰", "貪狼", "巨門", "天相", "天梁", "七殺", "破軍"]
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    msid = (C.lon(jd, swe.MOON) - swe.get_ayanamsa_ut(jd)) % 360
    hon, _ = C.ref_kyusei(yy, mi_)
    return {"pil": pil, "cal": C.ref_pillars(y, m, d, h, mi, bool(c["bt"]), 24)[0]["日柱"], "sun": sign_name(C.lon(jd, swe.SUN)), "life_main": [s for s in MAIN if s in inv[z["life"]]],
            "spouse": inv[(z["life"] - 2) % 12], "rashi": int(msid // 30), "rashi_edge": min(msid % 30, 30 - msid % 30) < 0.08,
            "maya": C.ref_maya(y, m, d), "honmei": hon, "shuku": C.ref_shukuyo_trad(dt.date(y, m, d)), "known": bool(c["bt"])}

# ─────────────── 突き合わせ ───────────────
def main():
    cases = [person() for _ in range(N)]
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto((C.HERE / "index.html").as_uri())
        pg.wait_for_function("typeof EPH !== 'undefined'", timeout=60000)
        app = []
        for i, c in enumerate(cases):
            app.append(pg.evaluate(APP_JS, c))
            if (i + 1) % 100 == 0:
                print(f"  {i + 1}/{N}人", flush=True)
        rule = pg.evaluate(RULE_JS)
        pairs = [(cases[i], cases[i + 1]) for i in range(0, N - 1, 2)][:max(20, N // 3)]
        papp = [pg.evaluate(PAIR_JS, [a_, b_]) for a_, b_ in pairs]
        sym = [pg.evaluate(SYM_JS, [a_, b_]) for a_, b_ in pairs]
        b.close()
    miss, seen, note = defaultdict(list), defaultdict(int), defaultdict(list)
    def chk(k, ok, who, msg=""):
        seen[k] += 1
        if not ok:
            miss[k].append(f"{who} {msg}")
    for c, a in zip(cases, app):
        y, m, d = map(int, c["bd"].split("-"))
        known = bool(c["bt"])
        h, mi = map(int, c["bt"].split(":")) if known else (12, 0)
        who = f"{c['bd']} {c['bt'] or '時刻なし'} {c['sex']} {c['bp'] or '-'}"
        jd = C.jd_ut(y, m, d, h, mi)
        pil, mi_, yy, _ = C.ref_pillars(y, m, d, h, mi, known)
        for i, k in enumerate(["年柱", "月柱", "日柱"] + (["時柱"] if known else [])):
            chk("四柱 " + k, a["pil"][i] == pil[k], who, f"アプリ={a['pil'][i]} 参照={pil[k]}")
        for i, (pid, tol) in enumerate(zip(C.PLANET_IDS, C.PLANET_TOL)):
            r = C.lon(jd, pid)
            chk("天体（10個）", C.angdiff(a["planets"][i], r) <= tol, who, f"{i}番 アプリ={a['planets'][i]:.3f} 参照={r:.3f}")
        if known:
            cusps, ascmc = swe.houses(jd, a["lat"], a["lon"], b"P")
            chk("ASC（出生地）", C.angdiff(a["asc"], ascmc[0]) <= 0.5, who, f"アプリ={a['asc']:.2f} 参照={ascmc[0]:.2f}")
            chk("MC（出生地）", C.angdiff(a["mc"], ascmc[1]) <= 0.5, who, f"アプリ={a['mc']:.2f} 参照={ascmc[1]:.2f}")
            chk("ハウス（出生地）", max(C.angdiff(a["houses"][i], cusps[i]) for i in range(12)) <= 1.0, who)
        # 大運
        fwd, exact, seq = ref_dayun(jd, pil["年柱"], pil["月柱"], c["sex"])
        chk("大運の干支（8つ）", [x[0] for x in a["dayun"]] == seq, who, f"アプリ={[x[0] for x in a['dayun']][:3]} 参照={seq[:3]}")
        want = max(round(exact), 1)                    # 3日＝1年を四捨五入。0歳になる人は1歳から（10歳はそのまま）
        near_half = abs(exact - round(exact)) > 0.45      # 四捨五入の境目（±0.05年＝約2時間）は丸めの差として別に数える
        if a["dayun"][0][1] != want and near_half:
            note["大運の始まる年齢：四捨五入の境目で1歳違う"].append(f"{who} 参照{exact:.2f}歳")
        else:
            chk("大運の始まる年齢", a["dayun"][0][1] == want, who, f"アプリ={a['dayun'][0][1]} 参照={exact:.2f}→{want}")
        # 紫微
        z = ref_ziwei_full(dt.date(y, m, d), h, c["sex"])
        chk("紫微 命宮・五行局", (a["zw"]["life"], a["zw"]["ju"]) == (z["life"], z["ju"]), who)
        bad = [s for s, b in z["star"].items() if a["zw"]["star"].get(s) != b]
        chk("紫微 主星14・副星10の宮", not bad, who, f"違う星 {bad}")
        chk("紫微 生年の四化", sorted(a["zw"]["sihua"]) == sorted(z["sihua"]), who, f"アプリ={a['zw']['sihua']} 参照={z['sihua']}")
        chk("紫微 大限（宮・年齢・干）", a["zw"]["dx"] == z["dx"], who, f"アプリ={a['zw']['dx'][:2]} 参照={z['dx'][:2]}")
        # ダシャー
        nak, ds, frac = ref_dasha(jd)
        edge = min(frac, 1 - frac) < 0.006          # 月の位置の誤差（約0.05°）で入れ替わる境目
        if a["dasha"]["nak"] != nak and edge:
            note["ダシャー：月がナクシャトラの境目（0.08°以内）"].append(who)
        else:
            chk("ナクシャトラ", a["dasha"]["nak"] == nak, who, f"アプリ={a['dasha']['nak']} 参照={nak}")
            tol = 0.08 / (360 / 27) * dict(DASHA)[ds[0][0]] + 0.02
            ok = all(x[0] == r[0] and abs(x[2] - r[2]) <= tol + 0.001 for x, r in zip(a["dasha"]["list"], ds))
            chk("ダシャー（星の順と区切りの年齢）", ok, who, f"アプリ={[(x[0], round(x[2], 2)) for x in a['dasha']['list'][:2]]} 参照={[(r[0], round(r[2], 2)) for r in ds[:2]]}")
        # 九星の方位
        for dd_ in a["dir"]:
            best, good, badl = ref_dirs(a["honmei"], dd_["Y"])
            chk("九星 方位の吉凶", (dd_["best"], dd_["good"], dd_["bad"]) == (best, good, badl), who,
                f"{dd_['Y']}年 アプリ={dd_['best']}/{dd_['good']}/{dd_['bad']} 参照={best}/{good}/{badl}")
        # 数秘
        nr = ref_numerology(y, m, d, a["nu"]["year"])
        for k in ("lp", "bd", "py", "pin", "ch", "e1"):
            chk("数秘 " + {"lp": "ライフパス", "bd": "バースデー", "py": "パーソナルイヤー", "pin": "ピナクル", "ch": "チャレンジ", "e1": "第1期の終わり"}[k],
                a["nu"][k] == nr[k], who, f"アプリ={a['nu'][k]} 参照={nr[k]}")
        # 算命の天中殺・九星の傾斜宮と回座
        # 算命学は生まれた時刻を使わないので、23時台でも日付どおりの日柱から（四柱推命は23時の流派で翌日の日柱）
        tc = ref_tenchu(C.ref_pillars(y, m, d, h, mi, known, 24)[0]["日柱"])
        chk("算命 天中殺の名前", a["tenchu"]["name"] == tc, who, f"アプリ={a['tenchu']['name']} 参照={tc}")
        now = a["kaiza"]["year"]
        want_y = [yy_ for yy_ in range(now - 4, now + 17) if BR[(yy_ - 4) % 12] in tc]
        chk("算命 天中殺の年", a["tenchu"]["years"] == want_y, who, f"アプリ={a['tenchu']['years']} 参照={want_y}")
        kp = PALN[ky_palace(a["honmei"], a["getsu"])]
        chk("九星 傾斜宮", a["keisha"] == kp, who, f"アプリ={a['keisha']} 参照={kp}")
        center = lambda Y: (11 - Y % 9) % 9 or 9
        flow_ok = len(a["kaiza"]["flow"]) == 3 and all(p_ == PALN[ky_palace(a["honmei"], center(Y))] for Y, p_ in a["kaiza"]["flow"])
        chk("九星 回座（前後3年の流れ）", flow_ok, who, f"アプリ={a['kaiza']['flow']}")
        want_k = PALN[ky_palace(a["honmei"], center(KY_NOW))]
        chk("九星 今年の回座（九星タブ）", a["kaiza"]["today"] == want_k, who, f"アプリ={a['kaiza']['today']} 参照={want_k}")
        chk("九星 今年の回座（総合の迷ったとき）", a["kaiza"]["dec"] == want_k, who, f"アプリ={a['kaiza']['dec']} 参照={want_k}")
    # 相性モード
    for (ca, cb), pa in zip(pairs, papp):
        who = f"{ca['bd']} {ca['bt'] or '-'} × {cb['bd']} {cb['bt'] or '-'}"
        A, B = ref_person(ca), ref_person(cb)
        chk("相性 西洋 太陽の星座", pa["sun"] == [A["sun"], B["sun"]], who, f"アプリ={pa['sun']} 参照={[A['sun'], B['sun']]}")
        wr = ref_wx_rel(A["pil"]["日柱"][0], B["pil"]["日柱"][0])
        chk("相性 四柱 日主の関係", bool(pa["wx"]) and pa["wx"][0].startswith(wr), who, f"アプリ={pa['wx']} 参照={wr}")
        if A["known"] and B["known"]:
            zr = [A["life_main"][0] if A["life_main"] else "無主星", B["life_main"][0] if B["life_main"] else "無主星"]
            chk("相性 紫微 命宮主星（比較表）", pa["zwRow"] == zr, who, f"アプリ={pa['zwRow']} 参照={zr}")
            chk("相性 紫微 お相手の命宮主星（お相手はこういう人）", pa["zwB"] == zr[1], who, f"アプリ={pa['zwB']} 参照={zr[1]}")
            sp = [set(x.split("・")) - {"星なし"} for x in pa["spouse"]] if len(pa["spouse"]) == 2 else None
            chk("相性 紫微 夫妻宮の星", sp == [A["spouse"], B["spouse"]], who, f"アプリ={pa['spouse']} 参照={[sorted(A['spouse']), sorted(B['spouse'])]}")
        tA, tB = ref_tenchu(A["cal"]) + "天中殺", ref_tenchu(B["cal"]) + "天中殺"
        chk("相性 算命 天中殺", pa["tenchu"] == [tA, tB], who, f"アプリ={pa['tenchu']} 参照={[tA, tB]}")
        ea, eb = KY_EL[A["honmei"]], KY_EL[B["honmei"]]
        kw = "同じ五行" if ea == eb else "あなた（" + ea + "）が相手" if GEN[ea] == eb else "相手（" + eb + "）があなた（" + ea + "）を育て" if GEN[eb] == ea else "抑える"
        chk("相性 九星 本命星の関係", kw in pa["kyNote"], who, f"アプリ={pa['kyNote']} 参照に含むはず={kw}")
        mA, mB = A["maya"], B["maya"]
        sb = C.SEALS[(mB["KIN"] - 1) % 20]
        sa = C.SEALS[(mA["KIN"] - 1) % 20]
        mr = "同じ紋章" if sb == sa else "ガイドKINの関係" if sb == mA["ガイド"] else "類似KINの関係" if sb == mA["類似"] else "反対KINの関係" if sb == mA["反対"] else "神秘KINの関係" if sb == mA["神秘"] else "特別な関係KINではない"
        chk("相性 マヤ 紋章の関係", pa["maya"] == mr, who, f"アプリ={pa['maya']} 参照={mr}")
        chk("相性 宿曜 2人の宿", pa["shuku"] == [A["shuku"], B["shuku"]], who, f"アプリ={pa['shuku']} 参照={[A['shuku'], B['shuku']]}")
        if not (A["rashi_edge"] or B["rashi_edge"]):
            g = min((B["rashi"] - A["rashi"]) % 12, (A["rashi"] - B["rashi"]) % 12)
            kw = {0: "同じ月のラーシ", 1: "2・12", 2: "3・11", 3: "4・10", 4: "5・9", 5: "6・8", 6: "1・7"}[g]
            chk("相性 インド 月のラーシの関係", kw in pa["moonCard"], who, f"アプリ={pa['moonCard'][:30]} 参照の距離={g}")
    # 相性総合の入れ替え（2026-10-20 監査: 宿曜を役割で点にしていて、入力の順で総合点が変わった）
    SYSN = ["西洋占星術", "四柱推命", "紫微斗数", "算命学", "数秘術", "九星気学", "マヤ暦", "宿曜", "インド占星術"]
    WXS = {"干合": 85, "比和": 75, "相生": 85, "ぶつかる関係": 40}
    for (ca, cb), sy in zip(pairs, sym):
        who = f"{ca['bd']} {ca['bt'] or '-'} × {cb['bd']} {cb['bt'] or '-'}"
        chk("相性総合 入れ替えて同じ点", sy["t"][0] == sy["t"][1] and all(r[1] == r[2] and r[3] == r[4] for r in sy["rows"]), who, f"{sy}")
        chk("相性総合 9占術が1行ずつ", [r[0] for r in sy["rows"]] == SYSN, who, f"{[r[0] for r in sy['rows']]}")
        A, B = ref_person(ca), ref_person(cb)
        wr = ref_wx_rel(A["pil"]["日柱"][0], B["pil"]["日柱"][0]).split("（")[0]
        chk("相性総合 四柱の点（干合を先に見る）", sy["rows"][1][1] == WXS[wr], who, f"アプリ={sy['rows'][1][1]} 参照={wr}")
        chk("相性総合 紫微は2人とも時刻ありのときだけ点に入れる", sy["rows"][2][3] == (A["known"] and B["known"]), who)
    rs = ref_shuku_rule()
    SEQ = list("命栄衰安危成壊友親業栄衰安危成壊友親胎栄衰安危成壊友親")   # 三九の秘法：自分の宿を命として数える（昴から見て翼＝業の公開例と同じ向き）
    for k, pair, band, seen_, role in rule:
        chk("宿曜 相性（27通り）", [pair, band] == rs[k], f"距離{k}", f"アプリ={pair}{band} 参照={rs[k]}")
        chk("宿曜 相性の向き（あなたから見た相手・相手から見たあなた）", [seen_, role] == [SEQ[k], SEQ[(27 - k) % 27]], f"距離{k}", f"アプリ={seen_}/{role} 参照={SEQ[k]}/{SEQ[(27 - k) % 27]}")
    print(f"\nランダム{N}人（時刻あり約75%・男女・出生地6か所）＋相性{len(pairs)}組")
    for k in seen:
        n = len(miss[k])
        print(f"  {'✓' if not n else '✗'} {k:<24} {seen[k] - n}/{seen[k]}" + (f"   例: {' / '.join(miss[k][:3])}" if n else ""))
    for k, v in note.items():
        print(f"  ・{k}: {len(v)}件  例: {' / '.join(v[:3])}")
    if errs:
        print("JSエラー:", errs[:3])
    sys.exit(1 if any(miss.values()) else 0)

if __name__ == "__main__":
    main()

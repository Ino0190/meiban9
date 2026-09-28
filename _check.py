#!/usr/bin/env python3
"""羅占盤の計算を検算する（アプリの関数は使わず、暦の定義と Swiss Ephemeris から独立に計算して突き合わせる）

使い方（Divination/ で実行）
  python3 _check.py            基準の12人で全項目を照合（直したら毎回これを回す）
  python3 _check.py --sweep    1950〜2030年の毎日（正午）で一致率を出す
必要なもの: pyswisseph, playwright（Chrome）

参照の定義
  天体・ASC/MC・ハウス   Swiss Ephemeris（Moshier）。出生地はアプリと同じ 北緯35°・東経135°・JST固定
  四柱推命               年・月＝生まれた瞬間の太陽黄経（立春315°・節入り）、日＝ユリウス通日 (JDN+49) mod 60、時＝五鼠遁、日の境は0時
  九星気学               本命星＝立春で切り替え、月命星＝節月ごとに逆行
  マヤ暦                 Dreamspell（2月29日を数えない。1987-07-26＝KIN34）
  宿曜（旧暦方式）       旧暦（JSTの朔日・中気のない月を閏月）の月ごとの1日の宿から日数を数える
  紫微斗数               旧暦の月・日と時支で命宮、命宮干支の納音で五行局、局と旧暦日で紫微星
"""
import sys, math, datetime as dt
import swisseph as swe
from pathlib import Path
from playwright.sync_api import sync_playwright

swe.set_ephe_path(None)
HERE = Path(__file__).resolve().parent
STEMS, BRANCHES = "甲乙丙丁戊己庚辛壬癸", "子丑寅卯辰巳午未申酉戌亥"
SHUKU = "昴畢觜参井鬼柳星張翼軫角亢氐房心尾箕斗女虚危室壁奎婁胃"
SHUKU_MONTH_START = {1: "室", 2: "奎", 3: "胃", 4: "畢", 5: "参", 6: "鬼", 7: "張", 8: "角", 9: "氐", 10: "心", 11: "斗", 12: "虚"}
SEALS = ["赤い竜", "白い風", "青い夜", "黄色い種", "赤い蛇", "白い世界の橋渡し", "青い手", "黄色い星", "赤い月", "白い犬",
         "青い猿", "黄色い人", "赤い空歩く人", "白い魔法使い", "青い鷲", "黄色い戦士", "赤い地球", "白い鏡", "青い嵐", "黄色い太陽"]
# 納音五行（60干支を2つずつ）→ 五行局（水2 木3 金4 土5 火6）
NAYIN_JU = [4, 6, 3, 5, 4, 6, 2, 5, 4, 3, 2, 5, 6, 3, 2, 4, 6, 3, 5, 4, 6, 2, 5, 4, 3, 2, 5, 6, 3, 2]

# ─────────────── 参照計算 ───────────────
def jd_ut(y, m, d, h=12, mi=0):
    return swe.julday(y, m, d, 0.0) + (h + mi / 60 - 9) / 24

def lon(jd, body):
    return swe.calc_ut(jd, body)[0][0]

def jdn(date):
    return date.toordinal() + 1721425

def jst_date(jd):
    return dt.date.fromordinal(int(math.floor(jd + 0.5 + 9 / 24)) - 1721425)

def ref_pillars(y, m, d, h, mi, time_known=True):
    s = lon(jd_ut(y, m, d, h, mi), swe.SUN)
    mi_ = int(((s - 315) % 360) // 30)          # 0=寅月 … 10=子月 11=丑月
    yy = y - 1 if (m <= 2 and mi_ >= 10) else y
    ys, yb = (yy - 4) % 10, (yy - 4) % 12
    mb, ms = (mi_ + 2) % 12, ((ys % 5) * 2 + 2 + mi_) % 10
    i60 = (jdn(dt.date(y, m, d)) + 49) % 60
    ds, db = i60 % 10, i60 % 12
    out = {"年柱": STEMS[ys] + BRANCHES[yb], "月柱": STEMS[ms] + BRANCHES[mb], "日柱": STEMS[ds] + BRANCHES[db]}
    if time_known:
        hb = 0 if (h >= 23 or h < 1) else (h + 1) // 2
        out["時柱"] = STEMS[((ds % 5) * 2 + hb) % 10] + BRANCHES[hb]
    out["天中殺"] = BRANCHES[(db - ds + 10) % 12] + BRANCHES[(db - ds + 11) % 12]
    return out, mi_, yy, ys

def ref_kyusei(yy, mi_):
    honmei = (11 - yy % 9) % 9 or 9
    base = {1: 8, 4: 8, 7: 8, 2: 2, 5: 2, 8: 2, 3: 5, 6: 5, 9: 5}[honmei]
    return honmei, (base - mi_) % 9 or 9

def _C(date):  # 2月29日を除いた通し日番号
    y = date.year - 1
    leaps = y // 4 - y // 100 + y // 400
    if (date.year % 4 == 0 and date.year % 100 != 0) or date.year % 400 == 0:
        if date >= dt.date(date.year, 2, 29):
            leaps += 1
    return date.toordinal() - leaps

def ref_maya(y, m, d):
    date = dt.date(y, 2, 28) if (m == 2 and d == 29) else dt.date(y, m, d)
    kin = (33 + _C(date) - _C(dt.date(1987, 7, 26))) % 260 + 1
    s, t = (kin - 1) % 20, (kin - 1) % 13 + 1
    return {"KIN": kin, "WS": SEALS[((kin - 1) // 13 * 13) % 20], "類似": SEALS[(17 - s) % 20], "反対": SEALS[(s + 10) % 20],
            "神秘": SEALS[(19 - s) % 20], "ガイド": SEALS[(s + [0, 12, 4, 16, 8][(t - 1) % 5]) % 20]}

# 旧暦（JST）: 朔の日を1日とし、中気を含まない月を閏月にする
_LUNAR = {}
def _crossings(start, end, f):
    """f(jd) は符号付き差（-180..180）。負→正に変わる瞬間を1日刻み＋二分法で探す"""
    out, jd = [], start
    prev = f(jd)
    while jd < end:
        nxt = f(jd + 1)
        if prev < 0 <= nxt and nxt - prev < 90:
            a, b = jd, jd + 1
            for _ in range(40):
                c = (a + b) / 2
                (a, b) = (c, b) if f(c) < 0 else (a, c)
            out.append((a + b) / 2)
        jd, prev = jd + 1, nxt
    return out

def lunar_table(y0=1948, y1=2031):
    """[(月の開始JDN, 次の月の開始JDN, 月番号, 閏月か, 旧暦の年)]  generate_lunar.py もこれを使う"""
    if (y0, y1) in _LUNAR:
        return _LUNAR[(y0, y1)]
    start, end = swe.julday(y0, 10, 1, 0), swe.julday(y1, 6, 1, 0)
    sgn = lambda x: (x + 180) % 360 - 180
    moons = [jdn(jst_date(j)) for j in _crossings(start, end, lambda j: sgn(lon(j, swe.MOON) - lon(j, swe.SUN)))]
    zq = []
    for L in range(0, 360, 30):
        zq += [(jdn(jst_date(j)), L) for j in _crossings(start, end, lambda j, L=L: sgn(lon(j, swe.SUN) - L))]
    zq.sort()
    months, prev = [], None
    ly = dt.date.fromordinal(moons[0] - 1721425).year
    for k in range(len(moons) - 1):
        a, b = moons[k], moons[k + 1]
        inside = [L for (dn, L) in zq if a <= dn < b]
        if inside:
            num, leap = ((inside[0] // 30 + 1) % 12) + 1, False
        else:
            num, leap = (prev or 1), True
        if num == 1 and not leap:
            ly = dt.date.fromordinal(a - 1721425).year
        months.append((a, b, num, leap, ly))
        prev = num
    _LUNAR[(y0, y1)] = months
    return months

def lunar_date(date):
    """(月, 日, 閏月か, 月の開始JDN, 旧暦の年)"""
    n = jdn(date)
    for a, b, num, leap, ly in lunar_table():
        if a <= n < b:
            return num, n - a + 1, leap, a, ly
    raise ValueError(date)

def lunar_year_stem(date):
    """旧正月で切り替えた年の年干"""
    return (lunar_date(date)[4] - 4) % 10

def ref_shukuyo_trad(date):
    num, day = lunar_date(date)[:2]
    return SHUKU[(SHUKU.index(SHUKU_MONTH_START[num]) + day - 1) % 27] + "宿"

def ref_ziwei(date, h):
    M, D = lunar_date(date)[:2]
    H = 0 if (h >= 23 or h < 1) else (h + 1) // 2
    life = (2 + (M - 1) - H) % 12
    ys = lunar_year_stem(date)
    pstem = (((ys % 5) * 2 + 2) + (life - 2) % 12) % 10
    i60 = (6 * pstem - 5 * life) % 60
    ju = NAYIN_JU[i60 // 2]
    k = 0
    while (D + k) % ju:
        k += 1
    pos = (2 + (D + k) // ju - 1 + (-k if k % 2 else k)) % 12
    return {"命宮": BRANCHES[life], "五行局": ju, "紫微星": BRANCHES[pos]}

# 算命学（高尾式）: 十大主星は日干から見た五行の関係と陰陽、十二大従星は表（算命学アカデミーの表をそのまま写した）
JUSSHU = ["貫索星", "石門星", "鳳閣星", "調舒星", "禄存星", "司禄星", "車騎星", "牽牛星", "龍高星", "玉堂星"]
ZOKAN = {"子": [(99, "癸")], "丑": [(9, "癸"), (12, "辛"), (99, "己")], "寅": [(7, "戊"), (14, "丙"), (99, "甲")], "卯": [(99, "乙")],
         "辰": [(9, "乙"), (12, "癸"), (99, "戊")], "巳": [(5, "戊"), (14, "庚"), (99, "丙")], "午": [(19, "己"), (99, "丁")],
         "未": [(9, "丁"), (12, "乙"), (99, "己")], "申": [(10, "戊"), (13, "壬"), (99, "庚")], "酉": [(99, "辛")],
         "戌": [(9, "辛"), (12, "丁"), (99, "戊")], "亥": [(12, "甲"), (99, "壬")]}
_JU_COLS = "癸甲乙丙丁戊己庚辛壬"
_JU_ROWS = {  # 行＝支、列＝日干（癸甲乙丙丁戊己庚辛壬）。「星」は省略
    "亥": "将貴極馳報馳報胡恍禄", "子": "禄恍胡報馳報馳極貴将", "丑": "南南堂印庫印庫庫印堂", "寅": "恍禄将貴極貴極馳報胡",
    "卯": "貴将禄恍胡恍胡報馳極", "辰": "印堂南南堂南堂印庫庫", "巳": "報胡恍禄将禄将貴極馳", "午": "馳極貴将禄将禄恍胡報",
    "未": "庫庫印堂南堂南南堂印", "申": "極馳報胡恍胡恍禄将貴", "酉": "胡報馳極貴極貴将禄恍", "戌": "堂印庫庫印庫印堂南南"}

def jusshu(day_s, other_s):
    rel = (other_s // 2 - day_s // 2) % 5          # 0比和 1洩 2剋 3官 4印
    return JUSSHU[rel * 2 + (0 if day_s % 2 == other_s % 2 else 1)]

def zokan(branch, days):
    for upto, stem in ZOKAN[branch]:
        if days <= upto:
            return stem

def juusei(day_stem_char, branch):
    return "天" + _JU_ROWS[branch][_JU_COLS.index(day_stem_char)] + "星"

def setsu_days(y, m, d, h, mi):
    jd = jd_ut(y, m, d, h, mi)
    s = lon(jd, swe.SUN)
    target = (315 + 30 * int(((s - 315) % 360) // 30)) % 360
    t = jd - ((s - target) % 360) / 0.9856
    for _ in range(8):
        t += ((target - lon(t, swe.SUN) + 540) % 360 - 180) / 0.9856
    return jdn(jst_date(jd)) - jdn(jst_date(t)) + 1

def ref_sanmei(pil, days):
    ds = STEMS.index(pil["日柱"][0])
    S = lambda ch: jusshu(ds, STEMS.index(ch))
    out = {"北": S(pil["年柱"][0]), "南": S(pil["月柱"][0]), "東": S(zokan(pil["年柱"][1], days)),
           "中央": S(zokan(pil["月柱"][1], days)), "西": S(zokan(pil["日柱"][1], days))}
    out.update({"従星年": juusei(pil["日柱"][0], pil["年柱"][1]), "従星月": juusei(pil["日柱"][0], pil["月柱"][1]),
                "従星日": juusei(pil["日柱"][0], pil["日柱"][1]), "節入り日数": days})
    return out

# 日盤の九星（こよみのページの置閏法）: 冬至・夏至の日の干支が前半30なら直前、後半なら直後の甲子で切り替え。
# 間隔が240日なら後半60日が閏で、その後ろ30日は次の遁を先取りする
_SW = None
def ref_day_star(date):
    global _SW
    if _SW is None:
        start, end = swe.julday(1948, 1, 1, 0), swe.julday(2032, 1, 1, 0)
        sgn = lambda x: (x + 180) % 360 - 180
        sw = []
        for L, yang in [(270, True), (90, False)]:
            for j in _crossings(start, end, lambda j, L=L: sgn(lon(j, swe.SUN) - L)):
                n = jdn(jst_date(j))
                i60 = (n + 49) % 60
                sw.append([n - i60 if i60 < 30 else n + 60 - i60, yang])
        sw.sort()
        for i, x in enumerate(sw):
            x.append(x[0] - 30 if i and x[0] - sw[i - 1][0] == 240 else x[0])
        _SW = sw
    n = jdn(date)
    s, yang, _ = [x for x in _SW if x[2] <= n][-1]
    k = (n - s) % 9
    return k + 1 if yang else 9 - k

def angdiff(a, b):
    return abs((a - b + 180) % 360 - 180)

# ─────────────── アプリ側（ブラウザで実行） ───────────────
APP_JS = """(cases) => cases.map(c => {
  const d = calcPersonData(c.bd, c.bt || '', c.bt ? 'known' : 'unknown', 'F', '');
  const ma = calcMaya(d.y, d.m, d.d), ky = calcKyusei(d.y, d.m, d), sm = calcJintai(d);
  const S = MAYA_SEALS.map(s => s.n);
  return {
    年柱: d.year.stem + d.year.branch, 月柱: d.month.stem + d.month.branch, 日柱: d.day.stem + d.day.branch, 時柱: d.hour.stem + d.hour.branch,
    天中殺: BRANCHES[sm.k1] + BRANCHES[sm.k2],
    本命星: ky.honmei, 月命星: ky.getsu,
    KIN: ma.kin, WS: S[ma.ws], 類似: S[ma.analogSeal], 反対: S[ma.antipodeSeal], 神秘: S[ma.occultSeal], ガイド: S[ma.guideSeal],
    宿: SHUKUYO_27[calcShukuyo(d.moonLon)].n, 宿旧暦: (typeof calcShukuyoTrad === 'function') ? SHUKUYO_27[calcShukuyoTrad(d.y, d.m, d.d)].n : null,
    LP: calcNumerology(d.y, d.m, d.d).lifePath,
    jd: d.jd, sun: d.sunLon, moon: d.moonLon, planets: d.planets.map(p => p.lon), asc: d.ascLon, mc: d.mcLon, houses: d.houses,
    aya: ayanamsha(d.jd), 命宮: BRANCHES[d.lifeIdx], 五行局: d.ziweiJu, 紫微星: BRANCHES[d.ziweiPos],
    北: sm.stars.north, 南: sm.stars.south, 東: sm.stars.east, 中央: sm.stars.center, 西: sm.stars.west,
    従星年: sm.juuniYear.n, 従星月: sm.juuniMonth.n, 従星日: sm.juuniDay.n, 節入り日数: sm.days,
    十神月: d.pillars[1].ten, 十神年: d.pillars[0].ten,
    日盤: (typeof kyuseiDayStar === 'function') ? kyuseiDayStar(d.y, d.m, d.d) : null,
  };
})"""

def run_app(cases):
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto((HERE / "index.html").as_uri())
        pg.wait_for_function("typeof EPH !== 'undefined'", timeout=60000)
        out = []
        for i in range(0, len(cases), 1500):
            out += pg.evaluate(APP_JS, cases[i:i + 1500])
        b.close()
    if errs:
        print("JSエラー:", errs)
    return out

# ─────────────── 基準の12人 ───────────────
CASES = [
    ("1990-05-15", "12:30", "基準の人"),
    ("1985-01-20", "08:00", "1月生まれ（立春前・小寒後）"),
    ("1990-02-03", "10:00", "立春の前日"),
    ("2024-02-04", "12:00", "立春の日・節入り（17:27）より前"),
    ("2024-02-04", "20:00", "立春の日・節入りより後"),
    ("2000-12-10", "18:00", "12月（子月）"),
    ("1972-02-29", "06:00", "うるう日"),
    ("2016-07-26", "09:00", "うるう年の後（マヤ暦のずれ確認）"),
    ("2001-01-01", "00:30", "元日の子の刻"),
    ("1995-08-07", "23:30", "23時台（時柱の子の刻）"),
    ("1964-10-10", "14:00", "昭和の人"),
    ("1950-06-21", None, "出生時刻不明"),
    ("2022-03-29", "12:00", "算命学の公開例"),
    ("1972-08-16", "12:00", "蔵干の公開例（申の初元）"),
]
PLANET_IDS = [swe.SUN, swe.MOON, swe.MERCURY, swe.VENUS, swe.MARS, swe.JUPITER, swe.SATURN, swe.URANUS, swe.NEPTUNE, swe.PLUTO]
PLANET_TOL = [0.02, 0.3, 0.05, 0.05, 0.05, 0.02, 0.02, 0.02, 0.02, 0.02]

def selftest():
    ok = True
    def t(label, got, want):
        nonlocal ok
        if got != want:
            ok = False
            print(f"  参照の自己テスト失敗: {label} = {got}（期待 {want}）")
    t("1900-01-01 日柱", ref_pillars(1900, 1, 1, 12, 0)[0]["日柱"], "甲戌")
    t("2000-01-01 日柱", ref_pillars(2000, 1, 1, 12, 0)[0]["日柱"], "戊午")
    t("1987-07-26 KIN", ref_maya(1987, 7, 26)["KIN"], 34)
    t("1990-01-01 KIN", ref_maya(1990, 1, 1)["KIN"], 143)
    t("2012-12-21 KIN", ref_maya(2012, 12, 21)["KIN"], 207)
    # 旧正月・閏月の既知の日（閏月は 2017年閏5月・2020年閏4月・2023年閏2月）
    for d, want in [(dt.date(1990, 1, 27), (1, 1, False)), (dt.date(2023, 1, 22), (1, 1, False)), (dt.date(2024, 2, 10), (1, 1, False)),
                    (dt.date(1990, 5, 15), (4, 21, False)), (dt.date(2017, 6, 24), (5, 1, True)), (dt.date(2020, 5, 23), (4, 1, True)),
                    (dt.date(2023, 3, 22), (2, 1, True)), (dt.date(2023, 4, 20), (3, 1, False)),
                    (dt.date(2026, 2, 17), (1, 1, False)), (dt.date(2026, 3, 19), (2, 1, False)), (dt.date(2026, 4, 17), (3, 1, False)),
                    (dt.date(2027, 5, 6), (4, 1, False))]:
        t(f"旧暦 {d}", lunar_date(d)[:3], want)
    t("旧暦の年 1990-01-26", lunar_date(dt.date(1990, 1, 26))[4], 1989)
    # 算命学の公開例: 2022-03-29（壬寅年・癸卯月・辛巳日、節入り3/5から25日目）＝北調舒・南鳳閣・東司禄・中央禄存・西牽牛
    pil = ref_pillars(2022, 3, 29, 12, 0)[0]
    t("2022-03-29 陰占", (pil["年柱"], pil["月柱"], pil["日柱"]), ("壬寅", "癸卯", "辛巳"))
    sm = ref_sanmei(pil, setsu_days(2022, 3, 29, 12, 0))
    t("2022-03-29 節入り日数", sm["節入り日数"], 25)
    t("2022-03-29 十大主星", (sm["北"], sm["南"], sm["東"], sm["中央"], sm["西"]), ("調舒星", "鳳閣星", "司禄星", "禄存星", "牽牛星"))
    # 蔵干の公開例: 1972-08-16（年支子・月支申・日支卯、節入り8/7から10日目）＝癸・戊・乙
    t("1972-08-16 節入り日数", setsu_days(1972, 8, 16, 12, 0), 10)
    t("1972-08-16 蔵干", (zokan("子", 10), zokan("申", 10), zokan("卯", 10)), ("癸", "戊", "乙"))
    # 日盤: 2026-09-19＝七赤（日本暦）、2026-06-18＝九紫（陽遁の終わり）、2020年は閏で甲午の前後に三碧が2日続く
    t("日盤 2026-09-19", ref_day_star(dt.date(2026, 9, 19)), 7)
    t("日盤 2026-06-18", ref_day_star(dt.date(2026, 6, 18)), 9)
    t("日盤 2020 閏の三碧", (ref_day_star(dt.date(2020, 6, 19)), ref_day_star(dt.date(2020, 6, 20))), (3, 3))
    t("2024-02-04 12:00 年柱", ref_pillars(2024, 2, 4, 12, 0)[0]["年柱"], "癸卯")
    t("2024-02-04 20:00 年柱", ref_pillars(2024, 2, 4, 20, 0)[0]["年柱"], "甲辰")
    print("参照の自己テスト:", "OK" if ok else "NG")
    return ok

def main():
    if not selftest():
        sys.exit(2)
    cases = [{"bd": bd, "bt": bt} for bd, bt, _ in CASES]
    app = run_app(cases)
    fails = {}
    for (bd, bt, label), a in zip(CASES, app):
        y, m, d = map(int, bd.split("-"))
        h, mi = (map(int, bt.split(":")) if bt else (5, 0))
        rows = []
        pil, mi_, yy, _ = ref_pillars(y, m, d, h, mi, bool(bt))
        for k, v in pil.items():
            rows.append((k, a[k], v))
        hon, get = ref_kyusei(yy, mi_)
        rows += [("本命星", a["本命星"], hon), ("月命星", a["月命星"], get), ("日盤", a["日盤"], ref_day_star(dt.date(y, m, d)))]
        full = ref_pillars(y, m, d, h, mi, True)[0]
        TEN = ["比肩", "劫財", "食神", "傷官", "偏財", "正財", "偏官", "正官", "偏印", "正印"]
        ten = lambda ch: TEN[JUSSHU.index(jusshu(STEMS.index(full["日柱"][0]), STEMS.index(ch)))]
        rows += [("十神（年干）", a["十神年"], ten(full["年柱"][0])), ("十神（月干）", a["十神月"], ten(full["月柱"][0]))]
        for k, v in ref_sanmei(full, setsu_days(y, m, d, h, mi)).items():
            rows.append(("算命" + k, a[k], v))
        for k, v in ref_maya(y, m, d).items():
            rows.append(("マヤ" + k, a[k], v))
        trad = ref_shukuyo_trad(dt.date(y, m, d))
        rows.append(("宿（旧暦方式）", a["宿旧暦"] if a["宿旧暦"] else a["宿"], trad))
        zw = ref_ziwei(dt.date(y, m, d), h)
        for k, v in zw.items():
            rows.append(("紫微" + k, a[k], v))
        jd = jd_ut(y, m, d, h, mi)
        rows.append(("JD(UT)", round(a["jd"], 5), round(jd, 5)))
        names = ["太陽", "月", "水星", "金星", "火星", "木星", "土星", "天王星", "海王星", "冥王星"]
        for i, (pid, tol) in enumerate(zip(PLANET_IDS, PLANET_TOL)):
            r = lon(jd, pid)
            rows.append((names[i], round(a["planets"][i], 2), round(r, 2), angdiff(a["planets"][i], r) <= tol))
        swe.set_sid_mode(swe.SIDM_LAHIRI)
        aya = swe.get_ayanamsa_ut(jd)
        rows.append(("アヤナムシャ", round(a["aya"], 3), round(aya, 3), abs(a["aya"] - aya) <= 0.05))
        sid_moon = (lon(jd, swe.MOON) - aya) % 360
        app_sid_moon = (a["moon"] - a["aya"]) % 360
        rows.append(("ナクシャトラ", int(app_sid_moon // (360 / 27)), int(sid_moon // (360 / 27))))
        if bt:
            cusps, ascmc = swe.houses(jd, 35.0, 135.0, b"P")
            rows.append(("ASC", round(a["asc"], 1), round(ascmc[0], 1), angdiff(a["asc"], ascmc[0]) <= 0.5))
            rows.append(("MC", round(a["mc"], 1), round(ascmc[1], 1), angdiff(a["mc"], ascmc[1]) <= 0.5))
            worst = max(angdiff(a["houses"][i], cusps[i]) for i in range(12))
            rows.append(("ハウス（最大誤差°）", round(worst, 1), 0, worst <= 1.0))
        print(f"\n■ {bd} {bt or '時刻不明'} — {label}")
        for r in rows:
            k, got, want = r[0], r[1], r[2]
            good = r[3] if len(r) > 3 else got == want
            if not good:
                fails.setdefault(k, []).append(bd)
            print(f"  {'✓' if good else '✗'} {k:<12} アプリ={got}  参照={want}")
    print("\n━━ まとめ ━━")
    if not fails:
        print("全項目一致")
    for k, v in fails.items():
        print(f"✗ {k}: {len(v)}/{len(CASES)}人  {', '.join(v)}")
    sys.exit(1 if fails else 0)

def sweep():
    days = []
    d = dt.date(1950, 1, 1)
    while d <= dt.date(2030, 12, 31):
        days.append(d)
        d += dt.timedelta(days=1)
    app = run_app([{"bd": x.isoformat(), "bt": "12:00"} for x in days])
    items = ["年柱", "月柱", "日柱", "本命星", "月命星", "日盤", "算命中央", "算命東", "算命西", "算命従星月", "KIN", "宿（月の位置 vs 旧暦）", "宿（アプリ旧暦 vs 参照旧暦）", "紫微命宮", "紫微五行局", "紫微紫微星"]
    miss = {k: 0 for k in items}
    samples = {k: [] for k in items}
    for x, a in zip(days, app):
        pil, mi_, yy, _ = ref_pillars(x.year, x.month, x.day, 12, 0)
        hon, get = ref_kyusei(yy, mi_)
        trad = ref_shukuyo_trad(x)
        zw = ref_ziwei(x, 12)
        sm = ref_sanmei(ref_pillars(x.year, x.month, x.day, 12, 0, True)[0], setsu_days(x.year, x.month, x.day, 12, 0))
        pairs = [("年柱", a["年柱"], pil["年柱"]), ("月柱", a["月柱"], pil["月柱"]), ("日柱", a["日柱"], pil["日柱"]),
                 ("本命星", a["本命星"], hon), ("月命星", a["月命星"], get), ("日盤", a["日盤"], ref_day_star(x)),
                 ("算命中央", a["中央"], sm["中央"]), ("算命東", a["東"], sm["東"]), ("算命西", a["西"], sm["西"]), ("算命従星月", a["従星月"], sm["従星月"]), ("KIN", a["KIN"], ref_maya(x.year, x.month, x.day)["KIN"]),
                 ("宿（月の位置 vs 旧暦）", a["宿"], trad), ("宿（アプリ旧暦 vs 参照旧暦）", a["宿旧暦"], trad if a["宿旧暦"] else None),
                 ("紫微命宮", a["命宮"], zw["命宮"]), ("紫微五行局", a["五行局"], zw["五行局"]), ("紫微紫微星", a["紫微星"], zw["紫微星"])]
        for k, got, want in pairs:
            if got != want:
                miss[k] += 1
                if len(samples[k]) < 3:
                    samples[k].append(f"{x} アプリ={got} 参照={want}")
    n = len(days)
    print(f"1950〜2030年の毎日（正午・{n}日）")
    for k in items:
        print(f"  {k:<22} 不一致 {miss[k]:>6}日（{miss[k] / n * 100:5.1f}%）  {' / '.join(samples[k])}")

if __name__ == "__main__":
    sweep() if "--sweep" in sys.argv else main()

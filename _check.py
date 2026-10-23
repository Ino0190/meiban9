#!/usr/bin/env python3
"""羅占盤の計算を検算する（アプリの関数は使わず、暦の定義と Swiss Ephemeris から独立に計算して突き合わせる）

使い方（Divination/ で実行）
  python3 _check.py            基準の12人で全項目を照合（直したら毎回これを回す）
  python3 _check.py --sweep    1950〜2030年の毎日（正午）で一致率を出す
  python3 _check.py --update-types   計算を直してタイプが変わるのを受け入れたとき、_type_snapshot.json を書き直す
  python3 _check.py --lunar    旧暦だけ（1920〜2080年の全日をアプリ・別書きの参照・香港天文台の表で比べる）
  python3 _check.py --audit    天体の表の誤差・独立監査（2026-10-20）の再現例・日の変わり目の2つの流派（四柱推命・紫微斗数）・易経の64卦・
                               画面の操作（相手の時刻欄・出生地未選択・性別・範囲外・端末の日付固定・日の変わり目の切り替え）
  python3 _check_random.py 500       ランダムな誕生日・時刻・出生地で、大運・紫微の全星と四化と大限・ダシャー・九星の方位と傾斜と回座・
                                      数秘・算命の天中殺と年・相性モード（9占術の関係）も検算
  （基準の人のあとに、位相法・忌神・インドの高揚減衰・紫微の流年の干のルールと、40人の16タイプが前と同じかも見る）
必要なもの: pyswisseph, playwright（Chrome）

参照の定義
  天体・ASC/MC・ハウス   Swiss Ephemeris（Moshier）。出生地はアプリと同じ 北緯35°・東経135°・JST固定
  四柱推命               年・月＝生まれた瞬間の太陽黄経（立春315°・節入り）、日＝ユリウス通日 (JDN+49) mod 60、時＝その日柱の日干から五鼠遁。
                         日の境は23時（23時台は翌日の日柱。アプリの既定）。0時の流派（日付どおり）も --audit で比べる
  算命学                 生まれた時刻を使わないので、日柱はいつも日付どおり（23時台でも翌日にしない）
  九星気学               本命星＝立春で切り替え、月命星＝節月ごとに逆行
  マヤ暦                 Dreamspell（2月29日を数えない。1987-07-26＝KIN34）
  旧暦                   JSTの朔日が1日。冬至の月を11月とし、次の冬至の月まで13か月なら最初に中気のない月を閏月（2033年は閏11月）。
                         generate_lunar.py とは別の書き方で計算し、香港天文台の表（_ref/hko/）とも全日を比べる
  宿曜（旧暦方式）       旧暦の月ごとの1日の宿から日数を数える
  紫微斗数               旧暦の月・日と時支で命宮、命宮干支の納音で五行局、局と旧暦日で紫微星。
                         23時台は翌日の旧暦の日（23時の流派・四柱推命と同じ設定）。0時の流派は日付どおり
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

def ref_pillars(y, m, d, h, mi, time_known=True, boundary=23):
    """四柱推命の四柱。boundary=23 は23時台を翌日の日柱にする流派（アプリの既定）、24 は日付どおり（0時の流派）。
    時柱はどちらも、その日柱の日干から五鼠遁で出す。天中殺は算命学のもので、生まれた時刻を使わない＝いつも日付どおりの日柱から"""
    s = lon(jd_ut(y, m, d, h, mi), swe.SUN)
    mi_ = int(((s - 315) % 360) // 30)          # 0=寅月 … 10=子月 11=丑月
    yy = y - 1 if (m <= 2 and mi_ >= 10) else y
    ys, yb = (yy - 4) % 10, (yy - 4) % 12
    mb, ms = (mi_ + 2) % 12, ((ys % 5) * 2 + 2 + mi_) % 10
    cal = (jdn(dt.date(y, m, d)) + 49) % 60
    i60 = (cal + 1) % 60 if (time_known and h >= 23 and boundary == 23) else cal
    ds, db = i60 % 10, i60 % 12
    out = {"年柱": STEMS[ys] + BRANCHES[yb], "月柱": STEMS[ms] + BRANCHES[mb], "日柱": STEMS[ds] + BRANCHES[db]}
    if time_known:
        hb = 0 if (h >= 23 or h < 1) else (h + 1) // 2
        out["時柱"] = STEMS[((ds % 5) * 2 + hb) % 10] + BRANCHES[hb]
    cs, cb = cal % 10, cal % 12
    out["天中殺"] = BRANCHES[(cb - cs + 10) % 12] + BRANCHES[(cb - cs + 11) % 12]
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

# 旧暦の参照。generate_lunar.py（ニュートン法・solcross_ut）とは別の書き方にしてある:
# 朔と中気を1日刻みの走査＋二分法で探し、冬至の月から次の冬至の月までを1区切りとして数える。
# 13か月の区切りだけ、最初に中気を含まない月を閏月にする。tz=9 がアプリと同じJST、tz=8 は香港天文台の表（中国標準時）と比べる用
_EVENTS, _LUNAR = None, {}
def _lunar_events():
    global _EVENTS
    if _EVENTS is None:
        start, end = swe.julday(1918, 10, 1, 0), swe.julday(2082, 3, 1, 0)
        sgn = lambda x: (x + 180) % 360 - 180
        moons = _crossings(start, end, lambda j: sgn(lon(j, swe.MOON) - lon(j, swe.SUN)))
        terms, jd, k = [], start, int(lon(start, swe.SUN) // 30)
        while jd < end:
            k2 = int(lon(jd + 1, swe.SUN) // 30)
            if k2 != k:
                a, b = jd, jd + 1
                for _ in range(40):
                    c = (a + b) / 2
                    (a, b) = (c, b) if sgn(lon(c, swe.SUN) - k2 * 30) < 0 else (a, c)
                terms.append(((a + b) / 2, k2 * 30))
            jd, k = jd + 1, k2
        _EVENTS = (moons, terms)
    return _EVENTS

def ref_lunar_months(tz=9):
    """[(月の開始JDN, 次の月の開始JDN, 月番号, 閏月か, 旧暦の年)]  1918年11月〜2081年"""
    if tz in _LUNAR:
        return _LUNAR[tz]
    moons, terms = _lunar_events()
    day = lambda j: int(math.floor(j + 0.5 + tz / 24))
    st, td = [day(j) for j in moons], [(day(j), L) for j, L in terms]
    zq = lambda k: [L for d, L in td if st[k] <= d < st[k + 1]]
    w = [k for k in range(len(st) - 1) if 270 in zq(k)]
    months = []
    for i, j in zip(w, w[1:]):
        leapk = next(k for k in range(i, j) if not zq(k)) if j - i == 13 else None
        n = 10
        for k in range(i, j):
            if k != leapk:
                n = n % 12 + 1
            g = dt.date.fromordinal(st[k] - 1721425)
            months.append((st[k], st[k + 1], n, k == leapk, g.year - (1 if n >= 11 and g.month <= 2 else 0)))
    _LUNAR[tz] = months
    return months

def lunar_date(date, tz=9):
    """(月, 日, 閏月か, 月の開始JDN, 旧暦の年)"""
    import bisect
    L, n = ref_lunar_months(tz), jdn(date)
    i = bisect.bisect_right([m[0] for m in L], n) - 1
    if i < 0 or n >= L[i][1]:
        raise ValueError(date)
    a, b, num, leap, ly = L[i]
    return num, n - a + 1, leap, a, ly

def lunar_year_stem(date):
    """旧正月で切り替えた年の年干"""
    return (lunar_date(date)[4] - 4) % 10

def ref_shukuyo_trad(date):
    num, day = lunar_date(date)[:2]
    return SHUKU[(SHUKU.index(SHUKU_MONTH_START[num]) + day - 1) % 27] + "宿"

def ziwei_date(date, h, boundary=23):
    """紫微斗数で旧暦を引く日。23時の流派（アプリの既定）は23時台を翌日にする（子の刻から翌日）。0時の流派（boundary=24）は日付どおり"""
    return date + dt.timedelta(days=1) if (h >= 23 and boundary == 23) else date

def ref_ziwei(date, h, boundary=23):
    date = ziwei_date(date, h, boundary)
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
    年柱: d.year.stem + d.year.branch, 月柱: d.month.stem + d.month.branch, 日柱: d.day.stem + d.day.branch, 時柱: d.hourKnown ? d.hour.stem + d.hour.branch : undefined,
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
# 許容の差（°）。2026-10-20 天体の表を太陽・月は小数4桁＋3次補間にしたので狭めた（旧: 太陽0.02・月0.3・内惑星0.05）
PLANET_TOL = [0.001, 0.004, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01]

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
    # 日の変わり目：23時の流派は23時台を翌日の日柱・翌日の日干の子の刻、0時の流派は日付どおり（2026-10-21）
    hp = lambda b: (lambda p: (p["日柱"], p["時柱"]))(ref_pillars(1995, 8, 7, 23, 30, True, b)[0])
    t("1995-08-07 23:30 日柱・時柱（23時／0時）", (hp(23), hp(24)), (("辛未", "戊子"), ("庚午", "丙子")))
    # 公開例（四柱推命ネクスト「夜子時問題」）：2024-06-24 23:30 は23時切り替えで庚申、0時切り替えで己未
    t("2024-06-24 23:30 日柱（23時／0時）", (ref_pillars(2024, 6, 24, 23, 30)[0]["日柱"], ref_pillars(2024, 6, 24, 23, 30, True, 24)[0]["日柱"]), ("庚申", "己未"))
    t("2024-06-24 0:30 日柱（どちらも同じ）", (ref_pillars(2024, 6, 25, 0, 30)[0]["日柱"], ref_pillars(2024, 6, 25, 0, 30, True, 24)[0]["日柱"]), ("庚申", "庚申"))
    print("参照の自己テスト:", "OK" if ok else "NG")
    return ok

# ─────────────── 解釈のルール（2026-10-20 外部レビューで六合の表のずれ等が見つかったので足した） ───────────────
RULES_JS = """() => {
  const ph = {};
  BRANCHES.forEach(a => BRANCHES.forEach(b => { if (a !== b) ph[a + b] = calcPhases([{branch: a}, {branch: b}]).map(x => x.type).sort().join(','); }));
  const P = ['太陽','月','水星','金星','火星','木星','土星'];
  const jy = {}; P.forEach(p => { jy[p] = Object.fromEntries([...Array(12).keys()].map(i => [i, String(JYOTISH_PLANET_READING[p][i] || '')])); });
  const fy = [[2027,1,15],[2027,2,10],[2026,2,16],[2026,2,17]].map(x => zwFlowYear(new Date(x[0], x[1]-1, x[2])).stem);
  return { ph, jy, fy };
}"""
GUARD_JS = """(cases) => cases.map(c => { const d = calcPersonData(c.bd, c.bt || '', c.bt ? 'known' : 'unknown', 'F', ''); const g = calcGuardianGod(d);
  return { el: STEM_EL[STEMS.indexOf(d.day.stem)], s: g.strength, enemy: g.enemy }; })"""
DASHA_JS = """(cases) => cases.flatMap(c => { const d = calcPersonData(c.bd, c.bt || '', c.bt ? 'known' : 'unknown', 'F', '');
  return calcDasha(norm360(d.moonLon - ayanamsha(d.jd)), d.y).dashas.map(m => { const a = calcAntardasha(m);
    return { bd: c.bd, lord: m.lord, first: !!m.isFirst, a0: a[0].lord, n: a.length, sum: a.reduce((s, x) => s + x.duration, 0), len: m.endAge - m.startAge, end: a[a.length - 1].endAge, mEnd: m.endAge, s0: a[0].startAge, mStart: m.startAge }; }); })"""
TYPE_JS = """(cases) => cases.map(c => { const d = calcPersonData(c.bd, c.bt || '', c.bt ? 'known' : 'unknown', 'X', c.bt ? '東京都' : ''); const tj = RSynth.buildSynthesis(d).tj;
  return { key: tj.key, name: tj.type.name, votes: [tj.a1, tj.a2, tj.a3, tj.a4].map(a => a.pn + a.plus + ':' + a.mn + a.minus).join(' ') }; })"""
SNAP = HERE / "_type_snapshot.json"

def type_cases():
    import random
    r = random.Random(20261020)
    out = [(bd, bt) for bd, bt, _ in CASES] + [("1973-12-16", None), ("1973-12-16", "12:00")]
    for _ in range(26):
        out.append((f"{r.randint(1950, 2010)}-{r.randint(1, 12):02d}-{r.randint(1, 28):02d}", r.choice([None, f"{r.randint(0, 23):02d}:30"])))
    return out

def run_js(js, arg=None):
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page()
        pg.goto((HERE / "index.html").as_uri())
        pg.wait_for_function("typeof EPH !== 'undefined'", timeout=60000)
        out = [pg.evaluate(j, a) if a is not None else pg.evaluate(j) for j, a in zip(js, arg)]
        b.close()
    return out

def rules_and_types(fails):
    import json
    tc = type_cases()
    base = [{"bd": bd, "bt": bt} for bd, bt, _ in CASES]
    rules, guard, dasha, types = run_js([RULES_JS, GUARD_JS, DASHA_JS, TYPE_JS], [None, base, base, [{"bd": bd, "bt": bt} for bd, bt in tc]])
    def chk(k, ok, msg=""):
        print(f"  {'✓' if ok else '✗'} {k} {msg}")
        if not ok:
            fails.setdefault(k, []).append(msg)
    print("\n■ 解釈のルール")
    B = BRANCHES
    pair = lambda s: {frozenset(s[i:i + 2]) for i in range(0, len(s), 2)}
    LIUHE, CHONG, HAI = pair("子丑寅亥卯戌辰酉巳申午未"), pair("子午丑未寅申卯酉辰戌巳亥"), pair("子未丑午寅巳卯辰申亥酉戌")
    XING = [set("寅巳申"), set("丑戌未"), set("子卯")]
    bad = []
    for a in B:
        for b in B:
            if a == b:
                continue
            want = sorted([t for t, S in (("六合", LIUHE), ("冲", CHONG), ("害", HAI)) if frozenset(a + b) in S] + (["刑"] if any({a, b} <= x for x in XING) else []))
            if rules["ph"][a + b] != ",".join(want):
                bad.append(f"{a}{b}={rules['ph'][a + b] or 'なし'}（正しくは{','.join(want) or 'なし'}）")
    chk("位相法（六合・冲・害・刑）132組", not bad, " / ".join(bad[:6]))
    SHENG = {"木": "水", "火": "木", "土": "火", "金": "土", "水": "金"}   # 生我
    KE = {"木": "金", "火": "水", "土": "木", "金": "火", "水": "土"}      # 剋我
    gbad = [f"{g['el']}・{g['s']}→{g['enemy']}" for g in guard if (g["s"] == "身弱" and g["enemy"] != KE[g["el"]]) or (g["s"] == "身強" and g["enemy"] != SHENG[g["el"]])]
    chk("守護神法の忌神（身弱＝剋我・身強＝生我）", not gbad, " / ".join(gbad))
    DEB = {"太陽": 6, "月": 7, "水星": 11, "金星": 5, "火星": 3, "木星": 9, "土星": 0}
    EXA = {"太陽": 0, "月": 1, "水星": 5, "金星": 11, "火星": 9, "木星": 3, "土星": 6}
    jbad = [f"{p}減衰" for p, i in DEB.items() if "減衰" not in rules["jy"][p][str(i)]] + [f"{p}高揚" for p, i in EXA.items() if "高揚" not in rules["jy"][p][str(i)]]
    jbad += [f"{p}の{i}に減衰" for p in DEB for i in range(12) if i != DEB[p] and "減衰" in rules["jy"][p][str(i)]]
    chk("インドの高揚・減衰（7惑星）", not jbad, " / ".join(jbad))
    want_fy = [STEMS[(lunar_date(dt.date(*x))[4] - 4) % 10] for x in [(2027, 1, 15), (2027, 2, 10), (2026, 2, 16), (2026, 2, 17)]]
    chk("紫微の流年の干（旧正月で切り替え）", rules["fy"] == want_fy, f"アプリ={rules['fy']} 参照={want_fy}")
    # 小運：途中から始まる最初の大運以外は大運と同じ星から始まり、9つ。どれも大運の始まり〜終わりをすき間なく埋める
    dbad = [f"{x['bd']} {x['lord']}期" for x in dasha if (not x["first"] and (x["a0"] != x["lord"] or x["n"] != 9))
            or abs(x["sum"] - x["len"]) > 1e-6 or abs(x["end"] - x["mEnd"]) > 1e-6 or abs(x["s0"] - x["mStart"]) > 1e-6]
    chk(f"インドの小運（{len(dasha)}の大運）", not dbad, " / ".join(dbad[:5]))
    print("\n■ 16タイプ（_type_snapshot.json と比べる。わざと変えたときは --update-types）")
    now = {f"{bd} {bt or '時刻不明'}": t for (bd, bt), t in zip(tc, types)}
    if not SNAP.exists() or "--update-types" in sys.argv:
        SNAP.write_text(json.dumps(now, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  記録した（{len(now)}人）")
        return
    old = json.loads(SNAP.read_text(encoding="utf-8"))
    diff = [k for k in now if k in old and old[k]["key"] != now[k]["key"]]
    for k in diff:
        print(f"  ✗ {k}: {old[k]['name']} → {now[k]['name']}\n      前 {old[k]['votes']}\n      今 {now[k]['votes']}")
    chk(f"タイプが前と同じ（{len(now)}人）", not diff, f"{len(diff)}人変わった" if diff else "")

# ─────────────── 旧暦の全日（2026-10-20 独立監査: 生成と検算が同じ関数を使っていて、1965・1985・2033年の誤りが一致したまま通っていた） ───────────────
LUNAR_JS = """() => { const out = [];
  for (let t = Date.UTC(1920, 0, 1); t <= Date.UTC(2080, 11, 31); t += 86400000) {
    const d = new Date(t), r = lunarDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    out.push(r ? r.year + '/' + r.month + '/' + r.day + (r.leap ? 'L' : '') : '-'); }
  return out.join(','); }"""
LUNAR_FIX = [((1965, 9, 25), (1965, 9, 1, False)), ((1985, 1, 21), (1984, 12, 1, False)), ((1985, 2, 20), (1985, 1, 1, False)),
             ((2033, 11, 22), (2033, 11, 1, False)), ((2033, 12, 22), (2033, 11, 1, True)), ((2034, 1, 20), (2033, 12, 1, False)),
             ((2034, 2, 19), (2034, 1, 1, False))]   # 香港天文台の表と国立天文台の2033年問題「閏11月案」

def hko_days():
    """香港天文台の対照表 {日付: (月, 日, 閏月か)}。閏月は同じ番号が続く月。_ref/hko/ に無ければ None（_ref/fetch_hko.py 1919 2081 で取る）"""
    import re
    out, cur = {}, None
    for y in range(1919, 2082):
        f = HERE / "_ref" / "hko" / f"T{y}e.txt"
        if not f.exists():
            return None
        for line in f.read_bytes().decode("latin-1").splitlines():
            m = re.match(r"\s*(\d{4})/(\d{1,2})/(\d{1,2})\s+(\d+)(?:st|nd|rd|th)?( Lunar [Mm]onth)?", line)
            if not m or (cur is None and not m[5]):
                continue
            if m[5]:
                cur, day = (int(m[4]), cur is not None and int(m[4]) == cur[0]), 1
            else:
                day = int(m[4])
            out[dt.date(int(m[1]), int(m[2]), int(m[3]))] = (cur[0], day, cur[1])
    return out

def check_lunar(fails):
    import bisect
    def chk(k, ok, msg=""):
        print(f"  {'✓' if ok else '✗'} {k} {msg}")
        if not ok:
            fails.setdefault(k, []).append(msg)
    print("\n■ 旧暦（generate_lunar.py とは別の書き方の参照・香港天文台の表・月の並びの決まりで全日を見る）")
    J, C = ref_lunar_months(9), ref_lunar_months(8)
    td = sorted((int(math.floor(j + 0.5 + 9 / 24)), L) for j, L in _lunar_events()[1])
    tdd = [d for d, _ in td]
    bad, per_year = [], {}
    for i, (a, b, n, lp, ly) in enumerate(J):
        zq = [L for _, L in td[bisect.bisect_left(tdd, a):bisect.bisect_left(tdd, b)]]
        g = dt.date.fromordinal(a - 1721425)
        if b - a not in (29, 30):
            bad.append(f"{g} {b - a}日")
        if lp and zq:
            bad.append(f"{g} 閏月なのに中気")
        if i and n != (J[i - 1][2] if lp else J[i - 1][2] % 12 + 1):
            bad.append(f"{g} 月番号が飛ぶ")
        bad += [f"{g} {nm}が{n}月" for L, want, nm in ((270, 11, "冬至"), (0, 2, "春分"), (90, 5, "夏至"), (180, 8, "秋分"))
                if L in zq and n != want and not (ly == 2033 and L != 270)]
        if n == 1 and not lp and (not dt.date(g.year, 1, 21) <= g <= dt.date(g.year, 2, 20) or ly != g.year):
            bad.append(f"{g} 旧正月（旧暦{ly}年）")
        per_year.setdefault(ly, []).append(lp)
    bad += [f"旧暦{y}年 閏月{sum(v)}回・{len(v)}か月" for y, v in per_year.items()
            if sum(v) > 1 or (min(per_year) < y < max(per_year) and len(v) != 12 + sum(v))]
    chk("月の並び（29/30日・番号が続く・閏月は年1回まで中気なし・冬至11月・春分2月/夏至5月/秋分8月（2033年は除く）・旧正月1/21〜2/20）", not bad, " / ".join(bad[:6]))
    fx = [f"{dt.date(*d)}={lunar_date(dt.date(*d))[4]}/{lunar_date(dt.date(*d))[0]}/{lunar_date(dt.date(*d))[1]}" for d, w in LUNAR_FIX
          if (lunar_date(dt.date(*d))[4],) + lunar_date(dt.date(*d))[:3] != w]
    chk("固定の答え（1965-09-25・1985-01-21/02-20・2033-11-22〜2034-02-19）", not fx, " / ".join(fx))
    days = [dt.date(1920, 1, 1) + dt.timedelta(n) for n in range((dt.date(2080, 12, 31) - dt.date(1920, 1, 1)).days + 1)]
    app = run_js([LUNAR_JS], [None])[0].split(",")
    fmt = lambda d: (lambda r: f"{r[4]}/{r[0]}/{r[1]}{'L' if r[2] else ''}")(lunar_date(d))
    ad = [f"{d} アプリ={a} 参照={fmt(d)}" for d, a in zip(days, app) if a != fmt(d)]
    chk(f"アプリの lunarDate と参照（{len(days)}日）", not ad, " / ".join(ad[:4]))
    H = hko_days()
    if H is None:
        chk("香港天文台の表", False, "_ref/hko/ が無い（python3 _ref/fetch_hko.py 1919 2081）")
        return
    def to_runs(ds):
        runs = []
        for d in ds:
            if runs and (d - runs[-1][1]).days == 1:
                runs[-1][1] = d
            else:
                runs.append([d, d])
        return runs
    ev = list(_lunar_events()[0]) + [j for j, _ in _lunar_events()[1]]
    def edge(d):
        """d の前後1日に、中国標準時の0時の前後15分の朔・中気がある（暦表どうしの計算差で日付が割れる。1929年以前の中国は北京の地方時＝14分早い）"""
        return any(abs(math.floor(j + 0.5 + 8 / 24) - jdn(d)) <= 1 and min((j + 0.5 + 8 / 24) % 1, 1 - (j + 0.5 + 8 / 24) % 1) < 15 / 1440 for j in ev)
    hd = [d for d in days if d in H]
    cst = to_runs([d for d in hd if lunar_date(d, 8)[:3] != H[d]])
    edge_runs = [r for r in cst if edge(r[0])]
    other = [f"{a}〜{b} 参照={lunar_date(a, 8)[:3]} 香港={H[a]}" for a, b in cst if [a, b] not in edge_runs]
    chk(f"参照を中国標準時で計算すると香港天文台の表と同じ（{len(hd)}日）", not other, " / ".join(other[:4]))
    if edge_runs:
        print("    違うのは朔が中国標準時の0時ちょうど付近の月だけ:", " ".join(f"{a}〜{b.month}/{b.day}" for a, b in edge_runs))
    mid = [dt.date.fromordinal(a + 14 - 1721425) for a, *_ in J if 1920 <= dt.date.fromordinal(a - 1721425).year <= 2080]
    numdiff = [f"{d}（日本{lunar_date(d)[0]}{'閏' if lunar_date(d)[2] else ''}月・中国{lunar_date(d, 8)[0]}{'閏' if lunar_date(d, 8)[2] else ''}月）"
               for d in mid if (lunar_date(d)[0], lunar_date(d)[2]) != (lunar_date(d, 8)[0], lunar_date(d, 8)[2])]
    print(f"    月番号・閏月まで日本と中国で違う月: {len(numdiff)}か所", " ".join(numdiff[:8]))
    jd_ = [d for d in hd if lunar_date(d)[:3] != H[d]]
    runs = to_runs(jd_)
    print(f"    日本時間だと香港天文台と違う日: {len(jd_)}日・{len(runs)}か所（朔か中気が日本時間の0時台にある。上の行で時差だけが原因と確認）")
    print("     ", " ".join(f"{a}〜{b.month}/{b.day}" for a, b in runs[:12]), "…" if len(runs) > 12 else "")

# ─────────────── 独立監査（2026-10-20）の再現例。期待値は監査が外部の表・公開例から出した値 ───────────────
AUDIT_JS = r"""() => {
  window._quietRender = true;
  const P = (bd, bt, sex, bp) => calcPersonData(bd, bt || '', bt ? 'known' : 'unknown', sex, bp || '');
  const zw = d => [BRANCHES[d.lifeIdx], d.ziweiJu, BRANCHES[d.ziweiPos], SHUKUYO_27[calcShukuyo(d)].n, d.lunar.year + '/' + d.lunar.month + '/' + d.lunar.day + (d.lunar.leap ? 'L' : ''), d.ziweiYear.stem + d.ziweiYear.branch];
  const exp = d => { currentMode = 'self'; dataB = null; currentData = d; return buildExportText(); };
  const el = id => document.getElementById(id), o = {};
  o.lunar = [zw(P('1985-01-21','12:00','F','東京都')), zw(P('1965-09-25','12:00','F','東京都')), zw(P('2034-02-19','12:00','F','東京都'))];
  o.range = [el('birthdate').min, el('birthdate').max, el('birthdate-b').min, el('birthdate-b').max, bdInRange('1919-12-31'), bdInRange('1920-01-01'), bdInRange('2080-12-31'), bdInRange('2081-01-01')];
  const s51 = P('1951-10-04','12:00','F','東京都'), ki = s51.sihua.find(s => s.type === '化忌');
  o.sihua = [ki.star, ki.unplaced, (s51.ziweiDistrib[s51.lifeIdx] || []).includes(ki.star), RSynth.buildSynthesis(s51).tj.type.name, exp(s51).includes('（副星・未配置）')];
  const x = P('1990-05-15','12:30','X','東京都'), tx = RSynth.buildSynthesis(x).timing;
  o.sexX = [dayunDirKnown(x), tx.now.some(n => n.sys === '四柱推命'), [tx.nowSpan, tx.nextSpan].filter(Boolean).some(s => s.sys.includes('四柱推命') || s.sys.includes('紫微斗数')), exp(x).includes('向き（順行・逆行）が決まりません')];
  const g = P('1990-05-15','12:30','F',''), gt = P('1990-05-15','12:30','F','東京都');
  o.geo = [g.geoTentative, gt.geoTentative, exp(g).includes('日本の中央'), g.ascLon, gt.ascLon];
  const sd = P('2024-02-04','','X',''), S = sd.setsuDay, gz = p => p.stem + p.branch;
  o.setsu = S ? [S.hh * 60 + S.mm, S.name, gz(S.before.year), gz(S.after.year), gz(S.before.month), gz(S.after.month), exp(sd).includes('節入り（立春）')] : null;
  const te = exp(sd);
  o.tie = [te.includes('0票 対 0票'), /楽観的（支持割合50%/.test(te)];
  const dy = calcDayun(P('2080-06-01','12:00','M','東京都'))[0];
  o.dayun2080 = [dy.stem + dy.branch, dy.startAge];
  o.moon = getMoonLon(julianDay(2000, 5, 31, 0, 0));
  o.kanro = sunCrossJd(195, julianDay(2000, 10, 8, 8, 40));
  const A = P('2025-01-16','','F',''), B = P('2025-01-07','','F',''), c1 = shukuyoCompat(calcShukuyo(A), calcShukuyo(B));
  o.shuku = [SHUKUYO_27[calcShukuyo(A)].n, SHUKUYO_27[calcShukuyo(B)].n, c1.seen, c1.type, compatScore(A, B).total, compatScore(B, A).total, compatScore(A, B).rows.map(r => r.name)];
  o.kango = compatScore(P('2001-01-01','12:00','F','東京都'), P('2001-01-06','12:00','F','東京都')).rows.find(r => r.name === '四柱推命').score;
  currentData = P('2026-06-01','12:00','F','東京都'); dataB = P('1990-05-15','12:30','F','東京都'); currentMode = 'compat';
  o.mainStar = (buildCompatExportText().match(/◆ 紫微斗数: 命宮主星 (\S+)/) || [])[1];
  currentMode = 'self'; dataB = null;
  const s22 = P('2022-02-02','12:00','F','東京都');
  o.sihuaLabel = [s22.year.stem, s22.ziweiYear.stem, (exp(s22).match(/◆ 四化（生年干：(\S)/) || [])[1]];
  o.kyNow = [kyuseiNowYear(new Date(2027,0,20,12,0)), kyuseiNowYear(new Date(2027,1,3,12,0)), kyuseiNowYear(new Date(2027,1,4,12,0)), zwFlowYear(new Date(2027,0,20)).year];
  o.asc = detectAspects(gt.planets, gt.ascLon).filter(a => a.p1 === 'ASC' || a.p2 === 'ASC').map(a => [a.p1, a.p2, a.name, a.orb]);
  o.radar = Object.values(calcPersonalityRadar(P('1990-05-15','','F',''), null, null).__voters).some(s => [...s].some(v => /^紫微/.test(v)));
  currentData = P('1990-05-15','00:00','F','東京都'); const k0 = RSynth.answerKey(10);
  currentData = P('1990-05-15','23:30','F','東京都'); const k1 = RSynth.answerKey(10);
  o.answerKey = [k0, k1];
  // 23時台の生まれ（2026-10-21 23時の流派を既定に）：四柱タブのカード、算命学は日付どおり、AI用の文、保存キー
  const tt = i => { const e = document.getElementById('tab' + i); const h = e.classList.contains('hide'); e.classList.remove('hide'); const s = e.innerText; if (h) e.classList.add('hide'); return s; };
  const lz = P('1995-08-07','23:30','F','東京都'); currentMode = 'self'; dataB = null; currentData = lz; renderAll();
  const lt1 = tt(1), lt3 = tt(3), lex = exp(lz);
  const lt2 = tt(2);
  o.lateZiView = [lt1.includes('23時台の生まれです'), /日柱 — 本当の自分\s*庚午/.test(lt3), lt3.includes('算命学は生まれた時刻を使わないので'),
    lex.includes('日の変わり目: 23時'), lex.includes('0時で切り替え）では 日柱庚午・時柱丙子'), lex.includes('◆ 日柱: 庚午（算命学は'),
    // 紫微斗数タブにも同じ切り替えのカード。AI用の文の紫微の欄に、もう一方の流派の旧暦の日と命宮の主星
    !!document.getElementById('day-boundary-2') && lt2.includes('紫微斗数は、日の変わり目を23時'), lt2.includes('今は23時の流派・旧暦'),
    lex.includes('0時の流派では旧暦') && lex.includes('流派で命盤が変わる人なので')];
  const nz = P('1995-08-07','22:30','F','東京都'); currentData = nz; renderAll();
  const nt1 = tt(1);
  o.noLateZi = [nz.lateZi === null, nt1.includes('23時台の生まれです'), nt1.includes('あなたの日柱はどちらでも同じです')];
  localStorage.setItem('sanmeiban_shichu_day', '24'); currentData = P('1995-08-07','23:30','F','東京都'); const k24 = RSynth.answerKey(10);
  localStorage.removeItem('sanmeiban_shichu_day'); currentData = P('1995-08-07','23:30','F','東京都'); const k23 = RSynth.answerKey(10);
  o.lateZiKey = [k23, k24];
  return o;
}"""

def check_audit(fails):
    def chk(k, ok, msg=""):
        print(f"  {'✓' if ok else '✗'} {k} {msg if not ok else ''}")
        if not ok:
            fails.setdefault(k, []).append(msg)
    print("\n■ 独立監査（2026-10-20）の再現例")
    o = run_js([AUDIT_JS], [None])[0]
    want = [["未", 5, "午", "虚宿", "1984/12/1", "甲子"], ["辰", None, None, "氐宿", "1965/9/1", "乙巳"], ["申", 4, "亥", "室宿", "2034/1/1", "甲寅"]]
    got = [[a if w is not None else None for a, w in zip(g, ws)] for g, ws in zip(o["lunar"], want)]
    chk("旧暦の誤配当（1985-01-21・1965-09-25・2034-02-19）", got == want, f"アプリ={o['lunar']}")
    chk("入力の範囲（1920〜2080年）", o["range"] == ["1920-01-01", "2080-12-31", "1920-01-01", "2080-12-31", False, True, True, False], f"{o['range']}")
    chk("四化の副星（1951-10-04 文昌化忌が命宮・オラクル）", o["sihua"] == ["文昌", False, True, "オラクル", False], f"{o['sihua']}")
    chk("性別「言わない」（大運の向きは仮・時期の判断に入れない）", o["sexX"] == [False, False, False, True], f"{o['sexX']}")
    ref_asc = [swe.houses(jd_ut(1990, 5, 15, 12, 30), la, lo, b"P")[1][0] for la, lo in ((35.0, 135.0), (35.69, 139.69))]
    chk("出生地未選択（上昇点は仮と書く）", o["geo"][:3] == [True, False, True] and all(angdiff(a, r) < 0.05 for a, r in zip(o["geo"][3:], ref_asc)),
        f"{o['geo']} 参照ASC={[round(r, 2) for r in ref_asc]}")
    t = swe.solcross_ut(315.0, swe.julday(2024, 1, 25, 0))
    want_min = int(round(((t + 9 / 24 + 0.5) % 1) * 1440))
    chk("節入りの日・時刻不明（2024-02-04 立春の注意書き）", bool(o["setsu"]) and abs(o["setsu"][0] - want_min) <= 1 and o["setsu"][1:] == ["立春", "癸卯", "甲辰", "乙丑", "丙寅", True],
        f"アプリ={o['setsu']} 参照の時刻={want_min // 60}:{want_min % 60:02d}")
    chk("0票対0票の軸（AI用の文で「判定材料なし」）", o["tie"] == [True, False], f"{o['tie']}")
    chk("2080年生まれの大運（壬午・1歳）", o["dayun2080"] == ["壬午", 1], f"{o['dayun2080']}")
    rm = lon(jd_ut(2000, 5, 31, 0, 0), swe.MOON)
    chk("月の位置（2000-05-31 00:00）", angdiff(o["moon"], rm) < 0.003, f"アプリ={o['moon']:.5f} 参照={rm:.5f}")
    tk = swe.solcross_ut(195.0, swe.julday(2000, 10, 1, 0))
    chk("節入りの時刻（2000年 寒露）", abs(o["kanro"] - tk) * 86400 < 30, f"差 {abs(o['kanro'] - tk) * 86400:.0f}秒")
    SEQ = list("命栄衰安危成壊友親業栄衰安危成壊友親胎栄衰安危成壊友親")   # 三九の秘法：自分の宿を命として数える
    s = o["shuku"]
    ref_dir = [SEQ[(SHUKU.index("昴") - SHUKU.index("翼")) % 27], SEQ[(SHUKU.index("翼") - SHUKU.index("昴")) % 27]]
    chk("宿曜の向き（翼宿から見て昴宿は胎・昴宿から見て翼宿は業）", s[:4] == ["翼宿", "昴宿"] + ref_dir and ref_dir == ["胎", "業"], f"{s[:4]}")
    chk("相性総合（入れ替えて同じ点・9占術が1行ずつ）", s[4] == s[5] and sorted(s[6]) == sorted(["西洋占星術", "四柱推命", "紫微斗数", "算命学", "数秘術", "九星気学", "マヤ暦", "宿曜", "インド占星術"]), f"{s[4:]}")
    chk("四柱の相性（甲×己は干合で85点）", o["kango"] == 85, f"{o['kango']}")
    chk("相性のAI用の文の命宮主星（2026-06-01 は天相だけ）", o["mainStar"] == "天相", f"{o['mainStar']}")
    chk("四化の見出しの年干（2022-02-02 は壬）", o["sihuaLabel"] == ["辛", "壬", "壬"], f"{o['sihuaLabel']}")
    chk("九星の今年（立春で切り替え）・紫微の流年（旧正月）", o["kyNow"] == [2026, 2026, 2027, 2026], f"{o['kyNow']}")
    m = [a for a in o["asc"] if "水星" in a[:2]]
    chk("上昇点とのアスペクト（水星–ASC 三分）", bool(m) and m[0][2] == "三分" and abs(m[0][3] - 1.05) < 0.1, f"{o['asc']}")
    chk("時刻不明の紫微を性格の集計に入れない", o["radar"] is False)
    chk("AIの答えの保存キー（00:00 と 23:30 で別）", o["answerKey"][0] != o["answerKey"][1], f"{o['answerKey']}")
    chk("23時台の表示（四柱・紫微のタブにカード・算命学は日付どおりの庚午・AI用の文に日の変わり目ともう一方の流派）", o["lateZiView"] == [True] * 9, f"{o['lateZiView']}")
    chk("23時台以外にはカードを出さない（22:30）", o["noLateZi"] == [True, False, True], f"{o['noLateZi']}")
    k = o["lateZiKey"]
    chk("AIの答えの保存キー（23時台で0時の流派のときだけ _d24・既定のキーは前と同じ）", k[0] != k[1] and k[1].endswith("_d24") and not k[0].endswith("_d24"), f"{k}")

DAYB_JS = r"""(cases) => { const out = {};
  for (const b of ['23', '24']) {
    localStorage.setItem('sanmeiban_shichu_day', b);
    out[b] = cases.map(c => { const d = calcPersonData(c.bd, c.bt, 'known', 'F', '東京都'), sm = calcJintai(d);
      return { 日柱: d.day.stem + d.day.branch, 時柱: d.hour.stem + d.hour.branch, 十神: d.pillars.map(p => p.ten).join(','),
        算命日柱: sm.day.stem + sm.day.branch, 中心星: sm.stars.center, 西: sm.stars.west, 天中殺: BRANCHES[sm.k1] + BRANCHES[sm.k2], lateZi: !!d.lateZi, b: d.dayBoundary,
        旧暦: d.lunar.year + '/' + d.lunar.month + '/' + d.lunar.day + (d.lunar.leap ? 'L' : ''), 命宮: BRANCHES[d.lifeIdx], 五行局: d.ziweiJu, 紫微星: BRANCHES[d.ziweiPos],
        紫微年干: d.ziweiYear.stem, 宿: SHUKUYO_27[calcShukuyo(d)].n }; });
  }
  localStorage.removeItem('sanmeiban_shichu_day');
  return out; }"""

def check_day_boundary(fails):
    """日の変わり目：23時の流派（既定）と0時の流派の両方で、四柱推命の日柱・時柱・十神と、紫微斗数の旧暦の日・命宮・五行局・紫微星・年干を参照と比べる。
    算命学と宿曜はどちらでも日付どおりか"""
    def chk(k, ok, msg=""):
        print(f"  {'✓' if ok else '✗'} {k} {msg if not ok else ''}")
        if not ok:
            fails.setdefault(k, []).append(msg)
    print("\n■ 日の変わり目（23時の流派＝既定／0時の流派）：四柱推命・紫微斗数")
    # 紫微の境目：2024-02-09 は旧正月の前日（23時台は翌日の旧暦1月1日＝年干が癸→甲）、2024-03-09 は旧暦2月1日の前日（月が変わる）、2023-03-21 は閏2月1日の前日
    cases = [(bd, bt) for bd, bt, _ in CASES if bt] + [("2024-06-24", "23:30"), ("2024-06-24", "22:59"), ("2024-06-25", "00:30"), ("2000-01-01", "23:59"),
             ("1980-02-29", "23:10"), ("2080-12-31", "23:30"), ("2024-02-04", "23:30"), ("1964-10-10", "23:00"), ("1920-01-01", "23:45"),
             ("2024-02-09", "23:30"), ("2024-03-09", "23:30"), ("2023-03-21", "23:30")]
    app = run_js([DAYB_JS], [[{"bd": bd, "bt": bt} for bd, bt in cases]])[0]
    TEN = ["比肩", "劫財", "食神", "傷官", "偏財", "正財", "偏官", "正官", "偏印", "正印"]
    for b in ("23", "24"):
        bad = []
        for (bd, bt), a in zip(cases, app[b]):
            y, m, d = map(int, bd.split("-"))
            h, mi = map(int, bt.split(":"))
            p, cal = ref_pillars(y, m, d, h, mi, True, int(b))[0], ref_pillars(y, m, d, h, mi, True, 24)[0]
            ds = STEMS.index(p["日柱"][0])
            tg = lambda k: TEN[JUSSHU.index(jusshu(ds, STEMS.index(p[k][0])))]
            sm = ref_sanmei(cal, setsu_days(y, m, d, h, mi))
            date = dt.date(y, m, d)
            zw, L = ref_ziwei(date, h, int(b)), lunar_date(ziwei_date(date, h, int(b)))
            want = {"日柱": p["日柱"], "時柱": p["時柱"], "十神": ",".join([tg("年柱"), tg("月柱"), "日主", tg("時柱")]), "算命日柱": cal["日柱"],
                    "中心星": sm["中央"], "西": sm["西"], "天中殺": cal["天中殺"], "lateZi": h >= 23, "b": b,
                    "旧暦": f"{L[4]}/{L[0]}/{L[1]}" + ("L" if L[2] else ""), "命宮": zw["命宮"], "五行局": zw["五行局"], "紫微星": zw["紫微星"],
                    "紫微年干": STEMS[(L[4] - 4) % 10], "宿": ref_shukuyo_trad(date)}
            diff = [f"{k}={a[k]}/{v}" for k, v in want.items() if a[k] != v]
            if diff:
                bad.append(f"{bd} {bt} " + " ".join(diff))
        chk(f"{'23時' if b == '23' else '0時'}の流派（{len(cases)}人：四柱の日柱・時柱・十神／紫微の旧暦の日・命宮・局・紫微星・年干／算命学と宿曜は日付どおり）",
            not bad, " / ".join(bad[:3]))
    # 紫微の境目の3人で、流派によって本当に旧暦の日（月・年）が変わっているか（参照どうしで確かめる）
    edge = {bd: (lunar_date(ziwei_date(dt.date(*map(int, bd.split("-"))), 23, 23)), lunar_date(dt.date(*map(int, bd.split("-")))))
            for bd in ("2024-02-09", "2024-03-09", "2023-03-21")}
    ok = (edge["2024-02-09"][0][4], edge["2024-02-09"][1][4]) == (2024, 2023) and (edge["2024-03-09"][0][0], edge["2024-03-09"][1][0]) == (2, 1) \
        and edge["2023-03-21"][0][2] and not edge["2023-03-21"][1][2]
    chk("紫微の境目の例（旧正月の前日は年が、旧暦1日の前日は月が、閏月の前日は閏が、23時の流派で翌日の側になる）", ok,
        f"{ {k: (v[0][4], v[0][0], v[0][1], v[0][2], v[1][4], v[1][0], v[1][1], v[1][2]) for k, v in edge.items()} }")

ICHING_JS = r"""() => {
  const TRI = ICHING_TRI, out = { table: {}, names: ICHING_64.map(h => h.n), casts: [] };
  TRI.forEach(u => TRI.forEach(l => { const i = ICHING_BY_TRIGRAM[u + l]; out.table[u + "/" + l] = (i === undefined ? null : i); }));
  for (let k = 0; k < 4000; k++) { const r = ichingCast();
    out.casts.push([r.sums.join(""), r.lines.join(""), r.moving.map(m => m ? 1 : 0).join(""), r.main, r.zhi, r.upper, r.lower]); }
  return out; }"""

def check_iching(fails):
    """易経：上下の卦→64卦の対応が64通りそろって一意か、名前の上下卦と合うか、変爻と之卦が決まりどおりか。
    2026-10-24 の指摘：手書きの対応表が左右対称で、35種類しか出せず45組が別の卦だった"""
    def chk(k, ok, msg=""):
        print(f"  {'✓' if ok else '✗'} {k} {msg if not ok else ''}")
        if not ok:
            fails.setdefault(k, []).append(msg)
    print("\n■ 易経（64卦の対応・変爻・之卦）")
    o = run_js([ICHING_JS], [None])[0]
    TRI = ["乾", "兌", "離", "震", "巽", "坎", "艮", "坤"]
    NATURE = {"天": "乾", "沢": "兌", "澤": "兌", "火": "離", "雷": "震", "風": "巽", "水": "坎", "山": "艮", "地": "坤"}
    names, table = o["names"], o["table"]
    chk("64卦の名前がそろっている", len(names) == 64, f"{len(names)}個")
    # 参照：卦の名前から上下卦を読む（アプリと同じ読み方だが、こちらは文王64卦序の代表例でも裏を取る）
    ref = {}
    for i, n in enumerate(names):
        up, lo = (n[0], n[0]) if "為" in n else (NATURE.get(n[0]), NATURE.get(n[1]))
        if "為" in n:
            up = lo = n[0]
        if up in TRI and lo in TRI:
            ref[up + "/" + lo] = i
    chk("64通りすべてに卦がある（抜けなし）", all(table.get(f"{u}/{l}") is not None for u in TRI for l in TRI),
        " ".join(f"{u}/{l}" for u in TRI for l in TRI if table.get(f"{u}/{l}") is None))
    vals = [table[f"{u}/{l}"] for u in TRI for l in TRI]
    chk("64卦が1つずつ（重複なし）", len(set(vals)) == 64, f"{len(set(vals))}種類しか出ない")
    bad = [f"上{u}・下{l}→{names[table[f'{u}/{l}']]}（名前は{u}/{l}でない）" for u in TRI for l in TRI
           if table.get(f"{u}/{l}") is not None and ref.get(f"{u}/{l}") != table[f"{u}/{l}"]]
    chk("引いた卦の名前が上下の卦と合っている", not bad, " / ".join(bad[:4]))
    # 文王64卦序の代表例（外から確かめられる固定の答え）
    KNOWN = [("乾", "兌", "天沢履"), ("兌", "乾", "沢天夬"), ("坎", "震", "水雷屯"), ("離", "坎", "火水未済"),
             ("坤", "乾", "地天泰"), ("乾", "坤", "天地否"), ("艮", "坤", "山地剥"), ("震", "乾", "雷天大壮"),
             ("乾", "乾", "乾為天"), ("坤", "坤", "坤為地"), ("巽", "兌", "風沢中孚"), ("坎", "離", "水火既済")]
    ng = [f"上{u}・下{l}＝{names[table[f'{u}/{l}']]}（期待 {w}）" for u, l, w in KNOWN if names[table[f"{u}/{l}"]] != w]
    chk(f"文王64卦序の固定の答え（{len(KNOWN)}組）", not ng, " / ".join(ng))
    # 立卦：合計6〜9、陰陽、変爻、之卦、上下卦の取り方
    cs, sums = o["casts"], {}
    bad2 = []
    for s, ln, mv, main, zhi, up, lo in cs:
        for i, c in enumerate(s):
            sums[c] = sums.get(c, 0) + 1
            if not ("6" <= c <= "9"):
                bad2.append(f"合計{c}")
            if (int(c) % 2 == 1) != (ln[i] == "1"):
                bad2.append("陰陽が合計と合わない")
            if (c in "69") != (mv[i] == "1"):
                bad2.append("変爻が老陰・老陽と合わない")
        t = lambda b: TRI[{"111": 0, "110": 1, "101": 2, "100": 3, "011": 4, "010": 5, "001": 6, "000": 7}[b]]
        if (up, lo) != (t(ln[3:6]), t(ln[0:3])):
            bad2.append("上下の卦の取り方（上＝4〜6本目・下＝1〜3本目）")
        if main != table[f"{up}/{lo}"]:
            bad2.append("卦が対応表と違う")
        want = None if "1" not in mv else table[f"{t(''.join('1' if (ln[i] == '0') == (mv[i] == '1') else '0' for i in range(3, 6)))}/{t(''.join('1' if (ln[i] == '0') == (mv[i] == '1') else '0' for i in range(0, 3)))}"]
        if zhi != want:
            bad2.append("之卦が変爻の反転と合わない")
    chk(f"立卦（{len(cs)}回：合計6〜9・陰陽・変爻・上下卦・之卦）", not bad2, " / ".join(sorted(set(bad2))[:4]))
    n = len(cs) * 6
    r69 = (sums.get("6", 0) + sums.get("9", 0)) / n
    chk(f"コイン3枚の出方（老陰・老陽が約1/4 → {r69 * 100:.1f}%）", 0.2 < r69 < 0.3, f"{r69 * 100:.1f}%")

# ─────────── 表の独立照合（2026-10-23）。アプリの式・既存の参照の写しを使わず、外部に公開されている規則と表から組み立てる ───────────
# 十二大従星：十二運の規則（長生の支＋陽干順行・陰干逆行）と、十二運→星名・点数の1対1対応から120通りを導く。
#   出典＝sanmeiscope.com「十二大従星とは？12星の意味一覧とエネルギー点数を図解で解説」（長生の支の表・十二運との対応・点数・公開例）
JU_START = {"甲": "亥", "乙": "午", "丙": "寅", "丁": "酉", "戊": "寅", "己": "酉", "庚": "巳", "辛": "子", "壬": "申", "癸": "卯"}
JU_ORDER = ["長生", "沐浴", "冠帯", "建禄", "帝旺", "衰", "病", "死", "墓", "絶", "胎", "養"]
JU_STAR = {"胎": ("天報星", 3), "養": ("天印星", 6), "長生": ("天貴星", 9), "沐浴": ("天恍星", 7),
           "冠帯": ("天南星", 10), "建禄": ("天禄星", 11), "帝旺": ("天将星", 12), "衰": ("天堂星", 8),
           "病": ("天胡星", 4), "死": ("天極星", 2), "墓": ("天庫星", 5), "絶": ("天馳星", 1)}

def juusei_rule(day_stem, branch):
    """日干と支から、十二運の規則で十二大従星と点数を出す（表を写さない）"""
    si = STEMS.index(day_stem)
    step = 1 if si % 2 == 0 else -1                      # 陽干は順行・陰干は逆行
    k = ((BRANCHES.index(branch) - BRANCHES.index(JU_START[day_stem])) * step) % 12
    return JU_STAR[JU_ORDER[k]]

# 紫微斗数の副星：古典の規則と、外部に公開されている年支系の表から導く。
#   天魁天鉞＝貴人歌「甲戊庚牛羊、乙己鼠猴郷、丙丁猪鶏位、壬癸蛇兎藏、六辛逢馬虎」（最も古い口訣。庚を寅午とする流派もある）
#   禄存＝十干の建禄（臨官）の支／天馬＝三合の駅馬／紅鸞・天喜＝紫微改運研究室「命盤作成＜副星２＞」の年支系諸星の表
#   左輔＝辰から旧暦月で順行・右弼＝戌から逆行／文曲＝辰から生時で順行・文昌＝戌から逆行
KUI_SONG = {"甲": "丑未", "戊": "丑未", "庚": "丑未", "乙": "子申", "己": "子申",
            "丙": "亥酉", "丁": "亥酉", "壬": "卯巳", "癸": "卯巳", "辛": "午寅"}
LU_JIANLU = {"甲": "寅", "乙": "卯", "丙": "巳", "丁": "午", "戊": "巳", "己": "午",
             "庚": "申", "辛": "酉", "壬": "亥", "癸": "子"}
MA_SANHE = {"申": "寅", "子": "寅", "辰": "寅", "巳": "亥", "酉": "亥", "丑": "亥",
            "寅": "申", "午": "申", "戌": "申", "亥": "巳", "卯": "巳", "未": "巳"}
HONGLUAN_TBL = "卯寅丑子亥戌酉申未午巳辰"      # 年支 子丑寅卯辰巳午未申酉戌亥 の順
TIANXI_TBL = "酉申未午巳辰卯寅丑子亥戌"
# 四化：生年干ごとに化禄・化権・化科・化忌が付く星。出典＝note「紫微斗数の四化①：四化表」（一般的に使われる表。流派で一部違う）
SIHUA_TBL = {"甲": "廉貞 破軍 武曲 太陽", "乙": "天機 天梁 紫微 太陰", "丙": "天同 天機 文昌 廉貞",
             "丁": "太陰 天同 天機 巨門", "戊": "貪狼 太陰 右弼 天機", "己": "武曲 貪狼 天梁 文曲",
             "庚": "太陽 武曲 太陰 天同", "辛": "巨門 太陽 文曲 文昌", "壬": "天梁 紫微 左輔 武曲",
             "癸": "破軍 巨門 太陰 貪狼"}

def fuxing_rule(year_stem, year_branch, lunar_month, hour_branch_idx):
    """副星10星の宮（地支の名前）を、規則と外部の表から出す"""
    b = lambda i: BRANCHES[i % 12]
    kui = KUI_SONG[year_stem]
    yb = BRANCHES.index(year_branch)
    return {"左輔": b(4 + lunar_month - 1), "右弼": b(10 - (lunar_month - 1)),
            "文曲": b(4 + hour_branch_idx), "文昌": b(10 - hour_branch_idx),
            "天魁": kui[0], "天鉞": kui[1],
            "禄存": LU_JIANLU[year_stem], "天馬": MA_SANHE[year_branch],
            "紅鸞": HONGLUAN_TBL[yb], "天喜": TIANXI_TBL[yb]}

TABLE_JS = r"""() => {
  const out = { ju: {}, e: {}, fx: {}, sel: {} };
  // 十二大従星：日干×支の120通りと点数
  STEMS.forEach((s, si) => BRANCHES.forEach((b, bi) => {
    const x = JUUNI_STARS[JUUNI_TABLE[si][bi]];
    out.ju[s + b] = x.n; out.e[s + b] = x.e;
  }));
  // 副星6星：年干10 × 旧暦月1〜12 × 時支0〜11（左輔右弼は月、文昌文曲は時、天魁天鉞は年干で決まる）
  STEMS.forEach(s => { for (let m = 1; m <= 12; m++) for (let h = 0; h < 12; h++) {
    const f = calcFuxing(s, m, h);
    out.fx[s + "_" + m + "_" + h] = ["左輔", "右弼", "文曲", "文昌", "天魁", "天鉞"].map(k => BRANCHES[f[k]]).join("");
  } });
  // 厳選副星4星：年干10 × 年支12
  STEMS.forEach(s => BRANCHES.forEach(b => {
    const f = calcSelectFuxing(s, b);
    out.sel[s + b] = ["禄存", "天馬", "紅鸞", "天喜"].map(k => BRANCHES[f[k]]).join("");
  }));
  // 四化：生年干10
  out.sihua = {};
  STEMS.forEach(s => { out.sihua[s] = SIHUA_TABLE[s].join(" "); });
  return out;
}"""

def check_tables(fails):
    """外部に公開されている規則・表と、アプリの出す値を突き合わせる（アプリの式も、これまでの参照の写しも使わない）"""
    def chk(k, ok, msg=""):
        print(f"  {'✓' if ok else '✗'} {k} {msg if not ok else ''}")
        if not ok:
            fails.setdefault(k, []).append(msg)
    print("\n■ 表の独立照合（外部に公開されている規則・表 vs アプリ）")
    app = run_js([TABLE_JS], [None])[0]
    # ① 十二大従星120通り：十二運の規則から導いたもの vs これまで写していた表 vs アプリ
    bad = [(s, b) for s in STEMS for b in BRANCHES if juusei_rule(s, b)[0] != juusei(s, b)]
    chk("十二大従星120通り（十二運の規則 vs これまで写していた表）", not bad, f"違い {bad[:6]}")
    bad = [(s, b, app["ju"][s + b], juusei_rule(s, b)[0]) for s in STEMS for b in BRANCHES if app["ju"][s + b] != juusei_rule(s, b)[0]]
    chk("十二大従星120通り（十二運の規則 vs アプリ）", not bad, f"違い {bad[:6]}")
    bad = [(s, b, app["e"][s + b], juusei_rule(s, b)[1]) for s in STEMS for b in BRANCHES if app["e"][s + b] != juusei_rule(s, b)[1]]
    chk("十二大従星の点数120通り（天報3・天印6・天貴9・天恍7・天南10・天禄11・天将12・天堂8・天胡4・天極2・天庫5・天馳1）", not bad, f"違い {bad[:6]}")
    ex = [juusei_rule("庚", x) for x in ("寅", "酉", "午")]
    chk("公開例 1986-09-23（丙寅・丁酉・庚午）＝天馳1・天将12・天恍7", ex == [("天馳星", 1), ("天将星", 12), ("天恍星", 7)], f"{ex}")
    # ② 紫微の副星：規則と外部の表から導いたもの vs アプリ（1440通り＋120通り）
    bad = []
    for s in STEMS:
        for m in range(1, 13):
            for h in range(12):
                r = fuxing_rule(s, "子", m, h)
                want = "".join(r[k] for k in ("左輔", "右弼", "文曲", "文昌", "天魁", "天鉞"))
                if app["fx"][f"{s}_{m}_{h}"] != want:
                    bad.append((s, m, h, app["fx"][f"{s}_{m}_{h}"], want))
    chk("副星6星 1440通り（左輔＝辰から旧暦月で順行・右弼＝戌から逆行・文曲＝辰から生時で順行・文昌＝戌から逆行・天魁天鉞＝貴人歌）",
        not bad, f"違い {len(bad)}件 {bad[:4]}")
    bad = []
    for s in STEMS:
        for b in BRANCHES:
            r = fuxing_rule(s, b, 1, 0)
            want = "".join(r[k] for k in ("禄存", "天馬", "紅鸞", "天喜"))
            if app["sel"][s + b] != want:
                bad.append((s, b, app["sel"][s + b], want))
    chk("厳選副星4星 120通り（禄存＝建禄の支・天馬＝三合の駅馬・紅鸞と天喜＝年支系諸星の表）", not bad, f"違い {len(bad)}件 {bad[:4]}")
    # ③ 外部に書かれている性質で裏を取る
    same = [m for m in range(1, 13) if app["fx"][f"甲_{m}_0"][0] == app["fx"][f"甲_{m}_0"][1]]
    chk("左輔と右弼が同じ宮になるのは旧暦4月と10月だけ（外部の記述と合うか）", same == [4, 10], f"{same}")
    same = [h for h in range(12) if app["fx"][f"甲_1_{h}"][2] == app["fx"][f"甲_1_{h}"][3]]
    chk("文曲と文昌が同じ宮になるのは卯の刻と酉の刻だけ（辰と戌から逆向きに同じ歩数）", same == [3, 9], f"{[BRANCHES[h] for h in same]}")
    opp = all((BRANCHES.index(app["sel"][s + b][2]) + 6) % 12 == BRANCHES.index(app["sel"][s + b][3]) for s in STEMS for b in BRANCHES)
    chk("紅鸞と天喜は必ず向かい合う宮にある（外部の記述「必ず対拱する」）", opp)
    chk("天魁と天鉞は同じ宮にならない（外部の記述「同宮することがない」）",
        all(app["fx"][f"{s}_1_0"][4] != app["fx"][f"{s}_1_0"][5] for s in STEMS))
    # ④ 四化の表（生年干→化禄・化権・化科・化忌）
    bad = [(s, app["sihua"][s], SIHUA_TBL[s]) for s in STEMS if app["sihua"][s] != SIHUA_TBL[s]]
    chk("四化の表10干（外部に公開されている四化表 vs アプリ）", not bad, f"違い {bad}")

def check_ui(fails):
    """画面の操作で確かめる（入力欄・相手の時刻欄・出生地未選択・性別「言わない」・範囲外の日付・端末の日付を固定した「今年」）"""
    def chk(k, ok, msg=""):
        print(f"  {'✓' if ok else '✗'} {k} {msg if not ok else ''}")
        if not ok:
            fails.setdefault(k, []).append(msg)
    print("\n■ 画面の操作")
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        ctx = b.new_context(timezone_id="Asia/Tokyo")
        pg = ctx.new_page()
        pg.clock.set_fixed_time(dt.datetime(2027, 1, 20, 12, 0, tzinfo=dt.timezone(dt.timedelta(hours=9))))
        alerts = []
        pg.on("dialog", lambda dlg: (alerts.append(dlg.message), dlg.accept()))
        pg.goto((HERE / "index.html").as_uri() + "?new")
        pg.wait_for_function("typeof EPH !== 'undefined'", timeout=60000)
        pg.evaluate("() => localStorage.clear()")
        # 範囲外の日付は止める
        pg.fill("#birthdate", "1919-12-31")
        pg.evaluate("() => cast()")
        chk("範囲外の生年月日で止める", bool(alerts) and "1920年1月1日" in alerts[-1] and pg.evaluate("() => currentData") is None, f"{alerts}")
        # 相性：相手の時刻欄に入れるだけで「時刻あり」になる。本人は時刻あり・出生地を選ばない・性別「言わない」
        pg.click("#mode-compat-label")
        pg.fill("#birthdate", "1990-05-15")
        pg.evaluate("() => { document.getElementById('more-input').open = true; }")
        pg.fill("#birthtime", "12:30")
        pg.fill("#birthdate-b", "1995-08-07")
        pg.fill("#birthtime-b", "23:30")
        pg.click('label:has(input[name="sex-b"][value="F"])')
        pg.select_option("#birthplace-b", "東京都")
        chk("相手の時刻欄で「時刻あり」になる", pg.eval_on_selector("#timemode-b", "e => e.value") == "known")
        pg.evaluate("() => cast()")
        pg.wait_for_function("() => dataB && !document.getElementById('calc-overlay')", timeout=20000)
        # 23時の流派（既定）なので日柱は翌日の辛未・時柱は戊子。タイプは、時刻ありで直接計算したものと同じになるか（画面の入力欄を通しても同じ値）
        r = pg.evaluate("""() => ({ b: [dataB.tm, dataB.day.stem + dataB.day.branch, dataB.hour.stem + dataB.hour.branch, BRANCHES[dataB.lifeIdx]],
          t: [RSynth.buildSynthesis(dataB).tj.type.name, RSynth.buildSynthesis(calcPersonData('1995-08-07', '23:30', 'known', 'F', '東京都')).tj.type.name] })""")
        life23 = ref_ziwei(dt.date(1995, 8, 7), 23, 23)["命宮"]
        chk(f"相手 1995-08-07 23:30（時刻あり・23時の流派で辛未・戊子・命宮{life23}）", r["b"] == ["known", "辛未", "戊子", life23] and r["t"][0] == r["t"][1], f"{r}")
        # 日の変わり目の切り替え（相性モードのまま。お相手が23時台）。紫微の旧暦の日は、23時の流派で翌日（8/8）、0時の流派で日付どおり（8/7）
        fmt = lambda L: f"{L[0]}/{L[1]}" + ("L" if L[2] else "")
        zw23, zw24 = fmt(lunar_date(dt.date(1995, 8, 8))), fmt(lunar_date(dt.date(1995, 8, 7)))
        st = """(t) => ({ b: [dataB.day.stem + dataB.day.branch, dataB.hour.stem + dataB.hour.branch, calcJintai(dataB).day.stem + calcJintai(dataB).day.branch,
            dataB.lunar.month + '/' + dataB.lunar.day + (dataB.lunar.leap ? 'L' : '')],
          a: [currentData.h, currentData.day.stem + currentData.day.branch], mode: currentMode, ls: localStorage.getItem('sanmeiban_shichu_day'),
          tab: !document.getElementById('tab' + t).classList.contains('hide'),
          pressed: document.querySelector('#day-boundary-' + t + ' button[aria-pressed="true"]').textContent })"""
        for t, name in ((1, "四柱推命"), (2, "紫微斗数")):
            pg.evaluate(f"() => setTab({t})")
            card = pg.locator(f"#day-boundary-{t}")
            b23, b24 = card.get_by_role("button", name="23時で切り替える（標準）"), card.get_by_role("button", name="0時で切り替える")
            chk(f"{name}タブに日の変わり目の切り替えが出る（23時が選ばれている）", card.count() == 1 and b23.get_attribute("aria-pressed") == "true" and b24.get_attribute("aria-pressed") == "false")
            b24.click()
            r = pg.evaluate(st, t)
            chk(f"{name}タブで0時の流派に（お相手は庚午・丙子・旧暦{zw24}、算命学は庚午のまま、相性モード・{name}タブのまま、端末に記録）",
                r["b"] == ["庚午", "丙子", "庚午", zw24] and r["a"] == [12, "庚辰"] and r["mode"] == "compat" and r["ls"] == "24" and r["tab"] and r["pressed"] == "0時で切り替える", f"{r}")
            pg.locator(f"#day-boundary-{t}").get_by_role("button", name="23時で切り替える（標準）").click()
            r = pg.evaluate(st, t)
            chk(f"{name}タブで23時の流派に戻す（辛未・戊子・旧暦{zw23}、算命学は庚午）", r["b"] == ["辛未", "戊子", "庚午", zw23] and r["ls"] == "23" and r["tab"], f"{r}")
        # 自分の命盤：出生地未選択・性別「言わない」の表示、九星の「今年」（端末の日付 2027-01-20 ＝立春前なので2026年の盤）
        r = pg.evaluate("""() => { currentMode = 'self'; dataB = null; renderAll();
          const t = i => { const e = document.getElementById('tab' + i); const h = e.classList.contains('hide'); e.classList.remove('hide'); const s = e.innerText; if (h) e.classList.add('hide'); return s; };
          return { meta: document.getElementById('h-meta').textContent, west: t(0), shichu: t(1), ziwei: t(2), ky: (t(5).match(/今年の運勢 — \\S+は(\\S+?宮)/) || [])[1] || '' }; }""")
        chk("出生地未選択の表示（上昇点は仮）", "上昇点は仮" in r["meta"] and "日本の中央" in r["west"], f"{r['meta']}")
        chk("性別「言わない」の表示（大運・大限の向きは仮）", "向き（順行・逆行）が決まりません" in r["shichu"] and "向き（順行・逆行）が決まりません" in r["ziwei"])
        chk("端末の日付が2027-01-20のとき九星の今年は2026年（一白水星は中宮）", r["ky"] == "中宮", f"{r['ky']}")
        # AIへの相談文の量（2026-10-23）。既定＝要点だけ／「画面の文を全部」で9タブと総合鑑定の画面の文を丸ごと渡す
        r = pg.evaluate("""() => {
          setTab(10);
          const box = () => document.getElementById('rs-consult-10');
          const amt = () => Array.from(box().querySelectorAll('.rs-amts .rs-chip')).map(b => b.textContent + ':' + b.getAttribute('aria-pressed'));
          const o = { amt0: amt(), full0: RSynth.isDigestFull() };
          const t0 = RSynth.consultPrompt(10).text;
          RSynth.setAmount(10, 1);
          const t1 = RSynth.consultPrompt(10).text;
          o.amt1 = amt(); o.full1 = RSynth.isDigestFull();
          const SYSN = ['西洋占星術','四柱推命','紫微斗数','算命学','数秘術','九星気学','マヤ暦','宿曜','インド占星術'];
          o.len = [t0.length, t1.length];
          o.cut = t0.indexOf('【12】各占術の読み（羅占盤の画面の文から抜粋') >= 0 && t0.indexOf('【13】') < 0;
          o.all = t1.indexOf('【13】総合鑑定の画面') >= 0 && t1.indexOf('【12】【13】') >= 0 && SYSN.every(s => t1.indexOf('■ ' + s) >= 0);
          o.ui = ['結果をシェア','16タイプを全部見る','ストーリー用の縦長画像','AIへの相談文をコピー','テキストファイルで保存','でAIに相談'].filter(w => t1.indexOf(w) >= 0);
          o.bad = (t1.match(/undefined|NaN|\\[object/g) || []).length;
          // 図・表そのもの（座標や記号の羅列）が混ざらないか。2026-10-23 ツォルキン表の260マス・タイムラインの格子・SVGの文字が入っていた
          o.fig = [['ツォルキン表の数字', '222\\t183\\t144'], ['タイムラインの格子', '始\\n待\\n表\\n基'],
                   ['ホロスコープのSVG', '牡羊牡牛双子蟹獅子乙女天秤蠍射手山羊水瓶魚'], ['レーダーのSVG', '行動力4票'],
                   ['ラーシチャートの格子', '南インド式']].filter(([, w]) => t1.indexOf(w) >= 0).map(([k]) => k);
          // 目印は、誰の命盤でも必ず出る見出しやラベルにする（配置によって出ない文を使うと、人によって ✗ になる）
          o.keep = [['惑星の配置', '📖 魂の目的'], ['レーダーの内訳', '複数占術が一致する強み'], ['三九の秘法', '栄親'],
                    ['方位の吉凶', '最大吉方'], ['十二宮', '僕役宮'], ['蔵干と通根', '通根']].filter(([, w]) => t1.indexOf(w) < 0).map(([k]) => k);
          // 月のナクシャトラの説明が1系統か（インドタブの表＝NAKSHATRAS と、「9占術が語る」の表で同じものを使う）
          o.nak = (() => {
            const i = Math.floor(norm360(currentData.moonLon - ayanamsha(currentData.jd)) / (360 / 27)), n = NAKSHATRAS[i];
            const row = Array.from(document.querySelectorAll('#tab10 tr')).find(tr => /^\\s*インド占星術/.test(tr.textContent));
            if (!row) return ['行が無い'];
            return [n.n, row.textContent.indexOf(n.n) >= 0, row.textContent.indexOf(n.desc.split('。')[0]) >= 0];
          })();
          RSynth.setAmount(10, 0);
          o.back = [RSynth.consultPrompt(10).text.length, RSynth.isDigestFull()];
          return o; }""")
        chk("総合鑑定の相談箱に「AIに渡す量」が出る（既定＝要点だけ）",
            r["amt0"] == ["要点だけ:true", "画面の文を全部:false"] and r["full0"] is False, f"{r['amt0']}")
        chk(f"「画面の文を全部」で9タブと総合鑑定の文が丸ごと入る（{r['len'][0]:,}字 → {r['len'][1]:,}字）",
            r["cut"] and r["all"] and r["full1"] and r["amt1"] == ["要点だけ:false", "画面の文を全部:true"] and r["len"][1] > r["len"][0] * 2.5, f"{r}")
        chk("相談文に操作のための文字が入らない（シェア・16タイプ・画像保存・ボタン名）", r["ui"] == [] and r["bad"] == 0, f"{r['ui']}/{r['bad']}")
        chk("相談文に図・表そのものが入らない（ツォルキン表の数字・タイムラインの格子・SVGの文字・ラーシチャート）", r["fig"] == [], f"{r['fig']}")
        chk("図を外しても文の中身は残る（惑星の配置・レーダーの内訳・三九の秘法・方位・十二宮・蔵干）", r["keep"] == [], f"入らなかった: {r['keep']}")
        chk(f"月のナクシャトラの説明が1系統（{r['nak'][0]}・インドタブと「9占術が語る」の表で同じ）", r["nak"][1:] == [True, True], f"{r['nak']}")
        chk("「要点だけ」に戻すと元の長さに戻る", r["back"] == [r["len"][0], False], f"{r['back']}")
        with pg.expect_download() as dl:
            pg.evaluate("() => RSynth.saveConsult(10)")
        chk("テキストファイルで保存できる", dl.value.suggested_filename == "羅占盤_相談文_19900515.txt", dl.value.suggested_filename)
        # 票の数え方と材料の重なり（2026-10-23 外部レビュー）。ルールの票（タイプ名を決める）と占術の種類（総合の一致）を両方出す
        r = pg.evaluate("""() => {
          const t = buildExportText();
          const notes = Array.from(document.querySelectorAll('#tab10 .rs-count-note')).map(x => x.textContent);
          return {
            票: (t.match(/判定ルールの票 \\d+ 対 \\d+＝\\d+%/g) || []).length,
            占術数: (t.match(/→ 占術の種類で数えると \\d+ 対 \\d+/g) || []).length,
            食い違い: /ルールの票では.+側だが、占術の数では割れている/.test(t),
            固定文: t.indexOf('このタイプに共通の固定文です') >= 0 && t.indexOf('この3つはタイプ共通の固定文') >= 0,
            材料: t.indexOf('独立した9つの証拠ではありません') >= 0 && t.indexOf('独立した証拠の数として扱わない') >= 0,
            能力でない: t.indexOf('判定ルールが何個当てはまったか') >= 0,
            注記: notes.filter(x => x.indexOf('判定ルールの数では') >= 0).length,
            重なり: notes.filter(x => /材料が\\d通り/.test(x)).length,
          }; }""")
        chk("16タイプの軸に、ルールの票と占術の種類の両方を出す（4軸とも）", r["票"] == 4 and r["占術数"] == 4, f"{r}")
        chk("2つの数え方で結論が違う軸は、食い違いを説明する", r["食い違い"], f"{r}")
        chk("総合鑑定の4軸にも数え方の注記が出て、材料の重なりを書く", r["注記"] == 4 and r["重なり"] >= 3, f"注記{r['注記']}/重なり{r['重なり']}")
        chk("9占術が材料を共有していることを、相談文とAIへの指示に書く", r["材料"], f"{r}")
        chk("タイプの物語・苦悩・処方箋がタイプ共通の固定文だと書く", r["固定文"], f"{r}")
        chk("票は「ルールが何個当てはまったか」で、能力の量ではないと書く", r["能力でない"], f"{r}")
        # 人格の4段（動機→思考→行動→葛藤）。4つの軸を動き方の順に言い直したもの（2026-10-23）
        r = pg.evaluate("""() => {
          const s = RSynth.buildSynthesis(currentData), A = RSynth.archLines(s), k = s.tj.key.split('_');
          const dl = document.querySelector('#tab10 .rs-arch dl'), t = buildExportText();
          return { 軸: k, 文: A.lines,
            空: A.lines.filter(x => !x || /undefined/.test(x)).length,
            画面: dl ? dl.children.length : 0,
            見出し: dl ? Array.from(dl.querySelectorAll('dt')).map(x => x.textContent.replace(/（.*/, '').trim().slice(0, 2)) : [],
            AI: /◆ 人格の4段/.test(t) && A.lines.every(x => t.indexOf(x) >= 0),
            対応: (k[0] === '革新' ? /違和感/ : /受け継いだ/).test(A.lines[0])
               && (k[2] === 'リーダー' ? /自分で新しい方法|人の前に立ち/ : /表に立たず|支える側から/).test(A.lines[2])
               && (k[3] === '慎重' ? /長く考える|止まりやすい/ : /手が離れる|勢いで崩して/).test(A.lines[3]),
            割れた注記: s.axes.some(a => a.level === 'split') === /意見が割れている/.test(A.note) }; }""")
        chk(f"人格の4段が画面とAI用の文に出る（{'・'.join(r['見出し'])}）",
            r["空"] == 0 and r["画面"] == 8 and r["AI"] and r["見出し"] == ["動機", "思考", "行動", "葛藤"], f"{r}")
        chk(f"4段の文が4つの軸と対応している（{'_'.join(r['軸'])}）", r["対応"] and r["割れた注記"], f"{r['文']}")
        # 前にこの端末で出たタイプと違うとき、変わった軸と理由を出す
        r = pg.evaluate("""() => {
          localStorage.setItem('sanmeiban_last_type', JSON.stringify(
            { k: '継承_狭い_参謀_楽天', n: 'アルチザン', v: '2026-09-28', p: '1230_F_東京都', d: '1990-5-15' }));
          renderAll();
          const e = document.querySelector('#tab10 .rs-changed');
          const once = (renderAll(), document.querySelector('#tab10 .rs-changed'));
          return { 文: e ? e.textContent : '', 二度目: !!once }; }""")
        # 仕込んだ前回＝アルチザン（継承_狭い_参謀_楽天）→ 今回はガーディアン（継承_狭い_リーダー_慎重）なので、役割と気質が動く
        chk("前にこの端末で出たタイプと違うとき、変わった軸と理由を出す（2度目は出さない）",
            "アルチザン" in r["文"] and "判定ルールを見直したためです" in r["文"]
            and "役割（参謀 → リーダー）" in r["文"] and "気質（楽天 → 慎重）" in r["文"] and not r["二度目"], f"{r}")
        r = pg.evaluate("""() => { currentMode = 'compat';
          dataB = calcPersonData('1995-08-07', '23:30', 'known', 'F', '東京都'); dataB.relType = 'love';
          renderAll(); setTab(10);
          const box = document.getElementById('rs-consult-10');
          return { amt: box.querySelectorAll('.rs-amts .rs-chip').length, len: RSynth.consultPrompt(10).text.length }; }""")
        chk(f"相性モードでは量を選ばせない（画面の文が少なく、丸ごとでも差がほとんど無い・{r['len']:,}字）",
            r["amt"] == 0 and r["len"] > 5000, f"{r}")
        b.close()

def check_ephem(fails):
    """天体の表（毎日0時・3次補間）の誤差を、表の全期間のランダムな時刻で Swiss Ephemeris と比べる"""
    import random
    def chk(k, ok, msg=""):
        print(f"  {'✓' if ok else '✗'} {k} {msg}")
        if not ok:
            fails.setdefault(k, []).append(msg)
    print("\n■ 天体の表の誤差（1920〜2080年のランダムな3000時刻・節入り300回）")
    r = random.Random(20261020)
    jds = [swe.julday(1920, 1, 1, 0) + r.random() * (swe.julday(2080, 12, 31, 0) - swe.julday(1920, 1, 1, 0)) for _ in range(3000)]
    terms = [(float(r.randrange(12) * 30 + 15) % 360, swe.julday(r.randint(1921, 2079), r.randint(1, 12), 15, 0)) for _ in range(300)]
    js = """([jds, terms]) => ({ lon: jds.map(j => [getSunLon(j), getMoonLon(j), ...['水星','金星','火星','木星','土星','天王星','海王星','冥王星'].map(n => getPlanetLon(n, j)), getRahuLon(j)]),
      cross: terms.map(([L, j]) => sunCrossJd(L, j + ((L - getSunLon(j) + 360) % 360) / 0.9856)) })"""
    app = run_js([js], [[jds, terms]])[0]
    ids = PLANET_IDS + [swe.MEAN_NODE]
    names = ["太陽", "月", "水星", "金星", "火星", "木星", "土星", "天王星", "海王星", "冥王星", "ラーフ"]
    tol = [0.001, 0.004, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]
    worst = [max(angdiff(a[i], lon(j, ids[i])) for j, a in zip(jds, app["lon"])) for i in range(len(ids))]
    for n, w, t in zip(names, worst, tol):
        chk(f"{n}（最大の差 {w:.4f}° ・許容 {t}°）", w <= t)
    # 見当（平均の速さで割った日数）は最大で約5日ずれるので、20日前から次の通過を探す
    dsec = max(abs(c - swe.solcross_ut(L, j + ((L - lon(j, swe.SUN)) % 360) / 0.9856 - 20)) * 86400 for (L, j), c in zip(terms, app["cross"]))
    chk(f"節入りの時刻（最大の差 {dsec:.0f}秒・許容 20秒）", dsec <= 20)

def main():
    if not selftest():
        sys.exit(2)
    cases = [{"bd": bd, "bt": bt} for bd, bt, _ in CASES]
    app = run_app(cases)
    fails = {}
    for (bd, bt, label), a in zip(CASES, app):
        y, m, d = map(int, bd.split("-"))
        h, mi = (map(int, bt.split(":")) if bt else (12, 0))   # 時刻不明は正午（2026-10-19 アプリを05:00→正午に変えた）
        rows = []
        pil, mi_, yy, _ = ref_pillars(y, m, d, h, mi, bool(bt))
        for k, v in pil.items():
            rows.append((k, a[k], v))
        hon, get = ref_kyusei(yy, mi_)
        rows += [("本命星", a["本命星"], hon), ("月命星", a["月命星"], get), ("日盤", a["日盤"], ref_day_star(dt.date(y, m, d)))]
        full = ref_pillars(y, m, d, h, mi, True)[0]                 # 四柱推命（23時の流派）の日主で十神
        cal = ref_pillars(y, m, d, h, mi, True, boundary=24)[0]     # 算命学は生まれた日付どおりの日柱
        TEN = ["比肩", "劫財", "食神", "傷官", "偏財", "正財", "偏官", "正官", "偏印", "正印"]
        ten = lambda ch: TEN[JUSSHU.index(jusshu(STEMS.index(full["日柱"][0]), STEMS.index(ch)))]
        rows += [("十神（年干）", a["十神年"], ten(full["年柱"][0])), ("十神（月干）", a["十神月"], ten(full["月柱"][0]))]
        for k, v in ref_sanmei(cal, setsu_days(y, m, d, h, mi)).items():
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
    check_lunar(fails)
    check_ephem(fails)
    check_audit(fails)
    check_day_boundary(fails)
    check_iching(fails)
    check_tables(fails)
    check_ui(fails)
    rules_and_types(fails)
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
    if "--lunar" in sys.argv:
        f = {}
        check_lunar(f)
        sys.exit(1 if f else 0)
    if "--audit" in sys.argv:
        f = {}
        check_ephem(f)
        check_audit(f)
        check_day_boundary(f)
        check_iching(f)
        check_tables(f)
        check_ui(f)
        print("\n━━ まとめ ━━\n" + ("全項目一致" if not f else "\n".join(f"✗ {k}" for k in f)))
        sys.exit(1 if f else 0)
    sweep() if "--sweep" in sys.argv else main()

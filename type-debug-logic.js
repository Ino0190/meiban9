1	// ==========================================================================
2	// 羅占盤 16タイプ判定ロジック（独立モジュール）
3	// ==========================================================================
4	//
5	// 使い方:
6	//   1. 既存HTMLの末尾に <script src="type-debug-logic.js"></script> を追加
7	//   2. 命盤を立てる（cast() 実行）
8	//   3. ブラウザのコンソールで TypeDebug.runFromHTML() を実行
9	//
10	// 出力: 16タイプ判定結果 + 詳細投票内訳
11	//
12	// 4軸: 革新/継承・広い/狭い・リーダー/参謀・楽天/慎重
13	// 修飾子: 早咲き/晩成・直感/論理
14	// ==========================================================================
15	
16	(function(global) {
17	  'use strict';
18	
19	  // --------------------------------------------------------------------------
20	  // 定数
21	  // --------------------------------------------------------------------------
22	
23	  const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
24	  const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
25	  const STEM_EL = ["木","木","火","火","土","土","金","金","水","水"];
26	  const SIGN_EL = ["火","土","風","水","火","土","風","水","火","土","風","水"];
27	
28	  function signOf(lon) { return Math.floor(lon / 30); }
29	  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }
30	
31	  // --------------------------------------------------------------------------
32	  // データアクセサ（ヘルパー）
33	  // 各テスト関数の引数: (d, sm, nu, ky, ma, shukuIdx, jy)
34	  // --------------------------------------------------------------------------
35	
36	  const sun = d => signOf(d.sunLon);
37	  const moon = d => signOf(d.moonLon);
38	  const asc = d => d.ascLon !== null ? signOf(d.ascLon) : null;
39	
40	  function planetSign(d, name) {
41	    const p = d.planets.find(p => p.n === name);
42	    return p ? signOf(p.lon) : null;
43	  }
44	
45	  function aspectAngle(d, n1, n2) {
46	    const p1 = d.planets.find(p => p.n === n1);
47	    const p2 = d.planets.find(p => p.n === n2);
48	    if (!p1 || !p2) return null;
49	    const diff = Math.abs(p1.lon - p2.lon);
50	    return diff > 180 ? 360 - diff : diff;
51	  }
52	
53	  function hasAspect(d, n1, n2, type, orb = 6) {
54	    const a = aspectAngle(d, n1, n2);
55	    if (a === null) return false;
56	    const target = {合:0, 衝:180, 三分:120, 四分:90, 六分:60}[type];
57	    return Math.abs(a - target) <= orb;
58	  }
59	
60	  function planetsInElement(d, el) {
61	    return d.planets.filter(p => SIGN_EL[signOf(p.lon)] === el).length;
62	  }
63	
64	  function hasTen(d, ten) {
65	    return d.pillars && d.pillars.some(p => p.ten === ten);
66	  }
67	
68	  function lifeStar(d, star) {
69	    if (!d.ziweiDistrib || d.lifeIdx === undefined) return false;
70	    const stars = d.ziweiDistrib[d.lifeIdx] || [];
71	    return stars.includes(star);
72	  }
73	
74	  function smCenter(sm, star) { return sm && sm.stars && sm.stars.center === star; }
75	  function smAny(sm, star) {
76	    if (!sm || !sm.stars) return false;
77	    return Object.values(sm.stars).includes(star);
78	  }
79	  function smJuuni(sm, star) {
80	    if (!sm) return false;
81	    return [sm.juuniYear, sm.juuniMonth, sm.juuniDay].some(j => j && j.n === star);
82	  }
83	
84	  // 27宿の名前リスト（calcShukuyo の結果インデックスに対応）
85	  const SHUKUYO_NAMES = ["昴宿","畢宿","觜宿","参宿","井宿","鬼宿","柳宿","星宿","張宿","翼宿","軫宿","角宿","亢宿","氐宿","房宿","心宿","尾宿","箕宿","斗宿","女宿","虚宿","危宿","室宿","壁宿","奎宿","婁宿","胃宿"];
86	  function shukuName(shukuIdx) { return SHUKUYO_NAMES[shukuIdx]; }
87	
88	  // --------------------------------------------------------------------------
89	  // 判定ルール定義
90	  //   各ルール: { p: 点数, n: 説明, t: テスト関数 }
91	  // --------------------------------------------------------------------------
92	
93	  // ============= 軸1: 革新 =============
94	  const AXIS1_REVOLUTION = [
95	    // 西洋占星術
96	    {p:3, n:"火星-天王星アスペクト(合/衝/四分)", t:d => hasAspect(d,'火星','天王星','合') || hasAspect(d,'火星','天王星','衝') || hasAspect(d,'火星','天王星','四分')},
97	    {p:2, n:"太陽が射手座", t:d => sun(d) === 8},
98	    {p:2, n:"太陽が水瓶座", t:d => sun(d) === 10},
99	    {p:1, n:"天王星が太陽/月/ASCと合", t:d => hasAspect(d,'天王星','太陽','合') || hasAspect(d,'天王星','月','合')},
100	    {p:1, n:"冥王星が太陽/月と合", t:d => hasAspect(d,'冥王星','太陽','合') || hasAspect(d,'冥王星','月','合')},
101	    // 四柱推命
102	    {p:3, n:"偏官透干", t:d => hasTen(d,'偏官')},
103	    {p:2, n:"食神透干", t:d => hasTen(d,'食神')},
104	    {p:2, n:"傷官透干", t:d => hasTen(d,'傷官')},
105	    {p:2, n:"五行欠如(火0または木0)", t:d => d.wx && (d.wx['火']===0 || d.wx['木']===0)},
106	    // 紫微斗数
107	    {p:3, n:"武曲が命宮", t:d => lifeStar(d,'武曲')},
108	    {p:3, n:"破軍が命宮", t:d => lifeStar(d,'破軍')},
109	    {p:2, n:"七殺が命宮", t:d => lifeStar(d,'七殺')},
110	    {p:2, n:"貪狼が命宮", t:d => lifeStar(d,'貪狼')},
111	    {p:2, n:"廉貞が命宮", t:d => lifeStar(d,'廉貞')},
112	    {p:1, n:"天機が命宮", t:d => lifeStar(d,'天機')},
113	    // 算命学
114	    {p:3, n:"龍高星が中央", t:(d,sm) => smCenter(sm,'龍高星')},
115	    {p:2, n:"調舒星が中央", t:(d,sm) => smCenter(sm,'調舒星')},
116	    {p:1, n:"天南星を持つ", t:(d,sm) => smJuuni(sm,'天南星')},
117	    {p:1, n:"龍高星をどこかに持つ", t:(d,sm) => smAny(sm,'龍高星')},
118	    // 数秘術
119	    {p:2, n:"LP1", t:(d,sm,nu) => nu && nu.lifePath === 1},
120	    {p:2, n:"LP5", t:(d,sm,nu) => nu && nu.lifePath === 5},
121	    {p:1, n:"LP3", t:(d,sm,nu) => nu && nu.lifePath === 3},
122	    {p:1, n:"LP11", t:(d,sm,nu) => nu && nu.lifePath === 11},
123	    // 九星気学
124	    {p:2, n:"三碧木星", t:(d,sm,nu,ky) => ky && ky.honmei === 3},
125	    {p:1, n:"四緑木星", t:(d,sm,nu,ky) => ky && ky.honmei === 4},
126	    {p:1, n:"九紫火星", t:(d,sm,nu,ky) => ky && ky.honmei === 9},
127	    // マヤ暦
128	    {p:2, n:"青い嵐紋章", t:(d,sm,nu,ky,ma) => ma && ma.seal === 18},
129	    {p:2, n:"赤い空歩く人", t:(d,sm,nu,ky,ma) => ma && ma.seal === 12},
130	    {p:1, n:"音10(現実化)", t:(d,sm,nu,ky,ma) => ma && ma.tone === 10},
131	    {p:1, n:"赤い地球", t:(d,sm,nu,ky,ma) => ma && ma.seal === 16},
132	    // 宿曜
133	    {p:3, n:"亢宿(妥協しない孤高)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "亢宿"},
134	    {p:2, n:"危宿(冒険)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "危宿"},
135	    {p:2, n:"室宿(建設と破壊)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "室宿"},
136	    // インド占星術
137	    {p:1, n:"太陽がメーシャ(火星支配)", t:(d,sm,nu,ky,ma,si,jy) => jy && jy.sunRashi === 0},
138	  ];
139	
140	  // ============= 軸1: 継承 =============
141	  const AXIS1_TRADITION = [
142	    // 西洋占星術
143	    {p:3, n:"土星が太陽/月/ASCと合", t:d => hasAspect(d,'土星','太陽','合') || hasAspect(d,'土星','月','合')},
144	    {p:2, n:"太陽が山羊座", t:d => sun(d) === 9},
145	    {p:2, n:"太陽が牡牛座", t:d => sun(d) === 1},
146	    {p:1, n:"ASCが山羊座/牡牛座", t:d => asc(d) === 9 || asc(d) === 1},
147	    {p:1, n:"土星-水星の合", t:d => hasAspect(d,'土星','水星','合')},
148	    // 四柱推命
149	    {p:3, n:"正印透干", t:d => hasTen(d,'正印')},
150	    {p:2, n:"偏印透干", t:d => hasTen(d,'偏印')},
151	    {p:2, n:"正官透干", t:d => hasTen(d,'正官')},
152	    {p:1, n:"正財透干", t:d => hasTen(d,'正財')},
153	    // 紫微斗数
154	    {p:3, n:"紫微が命宮", t:d => lifeStar(d,'紫微')},
155	    {p:3, n:"天府が命宮", t:d => lifeStar(d,'天府')},
156	    {p:2, n:"天梁が命宮", t:d => lifeStar(d,'天梁')},
157	    {p:1, n:"太陰が命宮", t:d => lifeStar(d,'太陰')},
158	    // 算命学
159	    {p:3, n:"玉堂星が中央", t:(d,sm) => smCenter(sm,'玉堂星')},
160	    {p:1, n:"天禄星を持つ", t:(d,sm) => smJuuni(sm,'天禄星')},
161	    {p:1, n:"天堂星を持つ", t:(d,sm) => smJuuni(sm,'天堂星')},
162	    // 数秘術
163	    {p:2, n:"LP4", t:(d,sm,nu) => nu && nu.lifePath === 4},
164	    {p:2, n:"LP6", t:(d,sm,nu) => nu && nu.lifePath === 6},
165	    {p:1, n:"LP2", t:(d,sm,nu) => nu && nu.lifePath === 2},
166	    // 九星気学
167	    {p:1, n:"六白金星", t:(d,sm,nu,ky) => ky && ky.honmei === 6},
168	    // マヤ暦
169	    {p:2, n:"白い鏡(秩序)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 17},
170	    {p:2, n:"黄色い種(伝承)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 3},
171	    {p:1, n:"白い犬(忠実)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 9},
172	    // 宿曜
173	    {p:2, n:"畢宿(堅実)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "畢宿"},
174	    {p:2, n:"婁宿(計画と実行)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "婁宿"},
175	    {p:1, n:"奎宿(品格)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "奎宿"},
176	    // インド占星術
177	    {p:1, n:"太陽がマカラ(山羊)/ヴリシャバ(牡牛)", t:(d,sm,nu,ky,ma,si,jy) => jy && (jy.sunRashi === 9 || jy.sunRashi === 1)},
178	  ];
179	
180	  // ============= 軸2: 広い =============
181	  const AXIS2_WIDE = [
182	    // 西洋占星術 - 「興味の幅」を弱化、「実際の社交・拡散」を残す
183	    {p:1, n:"太陽が射手座(興味の幅)", t:d => sun(d) === 8},
184	    {p:1, n:"太陽が双子座(多趣味)", t:d => sun(d) === 2},
185	    {p:2, n:"木星が太陽/月/ASCと合", t:d => hasAspect(d,'木星','太陽','合') || hasAspect(d,'木星','月','合')},
186	    {p:1, n:"金星-木星アスペクト(合/三分/六分)", t:d => hasAspect(d,'金星','木星','合') || hasAspect(d,'金星','木星','三分') || hasAspect(d,'金星','木星','六分')},
187	    // 四柱推命
188	    {p:2, n:"偏財透干", t:d => hasTen(d,'偏財')},
189	    {p:1, n:"日支が寅/申/亥/巳(駅馬)", t:d => d.day && ["寅","申","亥","巳"].includes(d.day.branch)},
190	    // 紫微斗数
191	    {p:3, n:"貪狼が命宮", t:d => lifeStar(d,'貪狼')},
192	    {p:2, n:"天機が命宮", t:d => lifeStar(d,'天機')},
193	    {p:1, n:"太陽が命宮", t:d => lifeStar(d,'太陽')},
194	    {p:1, n:"天馬が命宮", t:d => lifeStar(d,'天馬')},
195	    // 算命学
196	    {p:3, n:"鳳閣星が中央", t:(d,sm) => smCenter(sm,'鳳閣星')},
197	    {p:2, n:"石門星が中央", t:(d,sm) => smCenter(sm,'石門星')},
198	    {p:2, n:"禄存星が中央", t:(d,sm) => smCenter(sm,'禄存星')},
199	    {p:1, n:"鳳閣星をどこかに持つ", t:(d,sm) => smAny(sm,'鳳閣星')},
200	    {p:1, n:"石門星をどこかに持つ", t:(d,sm) => smAny(sm,'石門星')},
201	    // 数秘術
202	    {p:1, n:"LP3(社交・表現)", t:(d,sm,nu) => nu && nu.lifePath === 3},
203	    {p:2, n:"LP5(自由・多方面)", t:(d,sm,nu) => nu && nu.lifePath === 5},
204	    {p:1, n:"LP9(広い視野)", t:(d,sm,nu) => nu && nu.lifePath === 9},
205	    // 九星気学
206	    {p:3, n:"四緑木星(風)", t:(d,sm,nu,ky) => ky && ky.honmei === 4},
207	    {p:2, n:"三碧木星(音)", t:(d,sm,nu,ky) => ky && ky.honmei === 3},
208	    {p:1, n:"七赤金星", t:(d,sm,nu,ky) => ky && ky.honmei === 7},
209	    // マヤ暦
210	    {p:2, n:"黄色い人(影響・多面性)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 11},
211	    {p:2, n:"赤い空歩く人(探究)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 12},
212	    {p:1, n:"青い猿(遊び)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 10},
213	    // 宿曜
214	    {p:2, n:"翼宿(旅・移動)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "翼宿"},
215	    {p:2, n:"箕宿(自由奔放)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "箕宿"},
216	    {p:1, n:"張宿(社交)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "張宿"},
217	    // インド占星術
218	    {p:1, n:"太陽がダヌ(射手)", t:(d,sm,nu,ky,ma,si,jy) => jy && jy.sunRashi === 8},
219	  ];
220	
221	  // ============= 軸2: 狭い =============
222	  const AXIS2_NARROW = [
223	    // 西洋占星術
224	    {p:3, n:"冥王星が太陽/月と合", t:d => hasAspect(d,'冥王星','太陽','合') || hasAspect(d,'冥王星','月','合')},
225	    {p:2, n:"太陽が蠍座", t:d => sun(d) === 7},
226	    {p:2, n:"太陽が乙女座", t:d => sun(d) === 5},
227	    {p:1, n:"水の星座に天体3つ以上", t:d => planetsInElement(d,'水') >= 3},
228	    {p:1, n:"土の星座に天体3つ以上", t:d => planetsInElement(d,'土') >= 3},
229	    {p:1, n:"月が乙女座(細部)", t:d => moon(d) === 5},
230	    // 四柱推命
231	    {p:2, n:"正財透干(一点蓄積)", t:d => hasTen(d,'正財')},
232	    {p:2, n:"偏官透干(深い変容)", t:d => hasTen(d,'偏官')},
233	    {p:1, n:"五行が3種以下に偏る", t:d => d.wx && Object.values(d.wx).filter(v => v > 0).length <= 3},
234	    // 紫微斗数
235	    {p:3, n:"巨門が命宮(専門性)", t:d => lifeStar(d,'巨門')},
236	    {p:3, n:"七殺が命宮(独立独歩)", t:d => lifeStar(d,'七殺')},
237	    {p:3, n:"武曲が命宮(実務の極み)", t:d => lifeStar(d,'武曲')},
238	    {p:2, n:"破軍が命宮(深い変容)", t:d => lifeStar(d,'破軍')},
239	    // 算命学
240	    {p:3, n:"調舒星が中央(繊細)", t:(d,sm) => smCenter(sm,'調舒星')},
241	    {p:3, n:"貫索星が中央(自我・専門)", t:(d,sm) => smCenter(sm,'貫索星')},
242	    {p:1, n:"調舒星をどこかに持つ", t:(d,sm) => smAny(sm,'調舒星')},
243	    {p:1, n:"貫索星をどこかに持つ", t:(d,sm) => smAny(sm,'貫索星')},
244	    {p:1, n:"天胡星/天極星を持つ(深い精神性)", t:(d,sm) => smJuuni(sm,'天胡星') || smJuuni(sm,'天極星')},
245	    // 数秘術
246	    {p:3, n:"LP7(探究・深化)", t:(d,sm,nu) => nu && nu.lifePath === 7},
247	    {p:2, n:"LP4(実務・専門)", t:(d,sm,nu) => nu && nu.lifePath === 4},
248	    {p:2, n:"LP8(達成・専門)", t:(d,sm,nu) => nu && nu.lifePath === 8},
249	    {p:1, n:"BD7(探究のバースデー)", t:(d,sm,nu) => nu && nu.birthday === 7},
250	    // 九星気学
251	    {p:3, n:"八白土星(山・深く積む)", t:(d,sm,nu,ky) => ky && ky.honmei === 8},
252	    {p:1, n:"一白水星(深い知性)", t:(d,sm,nu,ky) => ky && ky.honmei === 1},
253	    {p:1, n:"一白水星(月命)", t:(d,sm,nu,ky) => ky && ky.getsu === 1},
254	    // マヤ暦
255	    {p:2, n:"青い夜(夢見る・深さ)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 2},
256	    {p:2, n:"黄色い種(深掘り)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 3},
257	    {p:1, n:"白い魔法使い(永遠・受容)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 13},
258	    {p:1, n:"音7(共鳴)", t:(d,sm,nu,ky,ma) => ma && ma.tone === 7},
259	    // 宿曜
260	    {p:2, n:"觜宿(研究・細部)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "觜宿"},
261	    {p:2, n:"尾宿(職人気質)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "尾宿"},
262	    {p:1, n:"鬼宿(独自世界)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "鬼宿"},
263	    {p:1, n:"亢宿(孤高の専門)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "亢宿"},
264	    // インド占星術
265	    {p:1, n:"太陽がヴリシュチカ(蠍)/カンニャー(乙女)", t:(d,sm,nu,ky,ma,si,jy) => jy && (jy.sunRashi === 7 || jy.sunRashi === 5)},
266	  ];
267	
268	  // ============= 軸3: リーダー =============
269	  const AXIS3_LEADER = [
270	    // 西洋占星術
271	    {p:3, n:"太陽が獅子座(君主)", t:d => sun(d) === 4},
272	    {p:2, n:"太陽が牡羊座(先頭)", t:d => sun(d) === 0},
273	    {p:1, n:"火星が太陽と合", t:d => hasAspect(d,'火星','太陽','合')},
274	    {p:1, n:"ASCが獅子座/牡羊座", t:d => asc(d) === 4 || asc(d) === 0},
275	    // 四柱推命
276	    {p:3, n:"偏官透干(権威)", t:d => hasTen(d,'偏官')},
277	    {p:1, n:"正官透干", t:d => hasTen(d,'正官')},
278	    {p:2, n:"比肩透干", t:d => hasTen(d,'比肩')},
279	    {p:1, n:"日主が陽干", t:d => d.day && ["甲","丙","戊","庚","壬"].includes(d.day.stem)},
280	    // 紫微斗数
281	    {p:3, n:"紫微が命宮", t:d => lifeStar(d,'紫微')},
282	    {p:3, n:"武曲が命宮", t:d => lifeStar(d,'武曲')},
283	    {p:2, n:"七殺が命宮", t:d => lifeStar(d,'七殺')},
284	    {p:2, n:"太陽が命宮", t:d => lifeStar(d,'太陽')},
285	    // 算命学
286	    {p:3, n:"牽牛星が中央", t:(d,sm) => smCenter(sm,'牽牛星')},
287	    {p:2, n:"車騎星が中央", t:(d,sm) => smCenter(sm,'車騎星')},
288	    {p:1, n:"牽牛星をどこかに持つ", t:(d,sm) => smAny(sm,'牽牛星')},
289	    // 数秘術
290	    {p:3, n:"LP1(リーダー)", t:(d,sm,nu) => nu && nu.lifePath === 1},
291	    {p:2, n:"LP8(達成者)", t:(d,sm,nu) => nu && nu.lifePath === 8},
292	    // 九星気学
293	    {p:2, n:"五黄土星", t:(d,sm,nu,ky) => ky && ky.honmei === 5},
294	    {p:1, n:"九紫火星", t:(d,sm,nu,ky) => ky && ky.honmei === 9},
295	    // マヤ暦
296	    {p:2, n:"黄色い太陽", t:(d,sm,nu,ky,ma) => ma && ma.seal === 19},
297	    {p:1, n:"白い魔法使い", t:(d,sm,nu,ky,ma) => ma && ma.seal === 13},
298	    // 宿曜
299	    {p:2, n:"房宿(権力)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "房宿"},
300	    {p:1, n:"星宿(華やかさ)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "星宿"},
301	    // インド占星術
302	    {p:1, n:"太陽がシンハ(獅子)", t:(d,sm,nu,ky,ma,si,jy) => jy && jy.sunRashi === 4},
303	    {p:1, n:"ラグナがシンハ(獅子)", t:(d,sm,nu,ky,ma,si,jy) => jy && jy.lagnaRashi === 4},
304	  ];
305	
306	  // ============= 軸3: 参謀 =============
307	  const AXIS3_STRATEGIST = [
308	    // 西洋占星術
309	    {p:2, n:"月が乙女座(細部分析)", t:d => moon(d) === 5},
310	    {p:2, n:"太陽が乙女座", t:d => sun(d) === 5},
311	    {p:1, n:"水星-土星アスペクト(合/三分/六分)", t:d => hasAspect(d,'水星','土星','合') || hasAspect(d,'水星','土星','三分') || hasAspect(d,'水星','土星','六分')},
312	    {p:1, n:"水星-海王星アスペクト(直感的思考)", t:d => hasAspect(d,'水星','海王星','合') || hasAspect(d,'水星','海王星','三分')},
313	    {p:1, n:"ASCが乙女座/水瓶座", t:d => asc(d) === 5 || asc(d) === 10},
314	    // 四柱推命
315	    {p:3, n:"正印透干(知恵を受ける)", t:d => hasTen(d,'正印')},
316	    {p:2, n:"偏印透干", t:d => hasTen(d,'偏印')},
317	    {p:1, n:"食神透干", t:d => hasTen(d,'食神')},
318	    // 紫微斗数
319	    {p:3, n:"天機が命宮", t:d => lifeStar(d,'天機')},
320	    {p:3, n:"巨門が命宮", t:d => lifeStar(d,'巨門')},
321	    {p:2, n:"天梁が命宮", t:d => lifeStar(d,'天梁')},
322	    {p:1, n:"文昌が命宮", t:d => lifeStar(d,'文昌')},
323	    {p:1, n:"文曲が命宮", t:d => lifeStar(d,'文曲')},
324	    {p:1, n:"太陰が命宮", t:d => lifeStar(d,'太陰')},
325	    // 算命学
326	    {p:3, n:"玉堂星が中央", t:(d,sm) => smCenter(sm,'玉堂星')},
327	    {p:2, n:"龍高星が中央", t:(d,sm) => smCenter(sm,'龍高星')},
328	    {p:1, n:"玉堂星をどこかに持つ", t:(d,sm) => smAny(sm,'玉堂星')},
329	    // 数秘術
330	    {p:2, n:"LP7(探究者)", t:(d,sm,nu) => nu && nu.lifePath === 7},
331	    {p:1, n:"LP4(実務家)", t:(d,sm,nu) => nu && nu.lifePath === 4},
332	    {p:2, n:"BD7(探究のバースデー)", t:(d,sm,nu) => nu && nu.birthday === 7},
333	    // 九星気学
334	    {p:2, n:"一白水星", t:(d,sm,nu,ky) => ky && ky.honmei === 1},
335	    {p:2, n:"一白水星(月命)", t:(d,sm,nu,ky) => ky && ky.getsu === 1},
336	    {p:1, n:"八白土星", t:(d,sm,nu,ky) => ky && ky.honmei === 8},
337	    // マヤ暦
338	    {p:2, n:"黄色い種(気づき)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 3},
339	    {p:2, n:"白い鏡(秩序)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 17},
340	    {p:1, n:"青い夜(夢見る)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 2},
341	    // 宿曜
342	    {p:2, n:"觜宿(研究)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "觜宿"},
343	    {p:1, n:"亢宿(孤高の知性)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "亢宿"},
344	    {p:1, n:"鬼宿(独自世界)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "鬼宿"},
345	    // インド占星術
346	    {p:2, n:"ラグナがクンバ(独自の知性)", t:(d,sm,nu,ky,ma,si,jy) => jy && jy.lagnaRashi === 10},
347	    {p:1, n:"ラグナがミトゥナ/カンニャー", t:(d,sm,nu,ky,ma,si,jy) => jy && (jy.lagnaRashi === 2 || jy.lagnaRashi === 5)},
348	  ];
349	
350	  // ============= 軸4: 楽天 =============
351	  const AXIS4_OPTIMIST = [
352	    // 西洋占星術
353	    {p:3, n:"木星が太陽/月/ASCと合または三分", t:d => hasAspect(d,'木星','太陽','合') || hasAspect(d,'木星','太陽','三分') || hasAspect(d,'木星','月','合') || hasAspect(d,'木星','月','三分')},
354	    {p:2, n:"太陽が射手座", t:d => sun(d) === 8},
355	    {p:2, n:"太陽が双子座/獅子座", t:d => sun(d) === 2 || sun(d) === 4},
356	    {p:1, n:"金星-木星アスペクト", t:d => hasAspect(d,'金星','木星','合') || hasAspect(d,'金星','木星','三分') || hasAspect(d,'金星','木星','六分')},
357	    {p:1, n:"ASCが射手座/獅子座", t:d => asc(d) === 8 || asc(d) === 4},
358	    // 四柱推命
359	    {p:2, n:"食神/傷官透干", t:d => hasTen(d,'食神') || hasTen(d,'傷官')},
360	    {p:1, n:"火が強い(2以上)", t:d => d.wx && d.wx['火'] >= 2},
361	    // 紫微斗数
362	    {p:2, n:"天同が命宮", t:d => lifeStar(d,'天同')},
363	    {p:2, n:"太陽が命宮", t:d => lifeStar(d,'太陽')},
364	    {p:1, n:"紅鸞/天喜が命宮", t:d => lifeStar(d,'紅鸞') || lifeStar(d,'天喜')},
365	    // 算命学
366	    {p:3, n:"鳳閣星が中央", t:(d,sm) => smCenter(sm,'鳳閣星')},
367	    {p:1, n:"鳳閣星をどこかに持つ", t:(d,sm) => smAny(sm,'鳳閣星')},
368	    {p:1, n:"天南星を持つ", t:(d,sm) => smJuuni(sm,'天南星')},
369	    {p:1, n:"天禄星を持つ", t:(d,sm) => smJuuni(sm,'天禄星')},
370	    // 数秘術
371	    {p:3, n:"LP3", t:(d,sm,nu) => nu && nu.lifePath === 3},
372	    {p:2, n:"LP5", t:(d,sm,nu) => nu && nu.lifePath === 5},
373	    {p:1, n:"LP1", t:(d,sm,nu) => nu && nu.lifePath === 1},
374	    // 九星気学
375	    {p:2, n:"三碧木星", t:(d,sm,nu,ky) => ky && ky.honmei === 3},
376	    {p:2, n:"九紫火星", t:(d,sm,nu,ky) => ky && ky.honmei === 9},
377	    {p:1, n:"七赤金星", t:(d,sm,nu,ky) => ky && ky.honmei === 7},
378	    // マヤ暦
379	    {p:2, n:"黄色い太陽", t:(d,sm,nu,ky,ma) => ma && ma.seal === 19},
380	    {p:1, n:"青い猿(遊び)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 10},
381	    {p:1, n:"黄色い人", t:(d,sm,nu,ky,ma) => ma && ma.seal === 11},
382	    // 宿曜
383	    {p:1, n:"張宿(楽しみ)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "張宿"},
384	    {p:1, n:"翼宿", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "翼宿"},
385	    // インド占星術
386	    {p:1, n:"太陽がダヌ(射手)", t:(d,sm,nu,ky,ma,si,jy) => jy && jy.sunRashi === 8},
387	  ];
388	
389	  // ============= 軸4: 慎重 =============
390	  const AXIS4_PESSIMIST = [
391	    // 西洋占星術
392	    {p:3, n:"土星が太陽/月/ASCと合または四分", t:d => hasAspect(d,'土星','太陽','合') || hasAspect(d,'土星','太陽','四分') || hasAspect(d,'土星','月','合') || hasAspect(d,'土星','月','四分')},
393	    {p:2, n:"太陽が蠍座/山羊座/魚座", t:d => sun(d) === 7 || sun(d) === 9 || sun(d) === 11},
394	    {p:1, n:"月が乙女座/蠍座", t:d => moon(d) === 5 || moon(d) === 7},
395	    {p:1, n:"月-土星アスペクト", t:d => hasAspect(d,'月','土星','合') || hasAspect(d,'月','土星','四分') || hasAspect(d,'月','土星','衝')},
396	    {p:1, n:"火星-冥王星アスペクト", t:d => hasAspect(d,'火星','冥王星','合') || hasAspect(d,'火星','冥王星','四分') || hasAspect(d,'火星','冥王星','衝')},
397	    {p:1, n:"火星-天王星の衝(破壊的緊張)", t:d => hasAspect(d,'火星','天王星','衝')},
398	    // 四柱推命
399	    {p:2, n:"偏官/七殺透干", t:d => hasTen(d,'偏官')},
400	    {p:2, n:"五行に欠如あり", t:d => d.wx && Object.values(d.wx).some(v => v === 0)},
401	    {p:1, n:"水が強すぎる(5以上)", t:d => d.wx && d.wx['水'] >= 5},
402	    // 紫微斗数
403	    {p:2, n:"巨門が命宮(疑念)", t:d => lifeStar(d,'巨門')},
404	    {p:1, n:"廉貞が命宮", t:d => lifeStar(d,'廉貞')},
405	    // 算命学
406	    {p:3, n:"調舒星が中央", t:(d,sm) => smCenter(sm,'調舒星')},
407	    {p:1, n:"調舒星をどこかに持つ", t:(d,sm) => smAny(sm,'調舒星')},
408	    {p:1, n:"天胡星を持つ", t:(d,sm) => smJuuni(sm,'天胡星')},
409	    {p:1, n:"天極星を持つ", t:(d,sm) => smJuuni(sm,'天極星')},
410	    // 数秘術
411	    {p:2, n:"LP4", t:(d,sm,nu) => nu && nu.lifePath === 4},
412	    {p:1, n:"LP7(探究の影)", t:(d,sm,nu) => nu && nu.lifePath === 7},
413	    {p:2, n:"BD7", t:(d,sm,nu) => nu && nu.birthday === 7},
414	    {p:1, n:"マスターナンバー(11/22/33)", t:(d,sm,nu) => nu && [11,22,33].includes(nu.lifePath)},
415	    // 九星気学
416	    {p:2, n:"一白水星(月命)", t:(d,sm,nu,ky) => ky && ky.getsu === 1},
417	    {p:1, n:"二黒土星", t:(d,sm,nu,ky) => ky && ky.honmei === 2},
418	    {p:1, n:"八白土星", t:(d,sm,nu,ky) => ky && ky.honmei === 8},
419	    // マヤ暦
420	    {p:1, n:"青い夜(深さ)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 2},
421	    {p:1, n:"白い鏡(厳しさ)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 17},
422	    {p:1, n:"赤い月(浄化の苦しみ)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 8},
423	    // 宿曜
424	    {p:2, n:"心宿(深い洞察)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "心宿"},
425	    {p:2, n:"亢宿(妥協しない厳しさ)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "亢宿"},
426	    {p:1, n:"觜宿", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "觜宿"},
427	    // インド占星術
428	    {p:2, n:"土星が強い(マカラ/クンバ)", t:(d,sm,nu,ky,ma,si,jy) => jy && (jy.sunRashi === 9 || jy.sunRashi === 10 || jy.lagnaRashi === 9 || jy.lagnaRashi === 10)},
429	  ];
430	
431	  // ============= 修飾子: 早咲き =============
432	  // 注: 「年支エネルギーが大」は削除。天禄星（成熟の星）が年支にあっても早咲きとは限らない。
433	  // 早咲き判定は「青年期の星」が前半の支にあるか、前半の大運/柱が良いかで判定する。
434	  const MOD_EARLY = [
435	    {p:3, n:"天恍星が年支/月支(夢見る青年期)", t:(d,sm) => sm && ((sm.juuniYear && sm.juuniYear.n === '天恍星') || (sm.juuniMonth && sm.juuniMonth.n === '天恍星'))},
436	    {p:3, n:"天貴星が年支/月支(誇り高い幼少期)", t:(d,sm) => sm && ((sm.juuniYear && sm.juuniYear.n === '天貴星') || (sm.juuniMonth && sm.juuniMonth.n === '天貴星'))},
437	    {p:2, n:"天南星が年支(青年期の情熱)", t:(d,sm) => sm && sm.juuniYear && sm.juuniYear.n === '天南星'},
438	    {p:2, n:"天将星が年支/月支(若年期の最大エネルギー)", t:(d,sm) => sm && ((sm.juuniYear && sm.juuniYear.n === '天将星') || (sm.juuniMonth && sm.juuniMonth.n === '天将星'))},
439	    {p:1, n:"天印星を持つ(若年の輝き)", t:(d,sm) => smJuuni(sm,'天印星')},
440	    {p:2, n:"太陽-木星の合または三分(若年の幸運)", t:d => hasAspect(d,'太陽','木星','合') || hasAspect(d,'太陽','木星','三分')},
441	    {p:2, n:"年柱の十神が良い(食神/正財/正官)", t:d => d.pillars && d.pillars[0] && ['食神','正財','正官'].includes(d.pillars[0].ten)},
442	    {p:2, n:"月柱の十神が良い(食神/正財/正官)", t:d => d.pillars && d.pillars[1] && ['食神','正財','正官'].includes(d.pillars[1].ten)},
443	    {p:1, n:"BD1/3/5/8(早咲きナンバー)", t:(d,sm,nu) => nu && [1,3,5,8].includes(nu.birthday)},
444	    {p:1, n:"本命星が三碧/四緑/九紫", t:(d,sm,nu,ky) => ky && [3,4,9].includes(ky.honmei)},
445	  ];
446	
447	  // ============= 修飾子: 晩成 =============
448	  // 晩成判定を強化: 天禄星が年支にあるのは「成熟が早期に蓄積→後半で実る」として晩成側に計上。
449	  // 時柱の良い十神、印星透干、天胡星なども晩成の根拠として追加。
450	  const MOD_LATE = [
451	    {p:3, n:"天禄星が年支/月支(成熟が蓄積→後半で実る)", t:(d,sm) => sm && ((sm.juuniYear && sm.juuniYear.n === '天禄星') || (sm.juuniMonth && sm.juuniMonth.n === '天禄星'))},
452	    {p:3, n:"天禄星/天堂星が日支(晩成の核)", t:(d,sm) => sm && sm.juuniDay && (sm.juuniDay.n === '天禄星' || sm.juuniDay.n === '天堂星')},
453	    {p:2, n:"天庫星を持つ(蓄積)", t:(d,sm) => smJuuni(sm,'天庫星')},
454	    {p:2, n:"天極星を持つ(深み)", t:(d,sm) => smJuuni(sm,'天極星')},
455	    {p:2, n:"天胡星を持つ(精神性の深まり)", t:(d,sm) => smJuuni(sm,'天胡星')},
456	    {p:2, n:"天将星が日支(晩年の王者)", t:(d,sm) => sm && sm.juuniDay && sm.juuniDay.n === '天将星'},
457	    {p:3, n:"時柱の十神が良い(食神/正財/偏財/正官)", t:d => d.pillars && d.pillars[3] && ['食神','正財','偏財','正官'].includes(d.pillars[3].ten)},
458	    {p:2, n:"太陽-土星の合または三分(成熟の試練)", t:d => hasAspect(d,'太陽','土星','合') || hasAspect(d,'太陽','土星','三分')},
459	    {p:2, n:"印星(正印/偏印)透干(後半の知恵)", t:d => hasTen(d,'正印') || hasTen(d,'偏印')},
460	    {p:1, n:"マスターナンバー(11/22/33)", t:(d,sm,nu) => nu && [11,22,33].includes(nu.lifePath)},
461	    {p:1, n:"BD7/9(成熟のバースデー)", t:(d,sm,nu) => nu && [7,9].includes(nu.birthday)},
462	    {p:1, n:"本命星が二黒/八白/六白", t:(d,sm,nu,ky) => ky && [2,8,6].includes(ky.honmei)},
463	  ];
464	
465	  // ============= 修飾子: 直感 =============
466	  const MOD_INTUITIVE = [
467	    {p:3, n:"海王星が水星と合", t:d => hasAspect(d,'海王星','水星','合')},
468	    {p:2, n:"水の星座に天体3つ以上", t:d => planetsInElement(d,'水') >= 3},
469	    {p:1, n:"月が水の星座", t:d => [3,7,11].includes(moon(d))},
470	    {p:1, n:"ASCが水の星座", t:d => [3,7,11].includes(asc(d))},
471	    {p:1, n:"印星(正印/偏印)透干", t:d => hasTen(d,'正印') || hasTen(d,'偏印')},
472	    {p:1, n:"水が強い(5以上)", t:d => d.wx && d.wx['水'] >= 5},
473	    {p:2, n:"太陰が命宮", t:d => lifeStar(d,'太陰')},
474	    {p:2, n:"龍高星が中央", t:(d,sm) => smCenter(sm,'龍高星')},
475	    {p:1, n:"調舒星が中央", t:(d,sm) => smCenter(sm,'調舒星')},
476	    {p:1, n:"天胡星を持つ", t:(d,sm) => smJuuni(sm,'天胡星')},
477	    {p:2, n:"LP7", t:(d,sm,nu) => nu && nu.lifePath === 7},
478	    {p:2, n:"マスターナンバー", t:(d,sm,nu) => nu && [11,22,33].includes(nu.lifePath)},
479	    {p:1, n:"BD7", t:(d,sm,nu) => nu && nu.birthday === 7},
480	    {p:2, n:"一白水星(月命)", t:(d,sm,nu,ky) => ky && ky.getsu === 1},
481	    {p:1, n:"九紫火星", t:(d,sm,nu,ky) => ky && ky.honmei === 9},
482	    {p:2, n:"青い夜紋章", t:(d,sm,nu,ky,ma) => ma && ma.seal === 2},
483	    {p:2, n:"白い魔法使い紋章", t:(d,sm,nu,ky,ma) => ma && ma.seal === 13},
484	    {p:1, n:"赤い地球紋章", t:(d,sm,nu,ky,ma) => ma && ma.seal === 16},
485	    {p:2, n:"心宿(直観)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "心宿"},
486	    {p:1, n:"鬼宿(霊感)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "鬼宿"},
487	  ];
488	
489	  // ============= 修飾子: 論理 =============
490	  const MOD_LOGICAL = [
491	    {p:2, n:"水星が風の星座", t:d => [2,6,10].includes(planetSign(d,'水星'))},
492	    {p:1, n:"太陽が乙女座/双子座", t:d => sun(d) === 5 || sun(d) === 2},
493	    {p:1, n:"水星-土星アスペクト", t:d => hasAspect(d,'水星','土星','合') || hasAspect(d,'水星','土星','三分') || hasAspect(d,'水星','土星','六分')},
494	    {p:1, n:"ASCが乙女座/水瓶座", t:d => asc(d) === 5 || asc(d) === 10},
495	    {p:1, n:"風の星座に天体3つ以上", t:d => planetsInElement(d,'風') >= 3},
496	    {p:1, n:"食神透干", t:d => hasTen(d,'食神')},
497	    {p:1, n:"金が強い(3以上)", t:d => d.wx && d.wx['金'] >= 3},
498	    {p:2, n:"巨門が命宮", t:d => lifeStar(d,'巨門')},
499	    {p:2, n:"天機が命宮(論理的思考)", t:d => lifeStar(d,'天機')},
500	    {p:1, n:"文昌が命宮", t:d => lifeStar(d,'文昌')},
501	    {p:3, n:"玉堂星が中央", t:(d,sm) => smCenter(sm,'玉堂星')},
502	    {p:2, n:"司禄星が中央", t:(d,sm) => smCenter(sm,'司禄星')},
503	    {p:2, n:"LP4", t:(d,sm,nu) => nu && nu.lifePath === 4},
504	    {p:2, n:"LP8", t:(d,sm,nu) => nu && nu.lifePath === 8},
505	    {p:1, n:"LP1", t:(d,sm,nu) => nu && nu.lifePath === 1},
506	    {p:2, n:"八白土星", t:(d,sm,nu,ky) => ky && ky.honmei === 8},
507	    {p:1, n:"六白金星", t:(d,sm,nu,ky) => ky && ky.honmei === 6},
508	    {p:2, n:"黄色い種(気づき)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 3},
509	    {p:2, n:"白い鏡(秩序)", t:(d,sm,nu,ky,ma) => ma && ma.seal === 17},
510	    {p:2, n:"觜宿(研究)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "觜宿"},
511	    {p:1, n:"奎宿(学問)", t:(d,sm,nu,ky,ma,si) => shukuName(si) === "奎宿"},
512	  ];
513	
514	  // --------------------------------------------------------------------------
515	  // 投票関数
516	  // --------------------------------------------------------------------------
517	
518	  function vote(rules, d, sm, nu, ky, ma, si, jy) {
519	    let total = 0;
520	    const matched = [];
521	    for (const rule of rules) {
522	      try {
523	        if (rule.t(d, sm, nu, ky, ma, si, jy)) {
524	          total += rule.p;
525	          matched.push({n: rule.n, p: rule.p});
526	        }
527	      } catch (e) {
528	        // データが不足している場合はスキップ
529	      }
530	    }
531	    return {total, matched};
532	  }
533	
534	  // --------------------------------------------------------------------------
535	  // 強度ラベル
536	  //   差が大きい → 「絶対」
537	  //   差が中    → 「○○寄り」
538	  //   差が小    → 「両面（○○寄り）」
539	  // --------------------------------------------------------------------------
540	
541	  function strengthLabel(plus, minus, plusName, minusName) {
542	    const diff = Math.abs(plus - minus);
543	    const winner = plus >= minus ? plusName : minusName;
544	    const total = plus + minus;
545	    if (total === 0) return {winner: null, label: "判定不能", isAmbiguous: true};
546	    const ratio = diff / total;
547	    if (ratio >= 0.5) return {winner, label: `絶対${winner}`, isAmbiguous: false};
548	    if (ratio >= 0.2) return {winner, label: `${winner}寄り`, isAmbiguous: false};
549	    return {winner, label: `両面（${winner}寄り）`, isAmbiguous: true};
550	  }
551	
552	  // --------------------------------------------------------------------------
553	  // 16タイプ命名表
554	  // --------------------------------------------------------------------------
555	
556	  const TYPE_NAMES = {
557	    "革新_広い_リーダー_楽天":   {name: "ヒーロー",         desc: "前線で人を巻き込み、新しい時代を作るリーダー"},
558	    "革新_広い_リーダー_慎重":   {name: "レボリューショナー", desc: "深く考え、世を変えるしかないと突き進む"},
559	    "革新_広い_参謀_楽天":       {name: "トリックスター",   desc: "場に化学反応を起こす陽気な触媒"},
560	    "革新_広い_参謀_慎重":       {name: "ヴィジョナリー",   desc: "未来を見通し、独自の視点で組織を動かす"},
561	    "革新_狭い_リーダー_楽天":   {name: "パイオニア",       desc: "自分の領域を切り拓く先駆者"},
562	    "革新_狭い_リーダー_慎重":   {name: "ローンウルフ",     desc: "信念だけで戦う孤独な戦士"},
563	    "革新_狭い_参謀_楽天":       {name: "シーカー",         desc: "好きなことだけを楽しく深く究める"},
564	    "革新_狭い_参謀_慎重":       {name: "マーヴェリック",   desc: "群れを離れ、自分の領域で革命を起こす者"},
565	    "継承_広い_リーダー_楽天":   {name: "ソブリン",         desc: "光で人を集め、伝統を継ぐカリスマ"},
566	    "継承_広い_リーダー_慎重":   {name: "エンペラー",       desc: "重責を担い、組織を率いる威厳の人"},
567	    "継承_広い_参謀_楽天":       {name: "セージ",           desc: "楽しみながら教え、人を育てる賢者"},
568	    "継承_広い_参謀_慎重":       {name: "オラクル",         desc: "重みのある言葉で人を導く知の人"},
569	    "継承_狭い_リーダー_楽天":   {name: "アルチザン",       desc: "自分の道を究め、後進に伝える名工"},
570	    "継承_狭い_リーダー_慎重":   {name: "ガーディアン",     desc: "重い使命を背負って伝統を守る守護者"},
571	    "継承_狭い_参謀_楽天":       {name: "ケアテイカー",     desc: "黙々と支え、人を育てる縁の下の力持ち"},
572	    "継承_狭い_参謀_慎重":       {name: "ハーミット",       desc: "世から離れ、深く一点を究める静かな賢者"},
573	  };
574	
575	  // --------------------------------------------------------------------------
576	  // メイン: タイプ判定
577	  // --------------------------------------------------------------------------
578	
579	  function judgeType(d, sm, nu, ky, ma, shukuIdx, jy) {
580	    const a1pos = vote(AXIS1_REVOLUTION, d, sm, nu, ky, ma, shukuIdx, jy);
581	    const a1neg = vote(AXIS1_TRADITION,  d, sm, nu, ky, ma, shukuIdx, jy);
582	    const a2pos = vote(AXIS2_WIDE,       d, sm, nu, ky, ma, shukuIdx, jy);
583	    const a2neg = vote(AXIS2_NARROW,     d, sm, nu, ky, ma, shukuIdx, jy);
584	    const a3pos = vote(AXIS3_LEADER,     d, sm, nu, ky, ma, shukuIdx, jy);
585	    const a3neg = vote(AXIS3_STRATEGIST, d, sm, nu, ky, ma, shukuIdx, jy);
586	    const a4pos = vote(AXIS4_OPTIMIST,   d, sm, nu, ky, ma, shukuIdx, jy);
587	    const a4neg = vote(AXIS4_PESSIMIST,  d, sm, nu, ky, ma, shukuIdx, jy);
588	    const m1pos = vote(MOD_EARLY,        d, sm, nu, ky, ma, shukuIdx, jy);
589	    const m1neg = vote(MOD_LATE,         d, sm, nu, ky, ma, shukuIdx, jy);
590	    const m2pos = vote(MOD_INTUITIVE,    d, sm, nu, ky, ma, shukuIdx, jy);
591	    const m2neg = vote(MOD_LOGICAL,      d, sm, nu, ky, ma, shukuIdx, jy);
592	
593	    const a1 = strengthLabel(a1pos.total, a1neg.total, "革新", "継承");
594	    const a2 = strengthLabel(a2pos.total, a2neg.total, "広い", "狭い");
595	    const a3 = strengthLabel(a3pos.total, a3neg.total, "リーダー", "参謀");
596	    const a4 = strengthLabel(a4pos.total, a4neg.total, "楽天", "慎重");
597	    const m1 = strengthLabel(m1pos.total, m1neg.total, "早咲き", "晩成");
598	    const m2 = strengthLabel(m2pos.total, m2neg.total, "直感", "論理");
599	
600	    const typeKey = [a1.winner, a2.winner, a3.winner, a4.winner].join("_");
601	    const typeInfo = TYPE_NAMES[typeKey] || {name: "判定不能", desc: ""};
602	
603	    return {
604	      type: typeInfo,
605	      typeKey,
606	      axes: {
607	        a1: {winner: a1.winner, label: a1.label, ambiguous: a1.isAmbiguous, plus: a1pos.total, minus: a1neg.total, plusName: "革新", minusName: "継承", plusEvidence: a1pos.matched, minusEvidence: a1neg.matched},
608	        a2: {winner: a2.winner, label: a2.label, ambiguous: a2.isAmbiguous, plus: a2pos.total, minus: a2neg.total, plusName: "広い", minusName: "狭い", plusEvidence: a2pos.matched, minusEvidence: a2neg.matched},
609	        a3: {winner: a3.winner, label: a3.label, ambiguous: a3.isAmbiguous, plus: a3pos.total, minus: a3neg.total, plusName: "リーダー", minusName: "参謀", plusEvidence: a3pos.matched, minusEvidence: a3neg.matched},
610	        a4: {winner: a4.winner, label: a4.label, ambiguous: a4.isAmbiguous, plus: a4pos.total, minus: a4neg.total, plusName: "楽天", minusName: "慎重", plusEvidence: a4pos.matched, minusEvidence: a4neg.matched},
611	      },
612	      modifiers: {
613	        m1: {winner: m1.winner, label: m1.label, ambiguous: m1.isAmbiguous, plus: m1pos.total, minus: m1neg.total, plusName: "早咲き", minusName: "晩成", plusEvidence: m1pos.matched, minusEvidence: m1neg.matched},
614	        m2: {winner: m2.winner, label: m2.label, ambiguous: m2.isAmbiguous, plus: m2pos.total, minus: m2neg.total, plusName: "直感", minusName: "論理", plusEvidence: m2pos.matched, minusEvidence: m2neg.matched},
615	      },
616	    };
617	  }
618	
619	  // --------------------------------------------------------------------------
620	  // 結果のフォーマット（コンソール出力用）
621	  // --------------------------------------------------------------------------
622	
623	  function formatResult(r) {
624	    const lines = [];
625	    lines.push("═══════════════════════════════════════════════");
626	    lines.push(`  16タイプ判定: 【${r.type.name}】`);
627	    lines.push(`  ${r.type.desc}`);
628	    lines.push("═══════════════════════════════════════════════");
629	    lines.push("");
630	    lines.push(`  タイプコード: ${r.typeKey}`);
631	    lines.push("");
632	    lines.push("─── 軸別強度 ─────────────────────────────────");
633	
634	    const fmtAxis = (key, axis) => {
635	      const bar = (() => {
636	        const total = axis.plus + axis.minus;
637	        if (total === 0) return "ーーーーーーーーーーーー";
638	        const plusRatio = axis.plus / total;
639	        const pos = Math.round(plusRatio * 12);
640	        return "ーー".repeat(pos) + "●" + "ーー".repeat(12 - pos);
641	      })();
642	      return `  ${key}  ${axis.plusName.padEnd(8)} ${bar} ${axis.minusName}    ${axis.label} (${axis.plus} vs ${axis.minus})`;
643	    };
644	
645	    lines.push(fmtAxis("軸1", r.axes.a1));
646	    lines.push(fmtAxis("軸2", r.axes.a2));
647	    lines.push(fmtAxis("軸3", r.axes.a3));
648	    lines.push(fmtAxis("軸4", r.axes.a4));
649	    lines.push("");
650	    lines.push("─── 修飾子 ──────────────────────────────────");
651	    lines.push(fmtAxis("修1", r.modifiers.m1));
652	    lines.push(fmtAxis("修2", r.modifiers.m2));
653	    lines.push("");
654	    lines.push("─── 詳細投票 ────────────────────────────────");
655	
656	    const fmtEvidence = (axis) => {
657	      const out = [];
658	      out.push(`  [${axis.plusName}] ${axis.plus}点`);
659	      for (const e of axis.plusEvidence) {
660	        out.push(`    +${e.p}  ${e.n}`);
661	      }
662	      out.push(`  [${axis.minusName}] ${axis.minus}点`);
663	      for (const e of axis.minusEvidence) {
664	        out.push(`    +${e.p}  ${e.n}`);
665	      }
666	      return out.join("\n");
667	    };
668	
669	    lines.push("【軸1: 革新 vs 継承】");
670	    lines.push(fmtEvidence(r.axes.a1));
671	    lines.push("");
672	    lines.push("【軸2: 広い vs 狭い】");
673	    lines.push(fmtEvidence(r.axes.a2));
674	    lines.push("");
675	    lines.push("【軸3: リーダー vs 参謀】");
676	    lines.push(fmtEvidence(r.axes.a3));
677	    lines.push("");
678	    lines.push("【軸4: 楽天 vs 慎重】");
679	    lines.push(fmtEvidence(r.axes.a4));
680	    lines.push("");
681	    lines.push("【修1: 早咲き vs 晩成】");
682	    lines.push(fmtEvidence(r.modifiers.m1));
683	    lines.push("");
684	    lines.push("【修2: 直感 vs 論理】");
685	    lines.push(fmtEvidence(r.modifiers.m2));
686	
687	    return lines.join("\n");
688	  }
689	
690	  // --------------------------------------------------------------------------
691	  // 既存HTMLのデータを使って判定（コンソール用）
692	  //
693	  //   使い方: ブラウザのコンソールで以下を実行
694	  //     TypeDebug.runFromHTML();
695	  //
696	  //   currentData が設定されていなければエラー
697	  // --------------------------------------------------------------------------
698	
699	  function runFromHTML() {
700	    if (typeof currentData === 'undefined' || !currentData) {
701	      console.error("currentData が未設定です。先に「命盤を立てる」を実行してください。");
702	      return;
703	    }
704	    const d = currentData;
705	
706	    // 補助データを既存関数で計算
707	    const sm = (typeof calcJintai === 'function') ? calcJintai(d) : null;
708	    const nu = (typeof calcNumerology === 'function') ? calcNumerology(d.y, d.m, d.d) : null;
709	    const ky = (typeof calcKyusei === 'function') ? calcKyusei(d.y, d.m) : null;
710	    const ma = (typeof calcMaya === 'function') ? calcMaya(d.y, d.m, d.d) : null;
711	    const shukuIdx = (typeof calcShukuyo === 'function') ? calcShukuyo(d.moonLon) : null;
712	
713	    // インド占星術（サイデリアル）
714	    let jy = null;
715	    if (typeof ayanamsha === 'function') {
716	      const aya = ayanamsha(d.jd);
717	      jy = {
718	        sunRashi: Math.floor(norm360(d.sunLon - aya) / 30),
719	        moonRashi: Math.floor(norm360(d.moonLon - aya) / 30),
720	        lagnaRashi: d.ascLon !== null ? Math.floor(norm360(d.ascLon - aya) / 30) : null,
721	      };
722	    }
723	
724	    const result = judgeType(d, sm, nu, ky, ma, shukuIdx, jy);
725	    console.log(formatResult(result));
726	    return result;
727	  }
728	
729	  // --------------------------------------------------------------------------
730	  // エクスポート
731	  // --------------------------------------------------------------------------
732	
733	  global.TypeDebug = {
734	    judgeType,
735	    formatResult,
736	    runFromHTML,
737	    // 個別ルールへのアクセス（デバッグ用）
738	    rules: {
739	      AXIS1_REVOLUTION, AXIS1_TRADITION,
740	      AXIS2_WIDE, AXIS2_NARROW,
741	      AXIS3_LEADER, AXIS3_STRATEGIST,
742	      AXIS4_OPTIMIST, AXIS4_PESSIMIST,
743	      MOD_EARLY, MOD_LATE,
744	      MOD_INTUITIVE, MOD_LOGICAL,
745	    },
746	    TYPE_NAMES,
747	  };
748	
749	  console.log("✓ TypeDebug ロード完了。命盤を立てた後、TypeDebug.runFromHTML() を実行してください。");
750	
751	})(typeof window !== 'undefined' ? window : globalThis);
752	
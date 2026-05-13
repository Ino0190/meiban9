/**
 * Celestial Sphere — バニラJS + Three.js
 * サイドバーのロゴ位置に3D天球アニメーションを描画する
 * 中心にrasenbanlogo.pngをオーバーレイ
 *
 * 使い方: initCelestialSphere(containerElement)
 * Three.js (CDN) が先に読み込まれている必要がある
 */

// 黄道12星座 — 正規化座標 [-0.5, 0.5]、線インデックス
const ZODIAC_CONSTS = [
  {n:'Aries',    s:[[.1,.25],[-.05,0],[-.25,-.25]],            l:[[0,1],[1,2]]},
  {n:'Taurus',   s:[[.05,.1],[-.3,-.2],[-.1,-.1],[.3,-.1],[.45,-.3]], l:[[0,2],[0,3],[2,1],[2,3],[3,4]]},
  {n:'Gemini',   s:[[-.2,.4],[.2,.4],[-.2,.0],[.2,.0],[-.2,-.4],[.2,-.4]], l:[[0,2],[2,4],[1,3],[3,5],[2,3]]},
  {n:'Cancer',   s:[[0,.3],[-.3,-.1],[.3,-.1],[0,-.4]],        l:[[0,1],[0,2],[1,3],[2,3]]},
  {n:'Leo',      s:[[.1,-.4],[-.1,-.1],[-.1,.15],[0,.35],[.2,.45],[.4,.3],[.45,-.15]], l:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,2],[0,6]]},
  {n:'Virgo',    s:[[.3,.4],[0,.1],[.3,0],[-.1,-.2],[-.3,-.5],[.3,-.5]], l:[[0,1],[0,2],[1,3],[3,4],[3,5]]},
  {n:'Libra',    s:[[-.4,.1],[.4,.1],[0,-.1],[-.2,.4],[.2,.4]], l:[[0,2],[2,1],[0,3],[3,4],[4,1]]},
  {n:'Scorpius', s:[[-.3,.35],[-.05,.35],[.2,.2],[.35,0],[.35,-.2],[.2,-.4],[0,-.45],[-.2,-.3]], l:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]]},
  {n:'Sagitt.',  s:[[-.25,-.1],[-.05,.15],[.2,.2],[.4,-.1],[.2,-.4],[-.2,-.4],[.3,.4]], l:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[2,6]]},
  {n:'Capric.',  s:[[-.35,.2],[0,.35],[.3,.25],[.4,-.1],[.1,-.35],[-.3,-.25]], l:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[1,3]]},
  {n:'Aquarius', s:[[.1,.3],[-.2,.1],[.1,-.05],[-.2,-.25],[.1,-.45],[.4,.1]], l:[[0,5],[5,2],[0,1],[1,2],[2,3],[3,4]]},
  {n:'Pisces',   s:[[-.3,.3],[-.4,0],[-.3,-.3],[0,0],[.3,.3],[.4,0],[.3,-.3]], l:[[0,1],[1,2],[0,3],[2,3],[3,4],[4,5],[5,6]]},
];

function initCelestialSphere(container) {
  if (!container || typeof THREE === 'undefined') {
    console.warn('CelestialSphere: container or THREE.js not available');
    return null;
  }

  const W = container.clientWidth || 160;
  const H = container.clientHeight || 160;

  // Scene
  const scene = new THREE.Scene();
  const aspect = W / H;
  const fov = 52;
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 2000);
  camera.position.set(0, 0, 6.0);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // Stars (gold tints)
  const starCount = 400;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  const tints = [
    [0.72,0.53,0.04],[0.83,0.66,0.12],[0.55,0.39,0.08],[0.90,0.78,0.35]
  ];
  for (let i = 0; i < starCount; i++) {
    const r = 250 + Math.random() * 450;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    starPos[i*3]   = r * Math.sin(ph) * Math.cos(th);
    starPos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
    starPos[i*3+2] = r * Math.cos(ph);
    const t = tints[Math.floor(Math.random() * tints.length)];
    const b = 0.35 + Math.random() * 0.55;
    starCol[i*3] = t[0]*b; starCol[i*3+1] = t[1]*b; starCol[i*3+2] = t[2]*b;
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const stars = new THREE.Points(sGeo, new THREE.PointsMaterial({
    size: 1.0, vertexColors: true, transparent: true, opacity: 0.45, sizeAttenuation: true
  }));
  scene.add(stars);

  // Main group (rotates together)
  const mainGroup = new THREE.Group();
  scene.add(mainGroup);

  // Celestial sphere (translucent cream)
  mainGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0xf5ead0, transparent: true, opacity: 0.12 })
  ));
  mainGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(2.11, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xc8a830, wireframe: true, transparent: true, opacity: 0.08 })
  ));

  // Ring builder
  function makeRing(rx, rz, tiltDeg, color, opacity, seg) {
    seg = seg || 128;
    const pts = [];
    const tilt = tiltDeg * Math.PI / 180;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(a) * rx,
        Math.sin(a) * rz * Math.sin(tilt),
        Math.sin(a) * rz * Math.cos(tilt)
      ));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity })
    );
  }

  // Ecliptic rings (23.5° tilt)
  mainGroup.add(makeRing(2.2, 2.2, 23.5, 0xb8860b, 0.88));
  mainGroup.add(makeRing(2.18, 2.18, 23.5, 0xe8c84a, 0.25));
  mainGroup.add(makeRing(2.23, 2.23, 23.5, 0xd4a820, 0.10));

  // Meridian
  const mp = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    mp.push(new THREE.Vector3(0, Math.sin(a) * 2.15, Math.cos(a) * 2.15));
  }
  mainGroup.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(mp),
    new THREE.LineBasicMaterial({ color: 0xc8a040, transparent: true, opacity: 0.28 })
  ));

  // Moon on ecliptic
  const moonGeo = new THREE.SphereGeometry(0.18, 16, 16);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xf0d040 });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  const moonOrbitR = 2.35;
  mainGroup.add(moon);

  // Constellations on ecliptic
  const tiltRad = 23.5 * Math.PI / 180;
  const constScale = 0.60;
  const constR = 2.50;
  const constGroup = new THREE.Group();

  const cLineMat = new THREE.LineBasicMaterial({ color: 0xb8860b, transparent: true, opacity: 0.65 });
  const cStarBrt = new THREE.MeshBasicMaterial({ color: 0xf0d040 });
  const cStarDim = new THREE.MeshBasicMaterial({ color: 0xc8a030 });
  const cAnchor = new THREE.MeshBasicMaterial({ color: 0x9a7200, transparent: true, opacity: 0.5 });

  ZODIAC_CONSTS.forEach(function(con, i) {
    const a = (i / 12) * Math.PI * 2;
    const center = new THREE.Vector3(
      Math.cos(a) * constR,
      Math.sin(a) * constR * Math.sin(tiltRad),
      Math.sin(a) * constR * Math.cos(tiltRad)
    );
    const tangent = new THREE.Vector3(
      -Math.sin(a),
      Math.cos(a) * Math.sin(tiltRad),
      Math.cos(a) * Math.cos(tiltRad)
    ).normalize();
    const radial = center.clone().normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, radial).normalize();

    // Lines
    con.l.forEach(function(pair) {
      const [ai, bi] = pair;
      const [x1, y1] = con.s[ai];
      const [x2, y2] = con.s[bi];
      const p1 = center.clone().addScaledVector(tangent, x1 * constScale).addScaledVector(normal, y1 * constScale);
      const p2 = center.clone().addScaledVector(tangent, x2 * constScale).addScaledVector(normal, y2 * constScale);
      constGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), cLineMat));
    });
    // Star dots
    con.s.forEach(function(coord, si) {
      const [x, y] = coord;
      const sp = center.clone().addScaledVector(tangent, x * constScale).addScaledVector(normal, y * constScale);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(si === 0 ? 0.038 : 0.022, 6, 6),
        si === 0 ? cStarBrt : cStarDim
      );
      dot.position.copy(sp);
      constGroup.add(dot);
    });
    // Anchor dot on ecliptic
    const anc = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), cAnchor);
    anc.position.copy(center.clone().multiplyScalar(2.22 / constR));
    constGroup.add(anc);
    // Spoke
    const spkPts = [new THREE.Vector3(0, 0, 0), center.clone().multiplyScalar(0.96)];
    constGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(spkPts),
      new THREE.LineBasicMaterial({ color: 0xb8860b, transparent: true, opacity: 0.06 })
    ));
  });
  mainGroup.add(constGroup);

  // Mouse/touch interaction
  let drag = false, px = 0, py = 0;
  let tX = 0.15, tY = 0, cX = 0.15, cY = 0, autoSpd = 0.0005;

  function onDown(e) { drag = true; px = e.clientX; py = e.clientY; autoSpd = 0; }
  function onMove(e) {
    if (!drag) return;
    tY += (e.clientX - px) * 0.005;
    tX += (e.clientY - py) * 0.003;
    tX = Math.max(-0.7, Math.min(0.7, tX));
    px = e.clientX; py = e.clientY;
  }
  function onUp() { drag = false; autoSpd = 0.0005; }
  function onTD(e) { drag = true; px = e.touches[0].clientX; py = e.touches[0].clientY; autoSpd = 0; }
  function onTM(e) {
    if (!drag) return;
    tY += (e.touches[0].clientX - px) * 0.005;
    tX += (e.touches[0].clientY - py) * 0.003;
    tX = Math.max(-0.7, Math.min(0.7, tX));
    px = e.touches[0].clientX; py = e.touches[0].clientY;
  }

  container.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  container.addEventListener('touchstart', onTD);
  window.addEventListener('touchmove', onTM);
  window.addEventListener('touchend', onUp);

  // Animation loop
  let animId;
  const clock = new THREE.Clock();
  function animate() {
    animId = requestAnimationFrame(animate);
    tY += autoSpd;
    cX += (tX - cX) * 0.06;
    cY += (tY - cY) * 0.06;
    mainGroup.rotation.x = cX;
    mainGroup.rotation.y = cY;
    stars.rotation.y = clock.getElapsedTime() * 0.004;

    // Moon orbits on ecliptic
    var moonAngle = clock.getElapsedTime() * 0.15;
    var tiltRad2 = 23.5 * Math.PI / 180;
    moon.position.set(
      Math.cos(moonAngle) * moonOrbitR,
      Math.sin(moonAngle) * moonOrbitR * Math.sin(tiltRad2),
      Math.sin(moonAngle) * moonOrbitR * Math.cos(tiltRad2)
    );

    renderer.render(scene, camera);
  }
  animate();

  // Resize handler
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  // Return dispose function
  return function dispose() {
    cancelAnimationFrame(animId);
    container.removeEventListener('mousedown', onDown);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    container.removeEventListener('touchstart', onTD);
    window.removeEventListener('touchmove', onTM);
    window.removeEventListener('touchend', onUp);
    window.removeEventListener('resize', onResize);
    if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    renderer.dispose();
  };
}

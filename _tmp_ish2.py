from pathlib import Path
from playwright.sync_api import sync_playwright
HERE = Path(__file__).resolve().parent
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    pg = b.new_page(viewport={"width": 390, "height": 900}, device_scale_factor=2)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto((HERE / "index.html").as_uri() + "?new")
    pg.wait_for_function("typeof EPH !== 'undefined'", timeout=60000)
    # 入口の易経（空の画面）
    pg.click("text=今すぐ占う")
    pg.wait_for_timeout(400)
    print("空の画面:", pg.locator("#quick-oracle h3").inner_text(), "／", pg.locator("#quick-oracle p").first.inner_text())
    # 結果画面の易経
    pg.evaluate("""() => { window._quietRender = true; currentData = calcPersonData('1990-05-15','12:30','known','F','東京都');
      dataB = null; currentMode = 'self'; renderAll(); window._quietRender = false; setTab(10); castIChing(); }""")
    pg.wait_for_timeout(300)
    print("結果画面:", pg.locator("#iching-result h3").inner_text())
    pg.locator("#quick-oracle").screenshot(path=str(HERE / "_tmp_shots" / "iching_final.png"))
    print("JSエラー:", errs)
    b.close()

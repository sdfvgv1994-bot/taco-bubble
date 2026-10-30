"""泡泡花園的檢查：遊戲程式用 node 跑（假的瀏覽器物件），驗證規則、手機操作和修過的 bug。"""
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
HARNESS = ROOT / "tests" / "harness.js"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="需要 node")


def run(js, store=None):
    """在遊戲程式後面接一段測試程式執行，回傳 (return 的值, 存檔內容)。"""
    args = ["node", str(HARNESS), str(HTML), js]
    if store is not None:
        args.append(json.dumps(store))
    out = subprocess.run(args, capture_output=True, text=True, check=True).stdout
    data = json.loads(out.strip().splitlines()[-1])
    return data["out"], data["store"]


BLOCKS = ["elements", "config", "state", "sound", "board", "flight", "draw", "game", "input", "main"]


def script_srcs():
    # 雙引號、單引號都認得，不會悄悄漏掉某個積木
    return re.findall(r'<script\b[^>]*\bsrc=["\']([^"\']+)["\']', HTML.read_text(encoding="utf-8"))


def test_page_files():
    """網頁本身：手機狀態列、遊戲區不會被拖去捲動網頁、版本號、部署流程先跑測試。"""
    html = HTML.read_text(encoding="utf-8")
    css = (ROOT / "style.css").read_text(encoding="utf-8")
    for el in ["hudScore", "hudBest", "hudNext", "hudStatus", "gameCanvas", "modeSelect", "ver"]:
        assert f'id="{el}"' in html, el
    assert re.search(r"canvas\s*\{[^}]*touch-action:\s*none", css)
    assert '<meta name="app-version" content="dev"' in html
    assert '<link rel="stylesheet" href="style.css?v=dev" />' in html
    assert "<style>" not in html
    wf = (ROOT / ".github" / "workflows" / "pages.yml").read_text(encoding="utf-8")
    assert "pytest" in wf and "needs: test" in wf and "app-version" in wf


def test_blocks_load_in_order():
    """積木照固定順序載入、每個都帶 ?v=dev（上線換成版本號，手機才不會新舊檔混用），沒有內嵌程式。"""
    assert script_srcs() == [f"js/{b}.js?v=dev" for b in BLOCKS]
    assert "<script>" not in HTML.read_text(encoding="utf-8")
    # js 資料夾裡沒有被忘記接上的積木
    assert sorted(p.stem for p in (ROOT / "js").glob("*.js")) == sorted(BLOCKS)


def test_deploy_copies_all_blocks():
    """上線流程要把 css、js 一起放上去，並把每個 ?v=dev 換成版本號，漏換就讓上線失敗。"""
    wf = (ROOT / ".github" / "workflows" / "pages.yml").read_text(encoding="utf-8")
    assert re.search(r"cp -r index\.html style\.css js site/", wf)
    assert 's#?v=dev\\"#?v=$v\\"#g' in wf
    assert 'if grep -q "v=dev" site/index.html; then' in wf and "exit 1" in wf


def test_script_syntax():
    """每個積木語法都正確。"""
    for b in BLOCKS:
        subprocess.run(["node", "--check", str(ROOT / "js" / f"{b}.js")], check=True)


def test_start_state():
    """一開始：經典模式 6 排、10 欄，瞄準線朝正上方（之前手機上會指向左上角）。"""
    r, _ = run("return {rows: board.length, cols: columns, up: aim.x === width / 2 && aim.y < height / 2, over: gameOver};")
    assert r == {"rows": 6, "cols": 10, "up": True, "over": False}


GEOMETRY = """
  // 檢查盤面幾何：neighbors() 說相鄰的格子距離要剛好 2 個半徑，也不能有重疊的泡泡
  function geometryOk() {
    const cells = [];
    board.forEach((row, r) => row && row.forEach((c, k) => { if (c !== undefined) cells.push([r, k]); }));
    for (const [r, k] of cells) {
      const a = bubbleCenter(r, k);
      if (a.x < radius - 0.01 || a.x > width - radius + 0.01) return 'out of bounds ' + r + ',' + k;
      for (const [nr, nk] of neighbors(r, k)) {
        if (nr < 0 || nk < 0 || nk >= columns) continue;
        const b = bubbleCenter(nr, nk);
        if (Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 2 * radius) > 0.01) return 'bad neighbor ' + r + ',' + k;
      }
      for (const [r2, k2] of cells) {
        if (r2 === r && k2 === k) continue;
        const b = bubbleCenter(r2, k2);
        if (Math.hypot(a.x - b.x, a.y - b.y) < 2 * radius - 0.01) return 'overlap';
      }
    }
    return 'ok';
  }
"""


def test_drop_keeps_bubbles_in_place():
    """下降模式多一排時，原本的泡泡只往下移、不會左右跳半格（之前的 bug：整片泡泡每次下降都左右晃）。"""
    r, _ = run(GEOMETRY + """
      __els.modeSelect.value = 'descent'; resetGame();
      const before = centerOf(0, 0), beforeColor = board[0][0];
      dropField();
      const after1 = centerOf(1, 0);
      const g1 = geometryOk();
      dropField();
      const after2 = centerOf(2, 0);
      return {sameX1: Math.abs(after1.x - before.x) < 0.01, sameX2: Math.abs(after2.x - before.x) < 0.01,
              down: after1.y > before.y, color: board[2][0] === beforeColor, g1, g2: geometryOk()};
    """)
    assert r == {"sameX1": True, "sameX2": True, "down": True, "color": True, "g1": "ok", "g2": "ok"}


def test_geometry_valid_in_all_modes():
    """每種模式開局盤面都是正確的蜂巢排列（泡泡不重疊、不超出牆）。"""
    r, _ = run(GEOMETRY + """
      const res = {};
      for (const m of ['classic', 'campaign', 'falling', 'timed', 'shots', 'descent']) {
        __els.modeSelect.value = m; resetGame(); res[m] = geometryOk();
      }
      return res;
    """)
    assert set(r.values()) == {"ok"}, r


def test_three_same_color_clear_and_score():
    """接到 3 顆同色就消掉：每顆 10 分；吊在下面的泡泡一起掉，每顆 5 分。"""
    r, _ = run("""
      setBoard([[0, 0, 1, 1, 1, 1, 1, 1, 1, 1], [2, null, null, null, null, null, null, null, null], [3]]);
      // (1,0) 是 2 號色，(2,0) 吊在它下面；在 (1,1) 放 0 號色：跟 (0,0)(0,1) 連成 3 顆
      board[1][0] = 0; board[2][0] = 3;
      score = 0;
      finishTurn(1, 1, 0);
      const empty = [[0, 0], [0, 1], [1, 1], [1, 0], [2, 0]].every(([r, c]) => board[r][c] === undefined);
      return {score, empty, rest: board[0][2] === 1};
    """)
    # 消掉 (0,0)(0,1)(1,0)(1,1) 四顆 0 號色 = 40；(2,0) 只靠 (1,0) 吊著，跟著掉 = 5；其他泡泡不受影響
    assert r == {"score": 45, "empty": True, "rest": True}


def test_not_adjacent_not_cleared():
    """沒碰在一起的同色泡泡不能一起消（原版的 bug：錯開的那排往上找錯鄰居，會把左上方離很遠的泡泡算進來）。"""
    r, _ = run("""
      // (1,1) 在錯開的排，真正貼著的上方是 (0,1)(0,2)；(0,0) 離它有 3 個半徑遠，不相鄰
      setBoard([[0, 1, 2, 1, 1, 1, 1, 1, 1, 1], [null, null, 0, null, null, null, null, null, null]]);
      score = 0;
      finishTurn(1, 1, 0);   // 真正相連的只有 (1,1)(1,2) 兩顆，不該消
      return {kept: board[0][0] === 0 && board[1][1] === 0 && board[1][2] === 0, score};
    """)
    assert r == {"kept": True, "score": 0}

def test_two_same_color_stays():
    """只有 2 顆同色不會消，也不加分。"""
    r, _ = run("""
      setBoard([[0, 1, 1, 1, 1, 1, 1, 1, 1, 1]]);
      score = 0; finishTurn(1, 0, 0);
      return {score, kept: board[0][0] === 0 && board[1][0] === 0};
    """)
    assert r == {"score": 0, "kept": True}


def test_best_score_saved_and_loaded():
    """最高紀錄會存起來，下次打開還在（之前重新整理就歸零）。"""
    _, store = run("""
      setBoard([[0, 0, 1, 1, 1, 1, 1, 1, 1, 1]]); score = 0; finishTurn(1, 0, 0);
      return score;
    """)
    assert store.get("bubbleGarden.best") == "30"
    r, _ = run("return document.getElementById('bestScore').textContent;", store)
    assert r == "0030"


def test_best_not_lowered():
    """之前的紀錄比較高時，不會被這次的低分蓋掉。"""
    _, store = run("setBoard([[0, 0, 1, 1, 1, 1, 1, 1, 1, 1]]); score = 0; finishTurn(1, 0, 0); return 0;",
                   {"bubbleGarden.best": "500"})
    assert store["bubbleGarden.best"] == "500"


def test_touch_aim_then_release_shoots():
    """手機：手指按下只瞄準不發射，拖曳時有瞄準線，放開才發射，方向就是手指的位置。"""
    r, _ = run("""
      __fire('gameCanvas', 'pointerdown', {pointerType: 'touch', pointerId: 7, clientX: 100, clientY: 200});
      const afterDown = projectile === null && touchAiming;
      __fire('gameCanvas', 'pointermove', {pointerType: 'touch', pointerId: 7, clientX: 60, clientY: 150});
      const aimed = aim.x === 60 && aim.y === 150;
      __fire('gameCanvas', 'pointerup', {pointerType: 'touch', pointerId: 7, clientX: 60, clientY: 150});
      return {afterDown, aimed, shot: projectile !== null, left: projectile && projectile.vx < 0, aiming: touchAiming};
    """)
    assert r == {"afterDown": True, "aimed": True, "shot": True, "left": True, "aiming": False}


def test_touch_release_below_cancels():
    """手機：拖到發射台下面再放開＝取消，不會射出去，也不會扣限球模式的球數。"""
    r, _ = run("""
      __els.modeSelect.value = 'shots'; resetGame();
      touchAim(width / 2, height - 2);
      return {shot: projectile !== null, left: shotsRemaining};
    """)
    assert r == {"shot": False, "left": 25}


def test_other_finger_ignored():
    """第二根手指不會打斷正在瞄準的第一根。"""
    r, _ = run("""
      __fire('gameCanvas', 'pointerdown', {pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 200});
      __fire('gameCanvas', 'pointermove', {pointerType: 'touch', pointerId: 2, clientX: 5, clientY: 5});
      const keep = aim.x === 100 && aim.y === 200;
      __fire('gameCanvas', 'pointerup', {pointerType: 'touch', pointerId: 2, clientX: 5, clientY: 5});
      return {keep, still: touchAiming && projectile === null};
    """)
    assert r == {"keep": True, "still": True}


def test_second_finger_down_does_not_move_aim():
    """第二根手指按下去，瞄準線不會跳過去（之前會跳到第二根手指的位置）。"""
    r, _ = run("""
      __fire('gameCanvas', 'pointerdown', {pointerType: 'touch', pointerId: 1, clientX: 70, clientY: 190});
      __fire('gameCanvas', 'pointerdown', {pointerType: 'touch', pointerId: 2, clientX: 315, clientY: 120});
      return {x: aim.x, y: aim.y, aiming: touchAiming && touchPointerId === 1};
    """)
    assert r == {"x": 70, "y": 190, "aiming": True}


def test_release_during_drop_is_queued():
    """整片正在往下降、或上一顆還在飛的時候放開手指：不會被吃掉，等一下自動射出去。"""
    r, _ = run("""
      __els.modeSelect.value = 'shots'; resetGame();
      boardDropAnimation = {startedAt: performance.now(), firstRow: 1};
      touchAim(width / 2, 20);
      const waiting = projectile === null && shotsRemaining === 25;
      tick(1);
      const fired1 = shotsRemaining === 24;
      tick(3);   // 等第一顆落地
      // 上一顆還在飛時再放開一次
      shoot(width / 2, 20);
      const flying = projectile !== null;
      touchAim(width / 2 - 30, 20);
      tick(3);
      return {waiting, fired1, flying, fired2: shotsRemaining === 22};
    """)
    assert r == {"waiting": True, "fired1": True, "flying": True, "fired2": True}


def test_level_advance_in_background_pauses():
    """過關畫面時切到別的 App：下一關準備好但先暫停，不會在背景自己開始。"""
    r, _ = run("""
      __els.modeSelect.value = 'campaign'; resetGame();
      setBoard([[0, 0]]);
      finishTurn(0, 2, 0);
      document.hidden = true;
      tick(2);
      return {level: currentLevel, paused};
    """)
    assert r == {"level": 2, "paused": True}


def test_mouse_click_shoots_immediately():
    """電腦：滑鼠點一下就發射（維持原本的玩法）。"""
    r, _ = run("""
      __fire('gameCanvas', 'pointerdown', {pointerType: 'mouse', pointerId: 1, clientX: 200, clientY: 100});
      return projectile !== null;
    """)
    assert r is True


def test_aim_path_bounces_inside_walls():
    """手指瞄準時的路線：斜斜射會撞牆反彈，路線不會跑出牆外，最後停在泡泡或天花板。"""
    r, _ = run("""
      const s = shooterPosition();
      const path = aimPath(s, -300, -120);
      const inside = path.every(p => p.x >= radius - 0.01 && p.x <= width - radius + 0.01);
      const end = path[path.length - 1];
      return {bounces: path.length > 2, inside, stops: end.y <= radius + 0.01 || touchesBubble(end.x, end.y)};
    """)
    assert r == {"bounces": True, "inside": True, "stops": True}


def test_shot_lands_where_path_ends():
    """瞄準線沒有騙人：每個角度實際射出去，泡泡都停在瞄準路線終點那一格（之前約 16% 的角度會差一格）。"""
    r, _ = run("""
      const misses = [];
      let total = 0;
      for (const mode of ['classic', 'falling']) {
        for (let deg = -80; deg <= 80; deg += 4) {
          __els.modeSelect.value = mode; resetGame();
          // 盤面只用 0～2 號色，射 5 號色：不會消，落點一定看得到
          setBoard(board.map((row, r) => row.map((c, k) => (r + k) % 3)));
          currentColor = 5;
          const s = shooterPosition(), a = deg * Math.PI / 180;
          const tx = s.x + Math.sin(a) * 100, ty = s.y - Math.cos(a) * 100;
          const path = aimPath(s, tx - s.x, ty - s.y);
          const end = path[path.length - 1];
          const want = findNearestEmpty(end.x, end.y);
          shoot(tx, ty);
          // 一落地就停（很斜的角度要在牆壁之間彈好幾次；也不能等太久，不然碰到 8 秒一次的下降）
          for (let t = 0; t < 100 && projectile; t++) tick(0.1);
          let got = null;
          board.forEach((row, rr) => row && row.forEach((c, k) => { if (c === 5) got = {row: rr, column: k}; }));
          total += 1;
          if (!got || got.row !== want.row || got.column !== want.column) misses.push(mode + ' ' + deg);
        }
      }
      return {total, misses};
    """)
    assert r["total"] == 82
    assert r["misses"] == []

def test_hidden_page_pauses():
    """手機切到別的 App：遊戲自動暫停（限時模式不會偷偷倒數）。"""
    r, _ = run("""
      document.hidden = true; __fire('document', 'visibilitychange');
      return paused;
    """)
    assert r is True


def test_timed_mode_runs_out():
    """限時挑戰：第一發之後開始倒數，60 秒到就結束；暫停期間不扣時間。"""
    r, _ = run("""
      __els.modeSelect.value = 'timed'; resetGame();
      tick(5);
      const notStarted = remainingTime === 60;
      gameStarted = true;
      tick(30);
      setPaused(true); tick(20); setPaused(false);
      const mid = Math.round(remainingTime);
      tick(31);
      return {notStarted, mid, over: gameOver, reason: gameOverReason};
    """)
    assert r["notStarted"] is True
    assert r["mid"] == 30
    assert r["over"] is True and r["reason"] == "時間到！"


def test_shots_mode_runs_out():
    """限球挑戰：25 顆用完還沒清空就結束。"""
    r, _ = run("""
      __els.modeSelect.value = 'shots'; resetGame();
      for (let i = 0; i < 25 && !gameOver; i++) {
        shotsRemaining = 1; // 直接跳到最後一顆
        shoot(width / 2, 10);
        tick(2);
        break;
      }
      return {over: gameOver, reason: gameOverReason, left: shotsRemaining};
    """)
    assert r["left"] == 0
    assert r["over"] is True


def test_campaign_clear_goes_next_level():
    """闖關模式：清空就過關，1.8 秒後自動進下一關。"""
    r, _ = run("""
      __els.modeSelect.value = 'campaign'; resetGame();
      setBoard([[0, 0]]);
      finishTurn(0, 2, 0);
      const won = hasWon && gameOver;
      tick(2);
      return {won, level: currentLevel, playing: !gameOver};
    """)
    assert r == {"won": True, "level": 2, "playing": True}


def test_no_audio_does_not_crash():
    """瀏覽器沒有音效功能（測試環境就是這樣）：發射、音樂按鈕都不會當掉。"""
    r, _ = run("""
      __fire('musicBtn', 'click'); __fire('musicBtn', 'click');
      shoot(width / 2, 10); tick(2);
      return {ok: true, music: musicEnabled};
    """)
    assert r == {"ok": True, "music": True}


def test_descent_only_drops_every_8_seconds():
    """下降挑戰：只有每 8 秒降一排，射泡泡不會額外降（原版每射一顆也會降一排）。"""
    r, _ = run("""
      __els.modeSelect.value = 'descent'; resetGame();
      setBoard(board.map((row, r) => row.map((c, k) => (r + k) % 3)));
      currentColor = 5;
      const top0 = JSON.stringify(board[0]);
      shoot(width / 2, 20);
      for (let t = 0; t < 30 && projectile; t++) tick(0.1);
      const sameTop = JSON.stringify(board[0]) === top0;      // 射完：最上面那排沒變＝沒有額外降
      tick(8.5);
      const movedDown = JSON.stringify(board[1]) === top0;    // 8 秒到：原本最上排被往下推一排
      return {sameTop, movedDown};
    """)
    assert r == {"sameTop": True, "movedDown": True}

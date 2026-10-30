// 發射台、泡泡飛行和瞄準線（同一套算法，預測落點＝實際落點）
function shooterPosition() {
  return { x: width / 2, y: height - radius * 1.4 };
}

function flightStep() {
  return radius * 0.5;
}

// 泡泡往前走一小步：撞到左右牆反彈；回傳有沒有反彈、有沒有碰到泡泡或天花板。
// 瞄準線和真正發射都用這一個，所以預測的落點跟實際落點一模一樣。
function stepFlight(state) {
  const step = flightStep();
  state.x += state.ux * step;
  state.y += state.uy * step;
  let bounced = false;
  if (state.x < radius) {
    state.x = radius;
    state.ux = Math.abs(state.ux);
    bounced = true;
  } else if (state.x > width - radius) {
    state.x = width - radius;
    state.ux = -Math.abs(state.ux);
    bounced = true;
  }
  return { bounced, hit: state.y <= radius || touchesBubble(state.x, state.y) };
}

// 算出泡泡會走的路線：撞到左右牆反彈，碰到泡泡或天花板就停
function aimPath(shooter, dx, dy) {
  const length = Math.hypot(dx, dy) || 1;
  const state = { x: shooter.x, y: shooter.y, ux: dx / length, uy: dy / length };
  const points = [{ x: state.x, y: state.y }];
  for (let i = 0; i < 4000; i += 1) {
    const result = stepFlight(state);
    if (result.bounced) points.push({ x: state.x, y: state.y });
    if (result.hit) break;
  }
  points.push({ x: state.x, y: state.y });
  return points;
}

function touchesBubble(x, y) {
  for (let row = 0; row < board.length; row += 1) {
    if (!board[row]) continue;
    for (let column = 0; column < columns; column += 1) {
      if (board[row][column] === undefined) continue;
      const center = bubbleCenter(row, column);
      if (Math.hypot(center.x - x, center.y - y) < radius * 1.9) return true;
    }
  }
  return false;
}

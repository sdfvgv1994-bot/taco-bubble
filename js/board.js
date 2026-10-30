// 蜂巢盤面規則：位置、鄰居、同色相連、懸空掉落、找空位
function isShiftedRow(row) {
  return (row + rowParity) % 2 === 1;
}

function bubbleCenter(row, column) {
  return {
    x: radius + column * radius * 2 + (isShiftedRow(row) ? radius : 0),
    y: radius + row * rowGap,
  };
}

function neighbors(row, column) {
  // 蜂巢排列：往右錯半格的那排，上下鄰居是 (欄, 欄+1)；沒錯開的那排是 (欄-1, 欄)。
  // 原版錯開的排往上找成 (欄-1, 欄)，會把沒碰在一起的泡泡當成相連。
  const [left, right] = isShiftedRow(row) ? [column, column + 1] : [column - 1, column];
  return [
    [row, column - 1],
    [row, column + 1],
    [row - 1, left],
    [row - 1, right],
    [row + 1, left],
    [row + 1, right],
  ];
}

function randomColor() {
  const colorCount = gameMode === 'campaign' || gameMode === 'falling'
    ? Math.min(colors.length, 3 + Math.floor((currentLevel - 1) / 10))
    : colors.length;
  return Math.floor(Math.random() * colorCount);
}

function findCluster(startRow, startColumn, colorIndex) {
  const cluster = [];
  const visited = new Set();
  const pending = [[startRow, startColumn]];

  while (pending.length) {
    const [row, column] = pending.pop();
    const key = `${row},${column}`;
    if (visited.has(key) || board[row]?.[column] !== colorIndex) continue;
    visited.add(key);
    cluster.push([row, column]);
    neighbors(row, column).forEach(([nextRow, nextColumn]) => {
      if (nextRow >= 0 && nextColumn >= 0 && nextColumn < columns) {
        pending.push([nextRow, nextColumn]);
      }
    });
  }
  return cluster;
}

function removeFloatingBubbles() {
  const connected = new Set();
  const pending = [];

  const firstOccupiedRow = gameMode === 'falling'
    ? board.findIndex((row) => row?.some((colorIndex) => colorIndex !== undefined))
    : 0;
  board[firstOccupiedRow]?.forEach((colorIndex, column) => {
    if (colorIndex !== undefined) pending.push([firstOccupiedRow, column]);
  });

  while (pending.length) {
    const [row, column] = pending.pop();
    const key = `${row},${column}`;
    if (connected.has(key) || board[row]?.[column] === undefined) continue;
    connected.add(key);
    neighbors(row, column).forEach(([nextRow, nextColumn]) => {
      if (nextRow >= 0 && nextColumn >= 0 && nextColumn < columns) {
        pending.push([nextRow, nextColumn]);
      }
    });
  }

  let removed = 0;
  board.forEach((row, rowIndex) => {
    row?.forEach((colorIndex, column) => {
      if (colorIndex !== undefined && !connected.has(`${rowIndex},${column}`)) {
        if (gameMode === 'falling') {
          const center = bubbleCenter(rowIndex, column);
          fallingBubbles.push({
            x: center.x,
            y: center.y,
            color: colorIndex,
            startedAt: performance.now(),
          });
        }
        row[column] = undefined;
        removed += 1;
      }
    });
  });
  return removed;
}

function findNearestEmpty(x, y) {
  let nearest = null;
  let nearestDistance = Infinity;
  const estimatedRow = Math.max(0, Math.round((y - radius) / rowGap));

  for (let row = Math.max(0, estimatedRow - 1); row <= estimatedRow + 1; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (board[row]?.[column] !== undefined) continue;
      const center = bubbleCenter(row, column);
      const distance = Math.hypot(center.x - x, center.y - y);
      if (distance < nearestDistance) {
        nearest = { row, column };
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}

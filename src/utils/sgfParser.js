// 坐标转换: 'aa' -> {x:0, y:0}
export function sgfToCoord(str) {
  if (!str || str.length < 2) return null;
  const col = str.charCodeAt(0) - 97;
  const row = str.charCodeAt(1) - 97;
  if (col < 0 || col > 18 || row < 0 || row > 18) return null;
  return { x: col, y: row };
}

// 解析器
export function parseSGF(sgfContent) {
  const result = {
    blackStones: [],
    whiteStones: [],
    moves: [],       
    boardSize: 19,
    initialPlayer: 'black',
    answer: null
  };

  if (!sgfContent) return result;

  // 1. 提取预设黑子
  const abMatches = sgfContent.match(/AB(?:\s*\[[a-z]{2}\])+/g);
  if (abMatches) {
    abMatches.forEach(tag => {
       const coords = tag.match(/\[([a-z]{2})\]/g);
       if (coords) coords.forEach(c => {
           const p = sgfToCoord(c.slice(1, 3));
           if(p) result.blackStones.push(p);
       });
    });
  }

  // 2. 提取预设白子
  const awMatches = sgfContent.match(/AW(?:\s*\[[a-z]{2}\])+/g);
  if (awMatches) {
    awMatches.forEach(tag => {
       const coords = tag.match(/\[([a-z]{2})\]/g);
       if (coords) coords.forEach(c => {
           const p = sgfToCoord(c.slice(1, 3));
           if(p) result.whiteStones.push(p);
       });
    });
  }
  
  // 3. 判断谁先走
  const plMatch = sgfContent.match(/PL\[([BW])\]/);
  if (plMatch) {
    result.initialPlayer = plMatch[1] === 'W' ? 'white' : 'black';
  }

  // 4. 【修复】提取招法序列
  // 旧正则: /;([BW])\s*\[([a-z]{2})\]/g
  // 新正则: /;\s*([BW])\s*\[([a-z]{2})\]/g  <-- 增加了 \s* 允许分号后有空格/换行
  const moveRegex = /;\s*([BW])\s*\[([a-z]{2})\]/g;
  
  let match;
  while ((match = moveRegex.exec(sgfContent)) !== null) {
    const colorCode = match[1]; // 'B' or 'W'
    const coordStr = match[2];  // 'aa'
    
    const coord = sgfToCoord(coordStr);
    if (coord) {
      result.moves.push({
        x: coord.x, 
        y: coord.y,
        color: colorCode === 'W' ? 'white' : 'black'
      });
    }
  }

  // 修正初始先手逻辑
  if (!plMatch && result.moves.length > 0) {
    result.initialPlayer = result.moves[0].color;
  }
  
  // 5. 设置 answer (第一手即为正解)
  if (result.moves.length > 0) {
    result.answer = result.moves[0];
  }

  return result;
}
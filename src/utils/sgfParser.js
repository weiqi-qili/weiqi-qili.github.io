// 坐标转换: 'aa' -> {x:0, y:0}
export function sgfToCoord(str) {
  if (!str || str.length < 2) return null;
  // 兼容 SGF 标准: a=0 ... s=18 (忽略 i, 但通常 SGF 不跳过 i，如果不跳过则是标准的 ascii 转换)
  // 标准 SGF 是 'a'=97
  const col = str.charCodeAt(0) - 97;
  const row = str.charCodeAt(1) - 97;
  return { x: col, y: row };
}

// 解析器
export function parseSGF(sgfContent) {
  const result = {
    blackStones: [],
    whiteStones: [],
    answer: null, // 正确的一手
    boardSize: 19
  };

  if (!sgfContent) return result;

  // 1. 提取黑子 AB[aa][bb]
  const abMatch = sgfContent.match(/AB(\[[a-z]{2}\])+/g);
  if (abMatch) {
    abMatch.forEach(group => {
       const coords = group.match(/\[([a-z]{2})\]/g);
       coords && coords.forEach(c => result.blackStones.push(sgfToCoord(c.slice(1,3))));
    });
  }

  // 2. 提取白子 AW[..]
  const awMatch = sgfContent.match(/AW(\[[a-z]{2}\])+/g);
  if (awMatch) {
    awMatch.forEach(group => {
       const coords = group.match(/\[([a-z]{2})\]/g);
       coords && coords.forEach(c => result.whiteStones.push(sgfToCoord(c.slice(1,3))));
    });
  }
  
  // 3. 提取答案 (这里假设 SGF 里紧接着的一手就是正解)
  // 匹配 ;B[xx] 或 ;W[xx]
  const moveMatch = sgfContent.match(/;[BW]\[([a-z]{2})\]/); 
  if (moveMatch) {
      result.answer = sgfToCoord(moveMatch[1]);
  }

  return result;
}
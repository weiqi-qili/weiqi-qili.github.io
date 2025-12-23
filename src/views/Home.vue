<template>
  <div class="app-container">
    <div class="header">
      <div class="logo" @click="handleLogoClick">
        Qili Weiqi ({{ currentIndex + 1 }}/{{ sessionProblems.length }})
      </div>
      <div class="header-actions">
        <span v-if="loading" class="loading-text">加载中...</span>
        <button class="refresh-btn" @click="forceNewSession" title="放弃进度，生成新题">🔄</button>
      </div>
    </div>

    <div class="board-wrapper" ref="boardWrapper">
      <!-- ⚠️ 注意：这里去掉了 :width 和 :height，改在 JS 里控制高清分辨率 -->
      <canvas 
        ref="boardCanvas" 
        @click="handleBoardClick"
      ></canvas>
    </div>

    <div class="controls-wrapper">
      <div class="msg-box" :class="{ error: isError, success: isSuccess }">
        {{ message }}
      </div>

      <button class="select-theory-btn" @click="showTheoryModal = true" :disabled="isSuccess">
        <span class="label">选择棋理</span>
        <span class="value" :class="{ empty: !currentCategoryName }">
          {{ currentCategoryName || '点击选择' }}
        </span>
      </button>

      <div class="action-bar">
        <button class="nav-btn secondary" @click="prevProblem" :disabled="currentIndex <= 0">上一题</button>

        <button 
          v-if="showHint && !isSuccess" 
          class="retry-btn" 
          @click="retryProblem"
        >
          重试
        </button>

        <button class="nav-btn primary" @click="nextProblem">
          {{ isLastProblem ? '新一组' : '下一题' }}
        </button>
      </div>
    </div>

    <TheorySelector 
      v-if="showTheoryModal" 
      :categories="allCategories" 
      :selectedId="selectedCategory" 
      @select="handleCategorySelect" 
      @close="showTheoryModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { parseSGF } from '../utils/sgfParser'
import TheorySelector from '../components/TheorySelector.vue'

const router = useRouter()

// 状态
const allCategories = ref([])
const sessionProblems = ref([])
const currentIndex = ref(0)
const loading = ref(false)

const showTheoryModal = ref(false)
const selectedCategory = ref(null)
const message = ref('准备中...')
const isSuccess = ref(false)
const isError = ref(false)
const showHint = ref(false)

const currentSgfData = ref(null)
const playedMoves = ref([])       
const stepIndex = ref(0)          

// 逻辑尺寸 (CSS像素)，实际绘制时会乘以 dpr
const boardSize = ref(350)
const boardCanvas = ref(null)
let logoClickCount = 0

const currentProblem = computed(() => sessionProblems.value[currentIndex.value])
const isLastProblem = computed(() => currentIndex.value >= sessionProblems.value.length - 1)
const currentCategoryName = computed(() => {
  const c = allCategories.value.find(i => i.id === selectedCategory.value)
  return c ? c.name : ''
})

onMounted(async () => {
  await loadCategories()
  await resumeProgressOrGenerate()
  window.addEventListener('resize', handleResize)
  handleResize()
})
onUnmounted(() => window.removeEventListener('resize', handleResize))

const loadCategories = async () => {
  const { data } = await supabase.from('categories').select('*')
  if (data) allCategories.value = data
}

const resumeProgressOrGenerate = async () => {
  loading.value = true
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: lastProgress } = await supabase.from('user_progress')
      .select('problem_id, problems(*)')
      .order('updated_at', { ascending: false }).limit(10)
    if (lastProgress && lastProgress.length > 0) {
      sessionProblems.value = lastProgress.map(p => ({ ...p.problems })).reverse()
      currentIndex.value = sessionProblems.value.length - 1
      loadCurrentSgf()
      loading.value = false
      return
    }
  }
  await generateNewProblems()
}

const generateNewProblems = async () => {
  loading.value = true
  message.value = '正在生成新题目...'
  const { data } = await supabase.from('problems').select('*').limit(50)
  if (data && data.length > 0) {
    sessionProblems.value = data.sort(() => 0.5 - Math.random()).slice(0, 10)
    currentIndex.value = 0
    loadCurrentSgf()
  } else {
    message.value = '暂无题目'
    sessionProblems.value = []
    drawBoard()
  }
  loading.value = false
}

const loadCurrentSgf = () => {
  if (!currentProblem.value) return
  currentSgfData.value = parseSGF(currentProblem.value.sgf_content)
  
  playedMoves.value = [] 
  stepIndex.value = 0    
  selectedCategory.value = null
  isSuccess.value = false
  isError.value = false
  showHint.value = false
  
  updateMessage()
  nextTick(drawBoard)
}

const updateMessage = () => {
  if (isSuccess.value) {
    message.value = '🎉 回答正确！'
    return
  }
  
  let nextColor = 'black'
  if (currentSgfData.value && currentSgfData.value.moves.length > stepIndex.value) {
    nextColor = currentSgfData.value.moves[stepIndex.value].color
  } else {
    nextColor = currentSgfData.value?.initialPlayer || 'black'
  }
  
  const turnText = nextColor === 'white' ? '⚪️ 白先' : '⚫️ 黑先'
  if (stepIndex.value === 0 && currentProblem.value.description) {
    message.value = currentProblem.value.description
  } else {
    message.value = `${turnText}，请落子`
  }
}

const forceNewSession = async () => {
  if (confirm('放弃当前进度重新生成？')) await generateNewProblems()
}
const prevProblem = () => { if(currentIndex.value > 0) { currentIndex.value--; loadCurrentSgf() } }
const nextProblem = async () => {
  if (isLastProblem.value) { if(confirm('生成新题？')) await generateNewProblems() }
  else { currentIndex.value++; loadCurrentSgf() }
}

const handleBoardClick = async (e) => {
  if (isSuccess.value || showHint.value) return 

  if (stepIndex.value === 0 && !selectedCategory.value) {
    message.value = '⚠️ 请先选择棋理类别！'
    isError.value = true
    setTimeout(() => { if(isError.value) updateMessage(); isError.value=false }, 1500)
    return
  }

  // 使用 getBoundingClientRect 获取的坐标是 CSS 像素
  const rect = boardCanvas.value.getBoundingClientRect()
  const gap = boardSize.value / 20
  
  // 这里的逻辑不需要变，因为 boardSize 还是 CSS 逻辑尺寸
  const col = Math.round((e.clientX - rect.left - gap) / gap)
  const row = Math.round((e.clientY - rect.top - gap) / gap)
  
  if (col < 0 || col >= 19 || row < 0 || row >= 19) return

  const clickMove = { x: col, y: row }
  await attemptMove(clickMove)
}

const attemptMove = async (userMoveCoords) => {
  const moves = currentSgfData.value.moves
  if (stepIndex.value >= moves.length) return

  const correctMove = moves[stepIndex.value]
  const moveOk = userMoveCoords.x === correctMove.x && userMoveCoords.y === correctMove.y
  const catOk = (stepIndex.value > 0) || (selectedCategory.value === currentProblem.value.correct_category_id)

  if (moveOk && catOk) {
    isError.value = false
    showHint.value = false
    
    playedMoves.value.push({ ...userMoveCoords, color: correctMove.color })
    stepIndex.value++ 
    drawBoard() 

    if (stepIndex.value < moves.length) {
      setTimeout(() => {
        const opponentMove = moves[stepIndex.value]
        playedMoves.value.push(opponentMove)
        stepIndex.value++
        drawBoard()
        if (stepIndex.value >= moves.length) handleSuccess()
        else updateMessage()
      }, 500)
    } else {
      handleSuccess()
    }
  } else {
    isError.value = true
    if (!moveOk) {
      message.value = '❌ 落子位置不对'
      showHint.value = true 
    } else {
      message.value = '❌ 落子正确，但棋理选错了'
    }
    await saveProgress(false)
    drawBoard()
  }
}

const handleSuccess = async () => {
  isSuccess.value = true
  message.value = '🎉 回答正确！'
  await saveProgress(true)
}

const saveProgress = async (ok) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const pid = currentProblem.value.id
  const { data: exist } = await supabase.from('user_progress').select('id, error_count').eq('problem_id', pid).eq('user_id', user.id).single()
  if (exist) {
    await supabase.from('user_progress').update({ is_correct: ok, error_count: ok ? exist.error_count : exist.error_count + 1, updated_at: new Date() }).eq('id', exist.id)
  } else {
    await supabase.from('user_progress').insert({ user_id: user.id, problem_id: pid, is_correct: ok, error_count: ok ? 0 : 1 })
  }
}

const retryProblem = () => {
  showHint.value = false; isError.value = false; 
  playedMoves.value = []
  stepIndex.value = 0
  updateMessage()
  drawBoard()
}

const handleCategorySelect = (item) => { 
  if (!isSuccess.value) selectedCategory.value = item.id 
  if (isError.value && message.value.includes('棋理')) {
    isError.value = false
    updateMessage()
  }
}
const handleLogoClick = () => { if (++logoClickCount >= 5) { router.push('/admin'); logoClickCount = 0 } }
const handleResize = () => { 
  boardSize.value = Math.max(300, Math.min(window.innerWidth - 20, window.innerHeight - 240, 600))
  nextTick(drawBoard) 
}

// ----------------------------------------------------
// 💎 高清 Canvas 绘图核心逻辑
// ----------------------------------------------------
const drawBoard = () => {
  const canvas = boardCanvas.value
  const ctx = canvas?.getContext('2d')
  if (!ctx) return

  // 1. 获取设备像素比 (Retina屏通常是 2 或 3)
  const dpr = window.devicePixelRatio || 1
  
  // 2. 逻辑尺寸 (CSS尺寸)
  const logicalSize = boardSize.value
  
  // 3. 设置 Canvas 内部实际分辨率 (物理像素)
  canvas.width = logicalSize * dpr
  canvas.height = logicalSize * dpr
  
  // 4. 设置 CSS 显示尺寸 (逻辑像素)
  canvas.style.width = logicalSize + 'px'
  canvas.style.height = logicalSize + 'px'
  
  // 5. 缩放绘图上下文，让我们后续的绘图代码继续使用逻辑坐标
  ctx.scale(dpr, dpr)

  // --- 以下绘图代码使用 logicalSize (例如 350)，无需手动乘 dpr ---

  const size = logicalSize
  const gap = size / 20
  const r = gap * 0.48 

  // 背景
  ctx.fillStyle = '#E3C082'
  ctx.fillRect(0, 0, size, size)

  // 网格线
  ctx.beginPath()
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1
  for (let i = 0; i < 19; i++) {
    // 0.5偏移量在高清屏上可能需要微调，但通常保持原样即可
    const pos = Math.floor(gap + i * gap) + 0.5 
    ctx.moveTo(gap, pos); ctx.lineTo(size - gap, pos)
    ctx.moveTo(pos, gap); ctx.lineTo(pos, size - gap)
  }
  ctx.stroke()

  // 星位
  ;[3, 9, 15].forEach(x => { [3, 9, 15].forEach(y => { 
    ctx.beginPath()
    ctx.arc(gap + x * gap, gap + y * gap, 3.5, 0, 6.28)
    ctx.fillStyle = '#111'
    ctx.fill() 
  }) })

  if (!currentSgfData.value) return

  const draw3DStone = (x, y, color) => {
    const cx = gap + x * gap
    const cy = gap + y * gap
    
    // 投影
    ctx.beginPath()
    ctx.arc(cx + 1, cy + 1, r, 0, 6.28) // 阴影偏移量改小一点，更精致
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fill()

    // 本体
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, 6.28)
    const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.1, cx, cy, r)
    if (color === 'black') {
      grad.addColorStop(0, '#666') // 稍微亮一点的高光
      grad.addColorStop(0.3, '#222')
      grad.addColorStop(1, '#000')
    } else {
      grad.addColorStop(0, '#fff')
      grad.addColorStop(0.8, '#e0e0e0')
      grad.addColorStop(1, '#aaa')
    }
    ctx.fillStyle = grad
    ctx.fill()
    
    if (color === 'white') {
      ctx.strokeStyle = 'rgba(0,0,0,0.1)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
  }

  currentSgfData.value.blackStones.forEach(p => draw3DStone(p.x, p.y, 'black'))
  currentSgfData.value.whiteStones.forEach(p => draw3DStone(p.x, p.y, 'white'))

  playedMoves.value.forEach((move, index) => {
    draw3DStone(move.x, move.y, move.color)
    if (index === playedMoves.value.length - 1) {
      const cx = gap + move.x * gap
      const cy = gap + move.y * gap
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, 6.28) 
      ctx.fillStyle = '#ff1744' 
      ctx.fill()
    }
  })

  if (showHint.value && currentSgfData.value.moves.length > stepIndex.value) {
    const a = currentSgfData.value.moves[stepIndex.value]
    const cx = gap + a.x * gap
    const cy = gap + a.y * gap
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.6, 0, 6.28)
    ctx.strokeStyle = '#00e676'
    ctx.lineWidth = 4
    ctx.stroke()
  }
}
</script>

<style scoped>
.app-container { display: flex; flex-direction: column; height: 100vh; width: 100%; max-width: 600px; margin: 0 auto; background: #1a1a1a; position: relative; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
.header { flex: 0 0 50px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; background: #222; border-bottom: 1px solid #333; z-index: 10; }
.logo { font-weight: bold; color: #4caf50; cursor: pointer; user-select: none; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.loading-text { font-size: 12px; color: #888; }
.refresh-btn { background: transparent; border: 1px solid #444; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: all 0.2s; }
.refresh-btn:active { background: #333; transform: rotate(180deg); }
.board-wrapper { flex: 1; display: flex; justify-content: center; align-items: center; width: 100%; padding: 10px; overflow: hidden; }
canvas { background: #E3C082; border-radius: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: block; }
.controls-wrapper { flex: 0 0 auto; width: 100%; padding: 0 20px 30px 20px; display: flex; flex-direction: column; gap: 15px; background: #1a1a1a; z-index: 10; }
.msg-box { text-align: center; height: 24px; line-height: 24px; font-size: 15px; color: #aaa; }
.msg-box.error { color: #f44336; font-weight: bold; }
.msg-box.success { color: #4caf50; font-weight: bold; }
.select-theory-btn { background: #333; border: 1px solid #444; border-radius: 10px; padding: 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; }
.select-theory-btn:active { background: #444; }
.select-theory-btn:disabled { opacity: 0.6; cursor: default; }
.select-theory-btn .label { color: #888; font-size: 14px; }
.select-theory-btn .value { color: #4caf50; font-size: 16px; font-weight: bold; }
.select-theory-btn .value.empty { color: #666; font-weight: normal; }
.action-bar { display: flex; gap: 12px; }
.nav-btn, .retry-btn { flex: 1; padding: 14px 0; border-radius: 10px; border: none; font-size: 16px; font-weight: bold; color: white; cursor: pointer; display: flex; justify-content: center; align-items: center; }
.nav-btn.secondary { background: #444; color: #ccc; }
.nav-btn.primary { background: #4caf50; }
.retry-btn { background: #f44336; }
:global(body) { background-color: #000; margin: 0; }
</style>
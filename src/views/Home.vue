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
      <canvas 
        ref="boardCanvas" 
        :width="boardSize" 
        :height="boardSize" 
        @click="handleBoardClick"
      ></canvas>
    </div>

    <div class="controls-wrapper">
      <div class="msg-box" :class="{ error: isError, success: isSuccess }">
        {{ message }}
      </div>

      <button 
        class="select-theory-btn" 
        @click="showTheoryModal = true" 
        :disabled="isSuccess"
        ref="selectBtnRef"
      >
        <span class="label">选择棋理</span>
        <span class="value" :class="{ empty: !currentCategoryName }">
          {{ currentCategoryName || '点击选择' }}
        </span>
      </button>

      <!-- 【重大修改】移除了确认按钮，简化了按钮组 -->
      <div class="action-bar">
        <button class="nav-btn secondary" @click="prevProblem" :disabled="currentIndex <= 0">上一题</button>
        
        <button 
          v-if="showHint && !isSuccess" 
          class="retry-btn" 
          @click="retryProblem"
        >
          重试本题
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
const playedMoves = ref([]) // 已经走过的招法（实地）
const stepIndex = ref(0)    // 当前进行到 SGF 序列的第几步

const boardSize = ref(350)
const boardCanvas = ref(null)
const selectBtnRef = ref(null) // 用于给按钮加闪烁效果
let logoClickCount = 0

// 计算属性
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

const loadCategories = async () => { /* ...代码未变... */ 
  const { data } = await supabase.from('categories').select('*');
  if (data) allCategories.value = data;
}

const resumeProgressOrGenerate = async () => { /* ...代码未变... */ 
  loading.value = true;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: lastProgress } = await supabase.from('user_progress').select('problem_id, problems(*)').order('updated_at', { ascending: false }).limit(10);
    if (lastProgress && lastProgress.length > 0) {
      sessionProblems.value = lastProgress.map(p => ({ ...p.problems })).reverse();
      currentIndex.value = sessionProblems.value.length - 1;
      loadCurrentSgf();
      loading.value = false;
      return;
    }
  }
  await generateNewProblems();
}

const generateNewProblems = async () => { /* ...代码未变... */ 
  loading.value = true;
  message.value = '正在生成新题目...';
  const { data } = await supabase.from('problems').select('*').limit(50);
  if (data && data.length > 0) {
    sessionProblems.value = data.sort(() => 0.5 - Math.random()).slice(0, 10);
    currentIndex.value = 0;
    loadCurrentSgf();
  } else {
    message.value = '暂无题目';
    sessionProblems.value = [];
    drawBoard();
  }
  loading.value = false;
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

const updateMessage = () => { /* ...代码未变... */ 
  if (isSuccess.value) { message.value = '🎉 回答正确！'; return; }
  let nextColor = currentSgfData.value?.initialPlayer || 'black';
  if (currentSgfData.value && currentSgfData.value.moves.length > stepIndex.value) {
    nextColor = currentSgfData.value.moves[stepIndex.value].color;
  }
  const turnText = nextColor === 'white' ? '⚪️ 白先' : '⚫️ 黑先';
  if (stepIndex.value === 0 && currentProblem.value.description) {
    message.value = currentProblem.value.description;
  } else {
    message.value = `${turnText}，请落子`;
  }
}

// 【核心交互升级】
const handleBoardClick = async (e) => {
  if (isSuccess.value || showHint.value) return
  
  // 第一步必须先选棋理
  if (stepIndex.value === 0 && !selectedCategory.value) {
    message.value = '⚠️ 请先选择棋理'
    isError.value = true // 让文字变红
    if (selectBtnRef.value) {
      selectBtnRef.value.classList.add('flash')
      setTimeout(() => {
        selectBtnRef.value?.classList.remove('flash')
        isError.value = false // 恢复
      }, 500)
    }
    return
  }

  const rect = boardCanvas.value.getBoundingClientRect()
  const gap = boardSize.value / 20
  const col = Math.round((e.clientX - rect.left - gap) / gap)
  const row = Math.round((e.clientY - rect.top - gap) / gap)
  
  if (col < 0 || col > 18 || row < 0 || row > 18) return

  const userClick = { x: col, y: row }
  const moves = currentSgfData.value.moves
  const correctMove = moves[stepIndex.value]

  // 检查坐标
  const moveOk = userClick.x === correctMove.x && userClick.y === correctMove.y
  // 检查棋理 (只检查第一步)
  const catOk = (stepIndex.value > 0) || (selectedCategory.value === currentProblem.value.correct_category_id)

  if (moveOk && catOk) {
    isError.value = false
    playedMoves.value.push({ ...userClick, color: correctMove.color })
    stepIndex.value++

    if (stepIndex.value < moves.length) {
      setTimeout(() => {
        const opponentMove = moves[stepIndex.value]
        playedMoves.value.push(opponentMove)
        stepIndex.value++
        
        if (stepIndex.value >= moves.length) {
          handleSuccess()
        } else {
          updateMessage()
          drawBoard()
        }
      }, 500) // 电脑应答延迟
    } else {
      handleSuccess()
    }
  } else {
    isError.value = true
    message.value = !moveOk ? '❌ 落子位置不对' : '❌ 棋理选错了'
    if (!moveOk) showHint.value = true
    await saveProgress(false)
  }
  drawBoard()
}

const handleSuccess = async () => { /* ...代码未变... */ 
  isSuccess.value = true;
  message.value = '🎉 回答正确！';
  await saveProgress(true);
  drawBoard();
}

const saveProgress = async (ok) => { /* ...代码未变... */
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const pid = currentProblem.value.id;
  const { data: exist } = await supabase.from('user_progress').select('id, error_count').eq('problem_id', pid).eq('user_id', user.id).single();
  if (exist) {
    await supabase.from('user_progress').update({ is_correct: ok, error_count: ok ? exist.error_count : exist.error_count + 1, updated_at: new Date() }).eq('id', exist.id);
  } else {
    await supabase.from('user_progress').insert({ user_id: user.id, problem_id: pid, is_correct: ok, error_count: ok ? 0 : 1 });
  }
}

const retryProblem = () => { /* ...代码未变... */ 
  showHint.value = false; isError.value = false;
  playedMoves.value = [];
  stepIndex.value = 0;
  updateMessage();
  drawBoard();
}

const handleCategorySelect = (item) => { 
  if (!isSuccess.value) {
    selectedCategory.value = item.id
    isError.value = false // 选了之后清除错误提示
    updateMessage()
  }
}

// --- 其他辅助函数 ---
const forceNewSession = async () => { if (confirm('放弃当前进度重新生成？')) await generateNewProblems() }
const prevProblem = () => { if(currentIndex.value > 0) { currentIndex.value--; loadCurrentSgf() } }
const nextProblem = async () => {
  if (isLastProblem.value) { if(confirm('生成新题？')) await generateNewProblems() }
  else { currentIndex.value++; loadCurrentSgf() }
}
const handleLogoClick = () => { if (++logoClickCount >= 5) { router.push('/admin'); logoClickCount = 0 } }
const handleResize = () => { 
  boardSize.value = Math.max(300, Math.min(window.innerWidth - 20, window.innerHeight - 240, 600))
  nextTick(drawBoard) 
}

// --- 绘图逻辑 ---
const drawBoard = () => {
  const ctx = boardCanvas.value?.getContext('2d')
  if (!ctx) return
  const size = boardSize.value, gap = size/20, r=gap*0.45

  ctx.fillStyle = '#DCB35C'; ctx.fillRect(0, 0, size, size)
  ctx.beginPath(); ctx.strokeStyle = '#000'
  for (let i = 0; i < 19; i++) {
    ctx.moveTo(gap, gap + i * gap); ctx.lineTo(size - gap, gap + i * gap)
    ctx.moveTo(gap + i * gap, gap); ctx.lineTo(gap + i * gap, size - gap)
  }
  ctx.stroke()
  ;[3, 9, 15].forEach(x => { [3, 9, 15].forEach(y => { ctx.beginPath(); ctx.arc(gap + x * gap, gap + y * gap, 3, 0, 6.28); ctx.fillStyle = '#000'; ctx.fill() }) })

  if (!currentSgfData.value) return

  const drawStone = (p, c) => {
    ctx.beginPath(); ctx.arc(gap + p.x * gap, gap + p.y * gap, r, 0, 6.28)
    ctx.fillStyle = c; ctx.fill()
    if (c === '#fff') { ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke() }
  }

  currentSgfData.value.blackStones.forEach(p => drawStone(p, '#000'))
  currentSgfData.value.whiteStones.forEach(p => drawStone(p, '#fff'))

  // 画已经走过的序列 (实地)
  playedMoves.value.forEach((move, index) => {
    const colorCode = move.color === 'white' ? '#fff' : '#000'
    drawStone(move, colorCode)
    
    // 给最后一手加红色标记
    if (index === playedMoves.value.length - 1) {
      ctx.fillStyle = 'red'
      ctx.fillRect(gap + move.x * gap - 3, gap + move.y * gap - 3, 6, 6)
    }
  })

  // 画提示 (Hint)
  if (showHint.value && currentSgfData.value.moves.length > stepIndex.value) {
    const a = currentSgfData.value.moves[stepIndex.value]
    ctx.beginPath(); ctx.arc(gap + a.x * gap, gap + a.y * gap, r * 0.8, 0, 6.28)
    ctx.strokeStyle = '#00e676'; ctx.lineWidth = 4; ctx.stroke()
  }
}
</script>

<style scoped>
/* 容器和布局 */
.app-container { display: flex; flex-direction: column; height: 100vh; width: 100%; max-width: 600px; margin: 0 auto; background: #1a1a1a; position: relative; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
.header { flex: 0 0 50px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; background: #222; border-bottom: 1px solid #333; z-index: 10; }
.logo { font-weight: bold; color: #4caf50; cursor: pointer; user-select: none; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.loading-text { font-size: 12px; color: #888; }
.refresh-btn { background: transparent; border: 1px solid #444; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: all 0.2s; }
.refresh-btn:active { background: #333; transform: rotate(180deg); }
.board-wrapper { flex: 1; display: flex; justify-content: center; align-items: center; width: 100%; padding: 10px; overflow: hidden; }
canvas { background: #DCB35C; border-radius: 4px; box-shadow: 0 5px 20px rgba(0,0,0,0.6); display: block; }
.controls-wrapper { flex: 0 0 auto; width: 100%; padding: 0 20px 30px 20px; display: flex; flex-direction: column; gap: 15px; background: #1a1a1a; z-index: 10; }

/* 按钮和提示 */
.msg-box { text-align: center; height: 24px; line-height: 24px; font-size: 15px; color: #aaa; }
.msg-box.error { color: #f44336; font-weight: bold; }
.msg-box.success { color: #4caf50; font-weight: bold; }
.select-theory-btn { background: #333; border: 1px solid #444; border-radius: 10px; padding: 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s, transform 0.1s; }
.select-theory-btn:active { background: #444; }
.select-theory-btn:disabled { opacity: 0.6; cursor: default; }
.select-theory-btn .label { color: #888; font-size: 14px; }
.select-theory-btn .value { color: #4caf50; font-size: 16px; font-weight: bold; }
.select-theory-btn .value.empty { color: #666; font-weight: normal; }
/* 闪烁效果 */
.select-theory-btn.flash { animation: flash-red 0.5s; }
@keyframes flash-red {
  0%, 100% { transform: scale(1); border-color: #444; }
  50% { transform: scale(1.02); border-color: #f44336; }
}

.action-bar { display: flex; gap: 12px; }
.nav-btn, .retry-btn { flex: 1; padding: 14px 0; border-radius: 10px; border: none; font-size: 16px; font-weight: bold; color: white; cursor: pointer; }
.nav-btn.secondary { background: #444; color: #ccc; }
.nav-btn.primary { background: #4caf50; }
.retry-btn { background: #f44336; }
:global(body) { background-color: #000; margin: 0; }
</style>
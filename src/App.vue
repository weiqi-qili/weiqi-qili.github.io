<template>
  <div class="app-container">
    <!-- 顶部 -->
    <div class="header">
      <div class="logo">Qili Weiqi</div>
      <div class="stats">错题: {{ errorCount }}</div>
    </div>

    <!-- 棋盘区 -->
    <div class="board-wrapper">
      <canvas ref="boardCanvas" width="350" height="350" @click="handleBoardClick"></canvas>
    </div>

    <!-- 底部控制区 -->
    <div class="controls-wrapper">
      
      <!-- 提示信息 -->
      <div class="msg-box" :class="{ error: isError, success: isSuccess }">
        {{ message || '请选择棋理并落子' }}
      </div>

      <!-- 棋理选择按钮 -->
      <button class="select-theory-btn" @click="showTheoryModal = true">
        <span class="label">当前棋理判定</span>
        <span class="value" :class="{ empty: !currentCategoryName }">
          {{ currentCategoryName || '点击选择' }}
        </span>
      </button>

      <!-- 提交按钮 -->
      <button class="confirm-btn" @click="checkAnswer" :disabled="!canSubmit">
        确认答案
      </button>
      
      <button v-if="isSuccess" class="next-btn" @click="nextProblem">下一题</button>
    </div>

    <!-- 弹窗 -->
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
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from './supabase'
import { parseSGF } from './utils/sgfParser'
import TheorySelector from './components/TheorySelector.vue'

// --- 状态变量 ---
const allCategories = ref([])
const showTheoryModal = ref(false)
const selectedCategory = ref(null)
const errorCount = ref(0)
const message = ref('')
const isError = ref(false)
const isSuccess = ref(false)

// 棋盘相关
const boardCanvas = ref(null)
const currentSgfData = ref(null)
const userMove = ref(null) // 用户落子的坐标 {x, y}

// --- 计算属性 ---
const currentCategoryName = computed(() => {
  const c = allCategories.value.find(i => i.id === selectedCategory.value)
  return c ? c.name : ''
})

const canSubmit = computed(() => {
  return selectedCategory.value && userMove.value && !isSuccess.value
})

// --- 核心逻辑 ---

// 1. 初始化
onMounted(async () => {
  await loadCategories()
  loadTestProblem() // 先加载测试题，确保有东西显示
})

// 2. 加载分类
const loadCategories = async () => {
  const { data, error } = await supabase.from('categories').select('*')
  if (data) allCategories.value = data
  else console.error('分类加载失败:', error)
}

// 3. 加载题目 (目前是硬编码的测试题，后续从 DB 拿)
const loadTestProblem = () => {
  // 一个简单的"攻击方向"题目 SGF
  const testSgf = "(;SZ[19]AB[dd][dp][pd][pp][jj]AW[cn][fq][qn][qf]PL[B];B[fp])" 
  // 解析
  currentSgfData.value = parseSGF(testSgf)
  // 重置状态
  userMove.value = null
  selectedCategory.value = null
  isSuccess.value = false
  isError.value = false
  message.value = '黑先，请选择棋理并落子'
  drawBoard()
}

// 4. 绘制棋盘 (Canvas)
const drawBoard = () => {
  const canvas = boardCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const size = 350
  const gap = size / 20 // 19路留边
  const r = gap * 0.45 // 棋子半径

  // 清空
  ctx.fillStyle = '#DCB35C' // 木纹色
  ctx.fillRect(0, 0, size, size)

  // 画线
  ctx.beginPath()
  ctx.strokeStyle = '#000'
  for (let i = 0; i < 19; i++) {
    // 横线
    ctx.moveTo(gap, gap + i * gap)
    ctx.lineTo(size - gap, gap + i * gap)
    // 竖线
    ctx.moveTo(gap + i * gap, gap)
    ctx.lineTo(gap + i * gap, size - gap)
  }
  ctx.stroke()
  
  // 画星位
  const stars = [3, 9, 15]
  ctx.fillStyle = '#000'
  stars.forEach(x => {
    stars.forEach(y => {
      ctx.beginPath()
      ctx.arc(gap + x * gap, gap + y * gap, 3, 0, 2 * Math.PI)
      ctx.fill()
    })
  })

  if (!currentSgfData.value) return

  // 画黑子
  ctx.fillStyle = '#000'
  currentSgfData.value.blackStones.forEach(p => {
    ctx.beginPath()
    ctx.arc(gap + p.x * gap, gap + p.y * gap, r, 0, 2 * Math.PI)
    ctx.fill()
  })

  // 画白子
  ctx.fillStyle = '#fff'
  currentSgfData.value.whiteStones.forEach(p => {
    ctx.beginPath()
    ctx.arc(gap + p.x * gap, gap + p.y * gap, r, 0, 2 * Math.PI)
    ctx.fill()
    // 白子加个圈不然看不清
    ctx.strokeStyle = '#000'
    ctx.stroke()
  })

  // 画用户刚才落的子 (半透明提示)
  if (userMove.value) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)' // 假设黑棋先走
    ctx.beginPath()
    ctx.arc(gap + userMove.value.x * gap, gap + userMove.value.y * gap, r, 0, 2 * Math.PI)
    ctx.fill()
    
    // 标记一下这是最后一手
    ctx.fillStyle = 'red'
    ctx.fillRect(gap + userMove.value.x * gap - 2, gap + userMove.value.y * gap - 2, 4, 4)
  }
}

// 5. 点击交互
const handleBoardClick = (e) => {
  if (isSuccess.value) return 
  const rect = boardCanvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  const size = 350
  const gap = size / 20
  
  // 简单的坐标吸附
  const col = Math.round((x - gap) / gap)
  const row = Math.round((y - gap) / gap)

  if (col >= 0 && col < 19 && row >= 0 && row < 19) {
    userMove.value = { x: col, y: row }
    drawBoard() // 重绘以显示落子
  }
}

// 6. 选择分类
const handleCategorySelect = (item) => {
  selectedCategory.value = item.id
}

// 7. 判题
const checkAnswer = () => {
  const correctAnswer = currentSgfData.value.answer
  // 这里暂时硬编码正确分类是 "攻击方向" (ID需要你去数据库看，假设是刚才脚本生成的id)
  // 为了测试，我们先假设只要选了中盘下的任意一个就算对棋理
  
  // 判棋
  const isMoveCorrect = (userMove.value.x === correctAnswer.x && userMove.value.y === correctAnswer.y)
  
  // 判理 (实际要对比 problem.correct_category_id)
  // 这里只是模拟：只要选了就有分
  const isTheoryCorrect = selectedCategory.value !== null 

  if (isMoveCorrect && isTheoryCorrect) {
    message.value = '🎉 回答正确！'
    isSuccess.value = true
    isError.value = false
    // 播放音效...
  } else {
    message.value = isMoveCorrect ? '❌ 棋理选错了！' : '❌ 落子位置不对！'
    isError.value = true
    errorCount.value++
  }
}

const nextProblem = () => {
  loadTestProblem() // 重新加载模拟下一题
}

// 监听状态变化重绘
watch(userMove, drawBoard)
</script>

<style>
/* 全局重置 */
body { margin: 0; background: #1a1a1a; color: #fff; font-family: sans-serif; }
.app-container { display: flex; flex-direction: column; height: 100vh; max-width: 600px; margin: 0 auto; }

.header { padding: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }
.logo { font-weight: bold; color: #4caf50; }
.stats { color: #f44336; }

.board-wrapper { flex: 0 0 auto; padding: 20px; display: flex; justify-content: center; }
canvas { background: #DCB35C; border-radius: 4px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); cursor: pointer; }

.controls-wrapper { flex: 1; padding: 0 20px 20px; display: flex; flex-direction: column; gap: 15px; }

.msg-box { text-align: center; height: 30px; line-height: 30px; color: #aaa; }
.msg-box.error { color: #f44336; font-weight: bold; }
.msg-box.success { color: #4caf50; font-weight: bold; }

.select-theory-btn {
  background: #333; border: 2px dashed #555; border-radius: 12px; padding: 15px;
  display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer;
  transition: all 0.2s;
}
.select-theory-btn:active { background: #444; }
.select-theory-btn .label { font-size: 12px; color: #888; }
.select-theory-btn .value { font-size: 18px; font-weight: bold; color: #4caf50; }
.select-theory-btn .value.empty { color: #666; }

.confirm-btn {
  padding: 15px; border-radius: 12px; border: none; font-size: 16px; font-weight: bold;
  background: #2196f3; color: white; cursor: pointer; margin-top: auto;
}
.confirm-btn:disabled { background: #444; color: #777; cursor: not-allowed; }
.next-btn { padding: 15px; background: #4caf50; border: none; color: white; border-radius: 12px; font-weight: bold; cursor: pointer; }
</style>
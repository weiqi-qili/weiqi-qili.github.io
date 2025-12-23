<template>
  <div class="admin-container">
    <div class="nav">
      <button class="back-btn" @click="goHome">← 返回做题 (强制刷新)</button>
      <div class="tabs">
        <button :class="{active: tab==='problem'}" @click="tab='problem'">录入题目</button>
        <button :class="{active: tab==='category'}" @click="tab='category'">管理分类</button>
      </div>
    </div>

    <!-- Tab 1: 录入题目 -->
    <div v-if="tab==='problem'" class="panel">
      <h3>录入新题</h3>
      <div class="form-group">
        <label>SGF 文本 (粘贴):</label>
        <textarea v-model="newSgf" rows="5" placeholder="(;SZ[19]...)"></textarea>
      </div>
      
      <!-- SGF 预览/校验区 -->
      <div class="preview" v-if="newSgf">
        <div v-if="parsedSgf">
          <span :class="{ok: parsedSgf.answer, err: !parsedSgf.answer}">
            {{ parsedSgf.answer ? '✅ 检测到正解' : '❌ 未检测到正解 (需包含下一手)' }}
          </span>
          <span style="margin-left:10px; color:#888">
            (黑:{{ parsedSgf.blackStones.length }} 白:{{ parsedSgf.whiteStones.length }})
          </span>
        </div>
        <div v-else class="err">SGF 解析失败，请检查格式</div>
      </div>

      <div class="form-group">
        <label>选择正确分类 (支持2级或3级):</label>
        <select v-model="selectedCatId">
          <option :value="null">-- 请选择 --</option>
          <option v-for="c in flatSelectable" :key="c.id" :value="c.id">
            {{ c.displayName }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>说明:</label>
        <input v-model="description" placeholder="例如：黑先杀白">
      </div>

      <button class="save-btn" @click="saveProblem" :disabled="!canSaveProblem">保存题目</button>
    </div>

    <!-- Tab 2: 管理分类 -->
    <div v-if="tab==='category'" class="panel">
      <h3>分类管理树</h3>
      <div class="add-box">
        <input v-model="newCatName" placeholder="分类名称">
        <select v-model="newCatParent">
          <option :value="null" disabled>请选择父级 (必选)</option>
          <!-- 下拉菜单：父级选择 -->
          <option v-for="c in flatParents" :key="c.id" :value="c.id">
            {{ c.displayName }}
          </option>
        </select>
        <button @click="addCategory">添加</button>
      </div>
      <p class="tip">提示：支持2级结构（大类-棋理）或3级结构（大类-分组-棋理）。</p>

      <div class="tree-view">
        <div v-for="root in treeData" :key="root.id" class="tree-root">
          <div class="root-label" :style="{color: root.color}">📂 {{ root.name }}</div>
          
          <div class="root-children">
            <div v-for="node in root.children" :key="node.id" class="tree-node-l2">
               <div class="node-row">
                 <span :class="{group: node.children.length>0, item: node.children.length===0}">
                   {{ node.children.length > 0 ? '📁' : '📄' }} {{ node.name }}
                 </span>
                 <button class="del-btn" @click="deleteCategory(node.id)">×</button>
               </div>
               
               <div v-for="child in node.children" :key="child.id" class="tree-node-l3">
                 <div class="item-row">
                   <span>└ 📄 {{ child.name }}</span>
                   <button class="del-btn" @click="deleteCategory(child.id)">×</button>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
// ⚠️ 如果下面这行报错，说明你没有 src/utils/sgfParser.js 文件
import { parseSGF } from '../utils/sgfParser'

const tab = ref('problem')
const categories = ref([])

// 表单数据
const newSgf = ref('')
const selectedCatId = ref(null)
const description = ref('')
const newCatName = ref('')
const newCatParent = ref(null)

onMounted(() => {
  fetchCategories()
})

const goHome = () => window.location.href = '/'

const fetchCategories = async () => {
  const { data, error } = await supabase.from('categories').select('*').order('id')
  if (error) console.error('分类加载失败:', error)
  if (data) categories.value = data
}

// --- 计算属性：分类管理 ---

// 树形结构
const treeData = computed(() => {
  const roots = categories.value.filter(c => c.level === 1)
  return roots.map(root => {
    const level2 = categories.value.filter(c => c.parent_id === root.id)
    return {
      ...root,
      children: level2.map(l2 => ({
        ...l2,
        children: categories.value.filter(c => c.parent_id === l2.id)
      }))
    }
  })
})

// 添加分类时的父级选项 (Level 1 & 2)
const flatParents = computed(() => {
  const list = []
  const roots = categories.value.filter(c => c.level === 1)
  roots.forEach(r => {
    list.push({ id: r.id, displayName: `📂 ${r.name} (根)`, level: 1 })
    const l2s = categories.value.filter(c => c.parent_id === r.id)
    l2s.forEach(l2 => {
      list.push({ id: l2.id, displayName: `　└ 📁 ${l2.name}`, level: 2 })
    })
  })
  return list
})

// --- 计算属性：录题 ---

// 录题时的分类选择 (Level 2 & 3)
const flatSelectable = computed(() => {
  return categories.value
    .filter(c => c.level !== 1) // 不选根节点
    .map(c => {
      const p = categories.value.find(x => x.id === c.parent_id)
      const pp = p ? categories.value.find(x => x.id === p.parent_id) : null
      let prefix = ''
      if (pp) prefix = `${pp.name} > ${p.name} > `
      else if (p) prefix = `${p.name} > `
      
      return { id: c.id, displayName: `${prefix}${c.name}` }
    })
    .sort((a,b) => a.id - b.id)
})

const parsedSgf = computed(() => {
  if (!newSgf.value) return null
  try {
    return parseSGF(newSgf.value)
  } catch (e) {
    console.error('SGF解析错:', e)
    return null
  }
})

const canSaveProblem = computed(() => {
  return newSgf.value && selectedCatId.value && parsedSgf.value?.answer
})

// --- 操作方法 ---

const saveProblem = async () => {
  const { error } = await supabase.from('problems').insert({
    sgf_content: newSgf.value,
    correct_category_id: selectedCatId.value,
    description: description.value
  })
  if (error) alert('保存失败: ' + error.message)
  else {
    alert('保存成功！')
    newSgf.value = ''
    // 保留分类不重置，方便连续录题
  }
}

const addCategory = async () => {
  if (!newCatName.value || !newCatParent.value) return alert('请填写名称并选择父级')
  
  const parent = categories.value.find(c => c.id === newCatParent.value)
  if (!parent) return
  
  const newLevel = parent.level + 1
  if (newLevel > 3) return alert('最多支持3级')

  const { error } = await supabase.from('categories').insert({
    name: newCatName.value,
    parent_id: newCatParent.value,
    level: newLevel
  })
  
  if (error) alert(error.message)
  else {
    newCatName.value = ''
    fetchCategories()
  }
}

const deleteCategory = async (id) => {
  if (!confirm('确认删除？')) return
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) alert('删除失败 (可能有关联数据): ' + error.message)
  else fetchCategories()
}
</script>

<style scoped>
.admin-container { padding: 20px; color: #fff; max-width: 800px; margin: 0 auto; min-height: 100vh; background: #1a1a1a; }
.nav { display: flex; justify-content: space-between; margin-bottom: 20px; }
.back-btn { background: #555; border: none; color: #ddd; padding: 8px 15px; cursor: pointer; border-radius: 4px; }
.tabs button { margin-left: 10px; padding: 8px 15px; background: #333; border: 1px solid #555; color: #ccc; cursor: pointer; }
.tabs button.active { background: #4caf50; color: white; border-color: #4caf50; }

.panel { background: #222; padding: 20px; border-radius: 8px; border: 1px solid #333; }
.form-group { margin-bottom: 15px; display: flex; flex-direction: column; gap: 5px; }
textarea, input, select { background: #333; color: white; border: 1px solid #555; padding: 10px; border-radius: 4px; font-family: monospace; }
.save-btn { width: 100%; padding: 12px; background: #2196f3; color: white; border: none; font-weight: bold; cursor: pointer; }
.save-btn:disabled { background: #444; color: #777; cursor: not-allowed; }

.preview { font-size: 13px; margin-bottom: 10px; padding: 10px; background: #111; border-radius: 4px; }
.ok { color: #4caf50; font-weight: bold; }
.err { color: #f44336; }

.add-box { display: flex; gap: 10px; margin-bottom: 10px; }
.tip { color: #888; font-size: 12px; margin-bottom: 20px; }

.tree-view { display: flex; flex-direction: column; gap: 15px; }
.root-label { font-weight: bold; font-size: 16px; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 5px; }
.root-children { padding-left: 15px; }
.node-row, .item-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
.node-row { color: #eee; }
.item-row { color: #aaa; font-size: 14px; padding-left: 20px; }
.group { color: #fff; font-weight: bold; }
.del-btn { background: #f44336; border: none; color: white; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-left: 10px; }
.del-btn:hover { background: #d32f2f; }
</style>
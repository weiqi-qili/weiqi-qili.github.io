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
      
      <div class="preview" v-if="newSgf">
        <div v-if="parsedSgf">
          <span :class="{ok: parsedSgf.answer, err: !parsedSgf.answer}">
            {{ parsedSgf.answer ? '✅ 解析成功' : '❌ 未检测到招法 (SGF内必须包含 ;B[...] 或 ;W[...])' }}
          </span>
          <span style="margin-left:10px; color:#888">
            (黑:{{ parsedSgf.blackStones.length }} 白:{{ parsedSgf.whiteStones.length }} 招法:{{ parsedSgf.moves.length }})
          </span>
        </div>
        <div v-else class="err">SGF 解析失败，请检查格式</div>
      </div>

      <div class="form-group">
        <label>选择正确分类:</label>
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
          <option v-for="c in flatParents" :key="c.id" :value="c.id">
            {{ c.displayName }}
          </option>
        </select>
        <button @click="addCategory">添加</button>
      </div>
      <p class="tip">提示：排序规则为【布局 -> 中盘 -> 胜负处 -> 官子】，其余按录入时间。</p>

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
import { parseSGF } from '../utils/sgfParser'

const tab = ref('problem')
const categories = ref([])

// 表单数据
const newSgf = ref('')
const selectedCatId = ref(null)
const description = ref('')
const newCatName = ref('')
const newCatParent = ref(null)

// 🌟 自定义排序规则：这几个名字的排前面，其他的按ID排
const rootSortOrder = ['布局', '中盘', '胜负处', '官子']

onMounted(() => {
  fetchCategories()
})

const goHome = () => window.location.href = '/'

const fetchCategories = async () => {
  const { data, error } = await supabase.from('categories').select('*').order('id')
  if (error) console.error('分类加载失败:', error)
  if (data) categories.value = data
}

// 通用排序函数：先按rootSortOrder排名字，再按ID排
const sortCategories = (list) => {
  return list.sort((a, b) => {
    const idxA = rootSortOrder.indexOf(a.name)
    const idxB = rootSortOrder.indexOf(b.name)
    
    // 如果都在列表中，按列表顺序排
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    // 如果只有A在，A排前
    if (idxA !== -1) return -1
    // 如果只有B在，B排前
    if (idxB !== -1) return 1
    
    // 如果都不在，按ID（时间）排
    return a.id - b.id
  })
}

// --- 计算属性：分类管理 ---

const treeData = computed(() => {
  // 1. 拿根节点
  let roots = categories.value.filter(c => c.level === 1)
  // 2. 排序根节点
  roots = sortCategories(roots)

  return roots.map(root => {
    // 3. 拿二级节点并按ID排序
    const level2 = categories.value
      .filter(c => c.parent_id === root.id)
      .sort((a,b) => a.id - b.id)

    return {
      ...root,
      children: level2.map(l2 => ({
        ...l2,
        // 4. 拿三级节点并按ID排序
        children: categories.value
          .filter(c => c.parent_id === l2.id)
          .sort((a,b) => a.id - b.id)
      }))
    }
  })
})

const flatParents = computed(() => {
  const list = []
  // 复用 treeData 的排序结果
  treeData.value.forEach(r => {
    list.push({ id: r.id, displayName: `📂 ${r.name} (根)`, level: 1 })
    r.children.forEach(l2 => {
      list.push({ id: l2.id, displayName: `　└ 📁 ${l2.name}`, level: 2 })
    })
  })
  return list
})

const flatSelectable = computed(() => {
  // 这里的排序也跟随 treeData，保证下拉菜单和管理界面顺序一致
  const list = []
  treeData.value.forEach(root => {
    root.children.forEach(l2 => {
      // 自己的名字
      const prefix2 = `${root.name} > `
      list.push({ id: l2.id, displayName: `${prefix2}${l2.name}` })
      
      // 孩子的名字
      l2.children.forEach(l3 => {
        const prefix3 = `${root.name} > ${l2.name} > `
        list.push({ id: l3.id, displayName: `${prefix3}${l3.name}` })
      })
    })
  })
  return list
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
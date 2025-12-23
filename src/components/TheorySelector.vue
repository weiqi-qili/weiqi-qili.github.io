<template>
  <div class="overlay-backdrop" @click.self="$emit('close')">
    <div class="scroll-container">
      <button class="close-btn" @click="$emit('close')">✕</button>
      <div class="main-title">请选择棋理类别</div>

      <div v-for="root in structuredCategories" :key="root.id" class="root-section">
        <!-- Sticky Header: Level 1 -->
        <div class="sticky-header" :style="{ backgroundColor: root.color }">
          {{ root.name }}
        </div>

        <div class="root-content">
          
          <!-- 1. 先显示：直接挂在下面的独立棋理 (Level 2 Orphan Items) -->
          <div v-if="root.directItems.length > 0" class="group-section">
            <div class="group-title" :style="{ color: root.color, opacity: 0.7 }">
              通用 / 其他
            </div>
            <div class="buttons-grid">
              <button 
                v-for="item in root.directItems" 
                :key="item.id"
                @click="selectItem(item)"
                :class="['theory-btn', { selected: selectedId === item.id }]"
                :style="selectedId === item.id ? { backgroundColor: root.color, borderColor: root.color } : {}"
              >
                {{ item.name }}
              </button>
            </div>
          </div>

          <!-- 2. 再显示：分组 (Level 2 Groups) -->
          <div v-for="group in root.groups" :key="group.id" class="group-section">
            <div class="group-title" :style="{ color: root.color }">
              {{ group.name }}
            </div>
            <div class="buttons-grid">
              <button 
                v-for="item in group.items" 
                :key="item.id"
                @click="selectItem(item)"
                :class="['theory-btn', { selected: selectedId === item.id }]"
                :style="selectedId === item.id ? { backgroundColor: root.color, borderColor: root.color } : {}"
              >
                {{ item.name }}
              </button>
            </div>
          </div>

          <div v-if="root.groups.length === 0 && root.directItems.length === 0" class="empty-tip">
            (暂无内容)
          </div>
        </div>
      </div>
      <div class="spacer"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  selectedId: Number
})
const emit = defineEmits(['select', 'close'])

const structuredCategories = computed(() => {
  // 1. 找出 Level 1 根节点
  const roots = props.categories.filter(c => c.level === 1).sort((a,b) => a.id - b.id)
  
  return roots.map(root => {
    // 找出所有 Level 2 的子节点
    const level2Children = props.categories.filter(c => c.parent_id === root.id && c.level === 2)
    
    // 区分：哪些是分组(有孩子的)，哪些是直接的棋理(没孩子的)
    const groups = []
    const directItems = []

    level2Children.forEach(l2 => {
      // 检查它有没有 Level 3 的孩子
      const children = props.categories.filter(c => c.parent_id === l2.id && c.level === 3)
      if (children.length > 0) {
        // 有孩子 -> 它是分组
        groups.push({ ...l2, items: children })
      } else {
        // 没孩子 -> 它是直接棋理
        directItems.push(l2)
      }
    })

    return { 
      ...root, 
      groups, 
      directItems 
    }
  })
})

const selectItem = (item) => {
  emit('select', item)
  emit('close')
}
</script>

<style scoped>
.overlay-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(4px); z-index: 999; display: flex; justify-content: center; }
.scroll-container { width: 100%; max-width: 600px; height: 100%; overflow-y: auto; position: relative; scrollbar-width: none; }
.scroll-container::-webkit-scrollbar { display: none; }
.close-btn { position: absolute; top: 15px; right: 15px; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2); color: #fff; border: none; font-size: 20px; z-index: 1001; cursor: pointer; }
.main-title { text-align: center; color: #888; padding: 20px 0 10px; font-size: 14px; }
.sticky-header { position: sticky; top: 0; z-index: 1000; padding: 12px 20px; color: white; font-weight: bold; font-size: 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.5); }
.root-content { padding: 15px 20px; }
.group-section { margin-bottom: 25px; }
.group-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; padding-left: 8px; border-left: 3px solid currentColor; }
.buttons-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.theory-btn { background: #2a2a2a; color: #ccc; border: 1px solid #444; padding: 10px 5px; border-radius: 8px; font-size: 14px; min-height: 45px; cursor: pointer; }
.theory-btn.selected { color: white; font-weight: bold; box-shadow: 0 0 8px rgba(255,255,255,0.5); }
.spacer { height: 100px; }
.empty-tip { color: #666; font-size: 12px; font-style: italic; padding: 10px; }
</style>
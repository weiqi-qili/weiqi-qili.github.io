<template>
  <div class="overlay-backdrop" @click.self="$emit('close')">
    <div class="scroll-container">
      <button class="close-btn" @click="$emit('close')">✕</button>
      <div class="main-title">请选择棋理类别</div>

      <div v-for="root in structuredCategories" :key="root.id" class="root-section">
        <!-- 粘性标题 -->
        <div class="sticky-header" :style="{ backgroundColor: root.color }">
          {{ root.name }}
        </div>

        <div class="root-content">
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
          <!-- 如果大类下没有分组，直接显示子项 (容错处理) -->
          <div v-if="root.items && root.items.length" class="group-section">
             <div class="buttons-grid">
              <button 
                v-for="item in root.items" :key="item.id"
                @click="selectItem(item)"
                :class="['theory-btn', { selected: selectedId === item.id }]"
              >
                {{ item.name }}
              </button>
             </div>
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

const rootConfigs = [
  { id: 1, name: '布局', color: '#4caf50' }, 
  { id: 2, name: '中盘', color: '#f44336' }, 
  { id: 3, name: '官子', color: '#2196f3' }
]

const structuredCategories = computed(() => {
  if (!props.categories.length) return []
  return rootConfigs.map(root => {
    // 找二级分组
    const groups = props.categories.filter(c => c.parent_id === root.id && c.level === 2)
    // 找直接挂在一级下的三级项 (以防万一)
    const directItems = props.categories.filter(c => c.parent_id === root.id && c.level === 3)

    const groupsWithItems = groups.map(g => ({
      ...g,
      items: props.categories.filter(c => c.parent_id === g.id && c.level === 3)
    })).filter(g => g.items.length > 0)

    return { ...root, groups: groupsWithItems, items: directItems }
  })
})

const selectItem = (item) => {
  emit('select', item)
  emit('close')
}
</script>

<style scoped>
.overlay-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(4px);
  z-index: 999;
  display: flex;
  justify-content: center;
}
.scroll-container {
  width: 100%; max-width: 600px; height: 100%; overflow-y: auto; position: relative;
  scrollbar-width: none;
}
.scroll-container::-webkit-scrollbar { display: none; }
.close-btn {
  position: absolute; top: 15px; right: 15px; width: 40px; height: 40px;
  border-radius: 50%; background: rgba(255,255,255,0.2); color: #fff;
  border: none; font-size: 20px; z-index: 1001; cursor: pointer;
}
.main-title { text-align: center; color: #888; padding: 20px 0 10px; font-size: 14px; }
.sticky-header {
  position: sticky; top: 0; z-index: 1000; padding: 12px 20px;
  color: white; font-weight: bold; font-size: 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.5);
}
.root-content { padding: 15px 20px; }
.group-title { font-size: 16px; font-weight: bold; margin: 15px 0 10px; padding-left: 8px; border-left: 3px solid currentColor; }
.buttons-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.theory-btn {
  background: #2a2a2a; color: #ccc; border: 1px solid #444; padding: 12px 5px;
  border-radius: 8px; font-size: 14px; min-height: 50px; cursor: pointer;
}
.theory-btn.selected { color: white; font-weight: bold; box-shadow: 0 0 8px rgba(255,255,255,0.5); }
.spacer { height: 100px; }
</style>
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('请确保 .env 文件中配置了 Supabase URL 和 Key')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
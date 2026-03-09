import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xzndojdhpuwbywpdepkb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6bmRvamRocHV3Ynl3cGRlcGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDg1NDksImV4cCI6MjA4ODAyNDU0OX0.NSyqCI9RrLtAVjS2HHXnaA6DC2M7p-G0xE-2S5iGSbE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export interface HowToVideo {
  id: string
  title: string
  description: string | null
  storage_path: string
  thumbnail_path: string | null
  duration: number | null
  sort_order: number
  is_published: boolean
  file_type: string | null
  file_size: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

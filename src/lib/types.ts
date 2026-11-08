export type Category = {
  id: string
  code: string
  name: string
  description: string | null
  display_order: number
  active: boolean
  published: boolean
}

export type Season = {
  id: string
  name: string
  start_date: string
  end_date: string
  cutoff_date: string
  active: boolean
}

export type Player = {
  id: string
  first_names: string
  last_names: string
  cedula_normalized: string
  birth_date: string
  status: 'active' | 'inactive' | 'suspended' | 'graduated'
  registration_date: string
  notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  enrollments?: Array<{
    id: string
    category_id: string
    season_id: string
    status: string
    categories?: Pick<Category, 'id' | 'name' | 'code'>
    seasons?: Pick<Season, 'id' | 'name'>
  }>
}

export type NewsItem = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  cover_path: string | null
  status: 'draft' | 'published' | 'archived'
  pinned: boolean
  published_at: string | null
  created_at: string
}

export type SiteSettings = {
  id: string
  academy_name: string
  motto: string
  hero_text: string
  mission: string
  vision: string
  values_text: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  instagram_url: string | null
  facebook_url: string | null
  enrollment_open: boolean
}

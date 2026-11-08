import { useEffect, useState } from 'react'
import { CalendarRange, CheckCircle2, History, LoaderCircle, Save, Settings2, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Category, Season, SiteSettings } from '../../lib/types'

type Tab = 'institution' | 'seasons' | 'categories' | 'audit'
type Audit = { id: number; actor_id: string | null; action: string; table_name: string; record_id: string | null; changed_fields: string[]; created_at: string }

export default function SettingsModule() {
  const [tab, setTab] = useState<Tab>('institution')
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [audit, setAudit] = useState<Audit[]>([])
  const [seasonForm, setSeasonForm] = useState({ name: '', start_date: '', end_date: '', cutoff_date: '', active: true })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [settingsResult, seasonsResult, categoriesResult, auditResult] = await Promise.all([
      supabase.from('site_settings').select('*').limit(1).maybeSingle(),
      supabase.from('seasons').select('*').order('start_date', { ascending: false }),
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    setSettings(settingsResult.data as SiteSettings | null); setSeasons((seasonsResult.data ?? []) as Season[]); setCategories((categoriesResult.data ?? []) as Category[]); setAudit((auditResult.data ?? []) as Audit[])
  }
  useEffect(() => { void load() }, [])

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault(); if (!settings) return; setBusy(true)
    const { id, ...values } = settings
    const { error } = await supabase.from('site_settings').update(values).eq('id', id)
    setBusy(false); setMessage(error ? error.message : 'Configuración institucional guardada.')
  }

  const saveSeason = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true)
    const { error } = await supabase.from('seasons').insert(seasonForm)
    setBusy(false); if (error) return setMessage(error.message)
    setMessage('Temporada creada.'); setSeasonForm({ name: '', start_date: '', end_date: '', cutoff_date: '', active: true }); await load()
  }

  const updateCategory = async (category: Category) => {
    const { error } = await supabase.from('categories').update({ name: category.name, description: category.description, active: category.active, published: category.published }).eq('id', category.id)
    setMessage(error ? error.message : `${category.name} actualizada.`)
  }

  if (!settings) return <div className="loading-screen contained"><LoaderCircle className="spin" /> Cargando configuración…</div>

  return <div className="admin-page"><div className="page-heading"><div><span>Administración general</span><h1>Configuración</h1></div></div>
    {message && <div className="notice-bar"><span>{message}</span><button onClick={() => setMessage('')}>×</button></div>}
    <div className="tab-bar wrap"><button className={tab === 'institution' ? 'active' : ''} onClick={() => setTab('institution')}><Settings2 /> Institución</button><button className={tab === 'seasons' ? 'active' : ''} onClick={() => setTab('seasons')}><CalendarRange /> Temporadas</button><button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}><CheckCircle2 /> Categorías</button><button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}><History /> Auditoría</button></div>

    {tab === 'institution' && <form className="settings-form panel" onSubmit={saveSettings}><div className="panel-heading"><div><span>Contenido principal</span><h2>Identidad y contacto</h2></div></div><div className="form-grid"><label>Nombre institucional<input value={settings.academy_name} onChange={(e) => setSettings({ ...settings, academy_name: e.target.value })} required /></label><label>Lema<input value={settings.motto} onChange={(e) => setSettings({ ...settings, motto: e.target.value })} required /></label><label className="span-2">Texto principal<textarea rows={3} value={settings.hero_text} onChange={(e) => setSettings({ ...settings, hero_text: e.target.value })} required /></label><label className="span-2">Misión<textarea rows={4} value={settings.mission} onChange={(e) => setSettings({ ...settings, mission: e.target.value })} /></label><label className="span-2">Visión<textarea rows={4} value={settings.vision} onChange={(e) => setSettings({ ...settings, vision: e.target.value })} /></label><label className="span-2">Valores<input value={settings.values_text} onChange={(e) => setSettings({ ...settings, values_text: e.target.value })} /></label><label>Teléfono<input value={settings.phone ?? ''} onChange={(e) => setSettings({ ...settings, phone: e.target.value || null })} /></label><label>WhatsApp con código de país<input value={settings.whatsapp ?? ''} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value || null })} /></label><label>Correo<input type="email" value={settings.email ?? ''} onChange={(e) => setSettings({ ...settings, email: e.target.value || null })} /></label><label>Dirección<input value={settings.address ?? ''} onChange={(e) => setSettings({ ...settings, address: e.target.value || null })} /></label><label>Instagram<input type="url" value={settings.instagram_url ?? ''} onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value || null })} /></label><label>Facebook<input type="url" value={settings.facebook_url ?? ''} onChange={(e) => setSettings({ ...settings, facebook_url: e.target.value || null })} /></label><label className="check-row span-2"><input type="checkbox" checked={settings.enrollment_open} onChange={(e) => setSettings({ ...settings, enrollment_open: e.target.checked })} /> Mostrar inscripciones abiertas en el sitio público</label></div><button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <><Save /> Guardar cambios</>}</button></form>}

    {tab === 'seasons' && <div className="settings-grid"><form className="panel stack-form" onSubmit={saveSeason}><div className="panel-heading"><div><span>Nueva configuración</span><h2>Crear temporada</h2></div></div><label>Nombre<input placeholder="Ej.: Temporada 2027" value={seasonForm.name} onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })} required /></label><label>Fecha de inicio<input type="date" value={seasonForm.start_date} onChange={(e) => setSeasonForm({ ...seasonForm, start_date: e.target.value })} required /></label><label>Fecha de cierre<input type="date" value={seasonForm.end_date} onChange={(e) => setSeasonForm({ ...seasonForm, end_date: e.target.value })} required /></label><label>Fecha de corte por edad<input type="date" value={seasonForm.cutoff_date} onChange={(e) => setSeasonForm({ ...seasonForm, cutoff_date: e.target.value })} required /></label><label className="check-row"><input type="checkbox" checked={seasonForm.active} onChange={(e) => setSeasonForm({ ...seasonForm, active: e.target.checked })} /> Temporada activa</label><button className="button button-primary" disabled={busy}><CalendarRange /> Crear temporada</button></form><section className="panel"><div className="panel-heading"><div><span>Historial</span><h2>Temporadas configuradas</h2></div></div><div className="season-list">{seasons.map((season) => <article key={season.id}><div><strong>{season.name}</strong><small>{season.start_date} → {season.end_date}</small></div><span className={`status ${season.active ? 'active' : 'inactive'}`}>{season.active ? 'Activa' : 'Inactiva'}</span></article>)}{!seasons.length && <div className="panel-empty">No hay temporadas. Creá una antes de registrar jugadores.</div>}</div></section></div>}

    {tab === 'categories' && <div className="category-settings">{categories.map((category, index) => <article className="panel" key={category.id}><div className="category-edit-title"><span>{String(index + 1).padStart(2, '0')}</span><div><small>{category.code}</small><input value={category.name} onChange={(e) => setCategories(categories.map((item) => item.id === category.id ? { ...item, name: e.target.value } : item))} /></div></div><label>Descripción pública<textarea rows={3} value={category.description ?? ''} onChange={(e) => setCategories(categories.map((item) => item.id === category.id ? { ...item, description: e.target.value } : item))} /></label><div className="inline-checks"><label><input type="checkbox" checked={category.active} onChange={(e) => setCategories(categories.map((item) => item.id === category.id ? { ...item, active: e.target.checked } : item))} /> Activa</label><label><input type="checkbox" checked={category.published} onChange={(e) => setCategories(categories.map((item) => item.id === category.id ? { ...item, published: e.target.checked } : item))} /> Pública</label></div><button className="button button-secondary" onClick={() => void updateCategory(category)}><Save /> Guardar</button></article>)}</div>}

    {tab === 'audit' && <section className="panel"><div className="panel-heading"><div><span>Trazabilidad</span><h2>Movimientos recientes</h2></div><ShieldCheck /></div><div className="audit-list">{audit.map((entry) => <article key={entry.id}><span className="audit-action">{entry.action}</span><div><strong>{entry.table_name}</strong><small>Registro {entry.record_id || '—'} · campos: {entry.changed_fields?.join(', ') || '—'}</small></div><time>{new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.created_at))}</time></article>)}{!audit.length && <div className="panel-empty">No hay movimientos auditados todavía.</div>}</div></section>}
  </div>
}

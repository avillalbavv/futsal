import { useEffect, useState } from 'react'
import { CalendarPlus, Check, Edit3, LoaderCircle, Newspaper, Plus, Save, UsersRound, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Category, NewsItem } from '../../lib/types'

type Tab = 'news' | 'staff' | 'schedules'
type Staff = { id: string; full_name: string; position: string; bio: string | null; credentials: string | null; published: boolean }
type Schedule = { id: string; category_id: string; day_of_week: number; start_time: string; end_time: string; location: string | null; published: boolean; categories?: { name: string } }
const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default function ContentModule() {
  const [tab, setTab] = useState<Tab>('news')
  const [news, setNews] = useState<NewsItem[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [newsForm, setNewsForm] = useState({ id: '', title: '', excerpt: '', content: '', status: 'draft' as NewsItem['status'], pinned: false })
  const [staffForm, setStaffForm] = useState({ id: '', full_name: '', position: '', bio: '', credentials: '', published: false })
  const [scheduleForm, setScheduleForm] = useState({ category_id: '', day_of_week: '1', start_time: '', end_time: '', location: '', published: false })
  const [editor, setEditor] = useState<null | Tab>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const [newsResult, staffResult, scheduleResult, categoryResult] = await Promise.all([
      supabase.from('news').select('*').order('created_at', { ascending: false }),
      supabase.from('staff').select('*').order('display_order'),
      supabase.from('training_schedules').select('*,categories(name)').order('day_of_week'),
      supabase.from('categories').select('*').eq('active', true).order('display_order'),
    ])
    setNews((newsResult.data ?? []) as NewsItem[]); setStaff((staffResult.data ?? []) as Staff[]); setSchedules((scheduleResult.data ?? []) as unknown as Schedule[]); setCategories((categoryResult.data ?? []) as Category[])
  }
  useEffect(() => { void load() }, [])

  const saveNews = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const payload = { title: newsForm.title.trim(), slug: `${slugify(newsForm.title)}${newsForm.id ? '' : `-${Date.now().toString().slice(-6)}`}`, excerpt: newsForm.excerpt.trim() || null, content: newsForm.content.trim(), status: newsForm.status, pinned: newsForm.pinned, published_at: newsForm.status === 'published' ? new Date().toISOString() : null }
    const result = newsForm.id ? await supabase.from('news').update({ ...payload, slug: news.find((item) => item.id === newsForm.id)?.slug }).eq('id', newsForm.id) : await supabase.from('news').insert(payload)
    setBusy(false); if (result.error) return setMessage(result.error.message)
    setMessage('Noticia guardada.'); setEditor(null); setNewsForm({ id: '', title: '', excerpt: '', content: '', status: 'draft', pinned: false }); await load()
  }

  const editNews = (item: NewsItem) => { setNewsForm({ id: item.id, title: item.title, excerpt: item.excerpt || '', content: item.content, status: item.status, pinned: item.pinned }); setEditor('news') }

  const saveStaff = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true)
    const payload = { full_name: staffForm.full_name.trim(), position: staffForm.position.trim(), bio: staffForm.bio.trim() || null, credentials: staffForm.credentials.trim() || null, published: staffForm.published }
    const result = staffForm.id ? await supabase.from('staff').update(payload).eq('id', staffForm.id) : await supabase.from('staff').insert(payload)
    setBusy(false); if (result.error) return setMessage(result.error.message)
    setMessage('Integrante guardado.'); setEditor(null); setStaffForm({ id: '', full_name: '', position: '', bio: '', credentials: '', published: false }); await load()
  }

  const saveSchedule = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true)
    const result = await supabase.from('training_schedules').insert({ category_id: scheduleForm.category_id, day_of_week: Number(scheduleForm.day_of_week), start_time: scheduleForm.start_time, end_time: scheduleForm.end_time, location: scheduleForm.location || null, published: scheduleForm.published })
    setBusy(false); if (result.error) return setMessage(result.error.message)
    setMessage('Horario guardado.'); setEditor(null); setScheduleForm({ category_id: '', day_of_week: '1', start_time: '', end_time: '', location: '', published: false }); await load()
  }

  return <div className="admin-page"><div className="page-heading"><div><span>Sitio institucional</span><h1>Gestión de contenido</h1></div><button className="button button-primary" onClick={() => setEditor(tab)}><Plus /> Agregar contenido</button></div>
    {message && <div className="notice-bar"><span>{message}</span><button onClick={() => setMessage('')}><X /></button></div>}
    <div className="tab-bar"><button className={tab === 'news' ? 'active' : ''} onClick={() => setTab('news')}><Newspaper /> Noticias</button><button className={tab === 'staff' ? 'active' : ''} onClick={() => setTab('staff')}><UsersRound /> Cuerpo técnico</button><button className={tab === 'schedules' ? 'active' : ''} onClick={() => setTab('schedules')}><CalendarPlus /> Horarios</button></div>
    <div className="content-list">
      {tab === 'news' && (news.length ? news.map((item) => <article key={item.id}><div className="content-icon"><Newspaper /></div><div><div className="item-meta"><span className={`status ${item.status === 'published' ? 'active' : 'inactive'}`}>{item.status === 'published' ? 'Publicado' : item.status === 'draft' ? 'Borrador' : 'Archivado'}</span>{item.pinned && <span>Fijada</span>}</div><h3>{item.title}</h3><p>{item.excerpt || item.content.slice(0, 120)}</p></div><button onClick={() => editNews(item)}><Edit3 /> Editar</button></article>) : <div className="panel-empty">Todavía no hay noticias.</div>)}
      {tab === 'staff' && (staff.length ? staff.map((member) => <article key={member.id}><div className="content-icon"><UsersRound /></div><div><div className="item-meta"><span className={`status ${member.published ? 'active' : 'inactive'}`}>{member.published ? 'Publicado' : 'Oculto'}</span></div><h3>{member.full_name}</h3><p>{member.position}{member.credentials ? ` · ${member.credentials}` : ''}</p></div><button onClick={() => { setStaffForm({ id: member.id, full_name: member.full_name, position: member.position, bio: member.bio || '', credentials: member.credentials || '', published: member.published }); setEditor('staff') }}><Edit3 /> Editar</button></article>) : <div className="panel-empty">Todavía no hay integrantes publicados.</div>)}
      {tab === 'schedules' && (schedules.length ? schedules.map((schedule) => <article key={schedule.id}><div className="content-icon"><CalendarPlus /></div><div><div className="item-meta"><span className={`status ${schedule.published ? 'active' : 'inactive'}`}>{schedule.published ? 'Publicado' : 'Oculto'}</span></div><h3>{schedule.categories?.name} · {days[schedule.day_of_week]}</h3><p>{schedule.start_time.slice(0, 5)}–{schedule.end_time.slice(0, 5)}{schedule.location ? ` · ${schedule.location}` : ''}</p></div></article>) : <div className="panel-empty">Todavía no hay horarios cargados.</div>)}
    </div>

    {editor && <div className="modal-backdrop"><div className="modal"><div className="modal-heading"><div><span>Editor institucional</span><h2>{editor === 'news' ? 'Noticia' : editor === 'staff' ? 'Cuerpo técnico' : 'Horario'}</h2></div><button onClick={() => setEditor(null)}><X /></button></div>
      {editor === 'news' && <form className="stack-form" onSubmit={saveNews}><label>Título<input value={newsForm.title} onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })} required /></label><label>Resumen<textarea rows={3} value={newsForm.excerpt} onChange={(e) => setNewsForm({ ...newsForm, excerpt: e.target.value })} /></label><label>Contenido<textarea rows={9} value={newsForm.content} onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })} required /></label><div className="form-grid"><label>Estado<select value={newsForm.status} onChange={(e) => setNewsForm({ ...newsForm, status: e.target.value as NewsItem['status'] })}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label><label className="check-row top-space"><input type="checkbox" checked={newsForm.pinned} onChange={(e) => setNewsForm({ ...newsForm, pinned: e.target.checked })} /> Fijar como importante</label></div><button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <><Save /> Guardar</>}</button></form>}
      {editor === 'staff' && <form className="stack-form" onSubmit={saveStaff}><label>Nombre completo<input value={staffForm.full_name} onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })} required /></label><label>Función<input value={staffForm.position} onChange={(e) => setStaffForm({ ...staffForm, position: e.target.value })} required /></label><label>Reseña<textarea rows={5} value={staffForm.bio} onChange={(e) => setStaffForm({ ...staffForm, bio: e.target.value })} /></label><label>Credenciales verificadas<input value={staffForm.credentials} onChange={(e) => setStaffForm({ ...staffForm, credentials: e.target.value })} /></label><label className="check-row"><input type="checkbox" checked={staffForm.published} onChange={(e) => setStaffForm({ ...staffForm, published: e.target.checked })} /> Publicar en el sitio</label><button className="button button-primary" disabled={busy}><Check /> Guardar integrante</button></form>}
      {editor === 'schedules' && <form className="stack-form" onSubmit={saveSchedule}><label>Categoría<select value={scheduleForm.category_id} onChange={(e) => setScheduleForm({ ...scheduleForm, category_id: e.target.value })} required><option value="">Seleccionar</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Día<select value={scheduleForm.day_of_week} onChange={(e) => setScheduleForm({ ...scheduleForm, day_of_week: e.target.value })}>{days.slice(1).map((day, index) => <option value={index + 1} key={day}>{day}</option>)}</select></label><div className="form-grid"><label>Inicio<input type="time" value={scheduleForm.start_time} onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })} required /></label><label>Fin<input type="time" value={scheduleForm.end_time} onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })} required /></label></div><label>Lugar<input value={scheduleForm.location} onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })} /></label><label className="check-row"><input type="checkbox" checked={scheduleForm.published} onChange={(e) => setScheduleForm({ ...scheduleForm, published: e.target.checked })} /> Publicar en el sitio</label><button className="button button-primary" disabled={busy}><Save /> Guardar horario</button></form>}
    </div></div>}
  </div>
}

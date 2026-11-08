import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, Clock3, Facebook, Instagram, MapPin, Menu, Phone, ShieldCheck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category, NewsItem, SiteSettings } from '../lib/types'

type StaffMember = { id: string; full_name: string; position: string; bio: string | null; photo_path: string | null }
type Schedule = { id: string; day_of_week: number; start_time: string; end_time: string; location: string | null; categories: { name: string } | null }
type Page = { id: string; slug: string; title: string; content: { body?: string } }

const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const fallbackSettings: SiteSettings = {
  id: '', academy_name: 'Academia de Futsal Piribebuy', motto: 'Formando talentos, construyendo futuro.',
  hero_text: 'Formación deportiva, disciplina, compañerismo y desarrollo integral.', mission: '', vision: '', values_text: '',
  phone: null, whatsapp: null, email: null, address: null, instagram_url: null, facebook_url: null, enrollment_open: false,
}

export default function PublicSite() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [settings, setSettings] = useState<SiteSettings>(fallbackSettings)
  const [categories, setCategories] = useState<Category[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [settingsResult, categoriesResult, newsResult, staffResult, schedulesResult, pagesResult] = await Promise.all([
        supabase.from('site_settings').select('*').limit(1).maybeSingle(),
        supabase.from('categories').select('*').order('display_order'),
        supabase.from('news').select('*').eq('status', 'published').order('pinned', { ascending: false }).order('published_at', { ascending: false }).limit(6),
        supabase.from('staff').select('id,full_name,position,bio,photo_path').eq('published', true).order('display_order'),
        supabase.from('training_schedules').select('id,day_of_week,start_time,end_time,location,categories(name)').eq('published', true).order('day_of_week'),
        supabase.from('site_pages').select('id,slug,title,content').eq('status', 'published').order('display_order'),
      ])
      if (settingsResult.data) setSettings(settingsResult.data as SiteSettings)
      setCategories((categoriesResult.data ?? []) as Category[])
      setNews((newsResult.data ?? []) as NewsItem[])
      setStaff((staffResult.data ?? []) as StaffMember[])
      setSchedules((schedulesResult.data ?? []) as unknown as Schedule[])
      setPages((pagesResult.data ?? []) as Page[])
      setLoading(false)
    }
    void load()
  }, [])

  const pageBySlug = useMemo(() => new Map(pages.map((page) => [page.slug, page])), [pages])
  const whatsappHref = settings.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/\D/g, '')}` : '#contacto'

  return (
    <div className="public-site">
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#inicio" aria-label="Ir al inicio">
            <img src="/logo.png" alt="Escudo de la Academia de Futsal Piribebuy" />
            <span><strong>Academia de Futsal</strong><small>Piribebuy</small></span>
          </a>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menú" aria-expanded={menuOpen}>
            {menuOpen ? <X /> : <Menu />}
          </button>
          <nav className={menuOpen ? 'nav-open' : ''} aria-label="Navegación principal">
            <a href="#academia" onClick={() => setMenuOpen(false)}>Academia</a>
            <a href="#categorias" onClick={() => setMenuOpen(false)}>Categorías</a>
            <a href="#equipo" onClick={() => setMenuOpen(false)}>Equipo</a>
            <a href="#noticias" onClick={() => setMenuOpen(false)}>Noticias</a>
            <a href="#contacto" onClick={() => setMenuOpen(false)}>Contacto</a>
            <Link className="admin-link" to="/admin">Administración</Link>
          </nav>
        </div>
      </header>

      <main>
        <section id="inicio" className="hero">
          <div className="hero-mark" aria-hidden="true">AFP</div>
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">Piribebuy · Paraguay</span>
              <h1>{settings.academy_name}</h1>
              <p className="motto">{settings.motto}</p>
              <p className="hero-text">{settings.hero_text}</p>
              <div className="hero-actions">
                <a className="button button-gold" href="#academia">Conocé la academia <ChevronRight size={18} /></a>
                <a className="button button-ghost" href="#categorias">Nuestras categorías</a>
              </div>
            </div>
            <div className="hero-emblem">
              <div className="emblem-ring"><img src="/logo.png" alt="Escudo oficial" /></div>
              <div className="hero-principles"><span>Disciplina</span><span>Formación</span><span>Equipo</span></div>
            </div>
          </div>
        </section>

        <section id="academia" className="section section-light">
          <div className="container split-section">
            <div>
              <span className="section-kicker">Nuestra identidad</span>
              <h2>Formación que trasciende la cancha</h2>
              <p className="lead">{pageBySlug.get('nuestra-academia')?.content?.body ?? settings.hero_text}</p>
              <div className="principle-grid">
                <article><ShieldCheck /><h3>Misión</h3><p>{settings.mission || 'Información institucional pendiente de publicación.'}</p></article>
                <article><ShieldCheck /><h3>Visión</h3><p>{settings.vision || 'Información institucional pendiente de publicación.'}</p></article>
              </div>
            </div>
            <aside className="values-panel">
              <span>Valores de la Academia</span>
              <strong>{settings.values_text || 'Disciplina · Respeto · Compañerismo · Compromiso'}</strong>
              <p>Un entorno organizado para acompañar el desarrollo deportivo y humano.</p>
            </aside>
          </div>
        </section>

        <section id="categorias" className="section categories-section">
          <div className="container">
            <div className="section-heading inverse">
              <div><span className="section-kicker">Etapas formativas</span><h2>Categorías</h2></div>
              <p>La asignación definitiva considera temporada, fecha de corte y criterio técnico.</p>
            </div>
            <div className="category-grid">
              {categories.map((category, index) => (
                <article className="category-card" key={category.id}>
                  <span className="category-number">{String(index + 1).padStart(2, '0')}</span>
                  <small>{category.code}</small><h3>{category.name}</h3>
                  <p>{category.description || 'Información específica disponible mediante la administración de la Academia.'}</p>
                </article>
              ))}
              {!loading && categories.length === 0 && <p className="empty inverse-text">Las categorías serán publicadas próximamente.</p>}
            </div>
          </div>
        </section>

        <section id="equipo" className="section section-light">
          <div className="container">
            <div className="section-heading"><div><span className="section-kicker">Profesionales</span><h2>Cuerpo técnico</h2></div></div>
            {staff.length > 0 ? <div className="staff-grid">{staff.map((member) => (
              <article className="staff-card" key={member.id}>
                {member.photo_path ? <img src={supabase.storage.from('site-public').getPublicUrl(member.photo_path).data.publicUrl} alt={member.full_name} /> : <div className="staff-placeholder">AFP</div>}
                <div><small>{member.position}</small><h3>{member.full_name}</h3>{member.bio && <p>{member.bio}</p>}</div>
              </article>
            ))}</div> : <div className="empty-panel">El cuerpo técnico será publicado cuando la Academia complete la información oficial.</div>}
          </div>
        </section>

        <section className="section schedule-section">
          <div className="container">
            <div className="section-heading"><div><span className="section-kicker">Organización semanal</span><h2>Horarios de entrenamiento</h2></div></div>
            {schedules.length > 0 ? <div className="schedule-list">{schedules.map((schedule) => (
              <article key={schedule.id}><CalendarDays /><div><strong>{schedule.categories?.name}</strong><span>{days[schedule.day_of_week]}</span></div><div><Clock3 /><span>{schedule.start_time.slice(0, 5)}–{schedule.end_time.slice(0, 5)}</span></div><small>{schedule.location || 'Lugar a confirmar'}</small></article>
            ))}</div> : <div className="empty-panel">Los horarios oficiales serán publicados por la administración.</div>}
          </div>
        </section>

        <section id="noticias" className="section section-light">
          <div className="container">
            <div className="section-heading"><div><span className="section-kicker">Actualidad institucional</span><h2>Noticias y actividades</h2></div></div>
            {news.length > 0 ? <div className="news-grid">{news.map((item) => (
              <article className="news-card" key={item.id}>
                <div className="news-meta">{item.published_at ? new Intl.DateTimeFormat('es-PY', { dateStyle: 'long' }).format(new Date(item.published_at)) : 'Comunicado'}</div>
                <h3>{item.title}</h3><p>{item.excerpt || item.content.slice(0, 150)}</p>
              </article>
            ))}</div> : <div className="empty-panel">No hay noticias publicadas en este momento.</div>}
          </div>
        </section>

        <section id="contacto" className="contact-section">
          <div className="container contact-grid">
            <div><span className="section-kicker">Inscripciones y consultas</span><h2>Sumate a la Academia</h2><p>{pageBySlug.get('inscripciones')?.content?.body ?? 'Consultá los requisitos y canales oficiales habilitados.'}</p></div>
            <div className="contact-card">
              {settings.phone && <a href={`tel:${settings.phone}`}><Phone /><span><small>Teléfono</small>{settings.phone}</span></a>}
              {settings.address && <div><MapPin /><span><small>Ubicación</small>{settings.address}</span></div>}
              {settings.enrollment_open && settings.whatsapp ? <a className="button button-gold" href={whatsappHref} target="_blank" rel="noreferrer">Consultar por WhatsApp</a> : <p className="contact-note">Las inscripciones se habilitan y comunican por canales oficiales.</p>}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand"><img src="/logo.png" alt="" /><span><strong>Academia de Futsal</strong><small>Piribebuy · Paraguay</small></span></div>
          <p>Formación deportiva con identidad, disciplina y compromiso.</p>
          <div className="social-links">
            {settings.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram /></a>}
            {settings.facebook_url && <a href={settings.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook /></a>}
          </div>
        </div>
      </footer>
    </div>
  )
}

import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BookOpenText, LayoutDashboard, LogOut, Menu, Settings2, UsersRound, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Dashboard from './Dashboard'
import PlayersModule from './PlayersModule'
import ContentModule from './ContentModule'
import SettingsModule from './SettingsModule'

type Section = 'dashboard' | 'players' | 'content' | 'settings'

const navItems: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
  { id: 'players', label: 'Jugadores', icon: UsersRound },
  { id: 'content', label: 'Contenido', icon: BookOpenText },
  { id: 'settings', label: 'Configuración', icon: Settings2 },
]

export default function AdminShell({ session, role }: { session: Session; role: string }) {
  const [section, setSection] = useState<Section>('dashboard')
  const [sidebar, setSidebar] = useState(false)

  const go = (id: Section) => { setSection(id); setSidebar(false) }

  return <div className="admin-app">
    <aside className={sidebar ? 'admin-sidebar open' : 'admin-sidebar'}>
      <div className="sidebar-brand"><img src="/logo.png" alt="" /><span><strong>Academia de Futsal</strong><small>Gestión deportiva</small></span><button onClick={() => setSidebar(false)} aria-label="Cerrar menú"><X /></button></div>
      <nav>{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => go(item.id)}><Icon />{item.label}</button> })}</nav>
      <div className="sidebar-user"><div className="avatar">{session.user.email?.slice(0, 1).toUpperCase()}</div><div><strong>{session.user.email}</strong><small>{role.replace('_', ' ')}</small></div></div>
      <button className="logout-button" onClick={() => supabase.auth.signOut()}><LogOut /> Cerrar sesión</button>
    </aside>
    {sidebar && <button className="sidebar-backdrop" onClick={() => setSidebar(false)} aria-label="Cerrar menú" />}
    <div className="admin-main">
      <header className="admin-topbar"><button className="mobile-sidebar-toggle" onClick={() => setSidebar(true)} aria-label="Abrir menú"><Menu /></button><div><span>Panel administrativo</span><strong>{navItems.find((item) => item.id === section)?.label}</strong></div><a href="/" target="_blank" rel="noreferrer">Ver sitio público</a></header>
      <main className="admin-content">
        {section === 'dashboard' && <Dashboard onNavigate={go} />}
        {section === 'players' && <PlayersModule />}
        {section === 'content' && <ContentModule />}
        {section === 'settings' && <SettingsModule />}
      </main>
    </div>
  </div>
}

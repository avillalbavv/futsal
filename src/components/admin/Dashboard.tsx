import { useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, FileClock, UserCheck, UsersRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Stats = { total: number; active: number; inactive: number; documentsPending: number }

export default function Dashboard({ onNavigate }: { onNavigate: (section: 'players' | 'content' | 'settings' | 'dashboard') => void }) {
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, documentsPending: 0 })
  const [recent, setRecent] = useState<Array<{ id: string; first_names: string; last_names: string; registration_date: string }>>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [total, active, inactive, documents, recentPlayers] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }).is('archived_at', null),
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('status', 'active').is('archived_at', null),
      supabase.from('players').select('*', { count: 'exact', head: true }).neq('status', 'active').is('archived_at', null),
      supabase.from('player_documents').select('*', { count: 'exact', head: true }).eq('verified', false),
      supabase.from('players').select('id,first_names,last_names,registration_date').is('archived_at', null).order('created_at', { ascending: false }).limit(5),
    ])
    setStats({ total: total.count ?? 0, active: active.count ?? 0, inactive: inactive.count ?? 0, documentsPending: documents.count ?? 0 })
    setRecent(recentPlayers.data ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  return <div className="admin-page">
    <div className="page-heading"><div><span>Información en tiempo real</span><h1>Resumen de la Academia</h1></div><button className="button button-primary" onClick={() => onNavigate('players')}>Registrar jugador</button></div>
    <div className="stat-grid">
      <article><div className="stat-icon red"><UsersRound /></div><span>Total de jugadores</span><strong>{loading ? '—' : stats.total}</strong></article>
      <article><div className="stat-icon green"><UserCheck /></div><span>Jugadores activos</span><strong>{loading ? '—' : stats.active}</strong></article>
      <article><div className="stat-icon gray"><AlertCircle /></div><span>Inactivos o suspendidos</span><strong>{loading ? '—' : stats.inactive}</strong></article>
      <article><div className="stat-icon gold"><FileClock /></div><span>Documentos por verificar</span><strong>{loading ? '—' : stats.documentsPending}</strong></article>
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><span>Últimos registros</span><h2>Inscripciones recientes</h2></div><button onClick={() => onNavigate('players')}>Ver todos <ArrowRight /></button></div>
        {recent.length ? <div className="recent-list">{recent.map((player) => <div key={player.id}><div className="avatar small">{player.first_names[0]}{player.last_names[0]}</div><span><strong>{player.first_names} {player.last_names}</strong><small>Inscripción: {new Intl.DateTimeFormat('es-PY').format(new Date(`${player.registration_date}T12:00:00`))}</small></span></div>)}</div> : <div className="panel-empty">Todavía no hay jugadores registrados.</div>}
      </section>
      <section className="panel quick-actions"><div className="panel-heading"><div><span>Gestión diaria</span><h2>Accesos rápidos</h2></div></div><button onClick={() => onNavigate('players')}>Registrar o buscar jugadores <ArrowRight /></button><button onClick={() => onNavigate('content')}>Publicar una noticia <ArrowRight /></button><button onClick={() => onNavigate('settings')}>Configurar temporada <ArrowRight /></button></section>
    </div>
  </div>
}

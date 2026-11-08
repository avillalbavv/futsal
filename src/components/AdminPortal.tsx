import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { KeyRound, LoaderCircle, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AdminShell from './admin/AdminShell'

type RoleRecord = { role: string; active: boolean }

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message)
    setBusy(false)
  }

  const recover = async () => {
    if (!email) return setMessage('Ingresá tu correo para recuperar la contraseña.')
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin` })
    setMessage(error ? error.message : 'Revisá tu correo. Te enviamos un enlace seguro.')
    setBusy(false)
  }

  return <div className="auth-screen"><div className="auth-panel">
    <a href="/" className="auth-brand"><img src="/logo.png" alt="Escudo" /><span><strong>Academia de Futsal</strong><small>Administración segura</small></span></a>
    <div className="auth-icon"><LockKeyhole /></div><h1>Ingresar al panel</h1><p>Acceso exclusivo para personal autorizado.</p>
    <form onSubmit={signIn}>
      <label>Correo electrónico<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
      <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
      {message && <div className="form-message">{message}</div>}
      <button className="button button-primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : 'Ingresar'}</button>
      <button type="button" className="text-button" onClick={recover} disabled={busy}>Recuperar contraseña</button>
    </form>
    <div className="security-note"><ShieldCheck /> Acceso protegido por autenticación y rol administrativo.</div>
  </div></div>
}

function PasswordUpdate({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 10) return setMessage('Usá al menos 10 caracteres.')
    const { error } = await supabase.auth.updateUser({ password })
    setMessage(error ? error.message : 'Contraseña actualizada correctamente.')
    if (!error) setTimeout(onDone, 900)
  }
  return <div className="auth-screen"><div className="auth-panel"><KeyRound className="auth-large-icon" /><h1>Nueva contraseña</h1><form onSubmit={save}><label>Contraseña nueva<input type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>{message && <div className="form-message">{message}</div>}<button className="button button-primary full">Guardar contraseña</button></form></div></div>
}

function AccessPending({ session }: { session: Session }) {
  return <div className="auth-screen"><div className="auth-panel"><div className="auth-icon"><LockKeyhole /></div><h1>Acceso pendiente</h1><p>La cuenta <strong>{session.user.email}</strong> está autenticada, pero todavía no tiene un rol administrativo activo.</p><p className="muted">Un superadministrador debe habilitarla. No se permite el autorregistro de administradores.</p><button className="button button-secondary full" onClick={() => supabase.auth.signOut()}><LogOut size={17} /> Cerrar sesión</button></div></div>
}

export default function AdminPortal() {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<RoleRecord | null | undefined>(undefined)
  const [recovery, setRecovery] = useState(false)
  const navigate = useNavigate()

  const checkAccess = async (currentSession: Session) => {
    const { data: roleData } = await supabase.from('user_roles').select('role,active').eq('user_id', currentSession.user.id).maybeSingle()
    setRole((roleData as RoleRecord | null) ?? null)
  }

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) void checkAccess(data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (!nextSession) { setRole(undefined); navigate('/admin') }
      else if (event === 'SIGNED_IN') setTimeout(() => void checkAccess(nextSession), 0)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (recovery && session) return <PasswordUpdate onDone={() => setRecovery(false)} />
  if (!session) return <Login />
  if (role === undefined) return <div className="loading-screen"><LoaderCircle className="spin" /><span>Verificando acceso…</span></div>
  if (!role?.active) return <AccessPending session={session} />
  return <Routes><Route path="/*" element={<AdminShell session={session} role={role.role} />} /><Route path="*" element={<Navigate to="/admin" replace />} /></Routes>
}

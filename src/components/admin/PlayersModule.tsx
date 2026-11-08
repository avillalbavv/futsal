import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Download, Eye, FileDown, FileUp, Filter, LoaderCircle, Plus, Search, Upload, X } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { calculateAge, normalizeCedula, supabase } from '../../lib/supabase'
import type { Category, Player, Season } from '../../lib/types'

type FormState = {
  first_names: string; last_names: string; cedula: string; birth_date: string; registration_date: string; status: Player['status']; notes: string
  guardian_name: string; guardian_phone: string; emergency_phone: string; relationship: string
  category_id: string; season_id: string; category_override_reason: string; data_consent: boolean; image_consent: boolean
}
type DocumentRow = { id: string; document_type: string; storage_path: string; original_name: string; verified: boolean }
type GuardianRow = { relationship: string; guardians: { full_name: string; phone: string; emergency_phone: string | null } | null }

const emptyForm = (): FormState => ({ first_names: '', last_names: '', cedula: '', birth_date: '', registration_date: new Date().toISOString().slice(0, 10), status: 'active', notes: '', guardian_name: '', guardian_phone: '', emergency_phone: '', relationship: 'Padre/Madre/Tutor', category_id: '', season_id: '', category_override_reason: '', data_consent: false, image_consent: false })
const statusLabels: Record<string, string> = { active: 'Activo', inactive: 'Inactivo', suspended: 'Suspendido', graduated: 'Egresado' }
const documentLabels: Record<string, string> = { profile_photo: 'Foto tipo carné', id_front: 'Cédula (anverso)', id_back: 'Cédula (reverso)', guardian_authorization: 'Autorización del tutor', image_consent: 'Autorización de imagen' }

export default function PlayersModule() {
  const [players, setPlayers] = useState<Player[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<Player | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [guardians, setGuardians] = useState<GuardianRow[]>([])
  const importRef = useRef<HTMLInputElement>(null)

  const loadReference = async () => {
    const [categoryResult, seasonResult] = await Promise.all([
      supabase.from('categories').select('*').order('display_order'),
      supabase.from('seasons').select('*').order('start_date', { ascending: false }),
    ])
    setCategories((categoryResult.data ?? []) as Category[])
    setSeasons((seasonResult.data ?? []) as Season[])
  }

  const loadPlayers = async () => {
    setLoading(true)
    let query = supabase.from('players').select('*,enrollments(id,category_id,season_id,status,categories(id,name,code),seasons(id,name))').is('archived_at', null).order('created_at', { ascending: false }).limit(250)
    if (statusFilter) query = query.eq('status', statusFilter)
    const safeSearch = search.trim().replace(/[%(),]/g, '')
    if (safeSearch) query = query.or(`first_names.ilike.%${safeSearch}%,last_names.ilike.%${safeSearch}%,cedula_normalized.ilike.%${normalizeCedula(safeSearch)}%`)
    const { data, error } = await query
    if (error) setMessage(error.message)
    let result = (data ?? []) as unknown as Player[]
    if (categoryFilter) result = result.filter((player) => player.enrollments?.some((enrollment) => enrollment.category_id === categoryFilter && enrollment.status === 'active'))
    setPlayers(result); setLoading(false)
  }

  useEffect(() => { void loadReference() }, [])
  useEffect(() => { const timer = setTimeout(() => void loadPlayers(), 250); return () => clearTimeout(timer) }, [search, categoryFilter, statusFilter])

  const categoryName = (player: Player) => player.enrollments?.find((item) => item.status === 'active')?.categories?.name ?? 'Sin categoría'

  const openPlayer = async (player: Player) => {
    setSelected(player)
    const [documentResult, guardianResult] = await Promise.all([
      supabase.from('player_documents').select('id,document_type,storage_path,original_name,verified').eq('player_id', player.id).order('created_at'),
      supabase.from('player_guardians').select('relationship,guardians(full_name,phone,emergency_phone)').eq('player_id', player.id),
    ])
    setDocuments((documentResult.data ?? []) as DocumentRow[])
    setGuardians((guardianResult.data ?? []) as unknown as GuardianRow[])
  }

  const savePlayer = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('')
    if (!form.data_consent) { setSaving(false); return setMessage('La autorización de inscripción y tratamiento de datos es obligatoria.') }
    if (!form.category_id || !form.season_id) { setSaving(false); return setMessage('Seleccioná una categoría y una temporada.') }
    const playerInsert = await supabase.from('players').insert({ first_names: form.first_names.trim(), last_names: form.last_names.trim(), cedula_normalized: normalizeCedula(form.cedula), birth_date: form.birth_date, registration_date: form.registration_date, status: form.status, notes: form.notes || null }).select().single()
    if (playerInsert.error) { setSaving(false); return setMessage(playerInsert.error.code === '23505' ? 'Ya existe un jugador con esa cédula.' : playerInsert.error.message) }
    const playerId = playerInsert.data.id
    const guardianInsert = await supabase.from('guardians').insert({ full_name: form.guardian_name.trim(), phone: form.guardian_phone.trim(), emergency_phone: form.emergency_phone.trim() || null }).select().single()
    if (guardianInsert.error) { setSaving(false); return setMessage(`El jugador fue creado, pero el tutor no pudo guardarse: ${guardianInsert.error.message}`) }
    const [relation, enrollment, consentData, consentImage] = await Promise.all([
      supabase.from('player_guardians').insert({ player_id: playerId, guardian_id: guardianInsert.data.id, relationship: form.relationship, primary_contact: true }),
      supabase.from('enrollments').insert({ player_id: playerId, category_id: form.category_id, season_id: form.season_id, category_override_reason: form.category_override_reason || null }),
      supabase.from('consents').insert({ player_id: playerId, guardian_id: guardianInsert.data.id, consent_type: 'enrollment_data', granted: true, text_version: 'v1-2026' }),
      supabase.from('consents').insert({ player_id: playerId, guardian_id: guardianInsert.data.id, consent_type: 'image_publication', granted: form.image_consent, text_version: 'v1-2026' }),
    ])
    const firstError = [relation.error, enrollment.error, consentData.error, consentImage.error].find(Boolean)
    setSaving(false)
    if (firstError) setMessage(`Registro creado con una advertencia: ${firstError.message}`)
    else { setMessage('Jugador registrado correctamente.'); setForm(emptyForm()); setFormOpen(false) }
    await loadPlayers()
  }

  const updateStatus = async (player: Player, status: Player['status']) => {
    const { error } = await supabase.from('players').update({ status }).eq('id', player.id)
    if (error) return setMessage(error.message)
    setSelected({ ...player, status }); await loadPlayers()
  }

  const archive = async (player: Player) => {
    if (!window.confirm(`¿Archivar el registro de ${player.first_names} ${player.last_names}?`)) return
    const { error } = await supabase.from('players').update({ archived_at: new Date().toISOString(), status: 'inactive' }).eq('id', player.id)
    if (error) return setMessage(error.message)
    setSelected(null); await loadPlayers()
  }

  const uploadDocument = async (event: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = event.target.files?.[0]
    if (!file || !selected) return
    if (file.size > 10 * 1024 * 1024) return setMessage('El archivo supera el límite de 10 MB.')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const path = `${selected.id}/${type}/${crypto.randomUUID()}-${safeName}`
    const upload = await supabase.storage.from('player-private').upload(path, file, { contentType: file.type, upsert: false })
    if (upload.error) return setMessage(upload.error.message)
    const metadata = await supabase.from('player_documents').insert({ player_id: selected.id, document_type: type, storage_path: path, original_name: file.name, mime_type: file.type, size_bytes: file.size })
    if (metadata.error) return setMessage(metadata.error.message)
    setMessage('Documento cargado de forma privada.'); await openPlayer(selected)
  }

  const viewDocument = async (document: DocumentRow) => {
    const { data, error } = await supabase.storage.from('player-private').createSignedUrl(document.storage_path, 60)
    if (error) return setMessage(error.message)
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const generatePdf = async (player: Player) => {
    const pdf = new jsPDF({ format: 'a4', unit: 'mm' })
    const logo = await fetch('/logo.png').then((response) => response.blob()).then((blob) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(blob) }))
    pdf.addImage(logo, 'PNG', 15, 12, 28, 28)
    pdf.setTextColor(142, 13, 24); pdf.setFontSize(18); pdf.setFont('helvetica', 'bold'); pdf.text('ACADEMIA DE FUTSAL PIRIBEBUY', 50, 22)
    pdf.setTextColor(50, 50, 50); pdf.setFontSize(11); pdf.text('Ficha individual de inscripción', 50, 30)
    pdf.setDrawColor(190, 147, 40); pdf.line(15, 45, 195, 45)
    const rows = [
      ['Jugador', `${player.first_names} ${player.last_names}`], ['Cédula', player.cedula_normalized], ['Fecha de nacimiento', player.birth_date], ['Edad actual', `${calculateAge(player.birth_date)} años`], ['Categoría', categoryName(player)], ['Estado', statusLabels[player.status]], ['Fecha de inscripción', player.registration_date], ['Responsable', guardians[0]?.guardians?.full_name ?? '—'], ['Contacto', guardians[0]?.guardians?.phone ?? '—'],
    ]
    let y = 58; pdf.setFontSize(10)
    rows.forEach(([label, value]) => { pdf.setFont('helvetica', 'bold'); pdf.text(label, 18, y); pdf.setFont('helvetica', 'normal'); pdf.text(value, 70, y); pdf.setDrawColor(225); pdf.line(18, y + 3, 192, y + 3); y += 11 })
    pdf.text('Firma del responsable: __________________________', 18, 175); pdf.text('Firma administrativa: __________________________', 110, 175)
    pdf.setFontSize(8); pdf.setTextColor(110); pdf.text('Documento de uso administrativo. Contiene datos personales protegidos.', 105, 286, { align: 'center' })
    pdf.save(`ficha-${player.cedula_normalized}.pdf`)
  }

  const exportCsv = () => {
    const header = ['nombres', 'apellidos', 'cedula', 'fecha_nacimiento', 'edad', 'categoria', 'estado', 'fecha_inscripcion']
    const lines = players.map((player) => [player.first_names, player.last_names, player.cedula_normalized, player.birth_date, calculateAge(player.birth_date), categoryName(player), statusLabels[player.status], player.registration_date].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    const blob = new Blob([`\uFEFF${header.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `jugadores-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return
    const text = await file.text(); const [headerLine, ...lines] = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
    const headers = headerLine.toLowerCase().split(',').map((item) => item.trim().replaceAll('"', ''))
    const required = ['nombres', 'apellidos', 'cedula', 'fecha_nacimiento']
    if (!required.every((key) => headers.includes(key))) return setMessage('El CSV debe incluir: nombres, apellidos, cedula y fecha_nacimiento.')
    const records = lines.map((line) => { const values = line.split(',').map((item) => item.trim().replace(/^"|"$/g, '')); const get = (key: string) => values[headers.indexOf(key)] || ''; return { first_names: get('nombres'), last_names: get('apellidos'), cedula_normalized: normalizeCedula(get('cedula')), birth_date: get('fecha_nacimiento'), registration_date: get('fecha_inscripcion') || new Date().toISOString().slice(0, 10), status: ['active','inactive','suspended','graduated'].includes(get('estado')) ? get('estado') : 'active' } })
    const { error } = await supabase.from('players').upsert(records, { onConflict: 'cedula_normalized', ignoreDuplicates: true })
    setMessage(error ? error.message : `${records.length} fila(s) procesadas. Los duplicados se conservaron sin cambios.`); event.target.value = ''; await loadPlayers()
  }

  const activeEnrollment = useMemo(() => selected?.enrollments?.find((item) => item.status === 'active'), [selected])

  return <div className="admin-page">
    <div className="page-heading"><div><span>Padrón deportivo</span><h1>Jugadores</h1></div><div className="heading-actions"><input ref={importRef} hidden type="file" accept=".csv,text/csv" onChange={importCsv} /><button className="button button-secondary" onClick={() => importRef.current?.click()}><FileUp /> Importar CSV</button><button className="button button-secondary" onClick={exportCsv}><FileDown /> Exportar</button><button className="button button-primary" onClick={() => setFormOpen(true)}><Plus /> Registrar jugador</button></div></div>
    {message && <div className="notice-bar"><span>{message}</span><button onClick={() => setMessage('')}><X /></button></div>}
    <div className="filter-bar"><label className="search-box"><Search /><input placeholder="Buscar por nombre, apellido o cédula" value={search} onChange={(e) => setSearch(e.target.value)} /></label><label><Filter /><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="">Todas las categorías</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="suspended">Suspendidos</option><option value="graduated">Egresados</option></select></label></div>
    <div className="data-panel">{loading ? <div className="panel-empty"><LoaderCircle className="spin" /> Cargando jugadores…</div> : players.length ? <><div className="table-wrap"><table><thead><tr><th>Jugador</th><th>Cédula</th><th>Edad</th><th>Categoría</th><th>Estado</th><th></th></tr></thead><tbody>{players.map((player) => <tr key={player.id}><td><div className="person-cell"><div className="avatar small">{player.first_names[0]}{player.last_names[0]}</div><strong>{player.last_names}, {player.first_names}</strong></div></td><td>{player.cedula_normalized}</td><td>{calculateAge(player.birth_date)}</td><td>{categoryName(player)}</td><td><span className={`status ${player.status}`}>{statusLabels[player.status]}</span></td><td><button className="icon-text-button" onClick={() => void openPlayer(player)}><Eye /> Ver ficha</button></td></tr>)}</tbody></table></div><div className="mobile-player-list">{players.map((player) => <button key={player.id} onClick={() => void openPlayer(player)}><div className="avatar">{player.first_names[0]}{player.last_names[0]}</div><span><strong>{player.first_names} {player.last_names}</strong><small>{categoryName(player)} · {calculateAge(player.birth_date)} años</small></span><span className={`status ${player.status}`}>{statusLabels[player.status]}</span></button>)}</div></> : <div className="panel-empty">No se encontraron jugadores con esos filtros.</div>}</div>

    {formOpen && <div className="modal-backdrop"><div className="modal large-modal"><div className="modal-heading"><div><span>Nuevo registro</span><h2>Registrar jugador</h2></div><button onClick={() => setFormOpen(false)}><X /></button></div><form onSubmit={savePlayer} className="player-form">
      <fieldset><legend>Datos personales</legend><div className="form-grid"><label>Nombres *<input value={form.first_names} onChange={(e) => setForm({ ...form, first_names: e.target.value })} required /></label><label>Apellidos *<input value={form.last_names} onChange={(e) => setForm({ ...form, last_names: e.target.value })} required /></label><label>Cédula *<input inputMode="numeric" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} required /></label><label>Fecha de nacimiento *<input type="date" max={new Date().toISOString().slice(0, 10)} value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} required /></label><label>Fecha de inscripción *<input type="date" value={form.registration_date} onChange={(e) => setForm({ ...form, registration_date: e.target.value })} required /></label><label>Estado<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Player['status'] })}><option value="active">Activo</option><option value="inactive">Inactivo</option><option value="suspended">Suspendido</option><option value="graduated">Egresado</option></select></label></div></fieldset>
      <fieldset><legend>Responsable legal</legend><div className="form-grid"><label className="span-2">Nombre y apellido *<input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} required /></label><label>Teléfono *<input type="tel" value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} required /></label><label>Contacto de emergencia<input type="tel" value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} /></label><label>Relación<input value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} required /></label></div></fieldset>
      <fieldset><legend>Inscripción deportiva</legend><div className="form-grid"><label>Categoría *<select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required><option value="">Seleccionar</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Temporada *<select value={form.season_id} onChange={(e) => setForm({ ...form, season_id: e.target.value })} required><option value="">Seleccionar</option>{seasons.filter((season) => season.active).map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label><label className="span-2">Motivo de ajuste manual de categoría<input value={form.category_override_reason} onChange={(e) => setForm({ ...form, category_override_reason: e.target.value })} placeholder="Solo si difiere de la sugerencia por edad" /></label><label className="span-2">Observaciones internas<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label></div></fieldset>
      <fieldset><legend>Autorizaciones</legend><label className="check-row"><input type="checkbox" checked={form.data_consent} onChange={(e) => setForm({ ...form, data_consent: e.target.checked })} /> El responsable autoriza la inscripción y el tratamiento administrativo de los datos. *</label><label className="check-row"><input type="checkbox" checked={form.image_consent} onChange={(e) => setForm({ ...form, image_consent: e.target.checked })} /> El responsable autoriza por separado la publicación de imágenes.</label></fieldset>
      {message && <div className="form-message">{message}</div>}<div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving || seasons.length === 0}>{saving ? <LoaderCircle className="spin" /> : 'Guardar jugador'}</button></div>{seasons.length === 0 && <p className="inline-warning">Primero creá una temporada activa en Configuración.</p>}
    </form></div></div>}

    {selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="player-drawer" onClick={(e) => e.stopPropagation()}><div className="drawer-heading"><button onClick={() => setSelected(null)}><X /></button></div><div className="player-profile"><div className="avatar large">{selected.first_names[0]}{selected.last_names[0]}</div><div><span className={`status ${selected.status}`}>{statusLabels[selected.status]}</span><h2>{selected.first_names} {selected.last_names}</h2><p>{categoryName(selected)}{activeEnrollment?.seasons?.name ? ` · ${activeEnrollment.seasons.name}` : ''}</p></div></div>
      <div className="profile-actions"><button onClick={() => void generatePdf(selected)}><Download /> Ficha PDF</button><select value={selected.status} onChange={(e) => void updateStatus(selected, e.target.value as Player['status'])}><option value="active">Activo</option><option value="inactive">Inactivo</option><option value="suspended">Suspendido</option><option value="graduated">Egresado</option></select></div>
      <section className="profile-section"><h3>Datos personales</h3><dl><div><dt>Cédula</dt><dd>{selected.cedula_normalized}</dd></div><div><dt>Nacimiento</dt><dd>{selected.birth_date} ({calculateAge(selected.birth_date)} años)</dd></div><div><dt>Inscripción</dt><dd>{selected.registration_date}</dd></div><div><dt>Observaciones</dt><dd>{selected.notes || 'Sin observaciones'}</dd></div></dl></section>
      <section className="profile-section"><h3>Responsable legal</h3>{guardians.length ? guardians.map((row, index) => <dl key={index}><div><dt>{row.relationship}</dt><dd>{row.guardians?.full_name}</dd></div><div><dt>Teléfono</dt><dd>{row.guardians?.phone}</dd></div><div><dt>Emergencia</dt><dd>{row.guardians?.emergency_phone || '—'}</dd></div></dl>) : <p className="muted">Sin responsable vinculado.</p>}</section>
      <section className="profile-section"><h3>Documentación privada</h3><div className="document-list">{documents.map((document) => <button key={document.id} onClick={() => void viewDocument(document)}><Eye /><span><strong>{documentLabels[document.document_type] || document.document_type}</strong><small>{document.original_name} · enlace válido por 60 s</small></span></button>)}</div><div className="upload-grid">{Object.entries(documentLabels).map(([type, label]) => <label key={type}><Upload /> {label}<input hidden type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture={type === 'profile_photo' ? 'user' : 'environment'} onChange={(e) => void uploadDocument(e, type)} /></label>)}</div></section>
      <button className="archive-button" onClick={() => void archive(selected)}><Archive /> Archivar registro</button>
    </aside></div>}
  </div>
}

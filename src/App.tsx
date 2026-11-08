import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import PublicSite from './components/PublicSite'

const AdminPortal = lazy(() => import('./components/AdminPortal'))

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicSite />} />
      <Route path="/admin/*" element={<Suspense fallback={<div className="loading-screen">Cargando administración…</div>}><AdminPortal /></Suspense>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import AgentsPage from '@/pages/AgentsPage'
import RunsPage from '@/pages/RunsPage'
import RunDetailPage from '@/pages/RunDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/runs" replace />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="runs" element={<RunsPage />} />
          <Route path="runs/:runId" element={<RunDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

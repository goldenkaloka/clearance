import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppShell, AdminShell } from './components/Layout'
import AuthPage from './pages/AuthPage'
import Landing from './pages/Landing'
import RegaliaCategoryPage from './pages/RegaliaCategory'
import StudentHome from './pages/student/Home'
import StudentApply from './pages/student/Apply'
import StudentGown from './pages/student/Gown'
import StudentRegalia from './pages/student/Regalia'
import StudentProfile from './pages/student/Profile'
import AgentHome from './pages/agent/Home'
import AgentTaskDetail from './pages/agent/TaskDetail'
import AgentProfile from './pages/agent/Profile'
import AdminDashboard from './pages/admin/Dashboard'
import AdminRequests from './pages/admin/Requests'
import AdminRequestDetail from './pages/admin/RequestDetail'
import AdminAgents from './pages/admin/Agents'
import AdminStudents from './pages/admin/Students'
import AdminStages from './pages/admin/Stages'
import AdminPayments from './pages/admin/Payments'
import AdminGowns from './pages/admin/Gowns'
import AdminRegaliaCatalog from './pages/admin/RegaliaCatalog'
import AdminSettings from './pages/admin/Settings'

function StudentRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/student" element={<StudentHome />} />
        <Route path="/student/apply" element={<StudentApply />} />
        <Route path="/student/gown" element={<StudentGown />} />
        <Route path="/student/regalia" element={<StudentRegalia />} />
        <Route path="/student/profile" element={<StudentProfile />} />
        <Route path="*" element={<Navigate to="/student" replace />} />
      </Routes>
    </AppShell>
  )
}

function AgentRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/agent" element={<AgentHome />} />
        <Route path="/agent/tasks/:taskId" element={<AgentTaskDetail />} />
        <Route path="/agent/profile" element={<AgentProfile />} />
        <Route path="*" element={<Navigate to="/agent" replace />} />
      </Routes>
    </AppShell>
  )
}

function AdminRoutes() {
  return (
    <AdminShell>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/requests" element={<AdminRequests />} />
        <Route path="/admin/requests/:id" element={<AdminRequestDetail />} />
        <Route path="/admin/agents" element={<AdminAgents />} />
        <Route path="/admin/students" element={<AdminStudents />} />
        <Route path="/admin/stages" element={<AdminStages />} />
        <Route path="/admin/payments" element={<AdminPayments />} />
        <Route path="/admin/gowns" element={<AdminGowns />} />
        <Route path="/admin/regalia" element={<AdminRegaliaCatalog />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminShell>
  )
}

function Gate() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  if (!profile) return <Navigate to="/auth" replace />
  if (profile.role === 'admin') return <AdminRoutes />
  if (profile.role === 'agent') return <AgentRoutes />
  return <StudentRoutes />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/regalia/:category" element={<RegaliaCategoryPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/*" element={<Gate />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
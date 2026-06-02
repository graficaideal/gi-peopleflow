import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import EmployeeDetail from './pages/EmployeeDetail'
import Evaluations from './pages/Evaluations'
import EvaluationDetail from './pages/EvaluationDetail'
import Cycles from './pages/Cycles'
import Departments from './pages/Departments'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import EvaluationPublic from './pages/EvaluationPublic'
import { useAuth } from './hooks/useAuth'

function AuthRoute({ children }) {
  const { authorized, loading } = useAuth()
  if (loading) return null
  if (authorized) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="employees" element={<Employees />} />
              <Route path="employees/:id" element={<EmployeeDetail />} />
              <Route path="evaluations" element={<Evaluations />} />
              <Route path="evaluations/:id" element={<EvaluationDetail />} />
              <Route path="cycles" element={<Cycles />} />
              <Route path="departments" element={<Departments />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="/avaliar/:token" element={<EvaluationPublic />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

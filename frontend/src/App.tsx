import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import './App.css'
import Login from './components/Login'
import MathGame from './components/MathGame'
import ParentDashboard from './components/ParentDashboard'
import SkillTreePage from './components/SkillTreePage'
import StudentDashboard from './components/StudentDashboard'
import TeacherDashboard from './components/TeacherDashboard'
import { AuthProvider } from './contexts/AuthContext'

function App() {
  return (
    <AuthProvider>
      <Router basename="/math">
        <div className="App">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/parent" element={<ParentDashboard />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/game" element={<MathGame />} />
            <Route path="/skills" element={<SkillTreePage />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App

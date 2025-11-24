import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import './App.css'
import Home from './components/Home'
import Login from './components/Login'
import MathGame from './components/MathGame'
import ParentDashboard from './components/ParentDashboard'
import ProblemDetailPage from './components/ProblemDetailPage'
import Signup from './components/Signup'
import SkillProblemListPage from './components/SkillProblemListPage'
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
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/parent" element={<ParentDashboard />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/game" element={<MathGame />} />
            <Route path="/demo-session" element={<MathGame />} />
            <Route path="/skills" element={<SkillTreePage />} />
            <Route path="/skill-tree" element={<SkillTreePage />} />
            <Route path="/skills/:skillId/problems" element={<SkillProblemListPage />} />
            <Route path="/problems/:problemId" element={<ProblemDetailPage />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App

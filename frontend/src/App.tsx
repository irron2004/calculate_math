import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import './App.css'
import MathGame from './components/MathGame'
import ParentDashboard from './components/ParentDashboard'
import StudentDashboard from './components/StudentDashboard'
import TeacherDashboard from './components/TeacherDashboard'
import { AuthProvider } from './contexts/AuthContext'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import ProblemDetailPage from './pages/ProblemDetailPage'
import SignupPage from './pages/SignupPage'
import SkillProblemListPage from './pages/SkillProblemListPage'
import CourseSkillTreePage from './pages/CourseSkillTreePage'
import SkillTreePage from './pages/SkillTreePage'

function App() {
  return (
    <AuthProvider>
      <Router basename="/math">
        <div className="App">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/parent" element={<ParentDashboard />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/game" element={<MathGame />} />
            <Route path="/demo-session" element={<MathGame />} />
            <Route path="/skills" element={<SkillTreePage />} />
            <Route path="/skill-tree" element={<SkillTreePage />} />
            <Route path="/course-skill-tree" element={<CourseSkillTreePage />} />
            <Route path="/skills/:skillId/problems" element={<SkillProblemListPage />} />
            <Route path="/problems/:problemId" element={<ProblemDetailPage />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App

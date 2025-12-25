import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Shorts from './pages/Shorts'
import Movies from './pages/Movies'
import Watch from './pages/Watch'
import ContentBrowsing from './pages/ContentBrowsing'
import AdminPanel from './pages/AdminPanel'
import UserProfile from './components/UserProfile'
import Login from './components/Login'
import EditVideo from './pages/EditVideo'
import BecomeCreator from './pages/BecomeCreator'
import Policies from './pages/Policies'
import TermsAgreement from './pages/TermsAgreement'
import './App.css'

function AppContent() {
  const location = useLocation();
  const currentPageName = location.pathname.split('/')[1] || 'Home';

  return (
    <Layout currentPageName={currentPageName}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shorts" element={<Shorts />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/watch" element={<Watch />} />
        <Route path="/content" element={<ContentBrowsing />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/login" element={<Login />} />
        <Route path="/editvideo" element={<EditVideo />} />
        <Route path="/becomecreator" element={<BecomeCreator />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/termsagreement" element={<TermsAgreement />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App

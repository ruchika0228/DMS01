import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Footer from './components/layout/Footer';
import ChatBot from './components/ChatBot';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/UsersPage';
import BlockchainPage from './pages/BlockchainPage';
import ConnectionsPage from './pages/ConnectionsPage';
import DocumentViewPage from './pages/DocumentViewPage';
import ReceivedDocumentsPage from './pages/ReceivedDocumentsPage';
import VaultPage from './pages/VaultPage';
import RedactionPage from './pages/RedactionPage';
import MapView from './pages/MapView';
import AdminDashboard from './pages/AdminDashboard';
import WorkflowDashboard from './pages/WorkflowDashboard';
import CreateDocumentPage from './pages/CreateDocumentPage';
import PendingApprovalsPage from './pages/PendingApprovalsPage';
import api from './api/axios';
import './styles/theme.css';
import './App.css';

// Auth guard: redirect to login if not authenticated
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  if (!user && !token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Admin guard: redirect to dashboard if not admin
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user || !user.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const AppContent = () => {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const location = useLocation();

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    const isAuthPage = location.pathname === '/';
    if (isAuthPage && !token) return;
    if (!token) return;

    // Fetch notifications
    const fetchNotifs = async () => {
      try {
        const res = await api.get('/workflow/notifications');
        setNotifications(res.data);
        const unread = res.data.filter(n => !n.is_read).length;
        setNotifCount(unread);
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // Check every 30 seconds

    const timer = setTimeout(() => {
      import('./utils/geolocation').then(module => {
        module.checkAndSetupLocationCache().catch(err => {
          console.error("Geolocation check failed", err);
        });
      });
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [user, location.pathname]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const isAuthPage = location.pathname === '/';

  return (
    <div className="app">
      <Navbar
        user={user}
        notificationCount={notifCount}
        notifications={notifications}
        onToggleSidebar={toggleSidebar}
        isOpen={isSidebarOpen}
        refreshNotifications={() => {
          // Trigger a re-fetch
          api.get('/workflow/notifications').then(res => {
            setNotifications(res.data);
            setNotifCount(res.data.filter(n => !n.is_read).length);
          });
        }}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
      />

      <main className={`app-content ${isAuthPage ? 'no-padding' : ''} ${isSidebarOpen ? 'content-blur' : ''}`}>
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/workflow" element={<ProtectedRoute><WorkflowDashboard /></ProtectedRoute>} />
          <Route path="/create-document" element={<ProtectedRoute><CreateDocumentPage /></ProtectedRoute>} />
          <Route path="/pending-approvals" element={<ProtectedRoute><PendingApprovalsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/received-documents" element={<ProtectedRoute><ReceivedDocumentsPage /></ProtectedRoute>} />
          <Route path="/vault" element={<ProtectedRoute><VaultPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/blockchain" element={<ProtectedRoute><BlockchainPage /></ProtectedRoute>} />
          <Route path="/connections" element={<ProtectedRoute><ConnectionsPage /></ProtectedRoute>} />
          <Route path="/document-view" element={<ProtectedRoute><DocumentViewPage /></ProtectedRoute>} />
          <Route path="/redaction" element={<ProtectedRoute><RedactionPage /></ProtectedRoute>} />
          <Route path="/map-view" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      {user && !isAuthPage && <ChatBot />}
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;

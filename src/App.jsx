import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentForm from './pages/StudentForm';
import StudentProfile from './pages/StudentProfile';
import StudentImport from './pages/StudentImport';
import Trials from './pages/Trials';
import Members from './pages/Members';
import Attendance from './pages/Attendance';
import Payments from './pages/Payments';
import Arrears from './pages/Arrears';
import Submissions from './pages/Submissions';
import Reports from './pages/Reports';
import Coaches from './pages/Coaches';
import CoachForm from './pages/CoachForm';
import CoachProfile from './pages/CoachProfile';
import Settings from './pages/Settings';
import Search from './pages/Search';
import Landing from './pages/Landing';
import Register from './pages/portal/Register';
import Enter from './pages/portal/Enter';
import PortalLayout from './pages/portal/PortalLayout';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalPayments from './pages/portal/PortalPayments';

function Protected() {
  const { session, profile, loading, signOut } = useAuth();
  if (loading) return <div className="splash">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return (
    <div className="splash" style={{ flexDirection: 'column', gap: 12 }}>
      <div>Akun ini belum punya profil. Hubungi admin.</div>
      <button className="btn" onClick={signOut}>Keluar</button>
    </div>
  );
  return <Layout />;
}
function AdminOnly({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/payments" replace />;
}
const A = (el) => <AdminOnly>{el}</AdminOnly>;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* ===== publik: tanpa login ===== */}
            <Route path="/" element={<Landing />} />
            <Route path="/daftar" element={<Register />} />
            <Route path="/masuk" element={<Enter />} />
            <Route element={<PortalLayout />}>
              <Route path="/anak" element={<PortalDashboard />} />
              <Route path="/anak/pembayaran" element={<PortalPayments />} />
            </Route>
            {/* ===== admin / bendahara: wajib login ===== */}
            <Route path="/login" element={<Login />} />
            <Route element={<Protected />}>
              <Route path="/dashboard" element={A(<Dashboard />)} />
              <Route path="/students" element={A(<Students />)} />
              <Route path="/students/new" element={A(<StudentForm />)} />
              <Route path="/students/import" element={A(<StudentImport />)} />
              <Route path="/students/:id" element={A(<StudentProfile />)} />
              <Route path="/students/:id/edit" element={A(<StudentForm />)} />
              <Route path="/trials" element={A(<Trials />)} />
              <Route path="/attendance" element={A(<Attendance mode="students" />)} />
              <Route path="/coach-attendance" element={A(<Attendance mode="coaches" />)} />
              <Route path="/reports" element={A(<Reports />)} />
              <Route path="/coaches" element={A(<Coaches />)} />
              <Route path="/coaches/new" element={A(<CoachForm />)} />
              <Route path="/coaches/:id" element={A(<CoachProfile />)} />
              <Route path="/coaches/:id/edit" element={A(<CoachForm />)} />
              <Route path="/search" element={A(<Search />)} />
              <Route path="/members" element={<Members />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/payments/arrears" element={<Arrears />} />
              <Route path="/payments/proofs" element={<Submissions />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

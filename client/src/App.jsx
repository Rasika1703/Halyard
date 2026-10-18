import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './Layout';
import AuthPage from './pages/Auth';
import Dashboard from './pages/Dashboard';
import ItemDetail from './pages/ItemDetail';
import Admin from './pages/Admin';
import Board from './pages/Board';
import Profile from './pages/Profile';
import { Skeleton } from './ui';

function Protected({ children, admin }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="p-8"><Skeleton className="h-10 w-64" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
export default function App() {
  const { user, ready } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={ready && user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="work" element={<Dashboard view="all" />} />
        <Route path="my-work" element={<Dashboard view="mine" />} />
        <Route path="profile" element={<Profile />} />
        <Route path="board" element={<Board />} />
        <Route path="items/:id" element={<ItemDetail />} />
        <Route path="admin" element={<Protected admin><Admin /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

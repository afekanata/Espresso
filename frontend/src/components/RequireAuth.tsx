import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { auth } from '@/lib/auth';

// Wrap a route subtree to require auth. Unauthenticated users are bounced to
// /login, with the original location preserved in router state so LoginPage
// can send them back to where they were trying to go.
export function RequireAuth() {
  const location = useLocation();
  if (!auth.isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}

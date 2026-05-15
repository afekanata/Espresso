import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-14 items-center gap-6">
          <h1 className="text-lg font-semibold tracking-tight">Trial Issue Log</h1>
          <nav className="flex gap-1 text-sm">
            <NavTab to="/issues">Issues</NavTab>
            <NavTab to="/dashboard">Dashboard</NavTab>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {auth.username && (
              <span className="text-muted-foreground">{auth.username}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}

function NavTab({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'rounded-md px-3 py-1.5 transition-colors',
          isActive
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {children}
    </NavLink>
  );
}

// Lightweight token store backed by localStorage. For a single-user stub this
// is sufficient; a real prod build would use httpOnly cookies + refresh tokens
// + a server-rendered auth boundary so the token never touches JS.
const TOKEN_KEY = 'til.accessToken';
const USERNAME_KEY = 'til.username';

export const auth = {
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  get username(): string | null {
    return localStorage.getItem(USERNAME_KEY);
  },
  setSession(token: string, username: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USERNAME_KEY, username);
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
  },
  isAuthenticated(): boolean {
    return !!auth.token;
  },
};

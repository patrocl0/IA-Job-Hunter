import { useEffect, useState, type FormEvent } from 'react';
import { LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { api, isPublicDemo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import App from '@/app/App';
type User = { id: string; email: string };
type Session = { user: User | null; registration: boolean };
const announce = () => {
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('jobhunter-auth');
    channel.postMessage('changed');
    channel.close();
  }
};
export function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  async function load() {
    setError('');
    try {
      setSession(await api<Session>('/api/auth/session'));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (isPublicDemo) return;
    void load();
    const expired = () => {
      setSession((current) => (current ? { ...current, user: null } : null));
      setPassword('');
      setConfirmation('');
    };
    window.addEventListener('jobhunter:session-expired', expired);
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('jobhunter-auth') : null;
    if (channel)
      channel.onmessage = () => {
        expired();
        void load();
      };
    return () => {
      window.removeEventListener('jobhunter:session-expired', expired);
      channel?.close();
    };
  }, []);
  if (isPublicDemo) return <App />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (register && password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ user: User }>(`/api/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSession((current) => ({
        user: result.user,
        registration: current?.registration ?? false,
      }));
      setPassword('');
      setConfirmation('');
      announce();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (!window.confirm('¿Cerrar sesión? Los cambios que no hayas guardado se perderán.')) return;
    setError('');
    setBusy(true);
    try {
      await api('/api/auth/logout', { method: 'POST', body: '{}' });
      setSession((current) => (current ? { ...current, user: null } : null));
      setPassword('');
      setConfirmation('');
      announce();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (session?.user)
    return (
      <>
        {error && (
          <p role="alert" className="error p-4">
            {error}
          </p>
        )}
        <App
          key={session.user.id}
          accountEmail={session.user.email}
          onLogout={() => void logout()}
          logoutBusy={busy}
        />
      </>
    );
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <ShieldCheck className="mx-auto mb-4 size-10 text-primary" />
          <p className="text-sm font-medium text-primary">AI Job Hunter</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {register ? 'Tu próximo capítulo.' : 'Bienvenido a tu espacio.'}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Tu perfil, tus oportunidades y tus próximos pasos.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            {error && (
              <p role="alert" className="error mb-4">
                {error}
              </p>
            )}
            {!session ? (
              <div role="status">
                {error ? (
                  <Button onClick={() => void load()}>Reintentar conexión</Button>
                ) : (
                  'Conectando…'
                )}
              </div>
            ) : (
              <form onSubmit={(event) => void submit(event)} className="space-y-5">
                <div>
                  <label htmlFor="auth-email">Correo electrónico</label>
                  <Input
                    id="auth-email"
                    type="email"
                    autoComplete="username"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div>
                  <label htmlFor="auth-password">Contraseña</label>
                  <Input
                    id="auth-password"
                    type="password"
                    autoComplete={register ? 'new-password' : 'current-password'}
                    required
                    minLength={12}
                    maxLength={256}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Al menos 12 caracteres. Puedes usar una frase larga.
                  </p>
                </div>
                {register && (
                  <div>
                    <label htmlFor="auth-confirmation">Repite la contraseña</label>
                    <Input
                      id="auth-confirmation"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                )}
                <Button type="submit" disabled={busy} className="w-full">
                  {register ? <UserPlus size={16} /> : <LogIn size={16} />}{' '}
                  {busy ? 'Un momento…' : register ? 'Crear cuenta' : 'Iniciar sesión'}
                </Button>
                {session.registration && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    disabled={busy}
                    onClick={() => {
                      setRegister(!register);
                      setError('');
                      setPassword('');
                      setConfirmation('');
                    }}
                  >
                    {register ? 'Ya tengo una cuenta' : 'Crear una cuenta nueva'}
                  </Button>
                )}
                <p className="text-xs leading-5 text-muted-foreground">
                  Las cuentas nuevas empiezan vacías. Si actualizaste una instalación anterior,
                  activa primero tu cuenta propietaria siguiendo la guía de actualización.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

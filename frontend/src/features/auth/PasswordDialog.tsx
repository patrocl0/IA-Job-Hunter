import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function PasswordDialog({
  onChanged,
  disabled,
}: {
  onChanged: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmation, setConfirmation] = useState('');
  function close() {
    setOpen(false);
    setError('');
    setCurrent('');
    setNew('');
    setConfirmation('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmation) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('La nueva contraseña debe ser diferente a la actual.');
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 256) {
      setError('La nueva contraseña supera el máximo de 256 bytes.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      close();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          if (value) setOpen(true);
          else close();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <KeyRound size={16} />
          <span>Cambiar contraseña</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Al guardar, se cerrarán todas tus sesiones, incluida esta. Guarda antes cualquier cambio
            pendiente en tu perfil o postulaciones.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="space-y-4" aria-busy={busy}>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="password-current">Contraseña actual</label>
            <Input
              id="password-current"
              type="password"
              autoComplete="current-password"
              required
              minLength={12}
              maxLength={256}
              value={currentPassword}
              onChange={(event) => setCurrent(event.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="password-new">Nueva contraseña</label>
            <Input
              id="password-new"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={256}
              value={newPassword}
              onChange={(event) => setNew(event.target.value)}
              disabled={busy}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Al menos 12 caracteres. Puedes usar una frase larga.
            </p>
          </div>
          <div>
            <label htmlFor="password-confirm">Repite la nueva contraseña</label>
            <Input
              id="password-confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={256}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar y cerrar sesiones'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

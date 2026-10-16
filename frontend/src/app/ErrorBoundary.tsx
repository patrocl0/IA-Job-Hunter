import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="mx-auto max-w-lg p-8">
          <h1 className="mb-4 text-2xl font-semibold">No se pudo mostrar la aplicación</h1>
          <p className="mb-5 text-muted-foreground">
            Recarga para volver a intentarlo. Esto no borra tus datos guardados; los cambios sin
            guardar podrían perderse.
          </p>
          <Button onClick={() => location.reload()}>Recargar aplicación</Button>
        </main>
      );
    return this.props.children;
  }
}

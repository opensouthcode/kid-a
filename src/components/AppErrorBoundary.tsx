import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState =
  | { kind: 'ok' }
  | { error: Error; kind: 'error' };

function clearLocalStorageKidA() {
  const keysToRemove: string[] = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);

    if (key?.startsWith('kid-a:')) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  window.location.reload();
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { kind: 'ok' };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error, kind: 'error' };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary caught an error', error, info.componentStack);
  }

  override render() {
    if (this.state.kind === 'error') {
      return (
        <div className="app-crash-screen">
          <div className="app-crash-card">
            <h1 className="app-crash-title">Something went wrong</h1>
            <p className="app-crash-message">
              The app failed to load. This can be caused by corrupted local data.
              Clearing local storage will reset your saved friends and session data
              but will not affect event progress.
            </p>
            <p className="app-crash-error">{this.state.error.message}</p>
            <button
              className="btn app-crash-btn"
              onClick={clearLocalStorageKidA}
              type="button"
            >
              Clear local data and reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

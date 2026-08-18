import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level render error boundary.
 *
 * Without this, any uncaught error thrown during render (e.g. a browser-side
 * client eagerly initialized with a missing API key, or any other render
 * exception) unmounts the whole React tree and leaves a logged-out visitor
 * looking at a blank/black page with no indication anything went wrong.
 *
 * This does not fix the underlying cause of any given error — it just
 * guarantees a visitor never sees a silent black screen, and gives them a
 * way to retry without a full reload.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught a render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            textAlign: 'center',
            background: '#050505',
            color: '#f2f2f4',
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          }}
        >
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            Something went wrong loading this page.
          </h1>
          <p style={{ opacity: 0.65, marginBottom: '1.5rem', maxWidth: '32rem' }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '0.4rem',
              border: '1px solid currentColor',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

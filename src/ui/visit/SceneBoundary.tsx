import { Component, type ReactNode } from 'react';

interface SceneBoundaryProps {
  onError: (error: unknown) => void;
  children: ReactNode;
}

/** Catches the scene failing to start (no WebGL, chunk failed to load) so the app can explain it. */
export class SceneBoundary extends Component<SceneBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    // Leave a trace for support: the Visitor only sees the plain-language message.
    console.error(
      'Surprise Museum: the 3D scene did not start.',
      error instanceof Error ? error.stack : error,
    );
    this.props.onError(error);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

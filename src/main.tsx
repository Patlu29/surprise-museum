import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { registerApi } from '@/api';
import { useBuilderStore } from '@/state/builderStore';
import { inputState } from '@/state/inputState';
import { useMuseumStore } from '@/state/museumStore';
import { publishScreenRects, screenRects } from '@/state/screenRects';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/ui/styles/fonts.css';
import '@/ui/styles/components.css';
import '@/ui/styles/screens.css';
import '@/ui/styles/builder.css';
import '@/ui/styles/visit.css';

// The backend client from src/api: the real Edge Functions when Supabase is configured, otherwise
// the in-memory mock (a demo copy, so nothing is saved online). `getApiMode()` says which.
registerApi();

// End-to-end tests read the stores through this hook (development and test builds only).
if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
  (window as unknown as { __APP_TEST__: unknown }).__APP_TEST__ = {
    useBuilderStore,
    inputState,
    publishScreenRects,
    screenRects,
    useMuseumStore,
    useSessionStore,
    useSettingsStore,
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Surprise Museum: the #root element is missing from index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { lazy, Suspense } from 'react';
import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { useApplySettings } from '@/hooks/useApplySettings';
import { Announcer } from '@/ui/components/Announcer';
import { HomeScreen } from '@/ui/screens/HomeScreen';
import { PrivacyScreen, TermsScreen } from '@/ui/screens/LegalScreen';
import { LoadingScreen } from '@/ui/screens/LoadingScreen';
import { NotFoundScreen } from '@/ui/screens/NotFoundScreen';

/*
 * Routes (docs/architecture.md, section 9). Hash routing (ADR 0002): the path after # never
 * reaches GitHub Pages, so share and edit tokens stay out of server logs and Referer headers.
 * Screens that need the builder or three.js are lazy so the home screen is not held up.
 * The builder's four steps live in history state, not in routes.
 */
const CreateScreen = lazy(() => import('@/ui/builder/CreateScreen'));
const PreviewScreen = lazy(() => import('@/ui/screens/PreviewScreen'));
const VisitScreen = lazy(() => import('@/ui/screens/VisitScreen'));
const EditScreen = lazy(() => import('@/ui/screens/EditScreen'));

export function App() {
  useApplySettings();
  return (
    <Router hook={useHashLocation}>
      <Suspense fallback={<LoadingScreen />}>
        <Switch>
          <Route path="/" component={HomeScreen} />
          <Route path="/create" component={CreateScreen} />
          <Route path="/create/preview" component={PreviewScreen} />
          <Route path="/m/:shareToken" component={VisitScreen} />
          <Route path="/edit/:editToken" component={EditScreen} />
          <Route path="/privacy" component={PrivacyScreen} />
          <Route path="/terms" component={TermsScreen} />
          <Route component={NotFoundScreen} />
        </Switch>
      </Suspense>
      <Announcer />
    </Router>
  );
}

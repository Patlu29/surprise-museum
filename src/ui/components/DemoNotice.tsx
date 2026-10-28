import { Alert } from './Alert';

/**
 * Shown when the build runs against the in-memory mock backend (no Supabase project configured).
 * Without it a Creator could think the share link works for other people. Real builds never show it.
 */
export function DemoNotice() {
  return (
    <Alert tone="warning" title="Demo copy" role="none">
      <p>
        This copy of the app is not connected to its server. Your museum is kept only in this
        browser tab, so the link will not work for anyone else.
      </p>
    </Alert>
  );
}

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { ApiFailureCode } from '@/lib/apiPort';
import { Button } from '@/ui/components/Button';
import { MessageScreen } from './MessageScreen';

interface CouldntOpenScreenProps {
  code: ApiFailureCode | null;
  onRetry: () => void;
}

/** The museum data could not be fetched (design spec 7.6). Try again does not reload the page (US-30). */
export function CouldntOpenScreen({ code, onRetry }: CouldntOpenScreenProps) {
  useDocumentTitle("We couldn't open your surprise");
  return (
    <MessageScreen
      alert
      heading="We couldn't open your surprise"
      actions={
        <Button variant="primary" large onClick={onRetry}>
          Try again
        </Button>
      }
    >
      <p>
        {code === 'rate_limited'
          ? "That's a lot of tries in a short time. Please wait a few minutes and try again."
          : "It looks like the connection dropped. Check you're online and try again."}
      </p>
    </MessageScreen>
  );
}

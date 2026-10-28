import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ButtonLink } from '@/ui/components/Button';
import { Illustration } from '@/ui/components/Illustration';
import { MessageScreen } from './MessageScreen';

/**
 * Unknown, deleted or expired link, or an unknown route (FR-55, design spec 7.5). It reveals
 * nothing about any museum and offers no list of others.
 */
export function NotFoundScreen() {
  useDocumentTitle("We can't find that museum");
  return (
    <MessageScreen
      illustration={<Illustration kind="not-found" />}
      heading="We can't find that museum"
      actions={
        <ButtonLink variant="secondary" href="/">
          Go to the home page
        </ButtonLink>
      }
    >
      <p>
        The link might have a typo, or the museum may have been taken down. Check the link, or ask
        the person who sent it to send it again.
      </p>
    </MessageScreen>
  );
}

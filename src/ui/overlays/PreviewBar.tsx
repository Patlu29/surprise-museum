import { Button } from '@/ui/components/Button';

interface PreviewBarProps {
  visitorName: string;
  onExit: () => void;
}

/** The preview strip (design spec 7.11). It sits above the welcome screen and the HUD. */
export function PreviewBar({ visitorName, onExit }: PreviewBarProps) {
  return (
    <div className="preview-bar" role="region" aria-label="Preview">
      <span className="preview-bar__tag">Preview</span>
      <p className="preview-bar__text">
        This is how <span className="user-text">{visitorName}</span> will see it
      </p>
      <Button variant="night" onClick={onExit}>
        Exit preview
      </Button>
    </div>
  );
}

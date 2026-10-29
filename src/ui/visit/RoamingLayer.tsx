import type { MuseumContent, MuseumPhoto } from '@contract';
import type { JumpTarget, SessionPhase } from '@/state/sessionStore';
import { useSessionStore } from '@/state/sessionStore';
import { HelpSheet } from '@/ui/overlays/HelpSheet';
import type { SheetName } from '@/ui/overlays/Hud';
import { Hud } from '@/ui/overlays/Hud';
import { PhotoViewer } from '@/ui/overlays/PhotoViewer';
import { PicturesSheet } from '@/ui/overlays/PicturesSheet';
import { SettingsSheet } from '@/ui/overlays/SettingsSheet';

/**
 * Everything the Visitor sees after Start: the HUD, the three sheets and the full-screen viewer.
 * It is its own chunk, loaded by VisitExperience once the 3D scene has mounted (so it arrives
 * while she reads the welcome screen), which keeps about 30 kB of overlay code out of the
 * welcome-screen download (NFR-2, architecture 12). Nothing here is needed before Start.
 */
interface RoamingLayerProps {
  content: MuseumContent;
  phase: SessionPhase;
  sheet: SheetName | null;
  onSheet: (sheet: SheetName | null) => void;
  onJump: (target: JumpTarget, announcement: string) => void;
  onReplay: () => void;
  viewerPhoto: MuseumPhoto | null;
  viewerIndex: number;
}

export default function RoamingLayer({
  content,
  phase,
  sheet,
  onSheet,
  onJump,
  onReplay,
  viewerPhoto,
  viewerIndex,
}: RoamingLayerProps) {
  return (
    <>
      {phase === 'roaming' ? (
        <Hud content={content} openSheet={sheet} onOpenSheet={onSheet} onReplay={onReplay} />
      ) : null}

      <PicturesSheet
        open={sheet === 'pictures'}
        onClose={() => onSheet(null)}
        content={content}
        onJump={onJump}
      />
      <HelpSheet
        open={sheet === 'help'}
        onClose={() => onSheet(null)}
        guideName={content.guideName}
      />
      <SettingsSheet
        open={sheet === 'settings'}
        onClose={() => onSheet(null)}
        onOpenHelp={() => onSheet('help')}
      />

      {viewerPhoto ? (
        <PhotoViewer
          photo={viewerPhoto}
          index={viewerIndex}
          total={content.photos.length}
          onClose={() => useSessionStore.getState().closeViewer()}
        />
      ) : null}
    </>
  );
}

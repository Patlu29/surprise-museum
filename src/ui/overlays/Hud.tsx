import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { MuseumContent } from '@contract';
import { useCaptionDock, type DockGeometry } from '@/hooks/useCaptionDock';
import { useCoaching } from '@/hooks/useCoaching';
import { useLayoutKind } from '@/hooks/useLayoutKind';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { photoLabel } from '@/lib/announcements';
import { parseHexColor, pickReadableInk } from '@/lib/contrast';
import { useMuseumStore } from '@/state/museumStore';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import type { Rect } from './chooseCaptionDock';
import { Button } from '@/ui/components/Button';
import type { IconName } from '@/ui/components/Icon';
import { Icon } from '@/ui/components/Icon';
import { ArrowPad } from './ArrowPad';
import { CaptionCard } from './CaptionCard';
import { FinaleCard } from './FinaleCard';
import { Joystick } from './Joystick';

export type SheetName = 'help' | 'pictures' | 'settings';

interface HudProps {
  content: MuseumContent;
  openSheet: SheetName | null;
  onOpenSheet: (sheet: SheetName) => void;
  onReplay: () => void;
}

const HINT_FALLBACK_MS = 700;
const HINT_VISIBLE_MS = 6000;
const CLEARANCE_BELOW_BARS = 12;

function toRect(box: DOMRect): Rect {
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}

function badgeInkFor(outfitColor: string): 'dark' | 'light' {
  const root = getComputedStyle(document.documentElement);
  const background = parseHexColor(root.getPropertyValue(`--avatar-outfit-${outfitColor}`));
  const dark = parseHexColor(root.getPropertyValue('--color-text'));
  const light = parseHexColor(root.getPropertyValue('--color-surface'));
  if (!background || !dark || !light) return 'light';
  return pickReadableInk(background, dark, light);
}

function HudButton(props: {
  icon: IconName;
  label: string;
  showLabel?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="night"
      icon={props.icon}
      className="hud-btn ui-hit"
      aria-label={props.label}
      onClick={props.onClick}
    >
      {props.showLabel ? <span className="hud-btn__label">{props.label}</span> : null}
    </Button>
  );
}

/**
 * The museum HUD (design spec 3.3): top bar, caption and finale cards, chips, joystick or arrow
 * buttons and the hint arrow. It sits in `.ui-layer`, which passes pointer events through to the
 * canvas except on controls (`.ui-hit`).
 */
export function Hud({ content, openSheet, onOpenSheet, onReplay }: HudProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const scrollingUntil = useRef(0);

  const layout = useLayoutKind();
  const coarse = useMediaQuery('(pointer: coarse)');
  const controls = useSettingsStore((state) => state.controls);
  const side = useSettingsStore((state) => state.joystickSide);
  const captionSize = useSettingsStore((state) => state.captionSize);

  const presentation = useSessionStore((state) => state.presentation);
  const viewed = useSessionStore((state) => state.viewed);
  const cameraOff = useSessionStore((state) => state.cameraOffDefault);
  const hint = useSessionStore((state) => state.hint);
  const nearFailed = useSessionStore((state) => state.nearFailedPhotoId);
  const finaleReached = useSessionStore((state) => state.finaleReached);
  const photoStatus = useMuseumStore((state) => state.photoStatus);

  const total = content.photos.length;
  const viewedCount = Math.min(viewed.size, total);
  const allViewed = total > 0 && viewed.size >= total;

  const photoIndex =
    presentation.kind === 'photo'
      ? content.photos.findIndex((photo) => photo.id === presentation.photoId)
      : -1;
  const photo = photoIndex >= 0 ? (content.photos[photoIndex] ?? null) : null;
  const caption = photo?.caption.trim() ?? '';
  const card: 'caption' | 'finale' | null =
    finaleReached || presentation.kind === 'finale'
      ? 'finale'
      : photo && caption
        ? 'caption'
        : null;

  const controlMode: 'joystick' | 'arrows' | 'none' =
    controls === 'auto' ? (coarse ? 'joystick' : 'none') : controls;

  const failedPhotoId =
    nearFailed ?? (photo && photoStatus[photo.id] === 'failed' ? photo.id : null);
  const failedIndex = failedPhotoId ? content.photos.findIndex((p) => p.id === failedPhotoId) : -1;

  const coaching = useCoaching(true, { guideName: content.guideName, touch: coarse });

  const measure = useCallback((): DockGeometry | null => {
    const layer = layerRef.current;
    if (!layer) return null;
    const style = getComputedStyle(layer);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    const viewport: Rect = {
      x: paddingLeft,
      y: paddingTop,
      width: layer.clientWidth - paddingLeft - paddingRight,
      height: layer.clientHeight - paddingTop - paddingBottom,
    };
    const keepOut: Rect[] = [];
    let top = 0;
    let bottom = 0;
    if (topRef.current) {
      const box = toRect(topRef.current.getBoundingClientRect());
      keepOut.push(box);
      top = Math.max(0, box.y + box.height - viewport.y + CLEARANCE_BELOW_BARS);
    }
    if (controlsRef.current) {
      const box = toRect(controlsRef.current.getBoundingClientRect());
      keepOut.push(box);
      bottom = Math.max(0, viewport.y + viewport.height - box.y + CLEARANCE_BELOW_BARS);
    }
    if (chipsRef.current && chipsRef.current.childElementCount > 0) {
      keepOut.push(toRect(chipsRef.current.getBoundingClientRect()));
    }
    return { viewport, insets: { top, bottom }, keepOut };
  }, []);

  const isBusy = useCallback(
    () =>
      performance.now() < scrollingUntil.current ||
      Boolean(cardRef.current && cardRef.current.contains(document.activeElement)),
    [],
  );

  const placement = useCaptionDock(
    card !== null,
    layout,
    captionSize !== 'normal',
    card === 'finale',
    measure,
    isBusy,
  );

  const guideOutfit = content.guideAvatar.outfitColor;
  const badgeInk = useMemo(() => badgeInkFor(guideOutfit), [guideOutfit]);

  // Where next? falls back to the Pictures list if the scene does not answer.
  const hintTimer = useRef<number | null>(null);
  useEffect(() => {
    if (hint && hintTimer.current !== null) {
      window.clearTimeout(hintTimer.current);
      hintTimer.current = null;
    }
  }, [hint]);
  useEffect(
    () => () => {
      if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(
      () => useSessionStore.getState().setHint(null),
      HINT_VISIBLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [hint]);

  const askWhereNext = () => {
    const session = useSessionStore.getState();
    session.setHint(null);
    session.requestHint();
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => {
      hintTimer.current = null;
      if (!useSessionStore.getState().hint) onOpenSheet('pictures');
    }, HINT_FALLBACK_MS);
  };

  const openViewer = (photoId: string) => useSessionStore.getState().openViewer(photoId);
  const dismiss = () => useSessionStore.getState().dismissPresentation();

  return (
    <div
      ref={layerRef}
      className="ui-layer hud"
      data-layout={layout}
      data-sheet={openSheet ?? undefined}
    >
      <div ref={topRef} className="hud__top">
        <div className="hud__cluster">
          <HudButton
            icon="list"
            label="Pictures"
            showLabel
            onClick={() => onOpenSheet('pictures')}
          />
          <HudButton
            icon="compass"
            label={allViewed ? 'To the finale' : 'Where next?'}
            showLabel
            onClick={askWhereNext}
          />
        </div>
        <p className="hud-pill">
          <span aria-hidden="true">
            {viewedCount} of {total}
          </span>
          <span className="visually-hidden">
            {viewedCount} of {total} pictures viewed
          </span>
        </p>
        <div className="hud__cluster hud__cluster--end">
          <HudButton icon="settings" label="Settings" onClick={() => onOpenSheet('settings')} />
          {cameraOff ? (
            <HudButton
              icon="reset"
              label="Reset view"
              onClick={() => useSessionStore.getState().resetView()}
            />
          ) : null}
          <HudButton icon="help" label="Help" onClick={() => onOpenSheet('help')} />
        </div>
      </div>

      {card === 'caption' && photo && placement ? (
        <CaptionCard
          placement={placement}
          guideName={content.guideName}
          badgeColor={`var(--avatar-outfit-${guideOutfit})`}
          badgeInk={badgeInk}
          label={photoLabel(photoIndex, total)}
          caption={caption}
          cardRef={cardRef}
          onClose={dismiss}
          onLookCloser={() => openViewer(photo.id)}
          onScrollActivity={() => {
            scrollingUntil.current = performance.now() + 1500;
          }}
        />
      ) : null}
      {card === 'finale' && placement ? (
        <FinaleCard
          placement={placement}
          guideName={content.guideName}
          visitorName={content.visitorName}
          message={content.closingMessage}
          cardRef={cardRef}
          onKeepExploring={dismiss}
          onReplay={onReplay}
        />
      ) : null}

      {hint && !hint.onScreen ? (
        <div
          className="edge-arrow"
          aria-hidden="true"
          style={{
            left: `${50 + Math.sin((hint.bearingDeg * Math.PI) / 180) * 42}%`,
            top: `${50 - Math.cos((hint.bearingDeg * Math.PI) / 180) * 38}%`,
          }}
        >
          <span style={{ transform: `rotate(${hint.bearingDeg}deg)`, display: 'inline-flex' }}>
            <Icon name="up" />
          </span>
          <span className="edge-arrow__distance">
            about {Math.max(1, Math.round(hint.distanceM))} m
          </span>
        </div>
      ) : null}

      <div
        ref={chipsRef}
        className={['hud__chips', controlMode !== 'none' && `hud__chips--lifted`]
          .filter(Boolean)
          .join(' ')}
      >
        {coaching ? <p className="hud-chip">{coaching}</p> : null}
        {presentation.kind === 'photo' && photo && !caption ? (
          <Button
            variant="night"
            icon="eye"
            className="ui-hit"
            onClick={() => openViewer(photo.id)}
          >
            Look closer at photo {photoIndex + 1}
          </Button>
        ) : null}
        {failedPhotoId && failedIndex >= 0 ? (
          <div className="hud-chip hud-chip--action ui-hit">
            <span>Photo {failedIndex + 1} did not load.</span>
            <Button
              variant="night-primary"
              icon="retry"
              onClick={() => useMuseumStore.getState().requestPhotoRetry(failedPhotoId)}
            >
              Retry
            </Button>
          </div>
        ) : null}
      </div>

      {controlMode !== 'none' ? (
        <div ref={controlsRef} className={`hud__controls hud__controls--${side}`}>
          {controlMode === 'joystick' ? <Joystick /> : <ArrowPad />}
        </div>
      ) : null}
    </div>
  );
}

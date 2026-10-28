import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeLocalStorage } from './safeStorage';

/**
 * Visitor preferences (design spec 5.13, FR-62, FR-65). Persisted in localStorage.
 *
 * Read by: the scene (`motion`, `quality`, `muted`), the HUD (`controls`, `joystickSide`),
 * and `useApplySettings` in src/hooks, which mirrors `motion` and `captionSize` onto `<html>`.
 * The scene reads the effective reduced-motion value with `getEffectiveReducedMotion()`,
 * never `motion` alone, because 'system' depends on the operating system.
 */

export type MotionSetting = 'system' | 'reduce' | 'full';
export type QualitySetting = 'auto' | 'low';
export type CaptionSize = 'normal' | 'large' | 'xlarge';
export type ControlsSetting = 'auto' | 'joystick' | 'arrows';
export type JoystickSide = 'left' | 'right';

export interface SettingsValues {
  /** 'system' follows prefers-reduced-motion; 'reduce' and 'full' override it. */
  motion: MotionSetting;
  quality: QualitySetting;
  /** No audio in the MVP (FR-42 is Release 2). Kept so the setting is ready. */
  muted: boolean;
  captionSize: CaptionSize;
  /** 'auto' shows the joystick on touch devices and nothing on desktop (keyboard). */
  controls: ControlsSetting;
  joystickSide: JoystickSide;
}

export interface SettingsState extends SettingsValues {
  setMotion: (value: MotionSetting) => void;
  setQuality: (value: QualitySetting) => void;
  setMuted: (value: boolean) => void;
  setCaptionSize: (value: CaptionSize) => void;
  setControls: (value: ControlsSetting) => void;
  setJoystickSide: (value: JoystickSide) => void;
}

export const DEFAULT_SETTINGS: SettingsValues = {
  motion: 'system',
  quality: 'auto',
  muted: false,
  captionSize: 'normal',
  controls: 'auto',
  joystickSide: 'left',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setMotion: (motion) => set({ motion }),
      setQuality: (quality) => set({ quality }),
      setMuted: (muted) => set({ muted }),
      setCaptionSize: (captionSize) => set({ captionSize }),
      setControls: (controls) => set({ controls }),
      setJoystickSide: (joystickSide) => set({ joystickSide }),
    }),
    {
      name: 'surprise-museum:settings:v1',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state): SettingsValues => ({
        motion: state.motion,
        quality: state.quality,
        muted: state.muted,
        captionSize: state.captionSize,
        controls: state.controls,
        joystickSide: state.joystickSide,
      }),
    },
  ),
);

/** Pure: the effective reduced-motion value for a setting and the operating system's request. */
export function resolveReducedMotion(
  motion: MotionSetting,
  systemPrefersReduced: boolean,
): boolean {
  if (motion === 'reduce') return true;
  if (motion === 'full') return false;
  return systemPrefersReduced;
}

export function systemPrefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** For the scene and other non-React code: reads the current effective value without subscribing. */
export function getEffectiveReducedMotion(): boolean {
  return resolveReducedMotion(useSettingsStore.getState().motion, systemPrefersReducedMotion());
}

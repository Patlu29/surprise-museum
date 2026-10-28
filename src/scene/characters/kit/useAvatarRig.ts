import { useEffect, useMemo } from 'react';
import type { AvatarConfig } from '@contract';
import { createAvatarRig, type AvatarRig, type AvatarRigOptions } from './rig';

/**
 * Creates one rig per component instance, keeps it in step with `config` (rebuilding only the
 * parts that changed) and disposes it on unmount. three.js re-uploads disposed geometry if it is
 * used again, so React Strict Mode's mount, unmount, mount sequence is safe.
 */
export function useAvatarRig(config: AvatarConfig, options: AvatarRigOptions): AvatarRig {
  const { role, blobShadow } = options;
  // The rig is created once per role; later config changes go through setAppearance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rig = useMemo(() => createAvatarRig(config, { role, blobShadow }), [role, blobShadow]);

  useEffect(() => {
    rig.setAppearance(config);
  }, [rig, config]);

  useEffect(() => () => rig.dispose(), [rig]);

  return rig;
}

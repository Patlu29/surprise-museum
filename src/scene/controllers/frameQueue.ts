/**
 * Work queued by store subscriptions (dismiss, replay, jump, reset view, hint). The SceneDriver
 * drains it at the start of each frame, so the simulation never changes in the middle of a tick.
 */
export const FRAME_COMMANDS = { queue: [] as Array<() => void> };

import { WS_SUBTYPES } from '../event.names';
import { DeepReadonly } from '../../utils';
import { ExcalidrawElement } from '../../../excalidraw/types/excalidraw.element';
import { ExcalidrawFileStore } from '../../../excalidraw/types/excalidraw.file';

/**
 * Payload for a server-initiated full-scene reload, broadcast to a room after an
 * external (e.g. MCP) content write. Carries the freshly reloaded DB scene. The
 * client reconciles it exactly like a SCENE_UPDATE.
 */
export type SceneReloadPayload = {
  type: WS_SUBTYPES.RELOAD;
  payload: {
    elements: readonly ExcalidrawElement[];
    files: DeepReadonly<ExcalidrawFileStore>;
  };
};

import { ExcalidrawElement } from '../../../excalidraw/types/excalidraw.element';
import { ExcalidrawFileStore } from '../../../excalidraw/types/excalidraw.file';
import { DeepReadonly } from '../../utils';
import { SCENE_INIT } from '../event.names';

export type SceneInitPayload = {
  type: typeof SCENE_INIT;
  payload: {
    elements: readonly ExcalidrawElement[];
    files: DeepReadonly<ExcalidrawFileStore>;
  };
};

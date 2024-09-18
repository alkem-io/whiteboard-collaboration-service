import { SCENE_INIT } from '../event.names';
import { DeepReadonly } from '../../utils';
import { ExcalidrawElement } from '../excalidraw.element';
import { ExcalidrawFileStore } from '../excalidraw.file';

export type SceneInitPayload = {
  type: typeof SCENE_INIT;
  payload: {
    elements: readonly ExcalidrawElement[];
    files: DeepReadonly<ExcalidrawFileStore>;
  };
};

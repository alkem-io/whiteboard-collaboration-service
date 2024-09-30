import { ExcalidrawElement } from '../../../excalidraw/types/excalidraw.element';
import { ExcalidrawFileStore } from '../../../excalidraw/types/excalidraw.file';
import { DeepReadonly } from '../../utils';

export type ServerBroadcastPayload = {
  elements: readonly ExcalidrawElement[];
  files: DeepReadonly<ExcalidrawFileStore>;
};

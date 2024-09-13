import { ExcalidrawElement } from '../excalidraw.element';
import { ExcalidrawFileStore } from '../excalidraw.file';
import { DeepReadonly } from '../../utils';

export type ServerBroadcastPayload = {
  elements: readonly ExcalidrawElement[];
  files: DeepReadonly<ExcalidrawFileStore>;
};

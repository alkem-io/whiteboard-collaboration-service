import { ExcalidrawElement } from '../excalidraw.element';
import { ExcalidrawFile } from '../excalidraw.file';

export type ServerBroadcastPayload = {
  elements: readonly ExcalidrawElement[];
  files: readonly ExcalidrawFile[];
};

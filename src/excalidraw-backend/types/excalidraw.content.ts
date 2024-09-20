import { ExcalidrawElement } from './excalidraw.element';
import { ExcalidrawFileStore } from './excalidraw.file';

export type ExcalidrawContent = {
  type: 'excalidraw';
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState: Record<string, unknown>;
  files: ExcalidrawFileStore;
};

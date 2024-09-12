import { ExcalidrawElement } from './excalidraw.element';
import { ExcalidrawFileStore } from './excalidraw.file';

export type ExcalidrawContent = {
  type: 'excalidraw';
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState: any; // todo
  files: ExcalidrawFileStore;
};

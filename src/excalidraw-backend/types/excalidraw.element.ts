type ExcalidrawBaseElement = {
  id: string;
  index: number;
  type: string; // many types
  version: number;
  versionNonce: number;
};

export type ExcalidrawImageElement = ExcalidrawBaseElement & {
  type: 'image';
  fileId: string;
};

export type ExcalidrawElement = ExcalidrawBaseElement | ExcalidrawImageElement;

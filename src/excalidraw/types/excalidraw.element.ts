type ExcalidrawBaseElement = {
  id: string;
  // index: number; // still not available in 0.17.0
  type: string; // many types
  version: number;
  versionNonce: number;
  /**
   *  used for sorting the array;
   *  Excalidraw uses a sorted array to simulate z-index behavior by
   *  drawing the elements in order, starting from the first element
   *  TODO: to be removed once we update the version of Excalidraw, where they are removing this field and introduce a new field called "index"
   */
  __precedingElement__: string;
};

export type ExcalidrawImageElement = ExcalidrawBaseElement & {
  type: 'image';
  fileId: string;
};

export type ExcalidrawElement = ExcalidrawBaseElement | ExcalidrawImageElement;

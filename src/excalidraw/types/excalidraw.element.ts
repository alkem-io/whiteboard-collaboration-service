type ExcalidrawBaseElement = {
  id: string;
  // index: number; // still not available in 0.17.0
  type: string; // many types
  version: number;
  versionNonce: number;
  /** String in a fractional form defined by https://github.com/rocicorp/fractional-indexing.
   Used for ordering in multiplayer scenarios, such as during reconciliation or undo / redo.
   Always kept in sync with the array order by `syncMovedIndices` and `syncInvalidIndices`.
   Could be null, i.e. for new elements which were not yet assigned to the scene. */
  index: FractionalIndex | null;
};

export type ExcalidrawImageElement = ExcalidrawBaseElement & {
  type: 'image';
  fileId: string;
};

export type ExcalidrawElement = ExcalidrawBaseElement | ExcalidrawImageElement;

export type FractionalIndex = string & { _brand: 'fractionalIndex' };
export type Ordered<TElement extends ExcalidrawElement> = TElement & {
  index: FractionalIndex;
};
export type OrderedExcalidrawElement = Ordered<ExcalidrawElement>;

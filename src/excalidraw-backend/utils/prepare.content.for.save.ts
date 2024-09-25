import { InMemorySnapshot } from '../types';
import { DeepReadonly } from './deep.readonly';
import { ExcalidrawContent, ExcalidrawFileStore } from '../../excalidraw/types';
import { isExcalidrawImageElement } from '../../util';

export const prepareContentForSave = (
  snapshot: InMemorySnapshot,
): DeepReadonly<ExcalidrawContent> => {
  const { files: fileStore, ...restOfContent } = snapshot.content;
  // clear files from the file store which are not referenced by elements
  const cleanStore: ExcalidrawFileStore = {};

  for (const fileId of Object.keys(fileStore)) {
    // is there an element referencing the file
    const hostElement = restOfContent.elements.find(
      (el) => isExcalidrawImageElement(el) && el.fileId === fileId,
    );

    if (hostElement) {
      // there is an element referencing the file - save the file
      cleanStore[fileId] = fileStore[fileId];
    }
  }

  return {
    ...restOfContent,
    files: cleanStore,
  };
};

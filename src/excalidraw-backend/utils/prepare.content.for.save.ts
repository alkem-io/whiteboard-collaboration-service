import { InMemorySnapshot } from '../types';
import { DeepReadonly } from './deep.readonly';
import { ExcalidrawContent, ExcalidrawFileStore } from '../../excalidraw/types';
import { isExcalidrawImageElement } from '../../util';

// todo: remove isDeleted, and maybe others
export const prepareContentForSave = (
  snapshot: InMemorySnapshot,
  keepDeleted: boolean,
): DeepReadonly<ExcalidrawContent> => {
  const { files: fileStore, elements, ...restOfContent } = snapshot.content;
  // clear files from the file store which are not referenced by elements
  const cleanStore: ExcalidrawFileStore = {};

  for (const fileId of Object.keys(fileStore)) {
    // is there an element referencing the file
    const hostElement = elements.find(
      (el) => isExcalidrawImageElement(el) && el.fileId === fileId,
    );

    if (hostElement) {
      // there is an element referencing the file - save the file
      cleanStore[fileId] = fileStore[fileId];
    }
  }

  const filteredElements = keepDeleted
    ? elements
    : elements.filter((element) => !element.isDeleted);

  return {
    ...restOfContent,
    files: cleanStore,
    elements: filteredElements,
  };
};

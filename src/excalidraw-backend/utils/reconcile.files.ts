import {
  ExcalidrawElement,
  ExcalidrawFileStore,
  ExcalidrawImageElement,
} from '../types';
import { DeepReadonly } from './deep.readonly';

export const reconcileFiles = (
  localElements: readonly ExcalidrawElement[],
  localFileStore: DeepReadonly<ExcalidrawFileStore>,
  remoteFileStore: DeepReadonly<ExcalidrawFileStore>,
): ExcalidrawFileStore => {
  const reconciledFileStore = { ...localFileStore };

  for (const remoteFileId in remoteFileStore) {
    // find a local file that matches the remote file
    // if it's already in - discard the remote
    if (reconciledFileStore[remoteFileId]) {
      continue;
    }
    // if it's not found locally - check if it's used by any element
    // const elementUsingTheFile = localElements.find(
    //   (element) =>
    //     isExcalidrawImageElement(element) && element.fileId === remoteFileId,
    // );
    // if it's not found locally and not used by any local element - discard the remote
    // if (!elementUsingTheFile) {
    //   continue;
    // }
    // if it's not found locally but used by a local element - add it to the list of reconciled files
    reconciledFileStore[remoteFileId] = remoteFileStore[remoteFileId];
  }

  return reconciledFileStore;
};

const isExcalidrawImageElement = (
  element: ExcalidrawElement,
): element is ExcalidrawImageElement => element.type === 'image';

import { DeepReadonly } from './deep.readonly';
import { ExcalidrawElement, ExcalidrawFileStore } from '../../excalidraw/types';

export const reconcileFiles = (
  _localElements: readonly ExcalidrawElement[],
  localFileStore: DeepReadonly<ExcalidrawFileStore>,
  remoteFileStore: DeepReadonly<ExcalidrawFileStore>,
): ExcalidrawFileStore => {
  const reconciledFileStore = { ...localFileStore };

  for (const remoteFileId in remoteFileStore) {
    // find a local file that matches the remote file
    // if it's already in - discard the remote
    if (reconciledFileStore[remoteFileId]) {
      // if the file already exists in the local store
      // update just the urls, because they might have been changed.
      // sometimes files get converted from dataURL to URL, and we would like to have the URL
      reconciledFileStore[remoteFileId] = {
        ...reconciledFileStore[remoteFileId],
        url: remoteFileStore[remoteFileId].url,
        dataURL: remoteFileStore[remoteFileId].dataURL,
      };
      continue;
    }
    /** uncomment this when Excalidraw starts sending the element and the file at the same time
     * otherwise it's causing a bug where the file is sent but the element that should fit the image is not
     * then another event is sent with the host element but not the file
     * so to accommodate this we store the file for future use
     */
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

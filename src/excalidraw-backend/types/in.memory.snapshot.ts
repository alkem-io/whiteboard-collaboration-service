import { ExcalidrawContent } from './excalidraw.content';
import { DeepReadonly } from '../utils';
import { ExcalidrawElement } from './excalidraw.element';
import { ExcalidrawFileStore } from './excalidraw.file';
import { reconcileElements } from '../utils/reconcile';
import { reconcileFiles } from '../utils/reconcile.files';
/**
 * Represents an immutable point-in-time-snapshot of an Excalidraw content stored in memory.
 * It includes methods to reconcile local and remote content and create a new snapshot.
 * Can be used as versioning mechanism for Excalidraw content.
 * To reduce data deltas can be calculated between two snapshots.
 */
export class InMemorySnapshot {
  /**
   * The timestamp of the last modification to the snapshot.
   * This timestamp is immutable and can be perceived as time of creation
   * @type {number}
   */
  public readonly lastModified: number;
  /**
   * The immutable content of the snapshot.
   * @type {DeepReadonly<ExcalidrawContent>}
   */
  public readonly content: DeepReadonly<ExcalidrawContent>;
  /**
   * The version number of the snapshot.
   * This field is immutable and can't be changed.
   * @type {number}
   */
  public readonly version: number;
  /**
   * Constructs an instance of `InMemorySnapshot`.
   *
   * @param {ExcalidrawContent} content - The content of the snapshot.
   * @param version The version of the snapshot. Defaults to 1 for new snapshots.
   */
  constructor(content: ExcalidrawContent, version?: number) {
    this.content = content;
    this.lastModified = Date.now();
    this.version = version ?? 1;
  }

  /**
   * Reconciles a snapshot with incoming remote elements and remote file store.
   * Returns a new instance of `InMemorySnapshot` with the reconciled content.
   *
   * @param {InMemorySnapshot} snapshot - The snapshot to be reconciled with.
   * @param {readonly ExcalidrawElement[]} remoteElements - The remote elements to reconcile with.
   * @param {DeepReadonly<ExcalidrawFileStore>} remoteFileStore - The remote file store to reconcile with.
   * @returns {InMemorySnapshot} - A new instance of `InMemorySnapshot` with the reconciled content.
   */
  public static reconcile = (
    snapshot: InMemorySnapshot,
    remoteElements: readonly ExcalidrawElement[],
    remoteFileStore: DeepReadonly<ExcalidrawFileStore>,
  ): InMemorySnapshot => {
    const {
      content: {
        elements: localElement,
        files: localFileStore,
        ...restOfContent
      },
    } = snapshot;

    const reconciledElements = reconcileElements(localElement, remoteElements);
    const reconciledFileStore = reconcileFiles(
      localElement,
      localFileStore,
      remoteFileStore,
    );

    return new InMemorySnapshot(
      {
        ...restOfContent,
        elements: reconciledElements,
        files: reconciledFileStore,
      },
      snapshot.version + 1,
    );
  };
}

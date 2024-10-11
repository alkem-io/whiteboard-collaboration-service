/**
 * Envisioned relation between array order and fractional indices:
 *
 * 1) Array (or array-like ordered data structure) should be used as a cache of elements order, hiding the internal fractional indices implementation.
 * - it's undesirable to to perform reorder for each related operation, thefeore it's necessary to cache the order defined by fractional indices into an ordered data structure
 * - it's easy enough to define the order of the elements from the outside (boundaries), without worrying about the underlying structure of fractional indices (especially for the host apps)
 * - it's necessary to always keep the array support for backwards compatibility (restore) - old scenes, old libraries, supporting multiple excalidraw versions etc.
 * - it's necessary to always keep the fractional indices in sync with the array order
 * - elements with invalid indices should be detected and synced, without altering the already valid indices
 *
 * 2) Fractional indices should be used to reorder the elements, whenever the cached order is expected to be invalidated.
 * - as the fractional indices are encoded as part of the elements, it opens up possibilties for incremental-like APIs
 * - re-order based on fractional indices should be part of (multiplayer) operations such as reconcillitation & undo/redo
 * - technically all the z-index actions could perform also re-order based on fractional indices,but in current state it would not bring much benefits,
 *   as it's faster & more efficient to perform re-order based on array manipulation and later synchronisation of moved indices with the array order
 */

import {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from '../../excalidraw/types';

/**
 * Order the elements based on the fractional indices.
 * - when fractional indices are identical, break the tie based on the element id
 * - when there is no fractional index in one of the elements, respect the order of the array
 */
export const orderByFractionalIndex = (elements: ExcalidrawElement[]) => {
  return elements.sort((a, b) => {
    // in case the indices are not the defined at runtime
    if (isOrderedElement(a) && isOrderedElement(b)) {
      if (a.index < b.index) {
        return -1;
      } else if (a.index > b.index) {
        return 1;
      }

      // break ties based on the element id
      return a.id < b.id ? -1 : 1;
    }

    // defensively keep the array order
    return 1;
  });
};

const isOrderedElement = (
  element: ExcalidrawElement,
): element is OrderedExcalidrawElement => {
  // for now, it's sufficient whether the index is there
  // meaning, the element was already ordered in the past
  // meaning, it is not a newly inserted element, not an unrestored element, etc.
  // it does not have to mean that the index itself is valid
  return !!element.index;
};

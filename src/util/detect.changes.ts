import { isEqual } from 'lodash';
import { ExcalidrawElement } from '../excalidraw/types';

type Identifiable = {
  id: string;
};

type Changes<T extends Identifiable> = {
  id: string;
} & Partial<{
  [P in keyof T as P extends 'id' ? never : P]: {
    old?: T[P];
    new?: T[P];
  };
}>;

export type DetectedChanges<T extends Identifiable> = {
  inserted?: Array<T>;
  updated?: Array<Changes<T>>;
  // todo: how to detect deleted?
  deleted?: Array<{
    id: string;
  }>;
};

// todo: doc
/**
 * Detects deep changes between two arrays of ExcalidrawElements, and returns an object with the changes.
 * Returns null if no changes are detected.
 * @param oldArrInput
 * @param newArrInput
 * @param fieldsToIgnore
 */
export const detectChanges = (
  oldArrInput: Array<ExcalidrawElement>,
  newArrInput: Array<ExcalidrawElement>,
  fieldsToIgnore?: Array<keyof ExcalidrawElement>,
): DetectedChanges<ExcalidrawElement> | null => {
  const oldLen = oldArrInput.length;
  const newLen = newArrInput.length;
  // if both are empty, no changes
  if (oldLen === 0 && newLen === 0) {
    return null;
  }
  // if oldArr is empty, all new are inserted
  if (oldLen === 0) {
    return { inserted: newArrInput };
  }
  // if new is empty, all oldArr are deleted
  if (newLen === 0) {
    return { deleted: oldArrInput.map((item) => ({ id: item.id })) };
  }

  // filter out the fields we want to ignore
  const newArr = newArrInput.map((item) =>
    removeFields(item, fieldsToIgnore ?? []),
  );

  const oldArr = oldArrInput.map((item) =>
    removeFields(item, fieldsToIgnore ?? []),
  );

  const changes: DetectedChanges<ExcalidrawElement> = {};

  const oldMap = new Map(oldArr.map((item) => [item.id, item]));
  for (const newItem of newArr) {
    const oldItem = oldMap.get(newItem.id);
    // if the new item is not in the old array, it is inserted
    if (!oldItem) {
      changes.inserted = changes.inserted ?? [];
      changes.inserted.push(newItem);
      continue;
    }
    // a match is found - the element is updated or deleted
    // if the new item is deleted, it is considered deleted
    if (newItem.isDeleted) {
      changes.deleted = changes.deleted ?? [];
      changes.deleted.push({ id: newItem.id });
      continue;
    }
    // a match is found and the item is not deleted
    // search what has been updated
    const updatedFields: Changes<ExcalidrawElement> = { id: newItem.id };
    let isUpdated = false;
    // compare every field of the new item against every field of the old item
    for (const key in newItem) {
      const typedKey = key as keyof ExcalidrawElement;

      if (isEqual(newItem[typedKey], oldItem[typedKey])) {
        continue;
      }
      updatedFields[typedKey] = {
        // @ts-expect-error updatedFields[typedKey] can be of undefined type and assigning another type to it brings a type error
        old: oldItem[typedKey],
        // @ts-expect-error same
        new: newItem[typedKey],
      };
      isUpdated = true;
    }

    if (isUpdated) {
      changes.updated = changes.updated ?? [];
      changes.updated.push(updatedFields);
    }
  }
  // return null if no changes detected
  return Object.keys(changes).length > 0 ? changes : null;
};

function removeFields<T extends object, K extends keyof T>(
  obj: T,
  fields: K[],
): T {
  const result = { ...obj };
  fields.forEach((field) => {
    delete result[field];
  });
  return result;
}

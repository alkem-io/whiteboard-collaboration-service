interface Item {
  id: string;
  [key: string]: any;
}

function arraysEqual(arr1: any[], arr2: any[]): boolean {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (Array.isArray(arr1[i]) && Array.isArray(arr2[i])) {
      if (!arraysEqual(arr1[i], arr2[i])) return false;
    } else if (typeof arr1[i] === 'object' && typeof arr2[i] === 'object') {
      if (!objectsEqual(arr1[i], arr2[i])) return false;
    } else if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

function objectsEqual(obj1: any, obj2: any): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
      if (!arraysEqual(obj1[key], obj2[key])) return false;
    } else if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
      if (!objectsEqual(obj1[key], obj2[key])) return false;
    } else if (obj1[key] !== obj2[key]) return false;
  }
  return true;
}

export function detectChanges(
  oldArray: readonly Item[],
  newArray: readonly Item[],
) {
  const changes = {
    added: [] as Item[],
    removed: [] as Item[],
    updated: [] as {
      id: string;
      changes: { before: Partial<Item>; after: Partial<Item> };
    }[],
  };

  const oldMap = new Map<string, Item>();
  const newMap = new Map<string, Item>();

  oldArray.forEach((item) => oldMap.set(item.id, item));
  newArray.forEach((item) => newMap.set(item.id, item));

  // Detect added and updated items
  newMap.forEach((newItem, id) => {
    const oldItem = oldMap.get(id);
    if (!oldItem) {
      changes.added.push(newItem);
    } else {
      const before: Partial<Item> = {};
      const after: Partial<Item> = {};
      for (const key in newItem) {
        if (Array.isArray(newItem[key]) && Array.isArray(oldItem[key])) {
          if (!arraysEqual(newItem[key], oldItem[key])) {
            before[key] = oldItem[key];
            after[key] = newItem[key];
          }
        } else if (
          newItem[key] !== null &&
          oldItem[key] !== null &&
          typeof newItem[key] === 'object' &&
          typeof oldItem[key] === 'object'
        ) {
          if (!objectsEqual(newItem[key], oldItem[key])) {
            before[key] = oldItem[key];
            after[key] = newItem[key];
          }
        } else if (newItem[key] !== oldItem[key]) {
          before[key] = oldItem[key];
          after[key] = newItem[key];
        }
      }
      if (Object.keys(before).length > 0) {
        changes.updated.push({ id, changes: { before, after } });
      }
    }
  });

  // Detect removed items
  oldMap.forEach((oldItem, id) => {
    if (!newMap.has(id)) {
      changes.removed.push(oldItem);
    }
  });

  return changes;
}

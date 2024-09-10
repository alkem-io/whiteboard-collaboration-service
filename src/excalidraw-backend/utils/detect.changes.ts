interface Item {
  id: string;
  [key: string]: any;
}

function arraysEqual(arr1: any[], arr2: any[]): boolean {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
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

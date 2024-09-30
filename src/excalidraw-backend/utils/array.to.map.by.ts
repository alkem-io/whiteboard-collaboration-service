export const arrayToMapBy = <T extends Record<string, any>>(
  items: readonly T[],
  key: keyof T,
): Map<string, T> => {
  return items.reduce((acc: Map<string, T>, element) => {
    acc.set(element[key], element);
    return acc;
  }, new Map<string, T>());
};

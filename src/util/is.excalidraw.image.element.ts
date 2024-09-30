import { ExcalidrawElement, ExcalidrawImageElement } from '../excalidraw/types';

export const isExcalidrawImageElement = (
  element: ExcalidrawElement,
): element is ExcalidrawImageElement => element.type === 'image';

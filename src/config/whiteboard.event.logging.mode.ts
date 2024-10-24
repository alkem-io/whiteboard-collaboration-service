export const WhiteboardEventLoggingMode = {
  none: 'none',
  lite: 'lite',
  full: 'full',
} as const;

export type WhiteboardEventLoggingModeType =
  (typeof WhiteboardEventLoggingMode)[keyof typeof WhiteboardEventLoggingMode];

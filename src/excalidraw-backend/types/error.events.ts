export const ERROR_EVENTS = {
  GENERIC_ERROR: {
    code: 0,
    description: 'Error with unknown origin',
  },
  USER_INFO_NO_VERIFY: {
    code: 1,
    description: 'Could not verify user info',
  },
  ROOM_NO_READ_ACCESS: {
    code: 2,
    description: 'No read access to the requested room',
  },
} as const;

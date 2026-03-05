/**
 * Represents an actor (user) in the system.
 * The `id` field is the actor ID; "user ID" and "actor ID" are interchangeable.
 */
export type UserInfo = {
  /** Actor ID (interchangeable with user ID) */
  id: string;
  guestName?: string;
};

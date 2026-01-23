/**
 * Payload for floating emoji reactions sent through the collaboration server.
 * These are ephemeral visual reactions that participants can send to other
 * collaborators on the whiteboard. The emoji floats up from the specified
 * scene coordinates and is displayed for all connected clients.
 *
 * Sent via the reliable (non-volatile) channel to ensure all peers receive
 * the reaction.
 */
export type FloatingEmojiPayload = {
  /** The emoji character to display (e.g., "👍", "🎉", "❤️") */
  emoji: string;
  /** X coordinate in scene/whiteboard space */
  x: number;
  /** Y coordinate in scene/whiteboard space */
  y: number;
  /** Optional unique identifier for the emoji instance */
  id?: string;
  /** Optional random seed for animation variation */
  seed?: number;
};

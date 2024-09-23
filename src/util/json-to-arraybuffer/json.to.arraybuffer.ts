export const jsonToArrayBuffer = (
  json: Record<string, unknown>,
): ArrayBuffer => {
  const jsonString = JSON.stringify(json);
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(jsonString);
  return uint8Array.buffer;
};

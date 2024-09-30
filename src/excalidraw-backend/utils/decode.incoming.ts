import { BasePayload, SocketEventData } from '../types';

/**
 * Tries to decode incoming binary data.
 * Throws an exception otherwise.
 * @param {ArrayBuffer}data The incoming binary data
 * @returns {SocketEventData} Returns the decoded data in form of event data
 * @throws {TypeError} Throws an error if the data cannot be decoded
 * @throws {SyntaxError} Thrown if the data to parse is not valid JSON.
 */
export const tryDecodeIncoming = <TPayload extends BasePayload>(
  data: ArrayBuffer,
): SocketEventData<TPayload> | never => {
  const strEventData = tryDecodeBinary(data);

  return JSON.parse(strEventData) as SocketEventData<TPayload>;
};
/**
 *
 * @throws {TypeError} Throws an error if the data cannot be decoded
 */
export const tryDecodeBinary = (data: ArrayBuffer): string => {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(data);
};

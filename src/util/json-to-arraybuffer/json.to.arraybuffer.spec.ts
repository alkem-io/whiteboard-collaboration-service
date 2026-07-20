import { jsonToArrayBuffer } from './json.to.arraybuffer';

describe('jsonToArrayBuffer', () => {
  it('should convert an empty object to an ArrayBuffer', () => {
    const json = {};
    const arrayBuffer = jsonToArrayBuffer(json);
    const expectedBuffer = new TextEncoder().encode(
      JSON.stringify(json),
    ).buffer;
    expect(arrayBuffer).toEqual(expectedBuffer);
  });

  it('should convert a simple JSON object to an ArrayBuffer', () => {
    const json = { key: 'value' };
    const arrayBuffer = jsonToArrayBuffer(json);
    const expectedBuffer = new TextEncoder().encode(
      JSON.stringify(json),
    ).buffer;
    expect(arrayBuffer).toEqual(expectedBuffer);
  });

  it('should convert a nested JSON object to an ArrayBuffer', () => {
    const json = { key: { nestedKey: 'nestedValue' } };
    const arrayBuffer = jsonToArrayBuffer(json);
    const expectedBuffer = new TextEncoder().encode(
      JSON.stringify(json),
    ).buffer;
    expect(arrayBuffer).toEqual(expectedBuffer);
  });

  it('should convert a JSON object with different data types to an ArrayBuffer', () => {
    const json = {
      string: 'value',
      number: 123,
      boolean: true,
      nullValue: null,
    };
    const arrayBuffer = jsonToArrayBuffer(json);
    const expectedBuffer = new TextEncoder().encode(
      JSON.stringify(json),
    ).buffer;
    expect(arrayBuffer).toEqual(expectedBuffer);
  });

  it('should convert a JSON object with an array to an ArrayBuffer', () => {
    const json = { array: [1, 2, 3] };
    const arrayBuffer = jsonToArrayBuffer(json);
    const expectedBuffer = new TextEncoder().encode(
      JSON.stringify(json),
    ).buffer;
    expect(arrayBuffer).toEqual(expectedBuffer);
  });

  describe('jsonToArrayBuffer decode', () => {
    const testCases = [
      { json: {} },
      { json: { key: 'value' } },
      { json: { key: { nestedKey: 'nestedValue' } } },
      {
        json: { string: 'value', number: 123, boolean: true, nullValue: null },
      },
      { json: { array: [1, 2, 3] } },
    ];

    test.each(testCases)(
      'should encode and decode JSON correctly %#',
      ({ json }) => {
        const arrayBuffer = jsonToArrayBuffer(json);
        const decodedJson = arrayBufferToJson(arrayBuffer);
        expect(decodedJson).toEqual(json);
      },
    );
  });
});

const arrayBufferToJson = (buffer: ArrayBuffer): Record<string, unknown> => {
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(new Uint8Array(buffer));
  return JSON.parse(jsonString);
};

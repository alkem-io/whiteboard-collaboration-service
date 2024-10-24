import { detectChanges } from './detect.changes';

describe('detectChanges', () => {
  it('should return null if both arrays are empty', () => {
    const result = detectChanges([], []);
    expect(result).toBeNull();
  });

  it('should detect inserted elements', () => {
    const result = detectChanges([], [element1, element2]);
    expect(result).toEqual({ inserted: [element1, element2] });
  });

  it('should detect deleted elements', () => {
    const result = detectChanges([element1, element2], []);
    expect(result).toEqual({ deleted: [{ id: '1' }, { id: '2' }] });
  });

  it('should detect updated elements', () => {
    const updatedElement1 = { ...element1, someField: 'newValue1' };
    const result = detectChanges([element1], [updatedElement1]);
    expect(result).toEqual({
      updated: [
        {
          id: '1',
          someField: {
            old: 'value1',
            new: 'newValue1',
          },
        },
      ],
    });
  });

  it('should detect mixed changes', () => {
    const updatedElement1 = { ...element1, someField: 'newValue1' };
    const result = detectChanges(
      [element1, element2],
      [updatedElement1, element3],
    );
    expect(result).toEqual({
      inserted: [element3],
      updated: [
        {
          id: '1',
          someField: {
            old: 'value1',
            new: 'newValue1',
          },
        },
      ],
    });
  });

  it('should ignore specified fields', () => {
    const updatedElement1 = { ...element1, someField: 'newValue1' };
    const result = detectChanges([element1], [updatedElement1], [
      'someField',
    ] as any);
    expect(result).toBeNull();
  });

  it('should handle elements marked as deleted', () => {
    const deletedElement1 = { ...element1, isDeleted: true };
    const result = detectChanges([element1, element4], [deletedElement1]);
    expect(result).toEqual({
      deleted: [{ id: '1' }],
    });
  });
});

const element1: any = {
  id: '1',
  isDeleted: false,
  someField: 'value1',
};
const element2: any = {
  id: '2',
  isDeleted: false,
  someField: 'value2',
};
const element3: any = {
  id: '3',
  isDeleted: false,
  someField: 'value3',
};
const element4: any = {
  id: '4',
  isDeleted: true,
  someField: 'value4',
};

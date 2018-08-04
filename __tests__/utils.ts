import { isThenable, isObject, identity, isFunction } from '../src/utils';

describe('isThenable', () => {
  test('detects objects with a then method', () => {
    expect(isThenable({ then: () => null })).toBe(true);
    expect(isThenable(null)).toBe(false);
    expect(isThenable({})).toBe(false);
  });
});

describe('isObject', () => {
  test('detects objects only', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject(1)).toBe(false);
  });
});

describe('identity', () => {
  test('it returns the passed value', () => {
    expect(identity(1)).toBe(1);
  });
});

describe('isFunction', () => {
  test('detects functions', () => {
    expect(isFunction(() => true)).toBe(true);
    expect(isFunction({})).toBe(false);
  });
});

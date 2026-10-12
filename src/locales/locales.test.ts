import { describe, expect, it } from 'vitest';
import en from './en.json';
import ky from './ky.json';
import ru from './ru.json';

const keys = (obj: object, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('locales', () => {
  it('ky и en содержат те же ключи, что ru', () => {
    expect(keys(ky).sort()).toEqual(keys(ru).sort());
    expect(keys(en).sort()).toEqual(keys(ru).sort());
  });
});

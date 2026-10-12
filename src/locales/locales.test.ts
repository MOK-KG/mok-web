import { describe, expect, it } from 'vitest';
import en from './en.json';
import ky from './ky.json';
import ru from './ru.json';

/** Ключи без суффиксов форм числа i18next: в русском их больше (_few, _many), чем в en/ky */
const keys = (obj: object, prefix = ''): string[] => [
  ...new Set(
    Object.entries(obj).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null
        ? keys(v, `${prefix}${k}.`)
        : [`${prefix}${k.replace(/_(zero|one|two|few|many|other)$/, '')}`],
    ),
  ),
];

describe('locales', () => {
  it('ky и en содержат те же ключи, что ru', () => {
    expect(keys(ky).sort()).toEqual(keys(ru).sort());
    expect(keys(en).sort()).toEqual(keys(ru).sort());
  });
});

/** Инициалы для аватара: «Айбек Дуйшеев» → «АД» */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

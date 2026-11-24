# Платформа НОК КР — веб

Интерфейс платформы цифровых операций НОК КР (React, Vite). В рабочей сборке раздаётся nginx,
который пересылает `/api`, `/google`, `/admin` бэкенду.

- **Развёртывание** платформы целиком: `docs/deploy.md` в репозитории `mok-backend`
- **Переменные сборки:** [.env.example](.env.example) — в рабочей сборке `VITE_API_URL` и `VITE_AUTH_MOCK` пустые
- **Разработка:** `pnpm install`, `pnpm dev`; перед коммитом `pnpm lint`, `pnpm test`, `pnpm build`

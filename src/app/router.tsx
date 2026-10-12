import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from './HomePage';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <HomePage />,
    },
  ],
  {
    // Поведение React Router v7 заранее — меньше работы при переходе и нет предупреждений в консоли
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);

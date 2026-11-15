import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '@/shared/api/client';
import { type Board, fetchBoard, tasksKey, useMoveTask } from '../api';
import { mockColumnId } from '../mock';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let move: ReturnType<typeof useMoveTask>;

function Probe() {
  move = useMoveTask();
  return null;
}

async function mount(queryClient: QueryClient) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
}

const key = [...tasksKey, 'board', 'department'];
const column = (board: Board, id: string) => board.tasks.find((t) => t.id === id)?.columnId;

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('перенос задачи на доске', () => {
  it('доска меняется сразу при отпускании, до ответа сервера', async () => {
    const queryClient = new QueryClient();
    const board = await fetchBoard('department');
    queryClient.setQueryData(key, board);
    await mount(queryClient);

    const task = board.tasks.find((t) => t.columnId === mockColumnId('queue'));
    const target = mockColumnId('in_progress');
    let release: () => void = () => {};
    vi.spyOn(client.api, 'post').mockImplementation(
      () => new Promise((resolve) => (release = () => resolve(undefined as never))),
    );

    act(() => move.mutate({ id: task?.id ?? '', columnId: target, beforeId: null }));
    expect(column(queryClient.getQueryData<Board>(key) as Board, task?.id ?? '')).toBe(target);

    await act(async () => release());
  });

  it('при ошибке сервера карточка возвращается на место', async () => {
    const queryClient = new QueryClient();
    const board = await fetchBoard('department');
    queryClient.setQueryData(key, board);
    await mount(queryClient);

    const task = board.tasks.find((t) => t.columnId === mockColumnId('queue'));
    const from = task?.columnId;
    vi.spyOn(client.api, 'post').mockRejectedValue(
      new client.ApiError(409, 'limit', { code: 'wip_limit' }),
    );

    await act(async () => {
      move.mutate({ id: task?.id ?? '', columnId: mockColumnId('in_progress'), beforeId: null });
    });
    await act(async () => new Promise((r) => setTimeout(r, 10)));
    expect(column(queryClient.getQueryData<Board>(key) as Board, task?.id ?? '')).toBe(from);
  });
});

import { useLocation, useSearchParams } from 'react-router-dom';
import { useCan } from '@/features/auth';
import { TaskModal } from './modal/TaskModal';

export function useTaskLink() {
  const location = useLocation();
  return (id: string) => {
    const params = new URLSearchParams(location.search);
    params.set('task', id);
    return `${location.pathname}?${params}`;
  };
}

export function TaskOverlay() {
  const { can } = useCan();
  const [params, setParams] = useSearchParams();
  const taskId = params.get('task');
  if (!can('tasks.view')) return null;
  return (
    <TaskModal
      taskId={taskId}
      onClose={() =>
        setParams((p) => {
          p.delete('task');
          return p;
        })
      }
    />
  );
}

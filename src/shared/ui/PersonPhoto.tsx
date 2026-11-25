import { useState } from 'react';
import { api } from '@/shared/api/client';
import { usePhotoVersion } from '@/shared/lib/photoVersion';

export const photoUrl = (id: string, version = 0) =>
  api.url(`/staff/photos/${id}`, version ? { v: version } : undefined);

export function PersonPhoto({ id }: { id: string | null | undefined }) {
  const version = usePhotoVersion();
  const [failed, setFailed] = useState<string | null>(null);
  const key = `${id}:${version}`;
  if (!id || !/^\d+$/.test(id) || failed === key) return null;
  return (
    <img
      src={photoUrl(id, version)}
      alt=""
      aria-hidden
      onError={() => setFailed(key)}
      className="absolute inset-0 size-full rounded-full object-cover"
    />
  );
}

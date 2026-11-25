import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/shared/api/client';
import { bumpPhotoVersion } from '@/shared/lib/photoVersion';

export function PhotoControls() {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.put('/auth/photo', form);
    },
    meta: { successMessage: 'profile.photo.saved' },
    onSuccess: bumpPhotoVersion,
  });
  const remove = useMutation({
    mutationFn: () => api.delete('/auth/photo'),
    meta: { successMessage: 'profile.photo.removed' },
    onSuccess: bumpPhotoVersion,
  });
  const link = 'text-[12px] font-medium text-info hover:underline disabled:opacity-50';
  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        className={link}
        disabled={upload.isPending}
        onClick={() => input.current?.click()}
      >
        {t('profile.photo.upload')}
      </button>
      <button
        type="button"
        className={link}
        disabled={remove.isPending}
        onClick={() => remove.mutate()}
      >
        {t('profile.photo.remove')}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        data-testid="photo-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

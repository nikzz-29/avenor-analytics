import { Suspense } from 'react';
import { PasswordRecovery } from '@/features/auth-form';
export default function Page() {
  return (
    <Suspense>
      <PasswordRecovery />
    </Suspense>
  );
}

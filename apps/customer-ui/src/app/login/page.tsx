import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/server-auth';
import { LoginClient } from './login-client';

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect('/inbox');
  }

  return <LoginClient />;
}

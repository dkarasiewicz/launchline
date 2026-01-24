import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/server-auth';
import TeamClient from './team-client';

export default async function TeamPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <TeamClient />;
}

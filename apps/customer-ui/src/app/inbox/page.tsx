import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/server-auth';
import InboxClient from './inbox-client';

export default async function InboxPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <InboxClient />;
}

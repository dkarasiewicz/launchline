import { cookies } from 'next/headers';
import { query } from '@launchline/ui/server';
import { gql } from '@apollo/client';

type CurrentUser = {
  id: string;
  email: string;
  name?: string;
  isVerified?: boolean;
  role?: string;
  isOnboarded?: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookie = await cookies();
  const sessionName = process.env.SESSION_NAME || 'core.sid';

  if (!cookie.get(sessionName)) {
    return null;
  }

  try {
    const response = await query<{
      getCurrentUserData: CurrentUser;
    }>({
      query: gql`
        query CurrentUser {
          getCurrentUserData {
            id
            email
            name
            isVerified
            role
            isOnboarded
          }
        }
      `,
    });

    if (!response.data) {
      return null;
    }

    return response.data.getCurrentUserData;
  } catch {
    return null;
  }
}

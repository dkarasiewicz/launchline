import { UserRole } from '@launchline/models';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  name: string | null;
  email: string | null;
  isVerified: boolean;
  isOnboarded: boolean;
}

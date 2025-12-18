import { UserRole } from '@launchline/models';

export interface UserDTO {
  customerEmail: string | null;
  name: string | null;
  role: UserRole;
  id: string;
}

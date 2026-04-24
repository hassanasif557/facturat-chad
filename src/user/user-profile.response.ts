import { User } from './user.entity';
import { Organization } from 'src/organization/organization.entity';
import { Subscription } from 'src/subscription/subscription.entity';
import { Plan } from 'src/plan/plan.entity';

export class UserProfileResponse {
  user!: Omit<User, 'password' | 'refreshToken'>;

  organization!: Organization | null;

  subscription!: Subscription | null;

  plan!: Plan | null;

  usage!: {
    invoicesUsed: number;
    userUsed: number;
  };
}
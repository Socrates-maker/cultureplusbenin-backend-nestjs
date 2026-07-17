import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { RequestUser } from '../../casl/casl-ability.factory';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // Authenticate with the email field instead of the default `username`.
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<RequestUser> {
    const user = await this.authService.validateUser(email, password);
    return { userId: user.id, email: user.email, role: user.role };
  }
}

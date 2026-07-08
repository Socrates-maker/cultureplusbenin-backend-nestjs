import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from '../../casl/casl-ability.factory';

interface JwtPayload {
  userId: string;
  email: string;
  role: RequestUser['role'];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // Whatever is returned here becomes `request.user`.
  validate(payload: JwtPayload): RequestUser {
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RequestUser } from '../casl/casl-ability.factory';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** Validates credentials for the Passport local strategy. */
  async validateUser(email: string, password: string): Promise<UserDocument> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    return this.sign(user);
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    return this.sign(user);
  }

  private sign(user: UserDocument) {
    const payload: RequestUser = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role,
      },
    };
  }
}

import { OmitType } from '@nestjs/swagger';
import { CreateUserDto } from '../../users/dto/create-user.dto';

// Public self-registration cannot set a role — it always defaults to `user`.
export class RegisterDto extends OmitType(CreateUserDto, ['role'] as const) {}

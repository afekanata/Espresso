import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

export interface AuthResult {
  accessToken: string;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async login(dto: LoginDto): Promise<AuthResult> {
    const expectedUsername = process.env.AUTH_USERNAME ?? 'admin';
    const expectedPassword = process.env.AUTH_PASSWORD ?? 'admin';

    // Plain comparison is fine for a single-user stub. Real prod = bcrypt hash
    // + per-user records + rate limiting; see README for the upgrade plan.
    if (dto.username !== expectedUsername || dto.password !== expectedPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwt.signAsync({
      sub: dto.username,
      username: dto.username,
    });
    return { accessToken, username: dto.username };
  }
}

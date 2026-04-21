import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto, tenantId: string) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, tenantId },
    });
    if (existing)
      throw new ConflictException('Email already registered in this tenant');

    const hashed = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: hashed,
        tenantId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.role,
      tenantId,
    );
    return { user, ...tokens };
  }

  async login(dto: LoginDto, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.role,
      tenantId,
    );
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refresh(rawRefreshToken: string, userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');

    try {
      const newRefreshToken =
        await this.tokenService.validateAndRotateRefreshToken(
          rawRefreshToken,
          userId,
        );

      const accessToken = this.tokenService.generateAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        tenantId,
      });
      return { accessToken, refreshToken: newRefreshToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.tokenService.revokeAllUserTokens(userId);
    return { message: 'Logged out successfully' };
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    tenantId: string,
  ) {
    const accessToken = this.tokenService.generateAccessToken({
      sub: userId,
      email,
      role,
      tenantId,
    });
    const refreshToken = await this.tokenService.generateRefreshToken(userId);
    return { accessToken, refreshToken };
  }
}

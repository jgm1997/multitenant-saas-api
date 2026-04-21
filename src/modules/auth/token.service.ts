import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  generateAccessToken(payload: JwtPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN'),
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwt.verify(token, {
      secret: this.config.get('JWT_SECRET'),
    });
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const rawToken = randomUUID();
    const hashed = await bcrypt.hash(rawToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        token: hashed,
        userId,
        expiresAt,
      },
    });
    return rawToken;
  }

  async validateAndRotateRefreshToken(
    rawToken: string,
    userId: string,
  ): Promise<string> {
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    let matchedToken: (typeof storedTokens)[number] | null = null;
    for (const stored of storedTokens) {
      const isMatch = await bcrypt.compare(rawToken, stored.token);
      if (isMatch) {
        matchedToken = stored;
        break;
      }
    }

    if (!matchedToken) {
      await this.revokeAllUserTokens(userId);
      throw new Error('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revokedAt: new Date() },
    });
    return this.generateRefreshToken(userId);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

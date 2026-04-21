import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../token.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  expect,
  it,
} from '@jest/globals';

// Mock PrismaService — we don't want a real DB in unit tests
const mockPrisma = {
  refreshToken: {
    create: jest.fn<(...args: any[]) => Promise<any>>(),
    findMany: jest.fn<(...args: any[]) => Promise<any>>(),
    update: jest.fn<(...args: any[]) => Promise<any>>(),
    updateMany: jest.fn<(...args: any[]) => Promise<any>>(),
  },
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '15m',
    };
    return config[key];
  }),
};

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        JwtService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  afterEach(async () => jest.clearAllMocks());

  describe('generateAccessToken', () => {
    it('should return a signed JWT string', () => {
      const payload = {
        sub: 'user-123',
        email: 'test@test.com',
        role: 'MEMBER',
        tenantId: 'tenant-123',
      };

      const token = service.generateAccessToken(payload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // Valid JWT has 3 parts
    });
  });

  describe('verifyAccessToken', () => {
    it('should decode a valid token', () => {
      const payload = {
        sub: 'user-123',
        email: 'test@test.com',
        role: 'MEMBER',
        tenantId: 'tenant-123',
      };

      const token = service.generateAccessToken(payload);
      const decoded = service.verifyAccessToken(token);

      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.tenantId).toBe(payload.tenantId);
    });

    it('should throw on an invalid token', () => {
      expect(() => service.verifyAccessToken('invalid.token.here')).toThrow();
    });
  });

  describe('generateRefreshToken', () => {
    it('should store a hashed token and return a raw token', async () => {
      (mockPrisma.refreshToken.create as jest.Mock<any>).mockResolvedValue({});

      const rawToken = await service.generateRefreshToken('user-123');

      expect(typeof rawToken).toBe('string');
      expect(rawToken.length).toBeGreaterThan(10);

      // Stored token should be hashed — not equal to raw
      const storedArg = mockPrisma.refreshToken.create.mock.calls[0][0];
      expect(storedArg.data.token).not.toBe(rawToken);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should call updateMany with revokedAt set', async () => {
      (mockPrisma.refreshToken.updateMany as jest.Mock<any>).mockResolvedValue({ count: 2 });

      await service.revokeAllUserTokens('user-123');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-123' }),
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });
  });
});

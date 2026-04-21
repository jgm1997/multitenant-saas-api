import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { TokenService } from '../token.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  jest,
  describe,
  beforeEach,
  beforeAll,
  afterEach,
  expect,
  it,
} from '@jest/globals';

const TENANT_ID = 'tenant-abc';

const mockUser = {
  id: 'user-123',
  email: 'john@acme.com',
  password: '',
  firstName: 'John',
  lastName: 'Doe',
  role: 'MEMBER',
  tenantId: TENANT_ID,
  createdAt: new Date(),
};

const mockPrisma = {
  user: {
    findFirst: jest.fn<(...args: any[]) => Promise<any>>(),
    create: jest.fn<(...args: any[]) => Promise<any>>(),
  },
  refreshToken: {
    create: jest.fn<(...args: any[]) => Promise<any>>(),
    findMany: jest.fn<(...args: any[]) => Promise<any>>(),
    update: jest.fn<(...args: any[]) => Promise<any>>(),
    updateMany: jest.fn<(...args: any[]) => Promise<any>>(),
  },
};

describe('AuthService (integration)', () => {
  let service: AuthService;

  beforeAll(async () => {
    // Pre-hash a password once for all tests
    mockUser.password = await bcrypt.hash('password123', 12);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        TokenService,
        JwtService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({ JWT_SECRET: 'test-secret', JWT_EXPIRES_IN: '15m' })[key],
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(async () => jest.clearAllMocks());

  describe('register', () => {
    it('should create a user and return tokens', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null); // No existing user
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'new@acme.com',
        firstName: 'New',
        lastName: 'User',
        role: 'MEMBER',
        createdAt: new Date(),
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(
        {
          firstName: 'New',
          lastName: 'User',
          email: 'new@acme.com',
          password: 'password123',
        },
        TENANT_ID,
      );

      expect(result.user.email).toBe('new@acme.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.register(
          {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@acme.com',
            password: 'password123',
          },
          TENANT_ID,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(
        { email: 'john@acme.com', password: 'password123' },
        TENANT_ID,
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('john@acme.com');
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.login(
          { email: 'john@acme.com', password: 'wrongpassword' },
          TENANT_ID,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login(
          { email: 'ghost@acme.com', password: 'password123' },
          TENANT_ID,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

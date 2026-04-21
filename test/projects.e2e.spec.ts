import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { afterAll, beforeAll, describe, it, expect } from '@jest/globals';

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let aliceToken: string;
  let bobToken: string;
  let projectId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Clean up test data in correct order (FK constraints)
    await prisma.project.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
    await app.close();
  });

  // ─── SETUP ────────────────────────────────────────────
  it('should set up tenant and users', async () => {
    // Create tenant
    await request(app.getHttpServer())
      .post('/api/v1/tenants')
      .send({ name: 'E2E Corp', slug: 'e2e-corp' })
      .expect(201);

    // Register Alice (will be MEMBER by default)
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-tenant-slug', 'e2e-corp')
      .send({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@e2e.com',
        password: 'password123',
      })
      .expect(201);

    // Register Bob
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-tenant-slug', 'e2e-corp')
      .send({
        firstName: 'Bob',
        lastName: 'Jones',
        email: 'bob@e2e.com',
        password: 'password123',
      })
      .expect(201);

    // Login Alice
    const aliceRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-tenant-slug', 'e2e-corp')
      .send({ email: 'alice@e2e.com', password: 'password123' })
      .expect(200);
    aliceToken = aliceRes.body.accessToken;

    // Login Bob
    const bobRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-tenant-slug', 'e2e-corp')
      .send({ email: 'bob@e2e.com', password: 'password123' })
      .expect(200);
    bobToken = bobRes.body.accessToken;
  });

  // ─── CREATE ────────────────────────────────────────────
  it('Alice should create a project', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('x-tenant-slug', 'e2e-corp')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'Project Alpha', description: 'Test project' })
      .expect(201);

    expect(res.body.name).toBe('Project Alpha');
    expect(res.body.owner.email).toBe('alice@e2e.com');
    projectId = res.body.id;
  });

  it('should reject project creation without auth', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('x-tenant-slug', 'e2e-corp')
      .send({ name: 'Sneaky Project' })
      .expect(401);
  });

  // ─── READ ──────────────────────────────────────────────
  it('Bob should list all projects in the tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('x-tenant-slug', 'e2e-corp')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].name).toBe('Project Alpha');
  });

  // ─── OWNERSHIP ─────────────────────────────────────────
  it("Bob should NOT update Alice's project", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('x-tenant-slug', 'e2e-corp')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: 'Hijacked' })
      .expect(403);
  });

  it('Alice should update her own project', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('x-tenant-slug', 'e2e-corp')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'Project Alpha Updated' })
      .expect(200);

    expect(res.body.name).toBe('Project Alpha Updated');
  });

  // ─── ROLES ─────────────────────────────────────────────
  it('Bob (MEMBER) should NOT delete a project', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}`)
      .set('x-tenant-slug', 'e2e-corp')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(403);
  });

  // ─── TENANT ISOLATION ──────────────────────────────────
  it('should not see projects from another tenant', async () => {
    // Create a second tenant
    await request(app.getHttpServer())
      .post('/api/v1/tenants')
      .send({ name: 'Other Corp', slug: 'other-corp' })
      .expect(201);

    // Register user in other tenant
    const otherRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-tenant-slug', 'other-corp')
      .send({
        firstName: 'Eve',
        lastName: 'Other',
        email: 'eve@other.com',
        password: 'password123',
      })
      .expect(201);

    const otherToken = otherRes.body.accessToken;

    // Eve should see zero projects — isolation works
    const res = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('x-tenant-slug', 'other-corp')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);

    expect(res.body).toHaveLength(0);
  });
});

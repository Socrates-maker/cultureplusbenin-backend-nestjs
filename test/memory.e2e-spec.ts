/// <reference types="jest" />

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { Model } from 'mongoose';
import { AppModule } from './../src/app.module';
import { Role } from './../src/common/enums/role.enum';
import { User, UserDocument } from './../src/users/schemas/user.schema';
import { UsersService } from './../src/users/users.service';

jest.setTimeout(60_000);

describe('Memory items (e2e)', () => {
  let app: INestApplication<App>;
  let usersModel: Model<UserDocument>;

  let adminToken: string;
  let userToken: string;
  let adminEmail: string;
  let userEmail: string;

  const password = 'S3curePass!';

  beforeAll(async () => {
    if (!process.env.MONGODB_URI) {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/cultureplusbenin';
    }
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'dev-secret-change-me-please-0123456789';
    }
    if (!process.env.JWT_EXPIRES_IN) {
      process.env.JWT_EXPIRES_IN = '1d';
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    usersModel = app.get<Model<UserDocument>>(getModelToken(User.name));

    const runSuffix = `${Date.now()}`;
    adminEmail = `admin.memory.${runSuffix}@test.bj`;
    userEmail = `user.memory.${runSuffix}@test.bj`;

    const usersService = app.get(UsersService);
    await usersService.create({
      email: adminEmail,
      firstname: 'Ad',
      lastname: 'Min',
      password,
      role: Role.ADMIN,
    });

    const server = app.getHttpServer();

    await request(server)
      .post('/auth/register')
      .send({
        email: userEmail,
        firstname: 'Reg',
        lastname: 'User',
        password,
      })
      .expect(201);

    adminToken = (
      await request(server)
        .post('/auth/login')
        .send({ email: adminEmail, password })
        .expect(201)
    ).body.accessToken;

    userToken = (
      await request(server)
        .post('/auth/login')
        .send({ email: userEmail, password })
        .expect(201)
    ).body.accessToken;

    await request(server)
      .post('/admin/memory/seed')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  }, 60_000);

  afterAll(async () => {
    if (usersModel) {
      await usersModel.deleteMany({ email: { $in: [adminEmail, userEmail] } }).exec();
    }
    await app?.close();
  });

  it('returns seeded items from the public memory route for an authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/memory/items')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(6);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        image: expect.any(String),
      }),
    );
  });
});
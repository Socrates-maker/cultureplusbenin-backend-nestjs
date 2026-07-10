import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Role } from './../src/common/enums/role.enum';
import { UsersService } from './../src/users/users.service';

/**
 * End-to-end coverage for the tourist-site moderation workflow:
 * users submit sites that stay hidden until an admin validates them, while
 * editors / admins publish directly.
 */
describe('TouristSites moderation (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication<App>;

  let adminToken: string;
  let userToken: string;
  let cityId: string;

  const password = 'S3curePass!';

  beforeAll(async () => {
    // Point the app at an isolated in-memory Mongo before it boots. dotenv
    // (ConfigModule) does not override already-set env vars, so this wins.
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    // AppModule only reads these env vars when it initializes below (ConfigModule
    // during compile()), and dotenv never overrides an already-set var, so the
    // in-memory Mongo uri wins over the one in .env.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    // Seed an admin (no public endpoint grants the admin role).
    const usersService = app.get(UsersService);
    await usersService.create({
      email: 'admin@test.bj',
      firstname: 'Ad',
      lastname: 'Min',
      password,
      role: Role.ADMIN,
    });

    const server = app.getHttpServer();

    // Register a regular user through the public flow.
    await request(server)
      .post('/auth/register')
      .send({
        email: 'user@test.bj',
        firstname: 'Reg',
        lastname: 'User',
        password,
      })
      .expect(201);

    adminToken = (
      await request(server)
        .post('/auth/login')
        .send({ email: 'admin@test.bj', password })
        .expect(201)
    ).body.accessToken;

    userToken = (
      await request(server)
        .post('/auth/login')
        .send({ email: 'user@test.bj', password })
        .expect(201)
    ).body.accessToken;

    // An admin-owned city the sites will be attached to.
    cityId = (
      await request(server)
        .post('/cities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ouidah',
          description: 'Ville historique.',
          location: { latitude: 6.3626, longitude: 2.0853 },
        })
        .expect(201)
    ).body._id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  const server = () => app.getHttpServer();
  const siteBody = (name: string) => ({
    name,
    description: 'Un site de test.',
    location: { latitude: 6.36, longitude: 2.08 },
    city: cityId,
  });

  let siteId: string;

  it('a user submission is created pending', async () => {
    const res = await request(server())
      .post('/tourist-sites')
      .set('Authorization', `Bearer ${userToken}`)
      .send(siteBody('Porte du Non-Retour'))
      .expect(201);

    expect(res.body.status).toBe('pending');
    expect(res.body.reviewedBy).toBeUndefined();
    siteId = res.body._id;
  });

  it('hides the pending site from the public list', async () => {
    const res = await request(server()).get('/tourist-sites').expect(200);
    expect(res.body.map((s: { _id: string }) => s._id)).not.toContain(siteId);
  });

  it('returns 404 on the public detail of a pending site', () =>
    request(server()).get(`/tourist-sites/${siteId}`).expect(404));

  it('lets the owner see their own pending submission via /mine', async () => {
    const res = await request(server())
      .get('/tourist-sites/mine')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const mine = res.body.find((s: { _id: string }) => s._id === siteId);
    expect(mine).toBeDefined();
    expect(mine.status).toBe('pending');
  });

  it('forbids non-admins from the moderation queue', () =>
    request(server())
      .get('/tourist-sites/pending')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403));

  it('shows the submission in the admin moderation queue', async () => {
    const res = await request(server())
      .get('/tourist-sites/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.map((s: { _id: string }) => s._id)).toContain(siteId);
  });

  it('forbids non-admins from approving', () =>
    request(server())
      .patch(`/tourist-sites/${siteId}/approve`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403));

  it('publishes the site once an admin approves it', async () => {
    const res = await request(server())
      .patch(`/tourist-sites/${siteId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.reviewedBy).toBeDefined();

    const list = await request(server()).get('/tourist-sites').expect(200);
    expect(list.body.map((s: { _id: string }) => s._id)).toContain(siteId);
    await request(server()).get(`/tourist-sites/${siteId}`).expect(200);
  });

  it('sends an approved site back to moderation when its owner edits it', async () => {
    const res = await request(server())
      .patch(`/tourist-sites/${siteId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Porte du Non-Retour (maj)' })
      .expect(200);
    expect(res.body.status).toBe('pending');

    const list = await request(server()).get('/tourist-sites').expect(200);
    expect(list.body.map((s: { _id: string }) => s._id)).not.toContain(siteId);
  });

  it('auto-approves a submission created by an admin', async () => {
    const res = await request(server())
      .post('/tourist-sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(siteBody('Temple des Pythons'))
      .expect(201);
    expect(res.body.status).toBe('approved');

    const list = await request(server()).get('/tourist-sites').expect(200);
    expect(list.body.map((s: { _id: string }) => s._id)).toContain(
      res.body._id,
    );
  });

  it('rejects a submission with a reason and keeps it hidden', async () => {
    const created = await request(server())
      .post('/tourist-sites')
      .set('Authorization', `Bearer ${userToken}`)
      .send(siteBody('Site douteux'))
      .expect(201);
    const rejectedId = created.body._id;

    const res = await request(server())
      .patch(`/tourist-sites/${rejectedId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Informations non vérifiables.' })
      .expect(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.rejectionReason).toBe('Informations non vérifiables.');

    await request(server()).get(`/tourist-sites/${rejectedId}`).expect(404);
  });
});

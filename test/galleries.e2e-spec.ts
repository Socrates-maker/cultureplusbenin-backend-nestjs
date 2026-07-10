import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Role } from './../src/common/enums/role.enum';
import { UsersService } from './../src/users/users.service';

/**
 * End-to-end coverage for attaching galleries to tourist sites: a gallery is
 * polymorphic and can belong to either a City or a TouristSite, and the site
 * detail exposes its galleries.
 */
describe('Galleries on tourist sites (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication<App>;

  let adminToken: string;
  let cityId: string;
  let siteId: string;

  const password = 'S3curePass!';

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const usersService = app.get(UsersService);
    await usersService.create({
      email: 'admin@test.bj',
      firstname: 'Ad',
      lastname: 'Min',
      password,
      role: Role.ADMIN,
    });

    const server = app.getHttpServer();
    adminToken = (
      await request(server)
        .post('/auth/login')
        .send({ email: 'admin@test.bj', password })
        .expect(201)
    ).body.accessToken;

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

    // An admin-owned site publishes directly (approved), so it is publicly
    // visible for the gallery assertions below.
    siteId = (
      await request(server)
        .post('/tourist-sites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Porte du Non-Retour',
          description: 'Un site de test.',
          location: { latitude: 6.36, longitude: 2.08 },
          city: cityId,
        })
        .expect(201)
    ).body._id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  const server = () => app.getHttpServer();

  let galleryId: string;

  it('creates a gallery owned by a tourist site', async () => {
    const res = await request(server())
      .post('/galleries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Galerie du mémorial',
        description: 'Photos du site.',
        ownerType: 'TouristSite',
        owner: siteId,
      })
      .expect(201);

    expect(res.body.ownerType).toBe('TouristSite');
    expect(res.body.owner).toBe(siteId);
    galleryId = res.body._id;
  });

  it('rejects a gallery whose owner does not exist', () =>
    request(server())
      .post('/galleries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Galerie orpheline',
        description: 'Sans propriétaire.',
        ownerType: 'TouristSite',
        owner: '507f1f77bcf86cd799439099',
      })
      .expect(404));

  it('filters galleries by owner', async () => {
    const res = await request(server())
      .get(`/galleries?ownerType=TouristSite&owner=${siteId}`)
      .expect(200);
    expect(res.body.map((g: { _id: string }) => g._id)).toContain(galleryId);
  });

  it('exposes the galleries on the tourist site detail', async () => {
    const res = await request(server())
      .get(`/tourist-sites/${siteId}`)
      .expect(200);
    expect(res.body.galleries.map((g: { _id: string }) => g._id)).toContain(
      galleryId,
    );
  });
});

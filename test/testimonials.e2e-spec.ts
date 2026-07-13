import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Role } from './../src/common/enums/role.enum';
import { UsersService } from './../src/users/users.service';

/**
 * End-to-end coverage for testimonials: a user submits a testimonial about a
 * tourist site, attaches a cover image and a video/audio media it owns, and an
 * admin validates it. Also checks the media-attachment guard rails.
 */
describe('Testimonials (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication<App>;

  let adminToken: string;
  let userToken: string;
  let cityId: string;
  let siteId: string;
  let testimonialId: string;
  let coverId: string;
  let videoId: string;

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
    await request(server)
      .post('/auth/register')
      .send({ email: 'user@test.bj', firstname: 'Reg', lastname: 'User', password })
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

  it('a user testimonial submission is created pending', async () => {
    const res = await request(server())
      .post('/testimonials')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Une visite bouleversante',
        description: 'Ce site m’a profondément marqué.',
        subjectType: 'TouristSite',
        subject: siteId,
      })
      .expect(201);

    expect(res.body.status).toBe('pending');
    testimonialId = res.body._id;
  });

  it('hides the pending testimonial from the public list', async () => {
    const res = await request(server()).get('/testimonials').expect(200);
    expect(res.body.data.map((t: { _id: string }) => t._id)).not.toContain(
      testimonialId,
    );
  });

  it('lets the owner attach a cover image owned by the testimonial', async () => {
    const res = await request(server())
      .post('/media')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Cover',
        description: 'Photo de couverture.',
        type: 'image',
        url: 'https://cdn.cultureplus.bj/cover.jpg',
        ownerType: 'Testimonial',
        owner: testimonialId,
      })
      .expect(201);
    coverId = res.body._id;

    const video = await request(server())
      .post('/media')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Vidéo',
        description: 'Témoignage vidéo.',
        type: 'video',
        url: 'https://cdn.cultureplus.bj/video.mp4',
        ownerType: 'Testimonial',
        owner: testimonialId,
      })
      .expect(201);
    videoId = video.body._id;
  });

  it('forbids a user from attaching media to a non-owned resource', () =>
    request(server())
      .post('/media')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Illégal',
        description: 'Média sur une ville.',
        type: 'image',
        url: 'https://cdn.cultureplus.bj/x.jpg',
        ownerType: 'City',
        owner: cityId,
      })
      .expect(403));

  it('rejects a cover of the wrong media type', () =>
    request(server())
      .patch(`/testimonials/${testimonialId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ coverMedia: videoId })
      .expect(400));

  it('attaches the cover and video to the testimonial', async () => {
    const res = await request(server())
      .patch(`/testimonials/${testimonialId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ coverMedia: coverId, media: videoId })
      .expect(200);
    expect(res.body.coverMedia).toBeDefined();
    expect(res.body.media).toBeDefined();
  });

  it('publishes the testimonial once an admin approves it', async () => {
    const res = await request(server())
      .patch(`/testimonials/${testimonialId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.status).toBe('approved');
  });

  it('exposes the approved testimonial publicly with populated media', async () => {
    const res = await request(server())
      .get(`/testimonials?subjectType=TouristSite&subject=${siteId}`)
      .expect(200);
    const found = res.body.data.find(
      (t: { _id: string }) => t._id === testimonialId,
    );
    expect(found).toBeDefined();
    expect(found.coverMedia.type).toBe('image');
    expect(found.media.type).toBe('video');
  });
});

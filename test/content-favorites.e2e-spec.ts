import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Role } from './../src/common/enums/role.enum';
import { UsersService } from './../src/users/users.service';

/**
 * End-to-end coverage for the editorial content types (stories, traditions,
 * events) and user favorites.
 */
describe('Stories / Traditions / Events / Favorites (e2e)', () => {
  let mongo: MongoMemoryServer;
  let app: INestApplication<App>;

  let adminToken: string;
  let userToken: string;

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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    // Global search relies on the text indexes: wait until they are built.
    const connection = app.get<Connection>(getConnectionToken());
    await Promise.all(
      Object.values(connection.models).map((model) => model.init()),
    );

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
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  const server = () => app.getHttpServer();

  let storyId: string;
  let traditionId: string;
  let eventId: string;

  it('lets an admin create a story and filters it by category', async () => {
    const res = await request(server())
      .post('/stories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'La résistance de Béhanzin',
        description: 'Le dernier roi du Dahomey face à la colonisation.',
        body: 'En 1890, les troupes françaises débarquèrent à Cotonou…',
        category: 'resistance',
        tags: ['Résistance ', 'histoire'],
      })
      .expect(201);
    expect(res.body.tags).toEqual(['résistance', 'histoire']);
    storyId = res.body._id;

    const list = await request(server())
      .get('/stories?category=resistance')
      .expect(200);
    expect(list.body.data.map((s: { _id: string }) => s._id)).toContain(
      storyId,
    );

    const none = await request(server())
      .get('/stories?category=conte')
      .expect(200);
    expect(none.body.data).toHaveLength(0);
  });

  it('forbids a regular user from creating a story', () =>
    request(server())
      .post('/stories')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'x',
        description: 'y',
        body: 'z',
        category: 'conte',
      })
      .expect(403));

  it('rejects an invalid story category', () =>
    request(server())
      .post('/stories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'x',
        description: 'y',
        body: 'z',
        category: 'nope',
      })
      .expect(400));

  it('lets an admin create a tradition and an event', async () => {
    const tradition = await request(server())
      .post('/traditions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Gèlèdé',
        description: 'Patrimoine culturel immatériel.',
        origin: 'Communautés yoruba-nago du Bénin.',
      })
      .expect(201);
    traditionId = tradition.body._id;

    const event = await request(server())
      .post('/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Festival Vodoun',
        description: 'Célébration annuelle à Ouidah.',
        origin: 'Fête nationale instituée en 1997.',
        date: '2026-01-10',
      })
      .expect(201);
    eventId = event.body._id;

    const traditions = await request(server()).get('/traditions').expect(200);
    expect(
      traditions.body.data.map((t: { _id: string }) => t._id),
    ).toContain(traditionId);

    const events = await request(server()).get('/events').expect(200);
    expect(events.body.data.map((e: { _id: string }) => e._id)).toContain(
      eventId,
    );
  });

  it('attaches a gallery and a testimonial to a story', async () => {
    const gallery = await request(server())
      .post('/galleries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Galerie du récit',
        description: 'Images du récit.',
        ownerType: 'Story',
        owner: storyId,
      })
      .expect(201);

    const detail = await request(server())
      .get(`/stories/${storyId}`)
      .expect(200);
    expect(detail.body.galleries.map((g: { _id: string }) => g._id)).toContain(
      gallery.body._id,
    );

    await request(server())
      .post('/testimonials')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Ce récit m’a marqué',
        description: 'Une histoire que je ne connaissais pas.',
        subjectType: 'Story',
        subject: storyId,
      })
      .expect(201);
  });

  it('favorites items, lists them and stays idempotent', async () => {
    await request(server())
      .post('/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ itemType: 'Story', item: storyId })
      .expect(201);
    // Re-adding the same favorite is a no-op, not an error.
    await request(server())
      .post('/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ itemType: 'Story', item: storyId })
      .expect(201);
    await request(server())
      .post('/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ itemType: 'Tradition', item: traditionId })
      .expect(201);

    const all = await request(server())
      .get('/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(all.body.total).toBe(2);
    // The favorited entity is populated.
    const storyFav = all.body.data.find(
      (f: { itemType: string }) => f.itemType === 'Story',
    );
    expect(storyFav.item.title).toBe('La résistance de Béhanzin');

    const filtered = await request(server())
      .get('/favorites?itemType=Tradition')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(filtered.body.total).toBe(1);
  });

  it('rejects favoriting a missing entity and requires auth', async () => {
    await request(server())
      .post('/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ itemType: 'Event', item: '507f1f77bcf86cd799439099' })
      .expect(404);
    await request(server()).get('/favorites').expect(401);
  });

  it('globally searches across content types, ranked by title match', async () => {
    const res = await request(server()).get('/search?q=Béhanzin').expect(200);
    const story = res.body.results.find(
      (r: { id: string }) => r.id === storyId,
    );
    expect(story).toBeDefined();
    expect(story.type).toBe('story');
    // Title matches rank first.
    expect(res.body.results[0].title).toContain('Béhanzin');

    const tradition = await request(server())
      .get('/search?q=gèlèdé')
      .expect(200);
    expect(
      tradition.body.results.map((r: { id: string }) => r.id),
    ).toContain(traditionId);

    const none = await request(server())
      .get('/search?q=zzzzintrouvable')
      .expect(200);
    expect(none.body.results).toHaveLength(0);
  });

  it('matches accent-insensitively (text index) and partial words (fallback)', async () => {
    // "behanzin" only matches "Béhanzin" thanks to the French text index.
    const accentless = await request(server())
      .get('/search?q=behanzin')
      .expect(200);
    expect(
      accentless.body.results.map((r: { id: string }) => r.id),
    ).toContain(storyId);

    // "Béhan" is a partial word: $text finds nothing, the regex fallback does.
    const partial = await request(server())
      .get('/search?q=Béhan')
      .expect(200);
    expect(partial.body.results.map((r: { id: string }) => r.id)).toContain(
      storyId,
    );

    // Partial AND accentless: the fallback regex must fold accents too.
    const partialAccentless = await request(server())
      .get('/search?q=behan')
      .expect(200);
    expect(
      partialAccentless.body.results.map((r: { id: string }) => r.id),
    ).toContain(storyId);
  });

  it('rejects a missing or too-short search query', async () => {
    await request(server()).get('/search').expect(400);
    await request(server()).get('/search?q=a').expect(400);
  });

  it('hides pending submissions from the global search', async () => {
    // A regular user's tourist site stays pending — invisible to search.
    const cityId = (
      await request(server())
        .post('/cities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ouidah',
          description: 'Ville historique.',
          location: { latitude: 6.3626, longitude: 2.0853 },
        })
        .expect(201)
    ).body._id;
    const pending = await request(server())
      .post('/tourist-sites')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Site secret en attente',
        description: 'Ne doit pas sortir dans la recherche.',
        location: { latitude: 6.36, longitude: 2.08 },
        city: cityId,
      })
      .expect(201);
    expect(pending.body.status).toBe('pending');

    const res = await request(server())
      .get('/search?q=Site secret')
      .expect(200);
    expect(res.body.results.map((r: { id: string }) => r.id)).not.toContain(
      pending.body._id,
    );
  });

  it("keeps favorites scoped to their owner and removes idempotently", async () => {
    const adminList = await request(server())
      .get('/favorites')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminList.body.total).toBe(0);

    await request(server())
      .delete(`/favorites/Story/${storyId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(204);
    // Removing again is a no-op.
    await request(server())
      .delete(`/favorites/Story/${storyId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(204);

    const after = await request(server())
      .get('/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(after.body.total).toBe(1);
  });
});

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Backend API for **CulturePlus Benin** — a dashboard where authorized users register
Beninese **cities** (villes) and their **tourist sites** (lieux touristiques).
Built with NestJS, MongoDB (Mongoose), Passport (JWT) authentication, and CASL for
role-based permissions. API documentation is served by Swagger at `/docs`.

### Environment

Copy `.env.example` to `.env` and adjust:

```bash
PORT=3000
MONGODB_URI=mongodb://localhost:27017/cultureplusbenin
JWT_SECRET=change-me-to-a-long-random-secret
JWT_EXPIRES_IN=1d
```

### Data model

- **City** (ville): `name`, `description`, `location` (address + lat/lng), plus a virtual `media` list.
- **TouristSite** (lieu touristique): same fields + a `city` reference, plus a virtual `media` list.
- **Media**: `name`, `description`, `type` (`image` \| `video` \| `audio`), `url`, and a
  polymorphic owner (`ownerType` = `City` \| `TouristSite`, `owner` = its id). A media belongs
  to exactly one city or tourist site. `GET /cities/:id` and `GET /tourist-sites/:id` return
  their media inline (populated).

### Roles & permissions (CASL)

| Role     | Cities / Sites / Media                          | Users            |
| -------- | ----------------------------------------------- | ---------------- |
| `user`   | read only                                       | read/update self |
| `editor` | read all, create, update/delete **their own**   | read/update self |
| `admin`  | full access to everything                       | manage all users |

Authorization is enforced in two layers: the `PoliciesGuard` gates each route by
role (subject-level), and the services enforce record-level ownership so an editor
can only modify content they created.

### Auth endpoints

- `POST /auth/register` — self sign-up (always creates a `user`; the `role` field is ignored).
- `POST /auth/login` — returns `{ accessToken, user }`. Send the token as `Authorization: Bearer <token>`.
- `GET /auth/profile` — current token payload.

### Bootstrapping the first admin

Self-registration only creates `user` accounts. Promote an existing account to
`editor`/`admin` directly in MongoDB:

```js
db.users.updateOne({ email: 'you@example.com' }, { $set: { role: 'admin' } });
```

### Main resources

- `cities` — `GET` (public), `POST` / `PATCH` / `DELETE` (editor/admin).
- `tourist-sites` — `GET` (public, filter with `?city=<id>`), `POST` / `PATCH` / `DELETE` (editor/admin).
- `media` — `GET` (public, filter with `?ownerType=City|TouristSite&owner=<id>&type=image|video|audio`),
  `POST` / `PATCH` / `DELETE` (editor/admin). Create with `{ name, description, type, url, ownerType, owner }`.
- `users` — admin only (except `GET /users/me`).

---

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

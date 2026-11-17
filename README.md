# Boosie Network — backend

Express + TypeScript + MongoDB (Mongoose) API and CMS. See `../ADMIN_CONTENT_INVENTORY.md` for what it manages and why.

## Setup
```bash
cd backend
cp .env.example .env        # fill in MONGODB_URI, JWT_SECRET, (Cloudinary keys when you have them)
npm install
npm run seed                # loads today's site content (safe to re-run; `-- --reset` rebuilds content)
# first administrator (one time):
#   set ADMIN_EMAIL and ADMIN_PASSWORD in .env, then:
npm run bootstrap-admin     # then delete ADMIN_PASSWORD from .env
npm run dev                 # http://localhost:4000
```

- `npm run dev:memory` starts a throw-away server with an in-memory database, seeded content, a demo admin and stub image storage. It needs a machine that can run `mongodb-memory-server` (on Windows: the Microsoft Visual C++ Redistributable).
- Images that came from the original site are stored as `local` media (served by the React app). Uploading a replacement in the admin moves that image to Cloudinary.

## Tests
```bash
npm test                    # no-database tests always run
TEST_MONGO_URI="mongodb+srv://…/throwaway" npm test   # also runs the 48 database-backed workflow tests
```
Database tests are skipped (and reported as skipped) when no test database is available. They drop their own database — never point `TEST_MONGO_URI` at real data.

## Security notes
Passwords: bcrypt (cost 12). Sessions: JWT in an HttpOnly, SameSite=Lax cookie (Secure in production); role and active state are re-read from the database on every request. State-changing admin requests are also checked against `CLIENT_ORIGIN`. Public submissions are validated, rate-limited, honeypot-protected and priced on the server. Uploads are limited to JPEG/PNG/WebP/GIF, verified by file signature, max 8 MB.

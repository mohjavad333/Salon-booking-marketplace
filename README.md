
# Salon Booking Marketplace

A full-stack marketplace for booking appointments at women's and men's salons. Customers can discover salons, check real-time availability, book services with their preferred staff member, and pay online. Salon owners manage their staff, schedules, services, and reports, while platform admins oversee the whole marketplace.

## Screenshots

### Home

![Home page](./docs/screenshots/home.png)

### Sign in

![Sign in](./docs/screenshots/login.png)

### Salons

![Salons](./docs/screenshots/salons.png)

### Booking

![Booking](./docs/screenshots/reserve.png)

### Admin panel

![Admin panel](./docs/screenshots/admin_panel.png)

## Features

**For customers**
- **Salon discovery** — browse salons and open detailed salon profiles
- **Availability-based booking** — pick a service, staff member, date, and time from the open slots
- **My bookings** — view, manage, and track upcoming and past appointments
- **Online payments** — pay for bookings, with payment result pages and refund support
- **Reviews** — rate and review salons after a visit
- **Favorites** — save the salons you like
- **Notifications** — stay updated about booking changes

**For salon owners**
- **Dashboard and calendar** — see all bookings at a glance
- **Staff management** — add staff and assign them to services
- **Availability control** — set working hours for the salon and for each staff member, plus exceptions such as holidays and days off
- **Salon settings** — manage the salon's profile and booking settings
- **Reports** — view booking and revenue reports

**For admins**
- **Admin dashboard** — oversee salons, users, and marketplace activity
- **Admin actions** — moderate and manage the platform

**Under the hood**
- Booking lifecycle service for status changes
- Availability engine that takes salon and staff schedules into account
- Request validation with Zod
- Database migrations, integration tests, and end-to-end tests

## Tech Stack

**Frontend**
- React 18 + TypeScript, built with Vite
- React Router and TanStack Query
- Tailwind CSS and shadcn/ui (Radix UI)
- Framer Motion for animations
- Recharts for reports

**Backend**
- Node.js + Express 5 + TypeScript
- PostgreSQL (`pg`) with TypeScript migrations
- Zod validation
- Repository and service layers

**Tooling and deployment**
- pnpm
- Vitest for unit, integration, and end-to-end tests
- Prettier and TypeScript type checking
- Netlify (static client + serverless API via `serverless-http`)

## Project Structure

```
Salon-booking-marketplace
├─ client/                  # React app
│  ├─ components/           # layout/, salon-card, ui/ (shadcn/ui)
│  ├─ hooks/                # use-mobile, use-toast
│  ├─ lib/                  # auth-context, salons-data, utils
│  └─ pages/                # Index, Salons, SalonProfile, MyBookings, Dashboard,
│                           # Schedule, Staff, StaffSchedule, SalonSettings,
│                           # OwnerReports, AdminDashboard, PaymentResult, ...
├─ server/                  # Express API
│  ├─ middleware/           # auth
│  ├─ migrations/           # Database migrations
│  ├─ repositories/         # booking, notification, owner-report
│  ├─ routes/               # salons, bookings, availability, payments, reviews,
│  │                        # favorites, notifications, owner-*, admin
│  ├─ services/             # booking, booking-lifecycle, notification,
│  │                        # owner-report
│  ├─ validators/           # Zod schemas
│  ├─ booking-availability.ts
│  ├─ payment-provider.ts
│  ├─ db.ts                 # PostgreSQL connection
│  └─ seed.ts               # Sample data
├─ shared/                  # Types shared by client and server
├─ docs/screenshots/        # App screenshots
├─ netlify/functions/       # Serverless API entry for Netlify
└─ netlify.toml
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- A PostgreSQL database

### Installation

```bash
git clone https://github.com/<your-username>/Salon-booking-marketplace.git
cd Salon-booking-marketplace
pnpm install
```

### Environment variables

Create a `.env` file in the project root and set the values the server needs:

```env
DATABASE_URL=your_postgres_connection_string
PORT=3000
```

If you use an online payment provider, add its credentials here as well (see `server/payment-provider.ts`).

### Seed the database

Load sample salons, staff, and services:

```bash
pnpm tsx server/seed.ts
```

### Run in development

```bash
pnpm dev
```

### Build and run in production

```bash
pnpm build
pnpm start
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm test` | Run unit, integration, and end-to-end tests with Vitest |
| `pnpm typecheck` | Run the TypeScript compiler |
| `pnpm format.fix` | Format the codebase with Prettier |

## Deployment

The repo includes `netlify.toml` and `netlify/functions/api.ts`, so the client can be deployed on Netlify with the API running as a serverless function. Set the same environment variables in your Netlify site settings.

## Roadmap

- [ ] Email and SMS booking reminders
- [ ] Discount codes and loyalty rewards
- [ ] Map-based salon search
- [ ] Mobile app


## Author

**Mohammad Javad Rezaei**
GitHub: [@your-username](https://github.com/your-username)
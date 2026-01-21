# AI Community Platform

## Overview

This is a full-stack web application built for an AI-focused community platform. The application enables users to share posts about AI topics, engage through comments, and interact with content through likes/dislikes and reporting features. It's designed as a Korean-language community hub for discussions about generative AI, prompts, showcases, and AI models.

The stack consists of:
- **Frontend**: React with TypeScript, Vite, TailwindCSS, and shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy and session management
- **State Management**: TanStack Query (React Query)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Component Library**: The application uses shadcn/ui, a collection of re-usable components built with Radix UI primitives and styled with TailwindCSS. This provides accessible, customizable UI components following the "new-york" style variant.

**Routing**: Implements client-side routing using Wouter, a lightweight routing solution. Routes are organized in a single Router component with protected and public routes.

**State Management**: TanStack Query handles all server state, providing caching, background refetching, and optimistic updates. The query client is configured with infinite stale time to minimize unnecessary refetches.

**Form Handling**: Uses React Hook Form with Zod validation schemas for type-safe form management.

**Styling System**: TailwindCSS v4 with custom design tokens defined in CSS variables. The theme supports both light and dark modes through CSS custom properties (HSL color space). Custom utilities like `hover-elevate` and `active-elevate-2` provide consistent interaction feedback.

### Backend Architecture

**API Structure**: RESTful API endpoints organized in the routes.ts file. All API routes are prefixed with `/api`.

**Session Management**: Express-session with connect-pg-simple for PostgreSQL-backed session storage. Sessions are configured with secure cookies in production.

**Authentication Strategy**: Passport.js with LocalStrategy for username/password authentication. Passwords are hashed using Node's scrypt algorithm with random salts. The authentication flow serializes user ID to session and deserializes full user object on requests.

**Development vs Production**: Two separate entry points:
- `index-dev.ts`: Integrates Vite middleware for HMR during development
- `index-prod.ts`: Serves pre-built static files from dist/public

**Request Logging**: Custom middleware logs all API requests with timing information, truncating long responses for readability.

### Database Schema

**ORM**: Drizzle ORM with PostgreSQL dialect, providing type-safe database queries and migrations.

**Core Tables**:
- `users`: Stores user credentials (hashed passwords), profile info (name, nickname, email, age group, avatar)
- `posts`: Content with title, excerpt, full content, category, tags array, engagement metrics (likes/dislikes/comments counts)
- `comments`: Hierarchical comments with optional parent comment for threading
- `postLikes` / `commentLikes`: User reactions with boolean `isLike` flag (true = like, false = dislike)
- `postReports` / `commentReports`: Content moderation with user-submitted reasons

**Key Design Decisions**:
- All primary keys use PostgreSQL's `gen_random_uuid()` for distributed-friendly IDs
- Unique constraints on user email and nickname for account integrity
- Unique composite constraints on like/report tables (userId + postId/commentId) to prevent duplicate actions
- Cascade deletes on posts ensure referential integrity when content is removed
- Denormalized counts (likesCount, dislikesCount, commentsCount) on posts for performance, updated through dedicated storage methods

### Data Access Layer

**Storage Interface**: The `IStorage` interface in storage.ts defines the contract for all database operations, implemented by `DatabaseStorage` class. This abstraction allows for testing and potential alternative implementations.

**Key Operations**:
- User CRUD with password management
- Post creation, retrieval (all, by ID, by author, by category), updates, and soft/hard deletion
- Comment threading and retrieval by post
- Toggle-based like/dislike system that handles add/remove/change-type actions atomically
- Report creation with duplicate prevention

**Count Synchronization**: Dedicated methods (`updatePostLikeCounts`, `updateCommentLikeCounts`) recalculate engagement metrics from source tables to maintain accuracy.

### Authentication & Authorization

**User Registration Flow**:
1. Client submits form with name, nickname, email, password, age group
2. Server validates using Zod schema
3. Password is hashed with scrypt + random salt
4. User record created in database
5. Auto-login via Passport session

**Login Flow**:
1. Passport LocalStrategy verifies email exists
2. Compares supplied password against stored hash using timing-safe comparison
3. On success, serializes user ID to session
4. Returns sanitized user object (excludes password)

**Session Security**: 
- HTTP-only cookies prevent XSS access
- Secure flag in production for HTTPS-only transmission
- SameSite=lax prevents CSRF
- Session store in PostgreSQL for horizontal scalability

### API Patterns

**Error Handling**: API client in lib/api.ts throws errors for non-OK responses, which are caught by React Query and exposed through query/mutation error states.

**Request Structure**: Most mutations send JSON payloads, with credentials included for session authentication.

**Response Format**: APIs return JSON with standardized structures - single objects for gets, arrays for lists, action results for mutations.

## External Dependencies

**Database**: PostgreSQL (via Neon serverless driver with WebSocket support for edge deployment)

**UI Components**: 
- Radix UI primitives for accessible component foundations
- Lucide React for consistent iconography
- Embla Carousel for image carousels

**Development Tools**:
- Replit-specific plugins (cartographer, dev banner, runtime error overlay) for enhanced development experience
- Vite for fast HMR and optimized production builds

**Utilities**:
- date-fns with Korean locale for relative time formatting
- nanoid for generating unique IDs
- class-variance-authority and clsx for conditional class name management
- zod for runtime type validation and schema generation from Drizzle models

**Session Store**: connect-pg-simple for PostgreSQL session persistence

**Build Tools**: esbuild bundles the server code, Vite bundles the client code
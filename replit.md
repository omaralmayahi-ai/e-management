# ناظم - نظام إدارة المعاملات الإلكتروني
# شركة نفط الوسط - Midland Oil Company

## Overview
ناظم is a comprehensive electronic document management system (DMS) for شركة نفط الوسط (Midland Oil Company). Its primary goal is to digitize and streamline all transactional processes, eliminating paper-based methods to enhance efficiency and transparency. The system manages four types of correspondence (internal/external, outgoing/incoming), administrative requests (leaves, duties), and service requests (maintenance, technical, administrative), all integrated with a full organizational hierarchy and a catalog-based permission system.

## User Preferences
The user prefers detailed explanations of changes and prefers an iterative development approach. They want to be asked before any major architectural changes or significant code refactoring. The user prefers clear and concise communication.

## System Architecture
The system uses a modern web architecture. The frontend is built with React, Vite, and TypeScript, supporting RTL Arabic interfaces. The backend is an Express.js REST API. Data is stored in PostgreSQL, managed with Drizzle ORM. Authentication is custom username/password based, secured with bcrypt and express-session. UI/UX is implemented using Shadcn/ui and Tailwind CSS, offering five customizable color themes.

**Key Architectural Decisions and Features:**

-   **Organizational Hierarchy**: A 6-level hierarchy (وحدة → شعبة → قسم → هيئة → معاون → مدير عام) with central department designations.
-   **Correspondence System**: Manages four types of correspondence with an 8-status workflow from draft to archived.
-   **Role and Permission System**: Features four core roles (موظف, مسؤول, بريد مركزي, مدير نظام). Permissions are primarily derived from workflow position rather than individual settings, with account-level toggles for module access.
-   **Central Mail (البريد المركزي)**: A dedicated role for entering external incoming correspondence. Central mail users can create external_incoming records, assign them to authorized receivers (`canReceiveExternalIncoming` flag on employee accounts), and manage returned correspondence. Privacy is maintained — downstream departments cannot see central mail assignment info.
-   **Workflow Automation**: Configurable flow templates define approval processes using ordered levels and account groups (department IDs).
-   **Auditability**: Immutable workflow events and activity logging provide a detailed audit trail.
-   **Module Access Control**: Per-user toggles manage access to specific modules (Correspondence, Leave Requests, Service Requests).
-   **Sequential Numbering**: Automated sequential numbering for outgoing correspondence, formatted as `{deptCode}-{seq}`, with separate counters for internal and external types.
-   **Admin Panel**: Centralized management for organization settings, themes, user/department management, notifications, password resets, and activity logs.
-   **UI/UX**: Utilizes Shadcn/ui and Tailwind CSS for a consistent and modern interface with theming capabilities.

**Module Breakdown:**

1.  **Dashboard**: Provides an overview of correspondence statistics and recent activities.
2.  **Correspondence**: Handles the full lifecycle of documents, including creation, workflow actions, margin notes, and archiving. Sections include: إعداد مراسلة (compose), البريد الوارد (inbox), **بانتظار التوقيع** (items currently held by my department — `currentDepartmentId === user.departmentId` — and not yet finalized), **المنجزة** (items my department previously held but no longer holds; still in flight, status NOT in [archived, completed, cancelled], for outgoing not yet issued, for incoming not yet replied to), المتابعة (follow-ups), and الأرشيف (archive). بانتظار التوقيع and المنجزة are mutually exclusive: a given correspondence shows up in one or the other based on whether `currentDepartmentId` matches the viewer's department. When status moves to issued/archived/completed it leaves both and appears in الأرشيف. The `/api/correspondence` endpoint enriches each item with `_actedByMe` (true if either the current user OR any member of the user's department performed an `elevate`/`sign_and_forward`/`approve_and_forward`/`route_to_subordinate`/`prepare_response`/`return_for_modification` workflow event — uses `workflow_events.fromDepartmentId` for the dept-level check) and `_hasReplies` (excludes soft-deleted children). An additional `_actedAccessOnly` flag marks items granted to the user only via the acted-on fallback so they don't leak into other sections (inbox/pending_signature/archive).
3.  **Leave Requests**: Manages employee leave applications and approvals.
4.  **Service Requests**: Facilitates requests for various services.
5.  **Departments (Admin)**: Manages the organizational hierarchy.
6.  **Employees (Admin)**: Manages employee accounts and permissions.
7.  **Settings (Admin)**: Manages global system configurations and organizational chart.

## External Dependencies
-   **Database**: PostgreSQL
-   **ORM**: Drizzle ORM
-   **Frontend Framework**: React
-   **Build Tool**: Vite
-   **Styling**: Tailwind CSS
-   **UI Components**: Shadcn/ui
-   **Authentication Hashing**: bcryptjs
-   **Session Management**: express-session, connect-pg-simple
-   **HTML Sanitization**: dompurify (client) and isomorphic-dompurify (server). Rich-text correspondence content is sanitized server-side before persistence (`server/htmlSanitizer.ts`) using the same allow-list as the client renderer.

## Automated Tests
-   Test runner: **Vitest** (configured via `vitest.config.ts`). Runs all files matching `server/**/*.test.ts` and `shared/**/*.test.ts` in a Node environment.
-   Run all tests: `npx vitest run` (one-off) or `npx vitest` (watch mode).
    -   Note: a `test` npm script was not added to `package.json` per user preference; invoke vitest directly via `npx`.
-   Existing suites:
    -   `server/htmlSanitizer.test.ts` — verifies server-side HTML sanitization strips `<script>`, `<iframe>`, `onerror`, `javascript:` URIs and dangerous CSS while preserving safe table/style markup. (Migrated from the old `script/test-html-sanitizer.ts`, which has been removed.)
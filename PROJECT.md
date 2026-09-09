# PROJECT.md — אתר כיתה (Single Class Website)

## What This Is
A secure, password-protected class website for schools (built for Ben Gurion Middle School, Herzliya).
The site serves students and parents with schedules, announcements, seating charts, teachers list, events, photo gallery, and quick links.
In compliance with student privacy protection requirements, the site is gated: students and parents register and must be approved by the homeroom teacher before accessing any personal student information.

## Routing
- **Protected Class Page:** `/` (`app/page.tsx`) — Gated by `<AuthGate>` with registration, login, and pending approval screens.
- **Admin Panel:** `/admin` (`app/admin/page.tsx`) — Teacher management interface including user approvals and whitelist.

## Tech Stack
- **Framework:** Next.js 16 (App Router), React, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui + custom CSS in `app/globals.css`
- **Backend:** Firebase Firestore + Firebase Auth + Firebase Storage
- **Hosting:** Vercel (auto-deploy from GitHub)

## Firebase
- **Firestore:** `classes/{classId}/{collection}` (default `classId`: `kita2` or set via `NEXT_PUBLIC_CLASS_ID`)
- **Users Collection:** `users/{uid}` — Stores user profiles with approval status (`pending` | `approved` | `rejected`) and role (`student` | `parent` | `admin`).
- **Storage:** `classes/{classId}/gallery/{filename}` — for gallery photos and announcement attachments
- **Auth:** Email + Password authentication with role-based gatekeeping and admin approval.
- **Security rules:** Read permitted only for approved users and admins; write permitted only for admins.

### Firestore Collections
| Collection | One doc per | Key fields |
|---|---|---|
| `users` | registered user | `uid`, `email`, `fullName`, `role` (student/parent/admin), `studentName`, `status` (pending/approved/rejected), `createdAt`, `approvedAt` |
| `classes/{classId}/announcements` | announcement | `order`, `date`, `title`, `body`, `important`, `hidden`, `imageUrl`, `fileUrl` |
| `classes/{classId}/events` | event | `date` (Timestamp), `title`, `time`, `category`, `endDate` (optional Timestamp) |
| `classes/{classId}/schedule` | lesson row | `order`, `period`, `time`, `sun`–`fri`, `type` |
| `classes/{classId}/emergency_schedule` | lesson row | same fields as `schedule` |
| `classes/{classId}/seating` | desk row | `order`, `desk1_right/left` … `desk4_right/left` |
| `classes/{classId}/teachers` | teacher | `order`, `name`, `subject`, `role`, `phone`, `email`, `notes` |
| `classes/{classId}/gallery` | photo | `url`, `storagePath`, `caption`, `createdAt` |

### Firestore Meta Docs (under `classes/{classId}/meta/`)
| Doc | Fields | Purpose |
|---|---|---|
| `settings` | `className: string, schoolName: string, theme: string` | Custom class name, school name, and color theme |
| `whitelist` | `emails: string[]` | Pre-approved emails for instant auto-approval upon registration |
| `subjects` | `list: string[]` | Subject palette for schedule editor |
| `students` | `list: string[]` | Student roster for seating editor |
| `emergency` | `visible: boolean` | Whether emergency schedule is shown on site |

## Public Sections (Protected behind Auth Gate)
1. **הודעות** — Announcements (important flag = highlighted, hidden flag = excluded from public view)
2. **מערכת בחירום** — Emergency schedule (hidden by default, orange styling, toggled from admin)
3. **מערכת שעות** — Weekly schedule (sticky columns on mobile, scrollable)
4. **אירועים** — Events (monthly view, category filter)
5. **מקומות ישיבה** — Seating chart (animated, horizontally scrollable on mobile, print button)
6. **מורים** — Teachers (expandable cards, WhatsApp/email links)
7. **גלריה** — Photo gallery (carousel with thumbnails + lightbox, hidden if empty)
8. **קישורים חשובים** — Quick links with favicons

## Admin Panel Tabs
| Tab | Key features |
|---|---|
| הודעות | Add/edit/delete/hide announcements, image & PDF attachments, one-click visibility toggle |
| אירועים | Add/delete events with date range support and Google Calendar import |
| מורים | Add/delete teachers |
| מערכת שעות | Drag-and-drop subject palette, inline time editing |
| מקומות ישיבה | Drag-and-drop seating grid, student roster sidebar |
| חירום | Visibility toggle, drag-and-drop editor, copy-from-regular button |
| גלריה | Drag-or-click upload, progress bar, delete thumbnails |
| 👥 משתמשים | Pending approvals queue with badge count, active users management, and pre-approved email whitelist |
| ⚙️ הגדרות | Edit class name, school name, and pick color theme (blue, purple, green, orange, pink) |

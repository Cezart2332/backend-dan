# Dan fost anxios — Project Structure

## Overview

**"Dan fost anxios"** is a Romanian-language mobile app for mental health / anxiety management. It provides HAI (Help Anxiety Immediately) techniques, daily challenges, video/audio content, community chat, webinars, 1:1 meetings, and a subscription-based monetization model.

The project has **three parts**:
1. **Mobile App** — React Native (Expo managed workflow) for iOS & Android
2. **Backend API** — Node.js + Fastify + MySQL
3. **Admin Panel** — React + Vite SPA for content management

---

## 1. Mobile App (`/` root)

### Tech Stack
- **Expo SDK 54** (managed workflow)
- **React Native** 0.81.5 / React 19.1.0
- **Navigation:** `@react-navigation/native` + `@react-navigation/stack`
- **IAP:** RevenueCat (`react-native-purchases`)
- **Push:** `expo-notifications` via Expo Push API
- **Auth:** Email/password + Google OAuth + Apple Sign-In (Facebook OAuth server-side)
- **Payments:** Stripe (web checkout) + RevenueCat
- **Video:** `expo-av`, `expo-video`
- **Builds:** EAS Build + Submit (CI/CD via GitHub Actions)

### Key Files
| File | Purpose |
|------|---------|
| `App.js` | Root component, navigation stack (48 screens), auth boot, push notification handler |
| `app.json` | Expo config: bundle IDs, schemes, permissions, plugins, env vars |
| `eas.json` | EAS Build profiles (dev / preview / production) |
| `package.json` | Dependencies and scripts |

### Screens (`components/` — 48 files)
| Screen | File | Purpose |
|--------|------|---------|
| Login | `LoginScreen.js` | Email/password + Google + Apple login |
| Register | `RegisterScreen.js` | Account creation |
| Dashboard | `DashboardScreen.js` | Main hub with menu, Facebook group link |
| Provocari | `ProvocarilScreen.js` | Challenge levels overview |
| LevelChallenges | `LevelChallengesScreen.js` | Challenges within a level |
| ChallengeRun | `ChallengeRunScreen.js` | Active challenge session |
| ChallengeHistory | `ChallengeHistoryScreen.js` | Past challenge runs |
| ChallengeDetail | `ChallengeDetailScreen.js` | Single challenge run details |
| Progress | `ProgressScreen.js` | Daily anxiety tracking (level 1-10) |
| ProgressHistory | `ProgressHistoryScreen.js` | Journal history |
| ProgressDetail | `ProgressDetailScreen.js` | Single journal entry detail |
| Tehnici | `TehniciScreen.js` | HAI techniques menu |
| TehnicaHAIDetail | `TehnicaHAIDetailScreen.js` | HAI technique details |
| TehnicaHAIPsihologice | `TehnicaHAIPsihologiceScreen.js` | Psychological techniques list |
| TehnicaHAIFizice | `TehnicaHAIFiziceScreen.js` | Physical techniques list |
| TehnicaHAIVideo | `TehnicaHAIVideoScreen.js` | Technique video playback |
| Ajutor | `AjutorScreen.js` | Help section menu |
| AjutorRau | `AjutorRau.js` | Emergency help |
| AjutorAnxietateList | `AjutorAnxietateListScreen.js` | Anxiety help articles |
| AjutorAnxietateVideo | `AjutorAnxietateVideoScreen.js` | Anxiety help video |
| AjutorAtacPanicaList | `AjutorAtacPanicaListScreen.js` | Panic attack help articles |
| AjutorAtacPanicaVideo | `AjutorAtacPanicaVideoScreen.js` | Panic attack help video |
| IntelegeAnxietate | `IntelegeAnxietateScreen.js` | Understanding anxiety |
| IntelegeAnxietateVideo | `IntelegeAnxietateVideoScreen.js` | Anxiety education video |
| AboutDan | `AboutDanScreen.js` | About Dan section menu |
| AboutDanIntro | `AboutDanIntroScreen.js` | Introduction |
| AboutDanCineVideo | `AboutDanCineVideoScreen.js` | Who is Dan video |
| AboutDanSection | `AboutDanSectionScreen.js` | CMS-driven about section |
| DinExperientaMea | `DinExperientaMeaScreen.js` | From my experience |
| DinExperientaMeaVideo | `DinExperientaMeaVideoScreen.js` | Experience video |
| AudioAnxietateList | `AudioAnxietateListScreen.js` | Audio content list |
| AudioAnxietateVideo | `AudioAnxietateVideoScreen.js` | Audio content playback |
| Direct | `DirectScreen.js` | 1:1 meeting requests |
| Intrebari | `IntrebariScreen.js` | Ask Dan questions |
| Webinarii | `WebinariiScreen.js` | Webinar list and access |
| CommunityChat | `CommunityChatScreen.js` | Real-time chat |
| Profile | `ProfileScreen.js` | User profile, avatar |
| Settings | `SettingsScreen.js` | App settings, logout |
| Subscriptions | `SubscriptionsScreen.js` | Subscription plans (web checkout) |
| SubscriptionPaywall | `SubscriptionPaywall.js` | In-app purchase paywall |
| Terms | `TermsScreen.js` | Terms & conditions |
| MedicalInfo | `MedicalInfoScreen.js` | Medical disclaimer info |
| QuoteOfTheDay | `QuoteOfTheDayScreen.js` | Daily quote |
| Onboarding | `OnboardingQuestionsScreen.js` | Initial user questionnaire |
| CmsSection | `CmsSectionScreen.js` | Dynamic CMS content section |
| AppSplashScreen | `AppSplashScreen.js` | Splash/loading screen |
| VideoPlayerScreen | `VideoPlayerScreen.js` | Generic video player |
| HeadphonesDisclaimer | `HeadphonesDisclaimer.js` | Headphones warning banner |

### Utilities (`utils/`)
| File | Purpose |
|------|---------|
| `api.js` | REST API client (backend communication) |
| `authStorage.js` | Auth token persistence (AsyncStorage) |
| `userStorage.js` | User data persistence |
| `subscriptionStorage.js` | Subscription state cache |
| `progressStorage.js` | Progress entries cache |
| `challengeStorage.js` | Challenge runs cache |
| `oauth.js` | Google + Apple OAuth hooks & handlers |
| `revenuecat.js` | RevenueCat SDK wrapper |
| `stripe.js` | Stripe publishable key config |
| `metaEvents.js` | Meta/Facebook App Events SDK wrapper |

### Config / Other
| File | Purpose |
|------|---------|
| `challenges/index.js` | 3 levels x 8 challenges catalog (24 challenges total) |
| `contexts/SubscriptionContext.js` | React Context for subscription state |
| `assets/` | App icons (iOS + Android), splash screen, logo |
| `google-services.json` | Firebase project config for Android |
| `@cartealuidan__dan-fost-anxios.jks` | Android signing keystore |
| `.github/workflows/pipeline.yaml` | CI/CD: auto EAS build + submit |

### Notification Types Handled (App.js)
| Type | Action on tap |
|------|---------------|
| `question_response` | Navigate to `Intrebari` |
| `announcement` | Navigate to `Dashboard` |
| `webinar_created` / `webinar_updated` | Navigate to `Webinarii` |
| `meeting_updated` | Navigate to `Direct` |
| `chat_unread` | (shown as push, no navigation) |

---

## 2. Backend API (`backend-dan/`)

### Tech Stack
- **Node.js** + **Fastify 5**
- **MySQL** via `mysql2` connection pool
- **Auth:** Better Auth 1.3 (email + social login)
- **Payments:** Stripe
- **Push:** Expo Push Notification API (`https://exp.host/--/api/v2/push/send`)
- **Chat:** WebSockets via `@fastify/websocket`
- **Profanity filter:** `bad-words`

### Key Files
| File | Purpose |
|------|---------|
| `src/index.js` | Server entry: register routes, plugins, migrations, CORS, graceful shutdown |
| `src/auth.js` | Better Auth configuration |
| `src/mysql.js` | MySQL connection pool |
| `src/migrate.js` | Database migrations (18 tables) |
| `src/push.js` | Expo push notification sender |

### Route Files
| File | Routes | Purpose |
|------|--------|---------|
| `src/routes-auth.js` | `/api/auth/*`, `/api/custom-auth/*` | Registration, login, OAuth (Google/Facebook/Apple), token refresh |
| `src/routes-profile.js` | `/api/profile/*` | User profile CRUD, avatar upload |
| `src/routes-progress.js` | `/api/progress/*` | Anxiety tracking entries (CRUD) |
| `src/routes-questions.js` | `/api/questions/*` | User questions (submit, list own) |
| `src/routes-meetings.js` | `/api/meetings/*` | 1:1 meeting requests (CRUD) |
| `src/routes-challenges.js` | `/api/challenges/*` | Challenge runs (save, list) |
| `src/routes-media.js` | `/api/media/*` | File serving (conditional — Nginx in production) |
| `src/routes-subscriptions.js` | `/api/subscriptions/*` | Stripe checkout sessions, webhooks |
| `src/routes-videos.js` | `/api/videos/*` | CMS video content for mobile app |
| `src/routes-webinars.js` | `/api/webinars/*` | Webinar listing for mobile app |
| `src/routes-notifications.js` | `/api/notifications/*` | Push token registration/enable/disable |
| `src/chat/routes.js` | `/api/chat/*` | Chat messages + WebSocket |
| `src/routes-admin.js` | `/api/admin/*` | Admin panel: stats, users, questions, meetings, webinars, bug reports, announcements |
| `src/routes-cms.js` | `/api/cms/*` | Public CMS content |
| `src/routes-admin-cms.js` | `/api/admin/video-sections`, `/api/admin/videos`, `/api/admin/challenge-levels`, `/api/admin/challenges` | CMS management (admin) |
| `src/chat/service.js` | — | Chat message persistence, unread tracking |
| `src/chat-notifications.js` | — | Background 6-hour chat unread push notifications |

### Database (18 tables)
| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `sessions` | Auth tokens |
| `progress_entries` | Daily anxiety level tracking (1-10) |
| `questions` | User Q&A (ask Dan) |
| `chat_messages` | Community chat messages |
| `chat_user_reads` | Per-user chat read state |
| `user_push_tokens` | Expo push tokens per device |
| `challenge_runs` | Completed challenge records |
| `meetings` | 1:1 meeting schedules |
| `webinars` | Webinar content |
| `subscriptions` | Subscription records (Stripe + RevenueCat) |
| `bug_reports` | User bug reports |
| `cms_video_sections` | CMS: video section groups |
| `cms_video_subsections` | CMS: video subsections |
| `cms_videos` | CMS: individual videos with encoding status |
| `cms_challenge_levels` | CMS: challenge levels |
| `cms_challenges` | CMS: challenges within levels |

### Environment Variables
See `backend-dan/.env.example` for all variables. Key ones:
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` – Auth config
- `MYSQL_*` – Database connection
- `JWT_SECRET` – JWT signing
- `ADMIN_TOKEN` – Static admin panel auth token
- `STRIPE_*` – Stripe integration
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` – Google OAuth
- `APPLE_CLIENT_ID`, `APPLE_PRIVATE_KEY` – Apple Sign-In

---

## 3. Admin Panel (`paneldan/`)

### Tech Stack
- **Vite** + **React 19**
- **react-router-dom** v7
- **react-icons** (Feather Icons)
- Plain CSS (`App.css`, ~1550 lines)

### Key Files
| File | Purpose |
|------|---------|
| `src/main.jsx` | Entry point |
| `src/App.jsx` | Router with auth gate |
| `src/api.js` | API helper with `X-Admin-Token` auth |
| `src/App.css` | All styles |
| `src/components/Sidebar.jsx` | Navigation sidebar |

### Pages
| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `DashboardPage.jsx` | Stats overview (users, entries, questions, bugs, meetings, subscriptions) |
| `/users` | `UsersPage.jsx` | User list (paginated, searchable) |
| `/entries` | `EntriesPage.jsx` | Progress journals (view, filter, delete) |
| `/questions` | `QuestionsPage.jsx` | Manage questions (filter, reply, change status) |
| `/bug-reports` | `BugReportsPage.jsx` | Bug report management |
| `/meetings` | `MeetingsPage.jsx` | CRUD meetings + monthly calendar |
| `/webinars` | `WebinarsPage.jsx` | CRUD webinars with push notification feedback |
| `/videos` | `VideosPage.jsx` | CMS: sections, subsections, videos (upload, encode) |
| `/challenges` | `ChallengesPage.jsx` | CMS: challenge levels and challenges |
| `/announcements` | `AnnouncementsPage.jsx` | Send push notification announcements to users |

### Admin API Endpoints (all under `/api/admin/`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/login` | Authenticate with static token or JWT |
| `GET` | `/stats` | Dashboard statistics |
| `GET` | `/users` | List users (paginated, searchable) |
| `GET` | `/progress` | List progress entries |
| `DELETE` | `/progress/:id` | Delete a progress entry |
| `GET` | `/questions` | List questions (filterable by status) |
| `PUT` | `/questions/:id` | Update question (status, admin response) |
| `GET` | `/meetings` | List meetings (paginated, filterable) |
| `POST` | `/meetings` | Create meeting |
| `PUT` | `/meetings/:id` | Update meeting |
| `DELETE` | `/meetings/:id` | Delete meeting |
| `GET` | `/webinars` | List webinars |
| `POST` | `/webinars` | Create webinar (+ push notify premium users) |
| `PUT` | `/webinars/:id` | Update webinar (+ push notify on changes) |
| `DELETE` | `/webinars/:id` | Delete webinar |
| `GET` | `/bug-reports` | List bug reports |
| `PUT` | `/bug-reports/:id` | Update bug report status |
| `POST` | `/announcements` | Send push announcement to all/premium users |
| `GET` | `/video-sections` | CMS: list video sections |
| `POST` | `/video-sections` | CMS: create video section |
| `PUT` | `/video-sections/:id` | CMS: update video section |
| `DELETE` | `/video-sections/:id` | CMS: delete video section |
| `GET` | `/video-subsections` | CMS: list subsections |
| `POST` | `/video-subsections` | CMS: create subsection |
| `PUT` | `/video-subsections/:id` | CMS: update subsection |
| `DELETE` | `/video-subsections/:id` | CMS: delete subsection |
| `GET` | `/videos` | CMS: list videos |
| `POST` | `/videos` | CMS: create video entry |
| `PUT` | `/videos/:id` | CMS: update video |
| `DELETE` | `/videos/:id` | CMS: delete video |
| `GET` | `/videos/:id/status` | CMS: video encoding status |
| `POST` | `/videos/:id/upload` | CMS: upload video file |
| `GET` | `/challenge-levels` | CMS: list challenge levels |
| `POST` | `/challenge-levels` | CMS: create challenge level |
| `PUT` | `/challenge-levels/:id` | CMS: update challenge level |
| `DELETE` | `/challenge-levels/:id` | CMS: delete challenge level |
| `GET` | `/challenges` | CMS: list challenges |
| `POST` | `/challenges` | CMS: create challenge |
| `PUT` | `/challenges/:id` | CMS: update challenge |
| `DELETE` | `/challenges/:id` | CMS: delete challenge |

---

## 4. Notifications Architecture

Push notifications are sent via **Expo Push API** (`https://exp.host/--/api/v2/push/send`). No Firebase Cloud Messaging is used.

| Notification Type | Trigger | Recipients | Data Payload |
|-------------------|---------|------------|--------------|
| `question_response` | Admin answers a question | Question author | `{ type, questionId }` |
| `webinar_created` | Admin creates a webinar | Premium/VIP/Pro users | `{ type, webinarId, status, scheduledAt }` |
| `webinar_updated` | Admin updates webinar (title/schedule/status/link change) | Premium/VIP/Pro users | `{ type, webinarId, status, scheduledAt }` |
| `meeting_updated` | Admin updates meeting (status/schedule change) | Meeting's user | `{ type, meetingId, status, scheduledAt, statusChanged, scheduleChanged }` |
| `chat_unread` | Background 6-hour timer | Users with unread chat | `{ type, unreadCount }` |
| `announcement` | Admin sends announcement | All users or Premium only | `{ type: 'announcement' }` |

---

## 5. Build & Deploy

- **EAS Build** via Expo Application Services
- **CI/CD:** `.github/workflows/pipeline.yaml` auto-builds iOS + Android on push to `master`
- **Keystore:** `@cartealuidan__dan-fost-anxios.jks` (Android)
- **Bundle ID:** `com.cartealuidan.danfostanxios`
- **App Store ID:** `6755789426`
- **Backend URL:** `https://api.danfostanxios.ro`
- **Admin panel:** Built with Vite, served as static files from the backend or separate hosting

---

## 6. Quick Reference — Where to Find Anything

| Question | Answer |
|----------|--------|
| Add a new mobile screen | Create file in `components/`, add `Stack.Screen` in `App.js` |
| Mobile API calls | `utils/api.js` |
| Add a backend route | Create file in `backend-dan/src/routes-*.js`, register in `src/index.js` |
| Database changes | Edit `backend-dan/src/migrate.js` (add migration), then update routes |
| Push notification logic | `backend-dan/src/push.js` (send), `src/routes-admin.js` (triggers) |
| Admin panel page | Create file in `paneldan/src/pages/`, add route in `App.jsx`, add link in `Sidebar.jsx` |
| Admin panel API calls | `paneldan/src/api.js` |
| Subscription/payment logic | `backend-dan/src/routes-subscriptions.js` (server), `utils/revenuecat.js` + `utils/stripe.js` (mobile) |
| Auth logic | `backend-dan/src/auth.js` + `src/routes-auth.js` (server), `utils/oauth.js` (mobile) |
| Chat (WebSocket) | `backend-dan/src/chat/routes.js` + `src/chat/service.js` |
| Meta/Facebook App Events | `utils/metaEvents.js` (configured in `app.json` via `react-native-fbsdk-next`) |

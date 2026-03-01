# CHECKINV5 – Full Data Schema for New UI

Use this schema when building a new UX/UI so the app can connect to the same Firestore data later. All field names and types match the current codebase. **Do not change collection names or field names** if you want to plug in existing data without migration.

**Firebase:** One project (e.g. `checkinv5`). Same Firestore database, Auth, and Storage for old and new app.

---

## 1. Firestore Collections Overview

| Collection | Purpose |
|------------|--------|
| `clients` | Client profiles (linked to Auth); coachId, onboarding, progress |
| `users` | User profiles (coaches + clients); role, email, display name |
| `coaches` | Coach profiles; shortUID, clients list |
| `forms` | Check-in form definitions; title, category, question IDs |
| `questions` | Question definitions; text, type, options, category, scoring |
| `check_in_assignments` | Assigned check-ins per client; dueDate, status, responseId, reflectionWeekStart |
| `formResponses` | Submitted check-in answers; assignmentId, responses[], score |
| `coachFeedback` | Coach feedback on responses; responseId, questionId, content (voice/text) |
| `client_measurements` | Body weight & measurements over time |
| `clientGoals` | Client wellness goals; targetValue, currentValue, progress |
| `clientScoring` | Per-client score thresholds (traffic light bands) |
| `client_onboarding_responses` | Onboarding questionnaire answers (by client) |
| `client_onboarding` | (Optional) Single doc per client for onboarding status – check usage |
| `progress_images` | Progress photos; clientId, imageUrl, orientation, caption |
| `measurement_schedules` | When to take measurements; clientId, firstFridayDate, frequency |
| `notifications` | In-app notifications; userId, type, isRead, actionUrl |
| `messages` | Coach–client messages; senderId, content, conversationId |
| `wellnessResources` | Static resources; title, description, category, type, url |

---

## 2. Core Document Schemas

### 2.1 `clients` (document ID = client doc id or auth Uid)

Used for: client portal identity, coach assignment, onboarding, profile, progress summary.

```ts
{
  id: string;                    // same as doc id or auth Uid
  coachId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  timezone?: string;             // e.g. 'Australia/Perth'
  status?: string;               // 'pending' | 'active' | etc.
  onboardingStatus?: string;     // 'not_started' | 'in_progress' | 'completed' | 'submitted'
  canStartCheckIns?: boolean;
  authUid?: string;              // Firebase Auth UID if different from doc id
  profile?: {
    goals?: string[];
    preferences?: { communication?: string; checkInFrequency?: string };
    healthMetrics?: Record<string, unknown>;
    avatar?: string;
  };
  profilePersonalization?: {
    quote: string | null;
    showQuote: boolean;
    colorTheme: string;          // hex e.g. '#daa450'
    icon: string | null;
    updatedAt: string | Date | null;
  };
  progress?: {
    overallScore?: number;
    completedCheckins?: number;
    totalCheckins?: number;
    lastActivity?: Date;
  };
  goalsLastUpdated?: Date;
  emailNotifications?: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Optional: mealPlanId, pausedUntil, extensionGranted, etc.
}
```

**Lookup:** By doc id, or by `authUid` (client may log in with Auth UID; doc id can be different).

---

### 2.2 `users` (document ID = Firebase Auth UID)

Used for: auth, role (coach/client/admin), display name.

```ts
{
  uid: string;
  email?: string;
  role?: string;                 // 'coach' | 'client' | 'admin'
  roles?: string[];
  firstName?: string;
  lastName?: string;
  profile?: { firstName?: string; lastName?: string; avatar?: string };
  createdAt?: Date;
  updatedAt?: Date;
}
```

---

### 2.3 `coaches` (document ID = coach UID)

```ts
{
  shortUID?: string;
  // profile, clients list, etc. – used for coach dashboard and client assignment
}
```

---

### 2.4 `forms` (document ID = formId)

Used for: list of check-in types, form title/category when loading a check-in.

```ts
{
  title: string;
  description?: string;
  category?: string;
  coachId: string;
  questions: string[];          // array of question document IDs
  estimatedTime?: number;
  isStandard?: boolean;
  isActive?: boolean;
  isArchived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.5 `questions` (document ID = questionId)

Used for: rendering check-in form questions and scoring.

```ts
{
  id: string;
  text: string;
  type: string;                 // 'scale' | 'number' | 'multiple_choice' | 'text' | etc.
  options?: string[];
  category?: string;
  coachId?: string;
  scoring?: {                    // optional; for traffic light / score
    type?: string;
    thresholds?: { green?: number[]; orange?: number[]; red?: number[] };
  };
  createdAt?: Date;
  updatedAt?: Date;
}
```

---

### 2.6 `check_in_assignments` (document ID = assignment id)

Used for: “my check-ins”, resume list, due dates, completion status, linking to form response.

```ts
{
  id?: string;                   // sometimes same as doc id
  formId: string;
  formTitle: string;
  clientId: string;
  coachId?: string | null;
  assignedBy?: string;
  assignedAt: Date;
  dueDate: Date;                 // Firestore Timestamp or Date
  dueTime?: string;              // e.g. '09:00'
  startDate?: string;            // YYYY-MM-DD
  firstCheckInDate?: string;
  reflectionWeekStart?: string;   // YYYY-MM-DD Monday – used for “which week” and grey-out
  status: string;                // 'pending' | 'active' | 'completed' | 'overdue' | 'missed' | 'started'
  completedAt?: Date | null;
  score?: number;
  responseCount?: number;
  responseId?: string | null;    // formResponses doc id when completed
  isRecurring?: boolean;
  recurringWeek?: number;
  totalWeeks?: number;
  checkInWindow?: object | null;
  pausedUntil?: Date | null;
  extensionGranted?: boolean;
  coachResponded?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
```

**Queries:** By `clientId` (and optionally `authUid` via clients doc). Filter by status for “resumable” (not completed, not missed). Use `reflectionWeekStart` to match “which week” and grey out completed weeks.

---

### 2.7 `formResponses` (document ID = responseId)

Used for: submitted check-in answers, scores, history, coach feedback.

```ts
{
  assignmentId: string;          // check_in_assignments doc id
  formId: string;
  formTitle: string;
  clientId: string;
  coachId?: string;
  responses: Array<{
    questionId: string;
    answer: string | number | string[];
    score?: number;
    // ... any question-specific fields
  }>;
  score: number;                 // overall 0–100
  totalQuestions: number;
  answeredQuestions: number;
  submittedAt: Date;
  status: string;                // 'completed'
  recurringWeek?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}
```

---

### 2.8 `coachFeedback` (document ID = auto)

Used for: coach voice/text feedback on a response or question.

```ts
{
  responseId: string;
  coachId: string;
  clientId: string;
  questionId?: string | null;   // null = overall feedback
  feedbackType: 'voice' | 'text';
  content: string;              // URL for voice, text for text
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.9 `client_measurements` (document ID = auto)

Used for: body weight and measurements over time (charts, progress).

```ts
{
  clientId: string;
  date: Date;                   // Firestore Timestamp – date of measurement
  bodyWeight?: number;           // kg
  measurements?: Record<string, number>;  // e.g. waist, hips, chest, leftThigh, rightThigh, leftArm, rightArm (cm)
  isBaseline?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Queries:** By `clientId`, order by `date` desc. Body weight is often the primary series for “body weight over time”.

---

### 2.10 `clientGoals` (document ID = auto)

Used for: client goals (target value, current value, progress).

```ts
{
  clientId: string;
  title: string;
  description?: string;
  category?: string;
  targetValue: number;
  currentValue: number;
  unit: string;                  // e.g. 'kg', 'cm'
  deadline: Date;
  status: string;                // 'active' | 'completed' | 'overdue'
  progress?: number;             // 0–100
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.11 `clientScoring` (document ID = clientId)

Used for: traffic light thresholds per client (green / orange / red bands).

```ts
{
  clientId: string;
  scoringProfile?: string;       // e.g. 'moderate'
  thresholds?: {
    green?: [number, number];    // [min, max] e.g. [7, 10]
    orange?: [number, number];
    red?: [number, number];
  };
  createdAt?: Date;
  updatedAt?: Date;
}
```

---

### 2.12 `client_onboarding_responses` (document ID = auto; query by clientId)

Used for: onboarding questionnaire answers and completion.

```ts
{
  clientId: string;
  coachId?: string | null;
  status: string;                // 'in_progress' | 'completed'
  startedAt: Date;
  completedAt?: Date;
  responses: Record<string, string | number | string[] | null>;  // questionId -> value
  progress?: {
    currentSection?: number;
    completedSections?: number[];
    totalQuestions?: number;
    answeredQuestions?: number;
    completionPercentage?: number;
  };
  metadata?: { timeSpent?: number; skippedQuestions?: string[] };
  lastUpdatedAt?: Date;
}
```

---

### 2.13 `progress_images` (document ID = auto)

Used for: before/after or progress photos.

```ts
{
  clientId: string;
  coachId?: string;
  clientName?: string;
  imageUrl: string;
  imageType?: string;            // e.g. 'before_front', 'before_side', 'before_back'
  orientation?: string;
  caption?: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.14 `measurement_schedules` (document ID = auto)

Used for: when to prompt for measurements (e.g. fortnightly).

```ts
{
  clientId: string;
  coachId: string;
  firstFridayDate: Date;
  frequency: string;             // e.g. 'fortnightly'
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.15 `notifications` (document ID = auto)

Used for: in-app notification list and badges.

```ts
{
  userId: string;
  type: string;                  // 'check_in_due' | 'message_received' | 'check_in_completed' | 'form_assigned' | etc.
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, string | undefined>;  // clientId, responseId, assignmentId, etc.
  isRead: boolean;
  createdAt: Date;
}
```

**Queries:** By `userId`, filter `isRead === false` for badge count.

---

### 2.16 `messages` (document ID = auto)

Used for: coach–client messaging.

```ts
{
  senderId: string;              // coach UID
  senderName?: string;
  content: string;
  type?: string;
  timestamp: Date;
  isRead: boolean;
  participants: string[];         // [clientId, coachId]
  conversationId: string;        // `${clientId}_${coachId}`
  responseId?: string;
  checkInContext?: { formTitle?: string; submittedAt?: string };
}
```

---

### 2.17 `wellnessResources` (document ID = auto)

Used for: static resources (articles, links).

```ts
{
  title: string;
  description?: string;
  category?: string;
  type?: string;                 // e.g. 'article'
  url?: string;
  createdAt?: Date;
}
```

---

## 3. Firebase Auth

- **Clients:** Sign in with email/password (or other provider). `uid` is stored as `users/{uid}` and often as `clients` doc id or in `clients.authUid`.
- **Coaches:** Same Auth; `users/{uid}` has `role: 'coach'` (or in `roles` array).
- **Resolving client from token:** Use `users/{uid}` then resolve `clients` by doc id = uid or by `clients.authUid === uid`.

---

## 4. Storage (Firebase Storage)

- **Profile images:** Client avatars (path often includes `clientId`).
- **Progress images:** Uploaded image files; URLs are stored in `progress_images.imageUrl`.
- **Voice feedback:** Coach voice memos; URLs stored in `coachFeedback.content` when `feedbackType === 'voice'`.

---

## 5. Key Indexes / Queries (for new app)

- `check_in_assignments`: by `clientId` (and optionally `status`, `dueDate`).
- `formResponses`: by `clientId`, by `assignmentId`, by `formId` + `submittedAt` for history.
- `client_measurements`: by `clientId`, orderBy `date` desc.
- `clientGoals`: by `clientId`.
- `notifications`: by `userId`, by `isRead`.
- `messages`: by `conversationId` or `participants` array-contains.
- `coachFeedback`: by `responseId`, by `clientId`.

If you use the same query patterns as the current app, existing composite indexes in Firestore should continue to work.

---

## 6. Building the New UI to This Schema

1. **Auth:** Same Firebase project; same env (e.g. `NEXT_PUBLIC_FIREBASE_*`). Resolve client by `users.uid` and `clients` by id or `authUid`.
2. **Client portal screens:** Read/write the same collections above (assignments, formResponses, client_measurements, clientGoals, notifications, messages, etc.) with the same field names.
3. **Check-in flow:** Load form + questions from `forms` and `questions`; create/update `check_in_assignments` and `formResponses` with the same structure (including `reflectionWeekStart` for “which week” and `recurringWeek` where used).
4. **No schema renames:** Keep collection and field names identical so the new app can attach to the same database without a data migration step.

When the new UI is ready, point it at the same Firebase project and deploy; no “merge data” step is needed—the data is already shared.

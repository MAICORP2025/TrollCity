# MAI CLASS SYSTEM - COMPLETE MASTER PLAN

**Created:** April 26, 2026
**Phase:** Planning & Specification
**Status:** Ready for Development
**Developer:** kilo IDE

---

## TABLE OF CONTENTS

1. [PROJECT OVERVIEW](#project-overview)
2. [DATABASE MIGRATIONS NEEDED](#database-migrations-needed)
3. [BACKEND FUNCTIONS & API ENDPOINTS](#backend-functions--api-endpoints)
4. [FRONTEND COMPONENTS](#frontend-components)
5. [SECURITY & PERMISSIONS LAYER](#security--permissions-layer)
6. [INTEGRATION POINTS](#integration-points)
7. [IMPLEMENTATION SEQUENCE](#implementation-sequence)

---

## PROJECT OVERVIEW

### System Goals
- Create a structured 17+ Real World Prep program (Mai Class)
- CEO-led classroom with max 20 students per class
- Live sessions, assignments, grading, rewards system
- Organization-based student management with strict privacy controls
- Locked earnings system for minors
- LiveKit integration for real-time classroom experience

### Key Features
1. **Mai Class Core** - Structured real-world prep curriculum
2. **Live Classroom** - LiveKit-powered video classroom
3. **Organization Management** - Business email validation, student enrollment
4. **Student Privacy** - Organization controls, HIPAA-compliant isolation
5. **Rewards & Recognition** - Coins, badges, Troll Wall posts
6. **Locked Earnings** - Age-gated cashout system

---

## DATABASE MIGRATIONS NEEDED

### MIGRATION 1: `001_create_mai_class_core_tables.sql`

**Purpose:** Create core tables for Mai Class system

**Tables to Create:**

#### `classroom_classes`
```
- id (UUID, PK)
- name (VARCHAR) - "Real World Prep", etc.
- description (TEXT)
- instructor_user_id (UUID, FK → users.id) - CEO/Admin
- max_students (INT, default: 20)
- status (ENUM: active, archived, draft)
- schedule_monday (TIME) - e.g., 6:00 PM
- schedule_thursday (TIME) - e.g., 6:00 PM
- timezone (VARCHAR) - MDT, etc.
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: instructor_user_id, status
RLS: Organizations can view their enrolled students only
```

#### `classroom_modules`
```
- id (UUID, PK)
- class_id (UUID, FK → classroom_classes.id)
- module_number (INT) - 1-6
- title (VARCHAR) - "Getting a Job", "Money & Credit", etc.
- description (TEXT)
- display_order (INT)
- status (ENUM: draft, published, archived)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: class_id, status
RLS: Enrolled students can read; CEO can manage
```

#### `classroom_lessons`
```
- id (UUID, PK)
- module_id (UUID, FK → classroom_modules.id)
- lesson_number (INT)
- title (VARCHAR)
- content (TEXT or JSON) - Supports markdown, embedded links
- lesson_type (ENUM: text, video, interactive, quiz)
- media_url (VARCHAR) - Video URL, etc.
- display_order (INT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: module_id
RLS: Enrolled students can read
```

#### `classroom_assignments`
```
- id (UUID, PK)
- module_id (UUID, FK → classroom_modules.id)
- class_id (UUID, FK → classroom_classes.id)
- title (VARCHAR)
- instructions (TEXT)
- assignment_type (ENUM: text, file_upload, mixed)
- due_date (TIMESTAMP)
- max_attempts (INT, nullable)
- points_possible (INT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: module_id, class_id, due_date
RLS: Enrolled students can read
```

#### `classroom_submissions`
```
- id (UUID, PK)
- user_id (UUID, FK → users.id)
- class_id (UUID, FK → classroom_classes.id)
- assignment_id (UUID, FK → classroom_assignments.id)
- content (TEXT) - Student answer
- file_url (VARCHAR) - Uploaded file path (Supabase Storage)
- file_name (VARCHAR)
- status (ENUM: submitted, graded, in_review)
- grade (INT, nullable) - 0-100 or numeric score
- feedback (TEXT) - CEO feedback
- is_pass_fail (BOOLEAN) - TRUE if module is pass/fail
- passed (BOOLEAN, nullable)
- created_at (TIMESTAMP)
- submitted_at (TIMESTAMP)
- graded_at (TIMESTAMP, nullable)
- graded_by (UUID, nullable) - CEO user_id

Indexes: user_id, assignment_id, status, class_id
RLS: Students see own; CEO/Admin see all
```

#### `classroom_tests`
```
- id (UUID, PK)
- module_id (UUID, FK → classroom_modules.id)
- title (VARCHAR)
- questions (JSON) - Array of question objects
- passing_score (INT) - 0-100
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: module_id
RLS: Enrolled students can read
```

#### `classroom_test_results`
```
- id (UUID, PK)
- user_id (UUID, FK → users.id)
- test_id (UUID, FK → classroom_tests.id)
- class_id (UUID, FK → classroom_classes.id)
- answers (JSON) - Student's answers
- score (INT) - 0-100
- passed (BOOLEAN)
- attempt_number (INT)
- created_at (TIMESTAMP)

Indexes: user_id, test_id, passed
RLS: Students see own; CEO/Admin see all
```

#### `classroom_enrollments`
```
- id (UUID, PK)
- user_id (UUID, FK → users.id)
- class_id (UUID, FK → classroom_classes.id)
- organization_id (UUID, FK → organizations.id)
- status (ENUM: pending, approved, rejected, withdrawn)
- enrolled_date (TIMESTAMP)
- completion_date (TIMESTAMP, nullable)
- completion_percentage (NUMERIC, default: 0)
- weeks_active (INT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: user_id, class_id, status, organization_id
Unique: (user_id, class_id)
RLS: Organizations see own students; CEO/Admin see all
```

#### `classroom_announcements`
```
- id (UUID, PK)
- class_id (UUID, FK → classroom_classes.id)
- created_by (UUID, FK → users.id) - CEO
- title (VARCHAR)
- content (TEXT)
- is_pinned (BOOLEAN, default: FALSE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: class_id, is_pinned
RLS: Enrolled students can read; CEO can manage
```

#### `classroom_resources`
```
- id (UUID, PK)
- module_id (UUID, FK → classroom_modules.id)
- title (VARCHAR)
- description (TEXT)
- resource_type (ENUM: link, video, article, document)
- url (VARCHAR)
- display_order (INT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: module_id
RLS: Enrolled students can read; CEO can manage
```

#### `classroom_progress`
```
- id (UUID, PK)
- user_id (UUID, FK → users.id)
- class_id (UUID, FK → classroom_classes.id)
- module_id (UUID, FK → classroom_modules.id)
- lessons_completed (INT)
- assignment_submitted (BOOLEAN)
- test_passed (BOOLEAN)
- test_score (INT, nullable)
- started_at (TIMESTAMP)
- completed_at (TIMESTAMP, nullable)
- updated_at (TIMESTAMP)

Indexes: user_id, class_id, module_id
Unique: (user_id, module_id)
RLS: Students see own; CEO/Admin/Org see enrolled
```

---

### MIGRATION 2: `002_create_organization_tables.sql`

**Purpose:** Create organization management and student control system

**Tables to Create:**

#### `organizations`
```
- id (UUID, PK)
- name (VARCHAR)
- description (TEXT, nullable)
- email (VARCHAR) - Must NOT be personal email domain
- phone (VARCHAR, nullable)
- website (VARCHAR, nullable)
- country (VARCHAR, nullable)
- admin_user_id (UUID, FK → users.id)
- business_email_verified (BOOLEAN, default: FALSE)
- email_verification_token (VARCHAR, nullable)
- email_verified_at (TIMESTAMP, nullable)
- status (ENUM: pending, approved, rejected, suspended, archived)
- logo_url (VARCHAR, nullable)
- student_limit (INT, default: 20)
- current_student_count (INT, default: 0)
- created_by (UUID, FK → users.id) - Admin who approved
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: admin_user_id, status, email
Unique: email
RLS: Org admins see own; CEO/Admin see all
```

#### `organization_admins`
```
- id (UUID, PK)
- organization_id (UUID, FK → organizations.id)
- user_id (UUID, FK → users.id)
- role (ENUM: owner, admin, manager)
- added_by (UUID, FK → users.id)
- added_at (TIMESTAMP)
- permissions (JSONB) - Custom permissions object

Indexes: organization_id, user_id
Unique: (organization_id, user_id)
RLS: Org admins see own org; CEO/Admin see all
```

#### `organization_students`
```
- id (UUID, PK)
- organization_id (UUID, FK → organizations.id)
- user_id (UUID, FK → users.id)
- status (ENUM: active, inactive, suspended, removed)
- date_of_birth (DATE) - Required to determine age lock
- age_at_enrollment (INT) - Calculated at enrollment
- is_verified_18_plus (BOOLEAN, default: FALSE)
- verified_at (TIMESTAMP, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: organization_id, user_id, status
Unique: (organization_id, user_id)
RLS: Orgs see own students; CEO/Admin see all
```

#### `organization_permissions`
```
- id (UUID, PK)
- organization_id (UUID, FK → organizations.id)
- permission_name (VARCHAR) - broadcast_access, chat_access, troll_wall_post, etc.
- is_approved (BOOLEAN, default: FALSE)
- description (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: organization_id, permission_name
Unique: (organization_id, permission_name)
RLS: CEO/Admin only
```

#### `organization_student_controls`
```
- id (UUID, PK)
- organization_id (UUID, FK → organizations.id)
- user_id (UUID, FK → users.id)
- can_broadcast (BOOLEAN, default: FALSE)
- can_watch_broadcast (BOOLEAN, default: FALSE)
- can_use_chat (BOOLEAN, default: FALSE)
- can_post_troll_wall (BOOLEAN, default: FALSE)
- can_join_mai_class (BOOLEAN, default: FALSE)
- can_gift_coins (BOOLEAN, default: FALSE)
- broadcast_requires_approval (BOOLEAN, default: TRUE)
- chat_requires_approval (BOOLEAN, default: FALSE)
- troll_wall_requires_approval (BOOLEAN, default: TRUE)
- broadcast_daily_limit (INT) - Max broadcasts per day
- updated_at (TIMESTAMP)

Indexes: organization_id, user_id
Unique: (organization_id, user_id)
RLS: Orgs manage own; CEO/Admin see all
```

#### `organization_messages`
```
- id (UUID, PK)
- sender_org_id (UUID, FK → organizations.id)
- receiver_org_id (UUID, FK → organizations.id)
- sender_user_id (UUID, FK → users.id)
- message (TEXT)
- thread_id (UUID, nullable) - For threading
- read_at (TIMESTAMP, nullable)
- created_at (TIMESTAMP)

Indexes: sender_org_id, receiver_org_id, thread_id, read_at
RLS: Involved orgs can read/write; others cannot
```

#### `organization_reports`
```
- id (UUID, PK)
- organization_id (UUID, FK → organizations.id)
- student_user_id (UUID, FK → users.id)
- report_category (ENUM: behavior, inactivity, technical, other)
- description (TEXT)
- severity (ENUM: low, medium, high, critical)
- status (ENUM: open, in_review, resolved, closed)
- notes (TEXT, nullable)
- created_by (UUID, FK → users.id) - Org admin who created
- assigned_to (UUID, nullable, FK → users.id) - CEO/Admin
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- resolved_at (TIMESTAMP, nullable)

Indexes: organization_id, student_user_id, status, severity
RLS: Orgs see own; CEO/Admin see all
```

---

### MIGRATION 3: `003_create_locked_earnings_system.sql`

**Purpose:** Add age-based locked earnings system to user_profiles

**Alter Table: `user_profiles`**

Add columns:
```
- date_of_birth (DATE, nullable) - Required for minors
- locked_balance (NUMERIC, default: 0) - Cash value locked for users < 18
- cashout_balance (NUMERIC, default: 0) - Available to cash out (≥18)
- is_verified_18_plus (BOOLEAN, default: FALSE)
- age_verification_date (TIMESTAMP, nullable)
- age_verification_method (VARCHAR, nullable) - government_id, credit_card, etc.
- is_minor_in_system (BOOLEAN, generated) - COMPUTED: date_of_birth IS NOT NULL AND age < 18
```

---

### MIGRATION 4: `004_create_livekit_integration_tables.sql`

**Purpose:** Track LiveKit room sessions and participant data

**Tables to Create:**

#### `classroom_livekit_sessions`
```
- id (UUID, PK)
- class_id (UUID, FK → classroom_classes.id)
- livekit_room_name (VARCHAR) - e.g., "mai-class-240426"
- session_token (VARCHAR, nullable) - For backend reference
- instructor_user_id (UUID, FK → users.id)
- started_at (TIMESTAMP)
- ended_at (TIMESTAMP, nullable)
- recording_url (VARCHAR, nullable) - If recorded
- is_live (BOOLEAN, default: FALSE)
- max_participants (INT, default: 20)
- current_participant_count (INT, default: 0)
- created_at (TIMESTAMP)

Indexes: class_id, livekit_room_name
RLS: Enrolled students can view; CEO can manage
```

#### `classroom_livekit_participants`
```
- id (UUID, PK)
- session_id (UUID, FK → classroom_livekit_sessions.id)
- user_id (UUID, FK → users.id)
- livekit_participant_id (VARCHAR)
- role (ENUM: host, viewer, speaker_request)
- camera_enabled (BOOLEAN)
- audio_enabled (BOOLEAN)
- screen_sharing (BOOLEAN)
- joined_at (TIMESTAMP)
- left_at (TIMESTAMP, nullable)
- duration_seconds (INT, nullable)
- participation_status (ENUM: active, inactive, spectator)

Indexes: session_id, user_id
RLS: Users see own; CEO/instructors see all in their class
```

---

### MIGRATION 5: `005_create_classroom_attendance_and_rewards.sql`

**Purpose:** Track attendance and rewards earned

**Tables to Create:**

#### `classroom_attendance`
```
- id (UUID, PK)
- user_id (UUID, FK → users.id)
- session_id (UUID, FK → classroom_livekit_sessions.id)
- class_id (UUID, FK → classroom_classes.id)
- attended (BOOLEAN)
- minutes_attended (INT)
- attendance_date (DATE)
- attendance_week (DATE) - Start of week for weekly aggregation
- marked_by (UUID, nullable, FK → users.id) - CEO who marked
- created_at (TIMESTAMP)

Indexes: user_id, class_id, attendance_week
Unique: (user_id, session_id)
RLS: Students see own; CEO/Admin see all
```

#### `classroom_rewards`
```
- id (UUID, PK)
- user_id (UUID, FK → users.id)
- class_id (UUID, FK → classroom_classes.id)
- organization_id (UUID, FK → organizations.id)
- reward_type (ENUM: attendance, assignment_submission, test_pass, module_completion, badge_earned)
- coins_awarded (INT)
- coins_converted_value (NUMERIC) - Dollar value
- locked_status (ENUM: locked, unlocked, transferred)
- is_locked_for_minor (BOOLEAN)
- awarded_by (UUID, nullable, FK → users.id)
- awarded_date (DATE)
- awarded_week (DATE)
- moved_to_locked_balance_at (TIMESTAMP, nullable)
- moved_to_cashout_balance_at (TIMESTAMP, nullable)
- created_at (TIMESTAMP)

Indexes: user_id, class_id, awarded_week
RLS: Students see own; CEO/Admin/Org see related
```

---

### MIGRATION 6: `006_create_teacher_application_table.sql`

**Purpose:** Store future teacher applications (Phase 2+)

**Tables to Create:**

#### `teacher_applications`
```
- id (UUID, PK)
- user_id (UUID, FK → users.id)
- name (VARCHAR)
- email (VARCHAR)
- phone (VARCHAR, nullable)
- experience (TEXT) - Background/experience
- why_teach (TEXT) - Motivation to teach
- relevant_skills (TEXT) - Skills description
- modules_interested (TEXT, nullable) - JSON array of modules
- status (ENUM: pending, under_review, approved, rejected, archived)
- reviewed_by (UUID, nullable, FK → users.id) - Admin
- reviewed_at (TIMESTAMP, nullable)
- feedback (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

Indexes: user_id, status
RLS: Users see own; Admin sees all
```

---

### MIGRATION 7: `007_create_classroom_badges_and_recognition.sql`

**Purpose:** Track badges and Troll Wall recognition

**Tables to Create:**

#### `classroom_badges`
```
- id (UUID, PK)
- name (VARCHAR) - "Real World Certified", "Module Master", etc.
- description (TEXT)
- trigger_event (VARCHAR) - test_pass, module_complete, etc.
- icon_url (VARCHAR)
- created_at (TIMESTAMP)

Indexes: trigger_event
RLS: Public read
```

#### `user_classroom_badges`
```
- id (UUID, PK)
- user_id (UUID, FK → users.id)
- badge_id (UUID, FK → classroom_badges.id)
- class_id (UUID, FK → classroom_classes.id)
- earned_at (TIMESTAMP)
- troll_wall_post_id (UUID, nullable, FK → troll_posts.id)

Indexes: user_id, badge_id
Unique: (user_id, badge_id)
RLS: Users see own; CEO sees all
```

#### `classroom_troll_wall_posts`
```
- id (UUID, PK)
- user_id (UUID, FK → users.id)
- class_id (UUID, FK → classroom_classes.id)
- organization_id (UUID, FK → organizations.id)
- post_type (ENUM: test_passed, module_completed, achievement_unlocked)
- title (VARCHAR)
- content (TEXT) - Auto-generated congratulations message
- troll_wall_post_id (UUID, nullable, FK → troll_posts.id) - Link to main feed
- auto_generated (BOOLEAN, default: TRUE)
- visibility (ENUM: class_only, organization_only, public_to_app)
- created_at (TIMESTAMP)

Indexes: user_id, class_id, post_type
RLS: Based on visibility and organization membership
```

---

### MIGRATION 8: `008_add_organization_visibility_privacy.sql`

**Purpose:** Add organization-specific privacy controls to existing tables

**Alter Tables:**

1. **`user_profiles`** - Add columns:
```
- organization_id (UUID, nullable, FK → organizations.id)
- is_org_managed_student (BOOLEAN, default: FALSE)
- org_profile_visibility (ENUM: private_to_org, private_completely, restricted)
- hide_from_search (BOOLEAN, default: FALSE) - For org students
- hide_from_public_feed (BOOLEAN, default: FALSE)
```

2. **`troll_posts`** - Add columns:
```
- organization_id (UUID, nullable, FK → organizations.id)
- requires_org_approval (BOOLEAN, default: FALSE)
- org_approved (BOOLEAN, nullable)
- org_approved_at (TIMESTAMP, nullable)
- visibility_override (VARCHAR, nullable) - May override normal visibility
```

3. **`user_broadcasts`** / streaming table - Add columns:
```
- organization_id (UUID, nullable, FK → organizations.id)
- requires_org_approval (BOOLEAN, default: FALSE)
- org_approved_by (UUID, nullable, FK → users.id)
- org_approved_at (TIMESTAMP, nullable)
```

---

## BACKEND FUNCTIONS & API ENDPOINTS

### SECTION A: AUTHENTICATION & AUTHORIZATION

#### Function: `check_organization_student_permission()`
```
Input:
  - user_id (UUID)
  - organization_id (UUID)
  - permission_name (VARCHAR) - 'broadcast', 'chat', 'troll_wall', 'mai_class'

Output:
  - BOOLEAN (TRUE if permitted, FALSE otherwise)

Logic:
  1. Check if user is org student
  2. Check organization_student_controls for permission
  3. Check if student status is 'active'
  4. Return TRUE/FALSE
```

#### Function: `verify_age_and_return_status()`
```
Input:
  - user_id (UUID)

Output:
  - JSON {
      is_minor: BOOLEAN,
      age: INT,
      date_of_birth: DATE,
      is_verified_18_plus: BOOLEAN,
      current_age_status: VARCHAR
    }

Logic:
  1. Get date_of_birth from user_profiles
  2. Calculate current age
  3. Check is_verified_18_plus flag
  4. Return age status
```

#### Function: `validate_business_email_domain()`
```
Input:
  - email (VARCHAR)

Output:
  - BOOLEAN (TRUE if valid business email, FALSE if personal)

Logic:
  1. Extract domain from email
  2. Check against blocked domains list (gmail, yahoo, outlook, etc.)
  3. Return TRUE if domain is not in blocked list
  4. Optionally check if domain has MX records (future)
```

---

### SECTION B: CLASSROOM CORE FUNCTIONS

#### RPC: `create_classroom_class()`
```
Input:
  - name VARCHAR
  - description TEXT
  - max_students INT (default: 20)
  - schedule_monday TIME
  - schedule_thursday TIME
  - timezone VARCHAR

Output:
  - class_id UUID

Calls:
  - INSERT into classroom_classes
  - Return new class_id

Permissions: CEO/Admin only
```

#### RPC: `enroll_student_in_class()`
```
Input:
  - user_id UUID
  - class_id UUID
  - organization_id UUID

Output:
  - enrollment_id UUID or ERROR

Logic:
  1. Verify class exists
  2. Verify organization student status
  3. Check class max_students limit
  4. Check user not already enrolled
  5. Create classroom_enrollments record with status='approved'
  6. Increment current_student_count in organizations
  7. Create initial classroom_progress records for all modules
  8. Return enrollment_id

Permissions: CEO/Admin/Org admin
```

#### RPC: `unenroll_student_from_class()`
```
Input:
  - user_id UUID
  - class_id UUID
  - reason VARCHAR (optional)

Output:
  - success BOOLEAN

Logic:
  1. Update classroom_enrollments status to 'withdrawn'
  2. Decrement current_student_count
  3. Soft-delete progress records (set archived)

Permissions: CEO/Admin/Org admin (only own org)
```

#### RPC: `submit_assignment()`
```
Input:
  - user_id UUID
  - assignment_id UUID
  - content TEXT (answer)
  - file_data BYTEA (optional)
  - file_name VARCHAR (optional)

Output:
  - submission_id UUID

Logic:
  1. Verify user is enrolled in class
  2. Verify assignment exists
  3. Check if already submitted (handle retries)
  4. If file: upload to Supabase Storage at path assignments/{class_id}/{user_id}/{file_name}
  5. Create classroom_submissions record
  6. Award coins (50) for submission
  7. Update classroom_progress
  8. Trigger notification to CEO: "New submission from @username"

Permissions: Enrolled students only
```

#### RPC: `grade_submission()`
```
Input:
  - submission_id UUID
  - grade INT (0-100 or pass/fail)
  - feedback TEXT
  - is_pass_fail BOOLEAN

Output:
  - success BOOLEAN

Logic:
  1. Update classroom_submissions: status='graded', grade, feedback, graded_by, graded_at
  2. If pass_fail: set passed field
  3. Notify student: "Your assignment has been graded: [grade]. Feedback: [feedback]"
  4. If passed: award 100 coins + trigger badge/recognition system
  5. Update classroom_progress

Permissions: CEO/Admin only
```

#### RPC: `submit_test_attempt()`
```
Input:
  - user_id UUID
  - test_id UUID
  - answers JSON (array of answers)

Output:
  - result JSON { passed: BOOLEAN, score: INT }

Logic:
  1. Verify user enrolled
  2. Check test exists
  3. Score the answers
  4. Calculate % score
  5. Determine if passed (>= passing_score)
  6. Save to classroom_test_results
  7. If passed:
     - Award 100 coins
     - Trigger recognition system (badge + Troll Wall post)
     - Update module status in classroom_progress
  8. Return { passed, score }

Permissions: Enrolled students only
```

#### RPC: `update_student_progress_percentage()`
```
Input:
  - user_id UUID
  - class_id UUID

Output:
  - progress_percentage NUMERIC (0-100)

Logic:
  1. Count total modules
  2. Count modules where test_passed = TRUE
  3. Calculate percentage
  4. Update classroom_enrollments.completion_percentage
  5. Return percentage

Auto-called by: grade_submission, submit_test_attempt
```

---

### SECTION C: ORGANIZATION MANAGEMENT

#### RPC: `create_organization()`
```
Input:
  - name VARCHAR
  - email VARCHAR
  - admin_user_id UUID
  - country VARCHAR (optional)
  - phone VARCHAR (optional)
  - website VARCHAR (optional)
  - description TEXT (optional)

Output:
  - org_id UUID or ERROR

Logic:
  1. Validate email domain (reject personal emails)
  2. Check email not already used
  3. Create organizations record with status='pending'
  4. Create organization_admins entry
  5. Create default organization_permissions entries for all permission types
  6. Generate email_verification_token
  7. Send verification email to business email
  8. Return org_id

Permissions: Admin only
```

#### RPC: `verify_organization_email()`
```
Input:
  - org_id UUID
  - verification_token VARCHAR

Output:
  - success BOOLEAN

Logic:
  1. Find organization by token
  2. Verify token matches and not expired
  3. Update: business_email_verified=TRUE, email_verified_at=NOW()
  4. (Optional: Trigger admin review workflow)

Permissions: Public (anyone with token)
```

#### RPC: `approve_organization()`
```
Input:
  - org_id UUID
  - approved_by UUID (Admin ID)

Output:
  - success BOOLEAN

Logic:
  1. Update organizations: status='approved'
  2. Send approval email to org admin
  3. Create audit log

Permissions: CEO/Admin only
```

#### RPC: `add_student_to_organization()`
```
Input:
  - user_id UUID
  - organization_id UUID
  - date_of_birth DATE (required)

Output:
  - enrollment_id UUID

Logic:
  1. Verify organization exists and status='approved'
  2. Verify user not already in org
  3. Check student limit not exceeded
  4. Create organization_students record
  5. Create organization_student_controls record (all defaults to FALSE)
  6. Calculate is_minor = age < 18
  7. Link user to organization via user_profiles.organization_id
  8. Increment organizations.current_student_count
  9. Return enrollment_id

Permissions: Org admin + CEO/Admin
```

#### RPC: `update_student_controls()`
```
Input:
  - org_id UUID
  - student_user_id UUID
  - can_broadcast BOOLEAN (optional)
  - can_watch_broadcast BOOLEAN (optional)
  - can_use_chat BOOLEAN (optional)
  - can_post_troll_wall BOOLEAN (optional)
  - can_join_mai_class BOOLEAN (optional)
  - can_gift_coins BOOLEAN (optional)
  - broadcast_requires_approval BOOLEAN (optional)
  - chat_requires_approval BOOLEAN (optional)
  - troll_wall_requires_approval BOOLEAN (optional)
  - broadcast_daily_limit INT (optional)

Output:
  - success BOOLEAN

Logic:
  1. Verify org admin is updating own org
  2. Update organization_student_controls record
  3. If student is minor and can_gift_coins=TRUE: add note "Minor may gift coins in broadcast"
  4. Audit log change
  5. Return success

Permissions: Org admin + CEO/Admin
```

#### RPC: `verify_student_age_18_plus()`
```
Input:
  - user_id UUID
  - verification_method VARCHAR (government_id, credit_card, etc.)

Output:
  - success BOOLEAN

Logic:
  1. Mark user as verified: is_verified_18_plus=TRUE
  2. Set age_verification_date=NOW()
  3. Move locked_balance to cashout_balance
  4. Create audit record
  5. Notify student: earnings unlocked

Permissions: CEO/Admin only
```

#### RPC: `create_organization_message()`
```
Input:
  - sender_org_id UUID
  - receiver_org_id UUID
  - sender_user_id UUID
  - message TEXT
  - thread_id UUID (optional)

Output:
  - message_id UUID

Logic:
  1. Verify sender is admin of sender_org
  2. Verify receiver org exists
  3. Create organization_messages record
  4. Notify receiver org: "@org_name sent a message"

Permissions: Org admin only
```

#### RPC: `create_student_report()`
```
Input:
  - organization_id UUID
  - student_user_id UUID
  - category VARCHAR (behavior, inactivity, technical, other)
  - description TEXT
  - severity VARCHAR (optional)

Output:
  - report_id UUID

Logic:
  1. Verify org admin is reporting own org
  2. Verify student is in org
  3. Create organization_reports record
  4. Notify CEO/Admin: "New report from {org_name} about {student}"
  5. Return report_id

Permissions: Org admin + CEO/Admin
```

---

### SECTION D: LIVEKIT INTEGRATION

#### RPC: `create_livekit_session()`
```
Input:
  - class_id UUID
  - instructor_user_id UUID

Output:
  - session JSON {
      room_name: VARCHAR,
      session_id: UUID,
      token: VARCHAR (JWT)
    }

Logic:
  1. Generate unique room_name: "mai-class-{date}-{hash}"
  2. Create classroom_livekit_sessions record
  3. Call LiveKit API to create room
  4. Generate session token (JWT) for backend
  5. Return room_name and session_id

Permissions: CEO/Admin only
```

#### RPC: `join_livekit_session()`
```
Input:
  - session_id UUID
  - user_id UUID
  - role VARCHAR (host, viewer, speaker_request)

Output:
  - access_token VARCHAR (JWT for LiveKit)

Logic:
  1. Verify user enrolled in class
  2. Check max 20 participants
  3. If role='speaker_request': store request, don't grant yet
  4. Generate LiveKit participant token
  5. Create classroom_livekit_participants record
  6. Increment session.current_participant_count
  7. Return access_token

Permissions: Enrolled students + CEO
```

#### RPC: `end_livekit_session()`
```
Input:
  - session_id UUID

Output:
  - success BOOLEAN

Logic:
  1. Update session: is_live=FALSE, ended_at=NOW()
  2. Calculate attendance: for each participant, record duration_seconds
  3. Award attendance coins: 50 per session (if attended > 10 mins)
  4. Get recording URL from LiveKit (if enabled)
  5. Update session.recording_url
  6. Create attendance records
  7. Trigger notification: "Class recording saved: [url]"

Permissions: CEO/Admin only
```

---

### SECTION E: REWARDS & EARNINGS

#### RPC: `award_coins_to_student()`
```
Input:
  - user_id UUID
  - class_id UUID
  - organization_id UUID
  - coin_amount INT
  - reason VARCHAR (attendance, assignment, test_pass, etc.)
  - award_date DATE (optional, defaults to TODAY)

Output:
  - reward_id UUID

Logic:
  1. Get user age status
  2. Create classroom_rewards record
  3. Convert coins to USD value: coins * 0.01 (example rate)
  4. If user < 18:
     - Set is_locked_for_minor=TRUE
     - Add to locked_balance
  5. If user >= 18:
     - Add to cashout_balance
  6. Return reward_id
  7. Audit log

Permissions: CEO/Admin only
```

#### RPC: `transfer_locked_to_cashout_on_age_verification()`
```
Input:
  - user_id UUID

Output:
  - transferred_amount NUMERIC

Logic:
  1. Get locked_balance from user_profiles
  2. Calculate total: sum of all locked_balance + unreleased rewards
  3. Move to cashout_balance
  4. Clear locked_balance
  5. Audit log

Auto-called by: verify_student_age_18_plus
```

#### RPC: `get_student_weekly_earnings()`
```
Input:
  - user_id UUID
  - class_id UUID
  - week_date DATE

Output:
  - JSON {
      total_coins: INT,
      attendance_coins: INT,
      assignment_coins: INT,
      test_coins: INT,
      remaining_weekly_cap: INT
    }

Logic:
  1. Query classroom_rewards for user + week
  2. Group by reward_type
  3. Sum coins per type
  4. Calculate remaining: 200 - total_coins (max per week)
  5. Return breakdown

Permissions: Student (own), CEO/Admin/Org (all)
```

---

### SECTION F: PRIVACY & PERMISSIONS

#### RPC: `check_profile_visibility_for_user()`
```
Input:
  - target_user_id UUID
  - requesting_user_id UUID

Output:
  - BOOLEAN (TRUE if visible, FALSE if hidden)

Logic:
  1. Get target_user.organization_id
  2. Get target_user.is_org_managed_student
  3. If is_org_managed_student:
     - Check if requesting user is from same org
     - Check if org explicitly shared profile
     - Return TRUE only if same org OR public override
  4. Else: Use normal visibility rules
  5. Return visibility status

Used by: Profile viewing, search, troll wall filtering
```

#### RPC: `filter_troll_posts_by_visibility()`
```
Input:
  - requesting_user_id UUID

Output:
  - filtered_posts ARRAY of post_ids

Logic:
  1. Query all troll_posts
  2. For each post by org-managed student:
     - Check organization_id match
     - Check visibility_override
     - Include only if visible to requester
  3. Return filtered list

Used by: Troll wall display, public feed
```

#### Function: `get_allowed_broadcast_access_for_user()`
```
Input:
  - user_id UUID

Output:
  - JSON {
      can_broadcast: BOOLEAN,
      can_watch: BOOLEAN,
      requires_approval: BOOLEAN,
      org_approver: VARCHAR or NULL
    }

Logic:
  1. Check if user is org-managed
  2. If yes: get controls from organization_student_controls
  3. Else: return normal permissions
  4. Return access object

Used by: Broadcast page before starting stream
```

---

### SECTION G: ADMIN DASHBOARD ENDPOINTS

#### RPC: `get_organization_admin_dashboard_data()`
```
Input:
  - org_id UUID
  - admin_user_id UUID

Output:
  - JSON {
      organization: { name, status, email, student_count, ... },
      students: [ { user_id, username, status, progress, ... } ],
      recent_reports: [ ... ],
      messages_count: INT,
      announcements: [ ... ]
    }
```

#### RPC: `get_system_admin_organizations_list()`
```
Input:
  - limit INT (default: 50)
  - offset INT (default: 0)
  - status_filter VARCHAR (optional)

Output:
  - JSON {
      organizations: [ ... ],
      total_count: INT
    }
```

---

## FRONTEND COMPONENTS

### COMPONENT TREE: Mai Class System

```
/src/pages/MaiClass.tsx
  ├── MaiClassHeader.tsx
  │   ├── HeroCard
  │   ├── StatsRow
  │   └── EnrollmentStatus
  │
  ├── MaiClassTabs.tsx
  │   ├── Tab: Overview
  │   ├── Tab: Live Class
  │   ├── Tab: Modules
  │   ├── Tab: Assignments
  │   ├── Tab: My Progress
  │   ├── Tab: Resources
  │   ├── Tab: Reports
  │   └── Tab: Announcements
  │
  ├── LiveClassroom.tsx (Tab: Live Class)
  │   ├── HostVideoArea.tsx
  │   │   ├── LiveBadge
  │   │   ├── ViewerCount
  │   │   └── HostControls (CEO only)
  │   │
  │   ├── StudentGridContainer.tsx
  │   │   ├── StudentTile.tsx (x20)
  │   │   │   ├── VideoArea
  │   │   │   ├── Username
  │   │   │   ├── MicIcon
  │   │   │   ├── CameraIcon
  │   │   │   └── ThreeDotsMenu
  │   │   │
  │   │   └── StudentGridControls (CEO only)
  │   │       ├── MuteAll
  │   │       ├── StopAllVideos
  │   │       └── RemoveStudent
  │   │
  │   ├── RightSidebar.tsx
  │   │   ├── NextClassCard
  │   │   ├── ClassChatCard.tsx
  │   │   │   ├── MessageList
  │   │   │   └── ChatInput
  │   │   │
  │   │   ├── ClassSettingsCard (CEO only)
  │   │   │   ├── AllowStudentsUnmute
  │   │   │   ├── AllowStudentsVideo
  │   │   │   └── RequireHandRaise
  │   │   │
  │   │   └── ClassInfoCard
  │   │       ├── Topic
  │   │       ├── Duration
  │   │       └── WeeklyCoinsEarned
  │   │
  │   └── CountdownTimer (when class not live)
  │
  ├── ModulesTab.tsx
  │   ├── ModuleCard.tsx (x6)
  │   │   ├── ModuleHeader
  │   │   ├── LessonsList
  │   │   ├── AssignmentButton
  │   │   ├── TestButton
  │   │   ├── ResourcesButton
  │   │   └── CompletionProgress
  │   │
  │   └── ModuleDetailModal.tsx (on expand)
  │       ├── LessonContent
  │       ├── AssignmentSubmission
  │       ├── TestStart
  │       └── Resources
  │
  ├── AssignmentsTab.tsx
  │   ├── AssignmentCard.tsx
  │   │   ├── Title
  │   │   ├── DueDate
  │   │   ├── Status
  │   │   ├── Grade (if graded)
  │   │   └── ViewSubmissionButton
  │   │
  │   ├── SubmitAssignmentModal.tsx
  │   │   ├── InstructionsDisplay
  │   │   ├── TextInput
  │   │   ├── FileUpload
  │   │   ├── SubmitButton
  │   │   └── ConfirmationMessage
  │   │
  │   └── GradingPanel.tsx (CEO only)
  │       ├── SubmissionList
  │       ├── SubmissionDetail
  │       ├── GradeInput
  │       ├── FeedbackInput
  │       └── SaveButton
  │
  ├── MyProgressTab.tsx
  │   ├── OverallProgress
  │   │   ├── ProgressBar
  │   │   ├── PercentageDisplay
  │   │   └── CompletionStatus
  │   │
  │   ├── ModuleProgressList.tsx
  │   │   ├── ModuleProgressCard.tsx
  │   │   │   ├── ModuleName
  │   │   │   ├── LessonsCompleted
  │   │   │   ├── AssignmentStatus
  │   │   │   ├── TestScore
  │   │   │   └── CompletionDate
  │   │   │
  │   │   └── EarningsBreakdown
  │   │       ├── CoinsEarned
  │   │       ├── WeeklyStatus
  │   │       └── LockedStatus (if < 18)
  │
  ├── ResourcesTab.tsx
  │   ├── ResourceCard.tsx
  │   │   ├── Type (video/link/article)
  │   │   ├── Title
  │   │   ├── Description
  │   │   └── OpenButton
  │
  ├── ReportsTab.tsx (Org admin only)
  │   ├── StudentReportCard.tsx
  │   │   ├── StudentName
  │   │   ├── Category
  │   │   ├── Description
  │   │   ├── Status
  │   │   └── Details
  │   │
  │   └── CreateReportModal.tsx
  │       ├── StudentSelect
  │       ├── CategorySelect
  │       ├── SeveritySelect
  │       ├── DescriptionInput
  │       └── SubmitButton
  │
  └── AnnouncementsTab.tsx
      ├── AnnouncementCard.tsx
          ├── Title
          ├── Content
          ├── Date
          ├── PinnedIcon
          └── (Admin) DeleteButton

/src/pages/Organizations/
  ├── OrganizationSignup.tsx
  │   ├── NameInput
  │   ├── EmailInput (with business email validation)
  │   ├── PhoneInput
  │   ├── WebsiteInput
  │   ├── CountrySelect
  │   ├── DescriptionInput
  │   ├── AdminUserSelect
  │   └── SubmitButton
  │
  ├── OrganizationDashboard.tsx (Org admin)
  │   ├── OrgInfoCard
  │   ├── StudentManagementTab
  │   │   ├── StudentList.tsx
  │   │   │   ├── StudentRow.tsx
  │   │   │   │   ├── Username
  │   │   │   │   ├── Status
  │   │   │   │   ├── Progress%
  │   │   │   │   ├── LastActivity
  │   │   │   │   ├── ControlsMenu
  │   │   │   │   │   ├── ViewReportCard
  │   │   │   │   │   ├── DisableAccount
  │   │   │   │   │   ├── RemoveStudent
  │   │   │   │   │   ├── ManagePermissions
  │   │   │   │   │   └── ViewProgress
  │   │   │   │   │
  │   │   │   │   └── QuickActionButtons
  │   │   │   │
  │   │   │   └── AddStudentButton
  │   │   │
  │   │   ├── StudentPermissionsModal.tsx
  │   │   │   ├── PermissionToggleList
  │   │   │   │   ├── can_broadcast
  │   │   │   │   ├── can_watch_broadcast
  │   │   │   │   ├── can_use_chat
  │   │   │   │   ├── can_post_troll_wall
  │   │   │   │   ├── can_join_mai_class
  │   │   │   │   └── can_gift_coins
  │   │   │   │
  │   │   │   ├── ToggleOptions
  │   │   │   │   ├── requires_approval checkboxes
  │   │   │   │   └── daily_limits inputs
  │   │   │   │
  │   │   │   └── SaveButton
  │   │   │
  │   │   └── ProgressReportCard.tsx
  │   │       ├── ModulesCompleted
  │   │       ├── AssignmentsSubmitted
  │   │       ├── TestsPassed
  │   │       ├── AverageGrade
  │   │       ├── WeeklyAttendance
  │   │       └── Badges
  │   │
  │   ├── MessagingTab.tsx
  │   │   ├── OrgInboxList.tsx
  │   │   │   ├── MessageRow.tsx
  │   │   │   │   ├── SenderOrgName
  │   │   │   │   ├── PreviewText
  │   │   │   │   ├── Date
  │   │   │   │   └── UnreadIndicator
  │   │   │   │
  │   │   │   └── ComposeButton
  │   │   │
  │   │   ├── MessageThreadView.tsx
  │   │   │   ├── MessageBubbles
  │   │   │   ├── ReplyInput
  │   │   │   └── SendButton
  │   │   │
  │   │   └── ComposeMessageModal.tsx
  │   │       ├── RecipientOrgSelect
  │   │       ├── MessageInput
  │   │       └── SendButton
  │   │
  │   └── ReportsTab.tsx
  │       ├── StudentReportsList.tsx
  │       │   ├── ReportCard.tsx
  │       │   │   ├── StudentName
  │       │   │   ├── Category
  │       │   │   ├── Severity
  │       │   │   ├── Status
  │       │   │   ├── CreatedDate
  │       │   │   └── ViewDetailsButton
  │       │   │
  │       │   └── CreateNewReportButton
  │       │
  │       └── ReportDetailModal.tsx
  │           ├── StudentInfo
  │           ├── ReportDetails
  │           ├── Status (Open/In Review/Resolved)
  │           ├── Notes
  │           ├── AssignToAdmin
  │           └── UpdateStatusButton
  │
  ├── AdminDashboard.tsx (Admin only - System Admin)
  │   ├── OrganizationsListTab.tsx
  │   │   ├── OrgTable.tsx
  │   │   │   ├── OrgRow.tsx
  │   │   │   │   ├── OrgName
  │   │   │   │   ├── Contact
  │   │   │   │   ├── Email
  │   │   │   │   ├── Country
  │   │   │   │   ├── Status
  │   │   │   │   ├── StudentCount
  │   │   │   │   ├── CreatedDate
  │   │   │   │   └── ActionButtons
  │   │   │   │       ├── Approve
  │   │   │   │       ├── Reject
  │   │   │   │       ├── Suspend
  │   │   │   │       └── View Details
  │   │   │   │
  │   │   │   └── Pagination
  │   │   │
  │   │   ├── StatusFilterButtons
  │   │   │   ├── All
  │   │   │   ├── Pending
  │   │   │   ├── Approved
  │   │   │   ├── Rejected
  │   │   │   └── Suspended
  │   │   │
  │   │   └── SearchOrgInput
  │   │
  │   ├── OrgDetailView.tsx (Modal/Side panel)
  │   │   ├── OrgInfoCard
  │   │   ├── StudentListInOrg
  │   │   ├── PermissionsSettings
  │   │   ├── ActivityOverview
  │   │   ├── ApprovalButtons
  │   │   └── SuspendButton
  │   │
  │   ├── TeacherApplicationsTab.tsx
  │   │   ├── ApplicationCard.tsx
  │   │   │   ├── UserInfo
  │   │   │   ├── Experience
  │   │   │   ├── Motivation
  │   │   │   ├── Status
  │   │   │   └── ApproveRejectButtons
  │   │   │
  │   │   └── ApplicationDetailModal.tsx
  │   │
  │   └── StudentReportsOverview.tsx
  │       ├── ReportsByOrg
  │       ├── ReportsBySeverity
  │       ├── ReportsByStatus
  │       └── HotItems
  │
  └── TeacherApplicationForm.tsx (Public)
      ├── NameInput
      ├── EmailInput
      ├── PhoneInput
      ├── ExperienceTextarea
      ├── WhyTeachTextarea
      ├── SkillsTextarea
      ├── ModuleInterests (multi-select)
      └── SubmitButton

/src/components/Shared/
  ├── LockedEarningsIndicator.tsx
      ├── If user < 18: Show lock icon + "Earnings locked until age 18"
      ├── Progress to unlock
      └── Amount locked
```

---

## SECURITY & PERMISSIONS LAYER

### RLS Policies Summary

| Table | Role | Rules |
|-------|------|-------|
| `classroom_classes` | Student | Can read own enrolled class |
| | CEO | Can read/write all |
| | Org Admin | Can read own org's classes |
| `classroom_enrollments` | Student | Can read own |
| | Org Admin | Can read own org's students |
| | CEO | Can read/write all |
| `classroom_submissions` | Student | Can read own |
| | CEO | Can read all in their class |
| | Org Admin | Can read own org students |
| `organization_students` | Student | Can read own record |
| | Org Admin | Can manage own org |
| | CEO | Can read all |
| `organization_student_controls` | Org Admin | Can update own |
| | CEO | Can read/update all |
| `troll_posts` | Various | Visibility based on org_id + public rules |
| `organization_messages` | Org Admin | Can read own sent/received |

### Age-Based Access Control

**For users < 18:**
- Cannot cash out coins
- Cannot purchase coins from store
- CAN gift coins in broadcasts
- CAN see own locked earnings balance
- Access to Mai Class if org approved
- All platform features restricted per org controls

**For users >= 18:**
- Full cashout access
- Can purchase coins
- Can gift coins
- Normal access

---

## INTEGRATION POINTS

### 1. EXISTING SYSTEMS TO CONNECT

#### Coin System Integration
- Link `classroom_rewards` to `troll_coins` table
- Award coins via existing `award_coins()` RPC
- Locked/unlocked logic in earnings functions
- Weekly cap: 200 coins per student per week

#### Troll Wall / Feed Integration
- Auto-create posts via `create_troll_post()` when:
  - Module completed
  - Test passed
  - Badge earned
- Post visible only within org initially, with visibility override

#### User Profiles Integration
- Add fields to `user_profiles`:
  - organization_id
  - is_org_managed_student
  - date_of_birth
  - locked_balance
  - cashout_balance
  - is_verified_18_plus

#### LiveKit Integration
- Use existing LiveKit setup
- Create room: `mai-class-{date}-{hash}`
- Manage participants with existing LiveKit tokens
- Store session data in `classroom_livekit_sessions`

#### Broadcast System Integration
- Link broadcast access to `organization_student_controls`
- Require org approval before broadcast
- Hide org student profiles from public

#### Chat System Integration
- Org chat: Use existing chat infrastructure
- Org messaging: New `organization_messages` table
- Link class chat to existing chat system

---

### 2. EXTERNAL DEPENDENCIES

- **LiveKit** - Already integrated, use existing tokens
- **Supabase Storage** - For assignment file uploads
- **Email Service** - For notifications and org verification
- **Stripe/PayPal** - Existing payment (no changes for Phase 1)

---

## IMPLEMENTATION SEQUENCE

### PHASE 1: CORE DATABASE & BACKEND (Week 1-2)

**Week 1, Day 1-2: Migrations**
- [ ] Migration 1: Core classroom tables
- [ ] Migration 2: Organization tables
- [ ] Migration 3: Age lock columns
- [ ] Migration 4: LiveKit session tables
- [ ] Migration 5: Attendance & rewards tables
- [ ] Migration 6: Teacher applications table
- [ ] Migration 7: Badges & recognition
- [ ] Migration 8: Org visibility privacy columns

**Week 1, Day 3-5: RLS Policies**
- [ ] Apply RLS to all tables
- [ ] Test policies with different roles
- [ ] Verify org isolation
- [ ] Verify age-based access

**Week 2, Day 1-3: Backend Functions (Priority)**
- [ ] `validate_business_email_domain()`
- [ ] `create_organization()`
- [ ] `add_student_to_organization()`
- [ ] `create_classroom_class()`
- [ ] `enroll_student_in_class()`
- [ ] `submit_assignment()`
- [ ] `grade_submission()`
- [ ] `submit_test_attempt()`

**Week 2, Day 4-5: Backend Functions (Secondary)**
- [ ] `create_livekit_session()`
- [ ] `join_livekit_session()`
- [ ] `award_coins_to_student()`
- [ ] `verify_student_age_18_plus()`
- [ ] `check_organization_student_permission()`

---

### PHASE 2: FRONTEND - PAGES (Week 3-4)

**Week 3, Day 1-3: Mai Class Page - Core Layout**
- [ ] Create `/mai-class` route
- [ ] Build `MaiClassHeader` with hero card
- [ ] Build `MaiClassTabs` component
- [ ] Build left sidebar integration
- [ ] Build top bar with search

**Week 3, Day 4-5: Mai Class - Live Classroom Tab**
- [ ] `LiveClassroom` component structure
- [ ] `HostVideoArea` with LiveKit integration
- [ ] `StudentGridContainer` with 20-student layout
- [ ] `StudentTile` components with avatars

**Week 4, Day 1-2: Mai Class - Remaining Tabs**
- [ ] `ModulesTab` - Display 6 modules
- [ ] `AssignmentsTab` - List assignments
- [ ] `MyProgressTab` - Show progress
- [ ] `ResourcesTab` - Display resources

**Week 4, Day 3-4: Organization Pages**
- [ ] `OrganizationSignup` page
- [ ] `OrganizationDashboard` for org admins
- [ ] `StudentManagement` tab
- [ ] `StudentPermissionsModal`

**Week 4, Day 5: Admin Pages**
- [ ] `AdminDashboard` organizations list
- [ ] `OrgDetailView` modal
- [ ] `TeacherApplicationsTab`

---

### PHASE 3: FRONTEND - INTERACTIVE FEATURES (Week 5-6)

**Week 5, Day 1-2: Classroom Interactions**
- [ ] Assignment submission flow
- [ ] Test submission flow
- [ ] Grading panel (CEO only)
- [ ] Class chat implementation

**Week 5, Day 3-5: Organization Controls**
- [ ] Student permission management
- [ ] Organization messaging
- [ ] Student reporting system
- [ ] Progress tracking display

**Week 6, Day 1-3: Locked Earnings Display**
- [ ] `LockedEarningsIndicator` component
- [ ] Show locked balance for minors
- [ ] Countdown to age 18
- [ ] Age verification flow

**Week 6, Day 4-5: Privacy & Visibility**
- [ ] Hide org student profiles from public
- [ ] Filter troll wall posts by org
- [ ] Hide broadcast access for unapproved
- [ ] Update search to exclude hidden profiles

---

### PHASE 4: TESTING & DEPLOYMENT (Week 7)

**Week 7, Day 1-2: Integration Testing**
- [ ] Test email validation
- [ ] Test org creation flow
- [ ] Test student enrollment
- [ ] Test assignment submission
- [ ] Test age lock on earnings

**Week 7, Day 3-4: LiveKit Testing**
- [ ] Test room creation
- [ ] Test participant joins
- [ ] Test recording
- [ ] Test attendance tracking

**Week 7, Day 5: Deployment**
- [ ] Deploy migrations
- [ ] Deploy functions
- [ ] Deploy frontend changes
- [ ] Monitor for issues

---

## REQUIRED FILES TO CREATE

### SQL Migration Files
```
migrations/
├── 001_create_mai_class_core_tables.sql
├── 002_create_organization_tables.sql
├── 003_create_locked_earnings_system.sql
├── 004_create_livekit_integration_tables.sql
├── 005_create_classroom_attendance_and_rewards.sql
├── 006_create_teacher_application_table.sql
├── 007_create_classroom_badges_and_recognition.sql
└── 008_add_organization_visibility_privacy.sql
```

### TypeScript/React Files
```
src/
├── pages/
│   ├── MaiClass.tsx
│   ├── Organizations/
│   │   ├── OrganizationSignup.tsx
│   │   ├── OrganizationDashboard.tsx
│   │   └── index.tsx
│   └── Admin/
│       ├── AdminDashboard.tsx
│       └── index.tsx
│
├── components/
│   ├── MaiClass/
│   │   ├── MaiClassHeader.tsx
│   │   ├── MaiClassTabs.tsx
│   │   ├── LiveClassroom.tsx
│   │   ├── HostVideoArea.tsx
│   │   ├── StudentGridContainer.tsx
│   │   ├── StudentTile.tsx
│   │   ├── ModulesTab.tsx
│   │   ├── AssignmentsTab.tsx
│   │   ├── MyProgressTab.tsx
│   │   ├── ResourcesTab.tsx
│   │   ├── ReportsTab.tsx
│   │   └── AnnouncementsTab.tsx
│   │
│   ├── Organizations/
│   │   ├── StudentManagement.tsx
│   │   ├── StudentPermissionsModal.tsx
│   │   ├── StudentProgressReport.tsx
│   │   ├── OrgMessaging.tsx
│   │   └── StudentReporting.tsx
│   │
│   └── Shared/
│       ├── LockedEarningsIndicator.tsx
│       └── BusinessEmailValidator.tsx
│
└── services/
    ├── maiClassService.ts
    ├── organizationService.ts
    ├── liveKitService.ts
    └── permissionsService.ts
```

---

## NOTES FOR KILO IDE

### Critical Implementation Rules

1. **Age Verification**
   - ALWAYS check date_of_birth on student enrollment
   - Mark locked_balance for all earnings if age < 18
   - NEVER allow cashout if not verified 18+

2. **Privacy**
   - ALWAYS hide org-managed student profiles from non-org users
   - Filter troll wall posts through `filter_troll_posts_by_visibility()`
   - Verify organization_id before showing any student data

3. **Email Validation**
   - ALWAYS validate business email on org signup
   - Reject free email domains (list in specs)
   - Store email_verified_at after verification

4. **LiveKit**
   - Room name format: `mai-class-{YYYYMMDD}-{random_hash}`
   - Max 20 participants (enforce in join logic)
   - Track attendance in `classroom_livekit_participants`

5. **Rewards**
   - 50 coins for attendance (> 10 mins)
   - 50 coins for assignment submission
   - 100 coins for test pass
   - 200 coin weekly cap per student
   - Auto-move to locked_balance if age < 18

6. **Permissions**
   - CEO only: grade submissions, create classes, approve orgs
   - Org admin only: manage own org students, send messages
   - Students: submit assignments, join class, view resources
   - Verify permissions on every RPC call

---

**END OF MASTER PLAN**

Status: ✅ READY FOR DEVELOPMENT
Next Step: Begin PHASE 1 migrations

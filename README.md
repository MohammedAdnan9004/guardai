# 🛡️ GuardAI – Autonomous AI-Powered SOC Analyst SaaS

> Upload security logs. Detect potential threats. Understand attacks. Generate actionable remediation plans with AI.

GuardAI is an AI-powered Security Operations Center (SOC) Analyst SaaS platform designed to help security teams automate security log analysis, identify suspicious activities, understand potential cyberattacks, and generate actionable remediation recommendations.

The platform combines Large Language Models (LLMs), Retrieval-Augmented Generation (RAG), vector embeddings, PostgreSQL with pgvector, and real-time AI streaming to deliver an intelligent security analysis experience.

GuardAI is designed around a secure, scalable, three-tier multi-tenant architecture with Role-Based Access Control (RBAC).

---

## 🚀 Product Vision

Traditional security log analysis requires security analysts to manually inspect large volumes of logs, investigate suspicious activities, correlate events, and determine appropriate remediation steps.

GuardAI aims to simplify this workflow through an autonomous AI-powered SOC Analyst.

Users will be able to:

- Upload security logs and supporting documents.
- Automatically parse and analyze security events.
- Identify suspicious patterns and potential threats.
- Detect attack indicators and classify threat severity.
- Understand why an event is considered suspicious.
- Retrieve relevant security knowledge using RAG.
- Generate AI-powered threat investigation reports.
- Receive actionable remediation plans.
- Interact with AI through real-time streaming responses.
- Manage security operations through isolated workspaces.

## 🎯 Core Product Capabilities

### 1. Security Log Ingestion

- Drag-and-drop log uploads.
- JSON, CSV, SYSLOG and supported log formats.
- File validation and sanitization.
- Asynchronous background processing.
- Structured log parsing.
- Personally identifiable information (PII) masking.

### 2. AI-Powered Threat Detection

- Suspicious activity detection.
- Threat classification.
- Severity scoring.
- Attack pattern identification.
- Contextual threat explanations.
- Security event correlation.

### 3. RAG-Based Security Intelligence

- Document and security knowledge ingestion.
- Text chunking.
- Embedding generation.
- PostgreSQL pgvector storage.
- Semantic similarity search.
- Context-aware threat analysis.
- Evidence-grounded AI responses.

### 4. AI Threat Reports

Generate structured reports containing:

- Threat type.
- Severity level.
- Threat score.
- Suspicious indicators.
- Attack explanation.
- Supporting evidence.
- Potential impact.
- Recommended remediation actions.

### 5. AI Remediation Plans

- Actionable mitigation steps.
- Prioritized remediation checklists.
- Investigation recommendations.
- Threat resolution tracking.
- Analyst feedback.

### 6. Real-Time AI Experience

- Streaming AI responses.
- Live analysis status.
- Dynamic threat cards.
- Severity indicators.
- Interactive remediation checklists.
- Real-time dashboard updates.

---

## 🏗️ Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 – App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Animations | Framer Motion |
| Icons | Lucide React |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Database Security | PostgreSQL RLS |
| Vector Database | pgvector |
| Rate Limiting | Upstash Redis |
| Validation | Zod |
| Forms | React Hook Form |
| Notifications | Sonner |
| Charts | Recharts |
| AI Streaming | Vercel AI SDK |
| Payments | Lemon Squeezy |
| Version Control | Git and GitHub |

### Infrastructure

- Supabase for authentication, PostgreSQL and database management.
- Upstash Redis for rate limiting, temporary security state and usage controls.
- pgvector for semantic search and retrieval.
- Lemon Squeezy for subscription and payment management.
- Background processing architecture for asynchronous log analysis.

---

## 🔐 Security Architecture

Security is a foundational requirement across GuardAI.

### Multi-Tenant Architecture

Every customer operates inside an isolated workspace.

Workspace data must never be accessible to unauthorized tenants.

### Role-Based Access Control

GuardAI supports three global access levels:

**1. Super Admin**
- Platform-wide administration.
- Workspace management.
- User management.
- Global analytics.
- Audit logs.
- Workspace suspension and reactivation.
- Subscription exemption.

**2. Tenant Admin / Workspace Owner**
- Workspace management.
- Team invitations.
- Member role management.
- Subscription and billing.
- Workspace security settings.
- Security log ingestion.
- Threat investigation.

**3. Member / SOC Analyst**
- Upload security logs.
- Access AI threat dashboards.
- Review threat reports.
- Execute remediation checklists.
- Manage personal profile and MFA.

### Security Controls

- Supabase Row Level Security.
- Server-side authorization.
- Zod schema validation.
- Secure session management.
- HTTP-only cookies.
- XSS prevention.
- CSRF protection.
- Upstash Redis rate limiting.
- Login brute-force protection.
- Secure API access.
- Administrative audit logging.

---

## 🧠 AI Architecture

The AI architecture will evolve through dedicated implementation phases.

Planned capabilities:

1. Security log parsing and normalization.
2. Document processing and chunking.
3. Embedding generation.
4. pgvector indexing.
5. Semantic retrieval.
6. RAG context construction.
7. LLM-based threat analysis.
8. Structured threat report generation.
9. Streaming AI responses.
10. Remediation plan generation.

AI-generated conclusions must distinguish observed evidence from inferred possibilities. GuardAI is an analyst-assistance platform, not an automatic guarantee that a threat is present or absent.

---

## 🖥️ User Interface & Experience

GuardAI will use a modern cybersecurity-inspired SaaS design.

### Design Direction

- Premium SOC dashboard aesthetic.
- Dark and light themes.
- Graphite and deep navy backgrounds.
- Electric violet and cyan accents.
- Subtle animated grid backgrounds.
- Glass-like interface surfaces.
- Animated threat indicators.
- Interactive analytics charts.
- Smooth page transitions.
- Responsive layouts.
- Professional typography.
- Consistent design tokens.

The goal is to create a distinctive, polished and production-quality cybersecurity SaaS experience.

---

## 📅 Development Roadmap

### Phase 1 – Authentication, RBAC, Multi-Tenancy & Security

- Next.js project foundation.
- Design system and theme.
- Supabase authentication.
- Email/password registration.
- Google OAuth.
- Login and logout.
- Forgot password and OTP verification.
- Password reset.
- Profiles and workspace database schema.
- Automatic profile synchronization.
- Workspace provisioning.
- Tenant Admin and Member roles.
- Super Admin authorization.
- Custom JWT claims.
- PostgreSQL RLS policies.
- Upstash Redis rate limiting.
- Protected routes.
- Security baseline.

### Phase 2 – GuardAI Foundation, Ingestion & RAG Pipeline

- Security log upload.
- File validation.
- Log parsing.
- PII masking.
- Background processing.
- Text chunking.
- Embedding generation.
- pgvector integration.
- Semantic search.
- RAG pipeline.
- AI threat analysis.
- Structured threat reports.

### Phase 3 – Real-Time AI SOC Dashboard & Generative UI

- SOC intelligence dashboard.
- Threat analytics.
- Attack visualization.
- Real-time log stream.
- AI response streaming.
- Dynamic threat components.
- Severity indicators.
- Remediation cards.
- Interactive remediation checklists.
- Dashboard role-based rendering.

### Phase 4 – Monetization, Metering, Team Invites & Production Launch

- Free and Pro plans.
- Lemon Squeezy integration.
- Subscription checkout.
- Secure webhooks.
- Usage tracking.
- Scan quotas.
- Upstash Redis metering.
- Workspace team invitations.
- Super Admin portal.
- Global platform analytics.
- Workspace suspension controls.
- Production readiness.

---

## 📂 Repository Structure

```text
guardai/
├── public/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── types/
│   └── utils/
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── docs/
│   ├── PROJECT_OVERVIEW.md
│   ├── TECH_STACK.md
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── DATABASE_DESIGN.md
│   ├── SECURITY_ARCHITECTURE.md
│   ├── AI_ARCHITECTURE.md
│   ├── UI_UX_GUIDELINES.md
│   ├── DEVELOPMENT_ROADMAP.md
│   └── ENVIRONMENT_SETUP.md
├── tests/
├── .env.example
├── DEVELOPMENT_STATUS.md
└── README.md
```

---

## 🛠️ Development Principles

- Modular and feature-oriented architecture.
- Strict TypeScript.
- Reusable UI components.
- Server-side security enforcement.
- Database-level tenant isolation.
- Centralized validation and error handling.
- Secure environment configuration.
- Automated testing.
- Clear separation of business logic and presentation.
- Documented architectural decisions.
- Incremental phase-based development.

---

## 📌 Project Status

**Current Stage:** Project Initialization

| Phase | Description | Status |
|---|---|---|
| Repository | Project documentation and architecture | Planned |
| Phase 1 | Authentication, RBAC and Security | Started |
| Phase 2 | Ingestion and RAG Pipeline | Not Started |
| Phase 3 | AI SOC Dashboard and Streaming | Not Started |
| Phase 4 | Monetization and Production Launch | Not Started |

---

## 🎯 Long-Term Objective

Build GuardAI into a production-grade AI-powered SOC Analyst SaaS that enables organizations to understand security threats faster, investigate suspicious activities more efficiently, and generate actionable security remediation plans using AI.

**GuardAI – Intelligent Security Analysis. Faster Threat Response.**

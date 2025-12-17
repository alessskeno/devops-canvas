# DevOps Canvas - Agent Context & Build Instructions

**Last Updated:** December 13, 2025  
**Project:** DevOps Canvas - Visual Node-Based Infrastructure Composer  
**Status:** Frontend Implementation Guide  
**Target:** LLM Agents & Code Generators

---

## 🎯 PROJECT OVERVIEW

**DevOps Canvas** is a visual node-based infrastructure composer that enables developers to design and deploy complete development environments (Kind clusters, databases, caches, message queues) in minutes without writing infrastructure code.

**Design Inspiration:** n8n workspace editor (simplified, minimal, developer-focused)  
**Target Users:** Developers spinning up local dev environments  
**Primary Interaction:** Drag-and-drop components → Configure → Deploy  

**Key Principle:** Reduce friction to maximum 3 clicks to add component, 2 clicks to deploy.

---

## 🎨 DESIGN SYSTEM (CRITICAL - Use for ALL styling)

### Color Palette (Use CSS variables - NO hardcoded colors)

```css
/* Primary & Actions */
--color-primary: #2563EB      /* Blue - buttons, highlights, active states */
--color-secondary: #8B5CF6      /* Purple - emphasis, hover states */

/* Status Colors */
--color-success: #10B981        /* Green - deployed, healthy, success */
--color-warning: #F59E0B        /* Orange - warnings, attention needed */
--color-error: #EF4444          /* Red - errors, failures, critical */

/* Neutral & Background */
--color-bg-primary: #F9FAFB     /* Light gray - main canvas background */
--color-surface: #FFFFFF        /* White - cards, panels, containers */
--color-text-primary: #1F2937   /* Dark gray - body text, high contrast */
--color-text-secondary: #6B7280 /* Medium gray - secondary text, labels */
--color-border: #E5E7EB         /* Light gray - dividers, borders */

/* Dark Mode */
--color-dark-bg: #0F172A    /* Dark background for dark mode */ 
--color-dark-surface: #020617   /* Dark surface for dark mode */
```

### Typography (Font Family: Inter + system fonts)

```
Font: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
Monospace: JetBrains Mono, 'monospace'

Sizes:
- xs: 11px
- sm: 12px
- base: 14px
- md: 14px
- lg: 16px
- xl: 18px
- 2xl: 20px
- 3xl: 24px
- 4xl: 30px

Weights:
- Regular: 400 (body text)
- Medium: 500 (labels)
- Semibold: 600 (headings)

Line Heights:
- Tight: 1.2 (headings)
- Normal: 1.5 (body)
```

### Spacing System (8px base unit)

```
0, 1px, 2px, 4px, 6px, 8px, 10px, 12px, 16px, 20px, 24px, 32px

Typical usage:
- Padding: 16px, 24px
- Margin: 8px, 16px
- Gap: 16px (grid)
```

### Border Radius

```
sm: 6px
base: 8px
md: 10px
lg: 12px
full: 9999px (circles)
```

### Shadows

```
xs: 0 1px 2px rgba(0,0,0,0.02)
sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)
md: 0 4px 6px -1px rgba(0,0,0,0.04), 0 2px 4px -1px rgba(0,0,0,0.02)
lg: 0 10px 15px -3px rgba(0,0,0,0.04), 0 4px 6px -2px rgba(0,0,0,0.02)
```

### Animations

```
Timing:
- Fast: 150-200ms (quick interactions)
- Normal: 250ms (standard transitions)

Easing: cubic-bezier(0.16, 1, 0.3, 1)

Uses:
- Fade-in: modals (150ms)
- Slide-in: side panels (200ms)
- Smooth number updates: progress bars
- Hover: color + shadow (200ms)
```

### Interactive Elements Styling

**Buttons:**
- Border-radius: 8px
- Flat design (NO shadows)
- Smooth transitions (200ms)
- States: default, hover, active, disabled, loading

**Form Inputs:**
- Border-radius: 6px
- Border: 1px
- Focus: blue outline + shadow
- States: empty, filled, error, disabled

**Cards:**
- Border-radius: 8px
- Default: subtle shadow
- Hover: shadow-lg
- Interactive: cursor change

**Canvas Nodes:**
- Border-radius: 12px
- Border: 2px
- Dragging: shadow-lg + 0.8 opacity
- Selected: blue border + blue shadow

**Connection Lines:**
- Curve: bezier (smooth, not straight)
- Color: purple (#8B5CF6)
- Width: 2px
- Hover: glow effect
- Arrow endpoint: small triangle

---

## 📱 RESPONSIVE DESIGN

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| **Desktop** | 1920px+ | Full layout: left sidebar + canvas + right sidebar |
| **Tablet** | 1024px-1920px | Right sidebar collapses to tabs, left sidebar toggleable |
| **Mobile** | <1024px | NOT SUPPORTED (developer tool - assume desktop) |

**Canvas:** Always responsive, maintains grid alignment

---

## 🏗️ PROJECT STRUCTURE

```
devops-canvas-frontend/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── AdminSetup.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── workspace/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── WorkspaceCard.tsx
│   │   ├── profile/
│   │   │   ├── ProfileLayout.tsx
│   │   │   ├── GeneralSettings.tsx
│   │   │   ├── SecuritySettings.tsx
│   │   │   ├── PreferencesSettings.tsx
│   │   │   └── DeveloperSettings.tsx
│   │   ├── team/
│   │   │   ├── TeamLayout.tsx
│   │   │   ├── TeamDashboard.tsx
│   │   │   ├── MembersList.tsx
│   │   │   └── InviteModal.tsx
│   │   ├── canvas/
│   │   │   ├── CanvasArea.tsx
│   │   │   ├── NodeEditor.tsx
│   │   │   ├── ComponentLibrary.tsx
│   │   │   ├── ConfigPanel.tsx
│   │   │   ├── CanvasNode.tsx
│   │   │   ├── KindClusterConfigForm.tsx
│   │   │   ├── ConnectionLine.tsx
│   │   │   └── ContextMenu.tsx
│   │   ├── modals/
│   │   │   ├── ExportModal.tsx
│   │   │   ├── DeploymentProgress.tsx
│   │   │   └── DeploymentSuccess.tsx
│   │   └── shared/
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       ├── Input.tsx
│   │       ├── HighlightedText.tsx
│   │       ├── Select.tsx
│   │       ├── Toggle.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCanvas.ts
│   │   ├── useWorkspace.ts
│   │   ├── useWebSocket.ts
│   │   └── useLocalStorage.ts
│   ├── store/
│   │   ├── authStore.ts (Zustand)
│   │   ├── canvasStore.ts (Zustand)
│   │   ├── workspaceStore.ts (Zustand)
│   │   └── uiStore.ts (Zustand)
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── api.ts (axios client)
│   │   ├── dragDrop.ts
│   │   ├── validation.ts
│   │   ├── componentRegistry.ts
│   │   ├── componentConfigSchemas.ts # Centralized schema definitions
│   │   ├── security.ts             # Sensitivity detection logic
│   │   ├── exportConfig.ts         # Export config generation logic
│   │   ├── kindConfig.ts
│   ├── styles/
│   │   ├── globals.css
│   │   ├── designTokens.css
│   │   └── animations.css
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── public/
│   └── index.html
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
└── README.md
```

---

## 🖼️ SCREEN BLUEPRINTS

### SCREEN 1: Login Page
- **Layout:** Centered card (max-width: 400px)
- **Background:** Gradient #F9FAFB → #E5E7EB
- **Fields:** Email, Password, Remember Me checkbox
- **Links:** Sign up, Forgot password
- **Button:** Full-width blue primary button
- **File:** `src/components/auth/LoginPage.tsx`

### SCREEN 2: Admin Setup (First-Time)
- **Layout:** Modal dialog, centered
- **Title:** "Welcome to DevOps Canvas"
- **Fields:** Full Name, Email, Password, Confirm Password, Terms Checkbox
- **Validation:** Real-time password strength indicator, field matching
- **Button:** Full-width "Create Admin User" (disabled until valid)
- **File:** `src/components/auth/AdminSetup.tsx`

### SCREEN 3: Dashboard (Post-Login)
- **Layout:** Header + Workspace grid + Quick actions
- **Header:** Logo + User dropdown
- **Content:** Workspace cards (grid, auto-fit, min 250px), search, filters
- **Card Actions:** Edit, Delete, Export, Duplicate (on hover)
- **Button:** Prominent "Create New Workspace" button
- **File:** `src/components/workspace/Dashboard.tsx`

### SCREEN 4: Main Canvas Workspace (N8N-style)
- **Layout:** Three-section layout
  1. **Left Sidebar (280px):** Component Library (search, tabs, draggable cards)
  2. **Center (flex: 1):** Canvas with grid background, toolbar, nodes, lines
  3. **Right Sidebar (320px):** Config Panel (tabs: General, Configuration, Advanced, Logs)

#### LEFT SIDEBAR: Component Library
- Search input with icon
- Category tabs: [All] [Infrastructure] [Databases] [Queues] [Caching] [Custom]
- Draggable component cards (Icon + Name + Description + Version + Star)
- Components: Kind, PostgreSQL, Redis, Kafka, RabbitMQ, ClickHouse
- **File:** `src/components/canvas/ComponentLibrary.tsx`

#### CENTER: Canvas
- Grid background (20px spacing, #E5E7EB lines)
- **Toolbar (fixed top):**
  - Left: Zoom, Fit to screen
  - Center: Editable workspace name
  - Right: Undo/Redo, Export, Save, Deploy
- **Canvas:** Pan via click+drag, scroll to zoom, grid snap optional, minimap (150x150px)
- **Nodes:** Draggable cards with ports, selected state (blue), context menu on right-click
- **Connections:** Bezier curves, purple (#8B5CF6), width 2px, arrow endpoint
- **Files:**
  - `src/components/canvas/CanvasArea.tsx`
  - `src/components/canvas/CanvasNode.tsx`
  - `src/components/canvas/ConnectionLine.tsx`
  - `src/components/canvas/CanvasToolbar.tsx`

#### RIGHT SIDEBAR: Config Panel
- **Tab: General**
  - Display name (editable)
  - Component type (read-only)
  - Description (textarea)
  - Enabled/Disabled toggle
  
- **Tab: Configuration (dynamic per component)**
  - Kind Cluster:
    - Topology: Control Planes, Workers
    - Networking: Ingress Ready, API Server Port
    - Storage: Extra Host Path Mounts
    - Advanced: Config File Attachment (raw YAML patches)
  - PostgreSQL: Version, Port, Database name, Root user, Root password, Max connections, Idle connections, Timeout
  - Redis: Version, Port, Max memory, Eviction policy, Persistence toggle, Persistence type, Key space notification, Slow log threshold
  - Kafka: Version, Broker port, Zookeeper port, Brokers count, Replication factor, Min in-sync, Partitions, Log retention, Compression
  
- **Tab: Advanced**
  - Environment variables (key-value editor)
  - Resource allocation (CPU, Memory, Disk dropdowns with visual bars)
  - Labels/Tags (chip input)
  - Network (port mapping)
  
- **Tab: Logs**
  - Dark background (#1F2937), monospace font
  - Real-time log stream (scrollable, max 500 lines)
  - Filter: [All] [Info] [Warning] [Error]
  - Search bar, Copy, Clear, Auto-scroll toggle, Download buttons
  
- **File:** `src/components/canvas/ConfigPanel.tsx`

#### BOTTOM STATUS BAR
- **Left:** Deployment status (Idle/Starting/Running/Error with icon)
- **Center:** Resource usage (CPU, Memory, Disk progress bars)
- **Right:** Collaboration info ("You • 👤 Live editing"), Component count, Connection count
- **File:** `src/components/shared/StatusBar.tsx`

---

### SCREEN 5: Profile Settings
- **Layout:** Sidebar navigation (left) + Settings Content (right)
- **Path:** `/profile`
- **Sidebar Tabs:**
  1. **General:** Avatar, Full Name, Job Title, Email (read-only)
  2. **Security:** Change Password, MFA Toggle, Active Sessions list (Device, IP, Revoke button)
  3. **Preferences:** Theme override, Notification checkboxes
  4. **Developer:** API Keys management (Generate, List, Revoke)
- **File:** `src/components/profile/ProfileLayout.tsx`

### SCREEN 6: Team Management
- **Layout:** Header + Content Area
- **Path:** `/team`
- **Tabs/Sections:**
  1. **Overview:** Total members count, Pending invites count, Active Workspaces,Recent Activity
  2. **Members:** Data grid (Avatar, Name, Role, Status, Last Active, Actions)
  3. **Roles:** Read-only table of permissions per role
- **Actions:** Invite User button (Email + Role modal)
- **File:** `src/components/team/TeamLayout.tsx`

---

## 🔧 COMPONENT LIBRARY (Pre-built Components)

| Component | Type | Ports | Key Config |
|-----------|------|-------|-----------|
| **Kind Cluster** | Infrastructure | Output | Nodes count, K8s version, Config File Attachment |
| **PostgreSQL** | Database | Input/Output | Port, Database, User, Password, Shared Buffers, Work Mem, pg_hba.conf |
| **Redis** | Cache | Input/Output | Port, Max Memory, Eviction Policy, Append Only, Password |
| **MySQL** | Database | Input/Output | Port, Root Password, Max Connections, Buffer Pool Size |
| **ClickHouse** | Analytics | Input/Output | HTTP/TCP Ports, Max Concurrent Queries, Memory Usage |
| **Kafka** | Queue | Input/Output | Brokers, Zookeeper, Log Retention, Auto Create Topics |
| **RabbitMQ** | Queue | Input/Output | Default User/Pass, Disk Free Limit |
| **Alertmanager** | Monitoring | Input/Output | Port, Retention, Config File |
| **Prometheus** | Monitoring | Input/Output | Retention, Scrape Interval, Rules Files, Alerting (Alertmanager) |
| **Grafana** | Monitoring | Input/Output | Admin User/Pass, Allow Sign Up |

**Plugin System:** Developers can create custom components with JSON schema validation.

---

## 🔌 MODALS & DIALOGS

### Modal: Create New Workspace
- **Fields:** Name, Description, Environment type, Visibility
- **Buttons:** Cancel, Create
- **Width:** 500px
- **File:** `src/components/modals/CreateWorkspaceModal.tsx`

### Modal: Export Configuration
- **Tabs:** YAML, JSON
- **Options:** Include secrets toggle, Minified toggle
- **Preview:** Dark monospace pane (300px height)
- **Buttons:** Copy, Download, Generate share link
- **Width:** 600px
- **File:** `src/components/modals/ExportModal.tsx`
- **Logic:**
  - Uses `src/utils/exportConfig.ts` to generate YAML/JSON.
  - Generates config from current canvas state (Nodes & Connections).
  - Filters sensitive fields based on `src/utils/security.ts` (Schema-driven + Auto-detection).

### Modal: Deployment Progress
- **Content:** Progress bar (0-100%), Component status list, Live logs
- **Buttons:** Cancel
- **Width:** 600px
- **File:** `src/components/modals/DeploymentProgress.tsx`

### Modal: Deployment Success
- **Content:** Summary, Quick links to services, Resources allocated
- **Buttons:** Close, View Logs, Open Dashboard
- **Width:** 500px
- **File:** `src/components/modals/DeploymentSuccess.tsx`

---

## 🎮 KEYBOARD SHORTCUTS

| Shortcut | Action |
|----------|--------|
| `Del` | Delete selected node |
| `Ctrl+S` | Save workspace |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+D` | Duplicate selected node |
| `Ctrl+E` | Export config |
| `Ctrl+Shift+M` | Toggle sidebar |
| `F1` | Help / Documentation |

---

## 💾 STATE MANAGEMENT (Zustand)

### authStore
```typescript
State:
- user: User | null
- token: string | null
- loading: boolean
- error: string | null

Actions:
- login(email, password)
- logout()
- register(email, password)
- adminSetup(fullName, email, password)
- checkAuth()

Persist: localStorage (token, user)
```

### canvasStore
```typescript
State:
- nodes: CanvasNode[]
- connections: Connection[]
- selectedNodeId: string | null
- clipboard: CanvasNode | null
- history: CanvasNode[][] (undo/redo)

Actions:
- addNode(component, position)
- deleteNode(nodeId)
- updateNode(nodeId, config)
- addConnection(sourceId, targetId, sourcPort, targetPort)
- deleteConnection(connectionId)
- selectNode(nodeId)
- duplicate(nodeId)
- undo()
- redo()

Persist: sessionStorage (auto-save canvas state)
```

### workspaceStore
```typescript
State:
- workspaces: Workspace[]
- currentWorkspace: Workspace | null
- loading: boolean
- error: string | null

Actions:
- getWorkspaces()
- getWorkspace(id)
- createWorkspace(name, description)
- deleteWorkspace(id)
- updateWorkspace(id, data)
- setCurrentWorkspace(workspace)
```

### uiStore
```typescript
State:
- deploymentProgress: number
- deploymentStatus: 'idle' | 'starting' | 'running' | 'error'
- resourceUsage: { cpu, memory, disk }
- notifications: Toast[]
- modals: { [key]: boolean }

Actions:
- setDeploymentProgress(percent)
- setDeploymentStatus(status)
- setResourceUsage(cpu, memory, disk)
- addNotification(message, type)
- openModal(name)
- closeModal(name)
```

---

## 🔗 API CLIENT (axios)

**Base URL:** `http://localhost:8080/api`

### API Methods Required

```typescript
// Auth
POST /auth/login { email, password } → { token, user }
POST /auth/register { email, password } → { token, user }
POST /auth/admin-setup { fullName, email, password } → { token, user }
GET /auth/me → { user }
PUT /auth/me → { user }
PUT /auth/password → { success }
GET /auth/sessions → { sessions[] }
DELETE /auth/sessions/:id → { success }
GET /auth/api-keys → { keys[] }
POST /auth/api-keys → { key }
DELETE /auth/api-keys/:id → { success }

// Team
GET /team/members → { members[] }
POST /team/invite { email, role } → { invite }
PUT /team/members/:id { role } → { member }
DELETE /team/members/:id → { success }

// Workspaces
GET /workspaces → { workspaces[] }
POST /workspaces { name, description, environment, visibility } → { workspace }
GET /workspaces/:id → { workspace }
PUT /workspaces/:id { data } → { workspace }
DELETE /workspaces/:id → { success }

// Canvas
POST /workspaces/:id/nodes { component, position, config } → { node }
PUT /workspaces/:id/nodes/:nodeId { config } → { node }
DELETE /workspaces/:id/nodes/:nodeId → { success }

// Connections
POST /workspaces/:id/connections { sourceId, targetId } → { connection }
DELETE /workspaces/:id/connections/:connectionId → { success }

// Deployment
POST /workspaces/:id/deploy → { deploymentId }
GET /workspaces/:id/deployment-status → { status, progress, logs }
GET /workspaces/:id/deployment-logs { limit, offset } → { logs[] }

// WebSocket
WS /ws/workspaces/:id (real-time canvas sync)
```

---

## 📦 PACKAGE.JSON DEPENDENCIES

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.x",
    "zustand": "^4.x",
    "axios": "^1.x",
    "react-hot-toast": "^2.x",
    "tailwindcss": "^4.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^4.x",
    "@vitejs/plugin-react": "^4.x",
    "tailwindcss": "^4.x",
    "postcss": "^8.x"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  }
}
```

---

## 🐳 DOCKER SETUP

### Dockerfile
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

### docker-compose.yml
```yaml
version: '3.8'
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8080
    depends_on:
      - backend
```

---

## ✅ CRITICAL BUILD REQUIREMENTS

**DO NOT deviate from these:**

1. ✅ All components: **Functional with hooks** (no class components)
2. ✅ TypeScript: **Strict mode enabled**
3. ✅ State: **Zustand ONLY** (no Redux, no Context)
4. ✅ Styling: **Tailwind CSS ONLY** (no CSS modules, no styled-components)
5. ✅ Colors: **CSS variables ONLY** (no hardcoded hex colors)
6. ✅ Forms: **Client-side validation before API call**
7. ✅ Error handling: **Try-catch + error toast notifications**
8. ✅ Loading states: **Spinner + disabled state on buttons/inputs**
9. ✅ Accessibility: **Semantic HTML, ARIA, keyboard navigation**
10. ✅ Responsive: **Desktop-first, 1024px tablet breakpoint**
11. ✅ Drag-drop: **Fully functional** (not just UI)
12. ✅ Dark mode: **CSS media query + data-color-scheme attribute**
13. ✅ Code quality: **No TODOs, no placeholders, production-ready**
14. ✅ Imports: **ESM only**, proper relative paths

---

## 🚀 IMPLEMENTATION CHECKLIST

When building components:

- [ ] Component file created in correct folder
- [ ] TypeScript interfaces defined (Props, State)
- [ ] Component exported as default + named export
- [ ] All imports present (React, Zustand, axios, etc.)
- [ ] Proper error handling (try-catch, error messages)
- [ ] Loading states (spinners, disabled buttons)
- [ ] Form validation (client-side)
- [ ] API integration (axios calls with interceptors)
- [ ] Zustand store integration (useStore hooks)
- [ ] Tailwind classes used (NO inline styles)
- [ ] Accessibility checks (semantic HTML, ARIA, keyboard nav)
- [ ] Responsive design (mobile NOT required, but tablet breakpoint)
- [ ] Dark mode support (CSS variables)
- [ ] Component tested mentally (all user flows)

---

## 📝 CODE STYLE GUIDE

### Naming Conventions
- **Components:** PascalCase (`LoginPage.tsx`, `CanvasNode.tsx`)
- **Files:** PascalCase for components, camelCase for utils
- **Variables:** camelCase (`userData`, `handleSubmit`)
- **Constants:** UPPER_SNAKE_CASE (`API_URL`, `MAX_NODES`)
- **Types/Interfaces:** PascalCase (`User`, `Workspace`, `CanvasNode`)

### File Organization
```typescript
// 1. Imports (React, libraries, types, utils, styles)
import React from 'react';
import { useStore } from 'zustand-store';
import { Button } from './Button';
import type { Props } from '../types';

// 2. Types/Interfaces
interface MyComponentProps {
  title: string;
  onSubmit: () => void;
}

// 3. Component declaration
export default function MyComponent({ title, onSubmit }: MyComponentProps) {
  // Hooks
  const state = useStore();
  
  // Event handlers
  const handleClick = () => {};
  
  // Render
  return <div>{title}</div>;
}

// 4. Exports (named export for testing)
export { MyComponent };
```

### Comments
- Use comments only for **why**, not **what** (code is self-documenting)
- Use TSDoc for component props: `/** Component description */`
- No console.log in production code

---

## 🎯 AGENT INSTRUCTIONS (FOR LLM USE)

**When building this project:**

1. **Always reference this AGENTS.md file** for design system, structure, and requirements
2. **Follow the three-section layout** for canvas workspace (left sidebar + center + right)
3. **Use Zustand stores** - one store per domain (auth, canvas, workspace, ui)
4. **Validate forms client-side** before API calls
5. **Add loading states** to all async operations
6. **Use design tokens** - never hardcode colors
7. **Support dark mode** via CSS variables
8. **Make components type-safe** with full TypeScript interfaces
9. **Test keyboard navigation** (Tab, Enter, Esc, arrow keys)
10. **Handle errors gracefully** with user-friendly messages

---

## 📚 References

- **Design System:** See Color Palette, Typography, Spacing sections above
- **Component Specs:** See Screen Blueprints section for detailed layout
- **State Management:** See Zustand store definitions above
- **API Contract:** See API Client section with endpoint specs
- **Project Structure:** Use the directory tree as source of truth

---

**This AGENTS.md serves as the single source of truth for all frontend development.**  
**Update this file whenever design system or architecture changes.**

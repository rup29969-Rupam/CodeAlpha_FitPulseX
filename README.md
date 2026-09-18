# FITPULSE X — Personal Activity & Habit Intelligence Dashboard
> **"Turn daily activity into smarter habits."**

An advanced, production-grade personal activity and habit intelligence web application built for the **CodeAlpha App Development Internship (Task 3: Fitness Tracker App)**.

---

## 📋 Requirements Checklist & Verification Matrix

This project was developed under a strict two-tier engineering hierarchy:
1. **100% of the Original CodeAlpha Task 3 Requirements** were implemented and verified first.
2. **All Advanced FitPulse X Intelligence Features** were layered seamlessly on top without altering, simplifying, or breaking the core internship requirements.

### ORIGINAL CODEALPHA REQUIREMENTS (Task 3: Fitness Tracker App)
- [x] **Requirement 1 — Implemented**: **Activity Tracking & Goal Setting**
  - Tracks daily steps, active workout minutes, water hydration volume (ml), sleep hours, and calculated calorie expenditure against customizable daily targets.
- [x] **Requirement 2 — Implemented**: **Data Logging / Manual Input**
  - Intuitive Quick Add modals for steps (with quick-increment chips + custom entries), water hydration, exercises (activity categories, duration in minutes, timestamp, and optional notes), and sleep with client-side input validation.
- [x] **Requirement 3 — Implemented**: **Dashboard & Visual Progress Summary**
  - SaaS-grade real-time dashboard featuring 6 responsive metric cards, dynamic CSS/SVG progress bars and rings, today's snapshot, dynamic percentages, and instantaneous recalculations.
- [x] **Requirement 4 — Implemented**: **Data Persistence & History**
  - 100% persistent browser LocalStorage architecture preserving user profile, targets, daily logs, workouts, habit streaks, and unlocked achievements across page refreshes. Includes a comprehensive historical data archive table with date filtering.
- [x] **Requirement 5 — Implemented**: **Responsive, Clean & Intuitive UI/UX**
  - Fully responsive layout across mobile phones, tablets, and desktop workstations. Features desktop sidebar navigation, mobile sticky header and bottom bar, dark/light theme switcher, accessible focus states, and zero console errors or broken buttons.

---

### ADVANCED FEATURES
- [x] **Wellness Score (Wellness Insight Engine) — Implemented**
  - A deterministic, rule-based 0–100 wellness composite score weighted across Steps (30%), Activity (25%), Water (20%), and Sleep (25%) with transparent component scoring. (Explicitly labeled non-AI/ML).
- [x] **Smart Insight Engine — Implemented**
  - Deterministic heuristics analyzing daily thresholds, 3-day and 7-day velocity, upward/downward trends, and habit balance. (Explicitly labeled non-AI/ML).
- [x] **Habit Streak — Implemented**
  - Tracks current and longest consecutive day streaks based on meeting daily activity targets, paired with an interactive 7-day activity consistency heatmap.
- [x] **7-Day Progress — Implemented**
  - Dedicated analytics section with custom high-DPI vanilla Canvas charts for Steps, Water, Active Minutes, and Wellness Score, with hover tooltips and 7-day daily averages.
- [x] **Achievements — Implemented**
  - Gamified milestone badges (*First Step, Consistency, Week Warrior, Activity Master, Hydration Hero, Goal Crusher*) with locked vs. unlocked visual states and celebratory notifications.
- [x] **Goals — Implemented**
  - Dedicated Goals page for customizing target steps, active time, water volume, and sleep duration with real-time actual vs. target progress bars.
- [x] **Activity Timeline — Implemented**
  - Chronological timeline of today's workouts with activity category badges, duration, MET-based calories burned estimates, notes, and individual record deletion with instant recalculation.
- [x] **History — Implemented**
  - Longitudinal archive of all past days with date search, metric table, and day-inspection modal dialog.
- [x] **Analytics — Implemented**
  - Multi-metric 7-day summary tables, daily average calculations, and habit distribution analysis.
- [x] **Dark/Light Mode — Implemented**
  - CSS Custom Properties-driven theme toggle with instant UI updates and LocalStorage persistence.
- [x] **Import/Export — Implemented**
  - One-click JSON backup export, schema-validated JSON import, and safe confirmation-guarded data reset.
- [x] **LocalStorage — Implemented**
  - Clean client-side storage schema under key `fitpulsex_data_v1`.
- [x] **Responsive UI — Implemented**
  - Tested across mobile (<768px), tablet (768px-1024px), and desktop (>1024px) screens.
- [x] **Accessibility — Implemented**
  - Semantic HTML5, visible focus outlines, ARIA roles for dialogs and status announcements, touch targets >= 44px, and WCAG AA contrast.

---

## 🛠️ Technology Stack
- **HTML5**: Semantic tags (`<header>`, `<aside>`, `<nav>`, `<main>`, `<section>`, `<dialog>`, `role="status"`).
- **CSS3**: CSS Custom Properties (Design Tokens), Flexbox, CSS Grid, Glassmorphism backdrop-filters, subtle transitions.
- **Vanilla JavaScript (ES6+)**: Modular store architecture, deterministic rule engines, custom Canvas charting, event controllers.
- **Storage**: Browser `localStorage` (No server, no database, no external APIs required).
- **Zero External Dependencies**: Pure standalone code; runs locally in any modern browser without npm, node, or build tools.

---

## 🚀 How to Run the Application
1. Double-click `index.html` to open directly in any modern web browser (Chrome, Edge, Firefox, Safari).
   *Or* serve locally via Python:
   ```bash
   cd CodeAlpha_FitPulseX
   python -m http.server 8080
   ```
   Then open `http://localhost:8080/` in your browser.

2. **First-Time Experience**:
   - The onboarding modal will prompt for your name and daily goals.
   - Click **"Save Preferences & Start Dashboard"** to start fresh, or click **"Explore with 7-Day Demo Data"** to immediately preview a fully populated dashboard with charts and streaks.
   - You can toggle or clear demo data anytime with 1 click from the on-screen banner or Settings.

---

## 🏥 Health Safety Disclaimer
FitPulse X is a personal activity tracking prototype and is not a medical device or medical advice system. It does not provide medical diagnoses, treatment recommendations, or physiological prescriptions.

## EduKE

This app was created using https://getmocha.com.
Need help or want to join the community? Join our [Discord](https://discord.gg/shDEGBSe2d).

To run the devserver:
```
npm install
npm run dev
```

## Subscription Tier Plans

This is an excellent next step. Based on the features available in your application, we can create logical tiers that offer clear value and a compelling upgrade path.

Here is a proposed feature breakdown for the **Trial**, **Basic**, and **Pro** subscription tiers, designed for your specific application.

The primary customer is a School. The main levers we can use to differentiate the plans are:

1. **Usage Limits**: Number of students and staff.
2. **Module Access**: Which features (like Finance or Parent Portals) are enabled.

### Subscription Tier Features

Here is a side-by-side comparison. The features are based on the modules you have already built.

| Feature Module | Basic Plan | Pro Plan | Trial Plan |
| :--- | :---: | :---: | :---: |
| Usage Limits | | | |
| Student Accounts | Up to **100** | **Unlimited** | Up to **25** Students |
| Staff Accounts (Admin + Teacher) | Up to **10** | **Unlimited** | Up to **5** Staff |
| Trial Duration | N/A | N/A | **14 Days** |
| | | | |
| Core Management | | | |
| School Admin Dashboard | ✅ | ✅ | ✅ |
| Student Management | ✅ | ✅ | ✅ |
| Staff Management | ✅ | ✅ | ✅ |
| Timetable Management | ✅ | ✅ | ✅ |
| | | | |
| Academics | | | |
| Course Management | ✅ | ✅ | ✅ |
| Assignments & Submissions | ✅ | ✅ | ✅ |
| Examinations & Grading | ✅ | ✅ | ✅ |
| Teacher Dashboard | ✅ | ✅ | ✅ |
| | | | |
| Community & Portals | | | |
| Announcements | ✅ | ✅ | ✅ |
| Direct Messaging & Events | ❌ | ✅ | ✅ |
| Parent Portal | ❌ | ✅ | ✅ |
| Student Portal | ❌ | ✅ | ✅ |
| Student Progress Tracker | ❌ | ✅ | ✅ |
| | | | |
| Administration | | | |
| Staff Leave Management | ❌ | ✅ | ✅ |
| Finance Module | ❌ | ✅ | ✅ |
| Advanced Reports | ❌ | ✅ | ✅ |
| | | | |
| Support | | | |
| Standard Support | ✅ | ✅ | ✅ |
| Priority Support | ❌ | ✅ | ❌ |

### Rationale for Each Tier

#### Trial Plan

* Goal: To give a school a full-featured taste of the platform to prove its value.
* Strategy: This plan includes all Pro features but is heavily restricted by time (14 days) and usage (25 students / 5 staff).
* This is just enough for a school administrator to set up a demo class, have teachers add assignments, and see the parent portal in action. The limitations make it unusable for running a real school, forcing a decision to upgrade.

#### Basic Plan

* Goal: To provide a low-cost entry point for smaller schools or those who only need to digitize their core academic operations.
* Strategy: This plan provides the essential tools for running classes but locks the high-value administrative and community-engagement features.
* Core Features: Full student, staff, and academic management. Teachers can run their classes, create assignments, and manage schedules.
* Key Limitations (The Upsell):
  * No Finance Module: This is a major value-add. Managing fee structures, tracking payments, and generating financial reports is a significant task. This is a primary reason to upgrade to Pro.
  * No Parent/Student Portals: This is the other major upsell. Access to `ParentDashboard.tsx` and `Progress.tsx` is a key selling point for a school to offer to their customers (the parents).
  * Limited Users: The cap of 100 students and 10 staff makes this plan suitable only for small institutions.

#### Pro Plan

* Goal: The all-in-one solution for a school that wants to fully integrate its operations, finances, and parent communication.
* Strategy: This plan removes all major limitations.
* Core Features: Everything from Basic, plus:
  * Full Finance and Reports: Unlocks the `Fees.tsx` module and the `Reports.tsx` module, which are critical for administrators.
  * Full Community Portals: Unlocks `ParentDashboard.tsx`, `StudentDashboard.tsx`, and `Progress.tsx`, which drives engagement for the whole school.
  * Full Communications: Enables direct messaging and event management, not just announcements.
  * Advanced Admin: Adds features like Staff Leave Management.
  * Unlimited Usage: The school can grow without worrying about hitting user limits.

This structure gives schools a clear reason to choose each plan and a compelling path to upgrade as their needs become more complex.

## Additional Feature Roadmap

Based on the comprehensive system you've already built, you have a strong foundation. The existing modules (Academics, Staff, Students, Finance, Communication) are the perfect core.

Here are more features you can add to this system, categorized by module, to build it into a complete, enterprise-level School Management System.

### Finance and Operations

These are often the key drivers for a school to purchase a Pro plan.

- **Online Fee Payments**: The system currently tracks fees (`Fees.tsx`, `StudentProfile.tsx`) but doesn't process payments.
  - **Feature**: Integrate a payment gateway (like Stripe, M-Pesa, or PayPal). Add a "Pay Now" button to the parent and student fee pages. The backend would listen for webhooks to automatically update a payment as "Paid" in the `student_fees` table.
- **Staff Payroll Module**: The Payroll tab in `Staff.tsx` is currently a placeholder.
  - **Feature**: Build this out. Allow admins to set salary structures for staff, factor in deductions (e.g., from the `Leave.tsx` module), and generate monthly payslips that staff can view.
- **Library Management**
  - **Feature**: A new sidebar module ("Library") for cataloging all school library books. Admins or librarians could manage book inventory, and students or staff could check books out and in. The system could automatically track due dates and issue fines for overdue books (linking back to the Finance module).
- **Transport and Bus Route Management**
  - **Feature**: A new module for managing school transportation. Admins could define bus routes, assign students to routes, and manage bus fees. Parents could view the bus schedule and track their child's assigned route from the `ParentDashboard.tsx`.

### Enhanced Academics

These features deepen the value for your primary users: teachers and students.

- **Daily Attendance Module**: The system has an `attendance` table in the schema but no clear UI for taking it.
  - **Feature**: Create a new page for teachers in their `TeacherDashboard.tsx` to take attendance for their assigned class. This would populate the live attendance data for the `ParentDashboard.tsx` and `StudentProfile.tsx` pages.
- **Comprehensive Gradebook**: The `Academics.tsx` page has a Grading tab that is just a placeholder.
  - **Feature**: Build a full gradebook. Allow teachers to weigh assignments (e.g., Homework 20%, Quizzes 30%, Mid-term 50%) and automatically calculate final grades. This would feed real data into the `StudentPerformanceChart.tsx`.
- **Report Card Generation**
  - **Feature**: At the end of an academic term (managed in `Students.tsx`), allow admins to generate report cards. This feature would compile all data from the gradebook, attendance, and discipline modules into a single, printable PDF for each student.
- **Resource and Content Library**
  - **Feature**: Add a Resources tab to the `CourseDetail.tsx` page. This would allow teachers to upload files (e.g., syllabus, PDFs, video links) for students in that course to access.

### Super Admin and System Enhancements

These additions support managing the platform as a SaaS product.

- **Subscription Management Portal**
  - **Feature**: A new page for the super admin to manage all school subscriptions. It would show a list of all schools from `Schools.tsx` and list their current plan (Trial, Basic, Pro), plan expiry date, and payment status. This would link to the `SubscriptionStatusChart.tsx`.
- **School-Level Customization**
  - **Feature**: Enhance the `Settings.tsx` page for school admins. Allow them to upload their school logo, change the primary color theme, and manage the curriculum grade levels for their school, rather than having it hardcoded in the system's `config.js`.
- **Role and Permission Management**
  - **Feature**: A settings page for admins to define custom roles beyond the defaults. For example, they might want to create a Finance Officer role that can only access the `Fees.tsx` page or an Admissions role that can only access the `Students.tsx` enrollment dialog.

## AI Analytics for the Pro Plan

Integrating AI for data analysis elevates the platform from data storage to an intelligent insights system. Add an **AI Insights** tab to `Reports.tsx` that is visible only to Pro subscribers and surfaces the following capabilities.

### At-Risk Student Identification (Predictive Analytics)

- **What it does**: Creates a risk score for every active student so staff can intervene before failure or retention occurs.
- **Data Used**:
  - `performance`: Analyzes grade trends to detect declines.
  - `attendance`: Flags high rates of absences or tardies.
  - `discipline`: Considers the severity and frequency of incidents.
  - `students`: Learns historical patterns tied to retention or graduation outcomes.
- **Backend AI**: Expose `/api/reports/at-risk-students` that trains a logistic regression model on historical data and recalculates scores nightly for caching.
- **Visualization**: Student Risk Quadrant chart with performance on the X-axis and engagement on the Y-axis, highlighting "High Risk" students in the bottom-left and "Excelling" students in the top-right.

### Financial Forecasting (Time-Series AI)

- **What it does**: Predicts revenue and outstanding fees for the next three to six months so administrators can plan cash flow.
- **Data Used**:
  - `student_fees`: Tracks payment timing and amounts.
  - `students`: Incorporates enrollment growth or churn.
  - `academic_years`: Understands seasonal payment cycles.
- **Backend AI**: Provide `/api/reports/financial-forecast` that runs a time-series model such as ARIMA or Prophet against historical collections to project future cash flow.
- **Visualization**: Interactive Cash Flow Forecast chart combining the past 12 months of actual revenue with six months of projections and a confidence band.

### AI-Powered Natural Language Insights

- **What it does**: Summarizes the most urgent academic, financial, and behavioral signals in plain language.
- **Data Used**: Aggregated JSON payloads from performance, finance, attendance, and discipline report endpoints.
- **Backend AI**:
  1. Fetch metric data from existing report services.
  2. Send the combined JSON to an LLM (e.g., GPT-4, Claude, Gemini) with a prompt tailored to school administrators.
  3. Store the generated summary for quick retrieval in the UI.
- **Presentation**: Weekly AI Briefing card at the top of `Reports.tsx` detailing alerts like grade drops, late fee collections, or spikes in discipline incidents.

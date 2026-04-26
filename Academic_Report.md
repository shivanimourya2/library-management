# Academic Report: Library Management System – Resource & Fine Optimizer Tool

## 1. Abstract
The Library Management System – Resource & Fine Optimizer Tool is an advanced, hybrid web application designed to optimize library operations. Unlike traditional library systems that rely solely on standard CRUD (Create, Read, Update, Delete) operations via relational databases, this system incorporates a declarative logic engine (Prolog) alongside a robust relational database (MySQL/SQL). This hybrid architecture allows for dynamic rule processing, automated fine calculation, and intelligent book recommendations.

## 2. Introduction
Modern libraries manage vast amounts of resources and diverse user groups, each with distinct borrowing privileges, fine rates, and access rules. Handling these intersecting requirements manually or through rigid procedural code often leads to inefficiencies and errors. This project introduces a comprehensive dashboard for librarians and an interactive portal for students, backed by a sophisticated backend.

## 3. System Architecture
The application follows a 3-tier architecture:
1.  **Presentation Tier (Frontend)**: Built with HTML5, CSS3, and Vanilla JavaScript. It provides a premium, dark-themed UI with gold accents, utilizing modern glassmorphism and smooth transitions. It features distinct portals for Students, Librarians, and Administrators.
2.  **Application/Logic Tier (Backend)**: Developed using Node.js and Express. It serves as the middleware connecting the frontend with the dual data/logic stores. 
3.  **Data & Rule Tier (Storage & Logic)**:
    *   *MySQL Database*: Handles structured data storage (Users, Books, Transactions) efficiently.
    *   *SWI-Prolog Engine*: Evaluates complex business logic (borrowing eligibility, fine calculations, reservation priorities).

## 4. Implementation Details
### 4.1. Domain Discovery & Attributes
The system tracks 25+ crucial attributes across three primary entities:
*   **Book**: Book ID, ISBN, Title, Author, Genre, Publication Year, Edition, Shelf Location, Availability Status, Reserved Count.
*   **User**: User ID, Full Name, User Type (Student, Professor, Senior Citizen, Staff), Department, Semester, Membership Status, Borrow Limit, Current Borrowed, Fine Due, Academic Score.
*   **Transaction**: Loan Date, Due Date, Return Date, Grace Period, Fine Rate, Reservation Queue Position, Recommendation Preference.

### 4.2. Relational Database Design (MySQL)
The schema defines clear relationships:
*   `Books` (One-to-Many with Transactions)
*   `Members` (One-to-Many with Transactions and Fine_History)
*   Foreign keys enforce referential integrity.
*   Complex SQL queries are formulated for administrative analytics (e.g., finding the most popular book, calculating total revenue, tracking overdue trends).

### 4.3. Logic-Based Policy Engine (Prolog)
Prolog encapsulates the system's "brain" through defined predicates:
*   `can_borrow/2`: Evaluates multiple conditions (limits, unpaid fines, membership status) to determine eligibility.
*   `calculate_fine/3`: Dynamically adjusts fines based on the user's tier (e.g., 50% discount for Senior Citizens).
*   `recommend_book/2`: Suggests literature based on declared interests.

## 5. Results & Integration
The integration of Node.js with SQL and Prolog was achieved through child processes (or foreign language interfaces). When a student inputs their attributes, the Node.js backend queries the SQL database for state and invokes the Prolog engine to evaluate eligibility. The unified JSON response is then dynamically rendered on the frontend dashboard, providing instantaneous feedback on borrow eligibility, accumulated fines, and customized recommendations.

## 6. Conclusion
The hybrid approach of combining a relational database with a logic programming engine presents a highly effective solution for complex administrative environments. The separation of declarative rules from data storage significantly improves the system's flexibility. Future work could involve scaling the recommendation engine using machine learning algorithms and integrating live RFID tracking for inventory management.

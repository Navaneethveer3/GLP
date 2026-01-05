# LearnPlay - Gamified Learning Platform

A gamified STEM learning platform for students, featuring interactive quizzes with animations (Math Demon, Science Jar) and a comprehensive Teacher Dashboard.

## Features

### Student Dashboard
- **Subject-based Quizzes**: Math and Science modules.
- **Interactive Animations**:
    - **Math**: Defeat the demon by answering correctly.
    - **Science**: Fill the jar with knowledge (liquid).
- **Gamification**: Score tracking, confetti celebrations, and daily streaks.
- **Daily Limits**: One attempt per subject per day.

### Teacher Dashboard
- **Quiz Builder**: Dynamic interface to create daily quizzes (exact 5 questions).
- **Class Roster**: View active students.
- **Leaderboard**: Track top performers.
- **Analytics**: Real-time progress monitoring.

## Tech Stack
- **Frontend**: HTML5, CSS3 (Glassmorphism), Vanilla JavaScript.
- **Backend**: Firebase (Auth & Firestore).
- **Bundling**: Single-file bundled logic for easy deployment.

## How to Deploy

### GitHub Pages (Recommended)
1.  Initialize a git repository:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    ```
2.  Create a new repository on GitHub.
3.  Push your code:
    ```bash
    git remote add origin <your-repo-url>
    git push -u origin main
    ```
4.  Go to **Settings > Pages** in your GitHub repository.
5.  Select `main` branch as the source and save.
6.  Your site will be live at `https://<username>.github.io/<repo-name>/`.

### Netlify (Drag & Drop or Git)
**Option 1: Git (Recommended)**
1. Push your code to GitHub (as shown above).
2. Log in to [Netlify](https://app.netlify.com/).
3. Click **"Add new site"** > **"Import from an existing project"**.
4. Select GitHub and choose your repository.
5. Netlify will detect the settings automatically (thanks to `netlify.toml`).
6. Click **Deploy**.

**Option 2: Drag & Drop**
1. Log in to Netlify.
2. Drag the entire `Gamified Learning Platform` folder onto the Netlify dashboard.
3. It will deploy instantly.

### Firebase Hosting
1.  Install Firebase CLI: `npm install -g firebase-tools`
2.  Login: `firebase login`
3.  Init: `firebase init` (Select Hosting, set public directory to current directory `.`).
4.  Deploy: `firebase deploy`

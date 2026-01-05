/**
 * Gamified Learning Platform - All Logic (Bundled)
 */

// --- STATE MANAGEMENT ---
const State = {
    user: null,
    currentQuiz: null,
    quizProgress: {
        index: 0,
        score: 0
    },

    setUser(u) {
        this.user = u;
    },

    startQuiz(quizData) {
        this.currentQuiz = quizData;
        this.quizProgress = { index: 0, score: 0 };
    },

    getCurrentQuestion() {
        if (!this.currentQuiz) return null;
        return this.currentQuiz.questions[this.quizProgress.index];
    },

    incrementProgress(scoreDelta) {
        this.quizProgress.score += scoreDelta;
        this.quizProgress.index++;
    },

    isQuizComplete() {
        if (!this.currentQuiz) return true;
        return this.quizProgress.index >= this.currentQuiz.questions.length;
    }
};

// --- AUTH WRAPPER ---
class Auth {
    constructor() {
        // Safe init
        try {
            this.auth = window.firebase.auth();
            this.db = window.firebase.firestore();
        } catch (e) {
            console.error("Auth init failed", e);
        }
    }

    onStateChanged(cb) {
        if (!this.auth) return;
        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const doc = await this.db.collection('users').doc(user.uid).get();
                    let profile = {};
                    if (doc.exists) profile = doc.data();

                    cb({
                        uid: user.uid,
                        email: user.email,
                        name: profile.name || user.email.split('@')[0],
                        role: profile.role || 'student',
                        classId: profile.classId || 'classA'
                    });
                } catch (e) {
                    console.error("Auth profile fetch error", e);
                    cb(null);
                }
            } else {
                cb(null);
            }
        });
    }

    async login(email, password) {
        return this.auth.signInWithEmailAndPassword(email, password);
    }

    async logout() {
        return this.auth.signOut();
    }
}

// --- DB WRAPPER ---
class DB {
    constructor() {
        try {
            this.db = window.firebase.firestore();
        } catch (e) { console.error("DB init failed", e); }
    }

    async getDailyQuiz(subject) {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        try {
            const doc = await this.db.collection('questions').doc(subject).collection('daily').doc(today).get();
            if (doc.exists) return doc.data();
        } catch (e) {
            console.error("Fetch quiz error", e);
        }

        return {
            title: "Daily Challenge (Demo)",
            questions: [
                { q: "What is 12 x 12?", options: ["120", "144", "124"], answer: 1 },
                { q: "Water chemical formula?", options: ["HO2", "H2O", "O2H"], answer: 1 },
                { q: "Capital of France?", options: ["London", "Berlin", "Paris"], answer: 2 },
            ],
            subject // preserve subject for logic
        };
    }

    async saveDailyQuiz(quizData, user) {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        try {
            await this.db.collection('questions')
                .doc(quizData.subject)
                .collection('daily')
                .doc(today)
                .set({
                    ...quizData,
                    createdBy: user.uid,
                    createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
                });
            return true;
        } catch (e) {
            console.error("Save quiz error", e);
            throw e;
        }
    }

    async saveProgress(user, subject, score, maxScore) {
        try {
            await this.db.collection('progress').add({
                studentId: user.uid,
                classId: user.classId,
                subject,
                score,
                maxScore,
                timestamp: window.firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) { console.error(e); }
    }

    async hasAttemptedToday(user, subject) {
        if (!user) return false;
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        try {
            const snap = await this.db.collection('progress')
                .where('studentId', '==', user.uid)
                .where('subject', '==', subject)
                .where('timestamp', '>=', startOfDay)
                .get();
            return !snap.empty;
        } catch (e) {
            console.error("Check attempt error", e);
            return false;
        }
    }

    async getStudents(classId) {
        try {
            const snap = await this.db.collection('users')
                .where('classId', '==', classId)
                .where('role', '==', 'student')
                .get();
            return snap.docs.map(d => d.data());
        } catch (e) { return []; }
    }

    async getLeaderboard(classId) {
        try {
            const snap = await this.db.collection('progress').where('classId', '==', classId).get();
            const scores = {};
            snap.forEach(doc => {
                const d = doc.data();
                scores[d.studentId] = (scores[d.studentId] || 0) + (d.score || 0);
            });
            const result = [];
            for (const [uid, score] of Object.entries(scores)) {
                const uDoc = await this.db.collection('users').doc(uid).get();
                const name = uDoc.exists ? (uDoc.data().name || "Unknown") : "Unknown";
                result.push({ name, score });
            }
            return result.sort((a, b) => b.score - a.score).slice(0, 10);
        } catch (e) { return []; }
    }
}

// --- GAME LOGIC ---
class MathGame {
    constructor(uiController) {
        this.ui = uiController;
        this.health = 100;
    }
    start() {
        this.health = 100;
        this.ui.updateDemonHealth(100);
        this.ui.resetDemonAnimation();
    }
    onCorrectAnswer() {
        const damage = 20;
        this.health = Math.max(0, this.health - damage);
        this.ui.animateDemonHurt();
        this.ui.updateDemonHealth(this.health);
        if (this.health <= 0) {
            this.ui.animateDemonDeath();
            return true;
        }
        return false;
    }
    onWrongAnswer() { }
}

class ScienceGame {
    constructor(uiController) {
        this.ui = uiController;
        this.fillLevel = 0;
    }
    start() {
        this.fillLevel = 0;
        this.ui.updateJarFill(0);
    }
    onCorrectAnswer() {
        const fillAmount = 20;
        this.fillLevel = Math.min(100, this.fillLevel + fillAmount);
        this.ui.animateJarFill();
        this.ui.updateJarFill(this.fillLevel);
        if (this.fillLevel >= 100) return true;
        return false;
    }
    onWrongAnswer() { }
}

// --- UI CONTROLLER ---
class UI {
    constructor() {
        this.els = {
            app: document.getElementById('app'),
            landing: document.getElementById('landing'),
            studentView: document.getElementById('studentView'),
            teacherView: document.getElementById('teacherView'),
            quizView: document.getElementById('quizView'),
            userTag: document.getElementById('userTag'),
            demonWrapper: document.getElementById('demonWrapper'),
            demonHealthBar: document.getElementById('demonHealthBar'),
            jarWrapper: document.getElementById('jarWrapper'),
            liquid: document.getElementById('liquid'),
            qArea: document.getElementById('qArea'),
            quizScore: document.getElementById('quizScore'),
            quizProgress: document.getElementById('quizProgress')
        };
    }

    showToast(msg, type = 'info') {
        const t = document.createElement('div');
        t.innerText = msg;
        t.style.position = 'fixed';
        t.style.bottom = '20px';
        t.style.left = '50%';
        t.style.transform = 'translateX(-50%)';
        t.style.padding = '10px 20px';
        t.style.background = type === 'error' ? '#ef4444' : '#0f172a';
        t.style.color = '#fff';
        t.style.borderRadius = '8px';
        t.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        t.style.zIndex = '9999';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }

    showPanel(panelName) {
        ['landing', 'studentView', 'teacherView', 'quizView'].forEach(p => {
            const el = document.getElementById(p);
            if (el) el.classList.add('hidden');
        });
        const target = document.getElementById(panelName);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('fade-in');
        }
    }

    updateUserTag(user) {
        if (!user) {
            this.els.userTag.textContent = 'Not signed in';
            this.els.userTag.style.opacity = '0.5';
        } else {
            this.els.userTag.textContent = `${user.name} (${user.role})`;
            this.els.userTag.style.opacity = '1';
        }
    }

    setupQuizView(subject) {
        this.showPanel('quizView');
        this.els.demonWrapper.classList.add('hidden');
        this.els.jarWrapper.classList.add('hidden');
        if (subject === 'math') this.els.demonWrapper.classList.remove('hidden');
        else if (subject === 'science') this.els.jarWrapper.classList.remove('hidden');
    }

    renderQuestion(q, index, total, onAnswer) {
        this.els.quizProgress.innerText = `Question ${index + 1} / ${total}`;
        this.els.qArea.innerHTML = '';

        const qCard = document.createElement('div');
        qCard.className = 'card';
        qCard.style.maxWidth = '600px';
        qCard.style.width = '100%';
        qCard.style.margin = '0 auto';

        const qText = document.createElement('h3');
        qText.innerText = q.q;
        qCard.appendChild(qText);

        const optsDiv = document.createElement('div');
        optsDiv.style.display = 'grid';
        optsDiv.style.gap = '10px';
        optsDiv.style.marginTop = '20px';

        q.options.forEach((optText, i) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.style.width = '100%';
            btn.style.justifyContent = 'flex-start';
            btn.style.textAlign = 'left';
            btn.innerText = optText;
            btn.onclick = () => {
                Array.from(optsDiv.children).forEach(b => b.disabled = true);
                onAnswer(i, btn);
            };
            optsDiv.appendChild(btn);
        });
        qCard.appendChild(optsDiv);
        this.els.qArea.appendChild(qCard);
    }

    markAnswer(btn, isCorrect) {
        if (isCorrect) {
            btn.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
            btn.style.borderColor = '#22c55e';
            btn.style.color = '#22c55e';
        } else {
            btn.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            btn.style.borderColor = '#ef4444';
            btn.style.color = '#ef4444';
        }
    }

    updateScore(score) {
        this.els.quizScore.innerText = `Score: ${score}`;
    }

    showQuizComplete(score, onBack) {
        this.els.qArea.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'card';
        card.style.textAlign = 'center';
        card.innerHTML = `
            <h2 class="text-gradient">Quiz Complete!</h2>
            <p style="font-size:1.2rem; margin-bottom:20px">Final Score: ${score}</p>
        `;
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.innerText = 'Back to Dashboard';
        btn.onclick = onBack;
        card.appendChild(btn);

        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        this.els.qArea.appendChild(card);
    }

    showStreak(streak) {
        if (!this.els.studentView.querySelector('.streak-badge')) {
            const badge = document.createElement('div');
            badge.className = 'streak-badge';
            badge.style = "background: linear-gradient(135deg, #f59e0b, #d97706); padding: 0.5rem 1rem; border-radius: 20px; color: white; margin-bottom: 1rem; display: inline-block; font-weight: bold; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);";
            badge.innerText = `🔥 Day Streak: ${streak}`;
            this.els.studentView.querySelector('header').appendChild(badge);
        }
    }

    // Teacher Utils
    switchTeacherTab(tabName) {
        ['create', 'roster', 'leaderboard'].forEach(t => {
            const btn = document.getElementById(`tab-${t}`);
            if (t === tabName) {
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary');
            } else {
                btn.classList.add('btn-secondary');
                btn.classList.remove('btn-primary');
            }
        });
        ['view-create', 'view-roster', 'view-leaderboard'].forEach(v => {
            const el = document.getElementById(v);
            if (v === `view-${tabName}`) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });
    }

    addBuilderQuestion() {
        const container = document.getElementById('builderQuestions');
        const card = document.createElement('div');
        card.className = 'card';
        card.style.padding = '1.5rem';
        card.style.border = '1px solid var(--border-light)';
        card.style.background = 'rgba(0,0,0,0.2)';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:1rem">
                <h4 style="margin:0">Question</h4>
                <button class="btn btn-danger" style="padding:0.25rem 0.5rem; font-size:0.8rem" onclick="this.closest('.card').remove()">Remove</button>
            </div>
            <input class="build-q" placeholder="Enter question text..." style="margin-bottom:1rem" />
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.5rem; margin-bottom:1rem">
                <input class="build-opt" placeholder="Option A" />
                <input class="build-opt" placeholder="Option B" />
                <input class="build-opt" placeholder="Option C" />
            </div>
            <select class="build-ans" style="width:100%">
                <option value="0">Correct Answer: Option A</option>
                <option value="1">Correct Answer: Option B</option>
                <option value="2">Correct Answer: Option C</option>
            </select>
        `;
        container.appendChild(card);
    }

    getBuilderData() {
        const title = document.getElementById('newQuizTitle').value.trim();
        const subject = document.getElementById('newQuizSubject').value;
        const qCards = document.querySelectorAll('#builderQuestions .card');
        if (!title) return { error: "Please enter a quiz title" };
        if (!title) return { error: "Please enter a quiz title" };
        if (qCards.length !== 5) return { error: "Quiz must have exactly 5 questions." };

        const questions = [];
        let error = null;
        qCards.forEach(card => {
            const qText = card.querySelector('.build-q').value.trim();
            const opts = Array.from(card.querySelectorAll('.build-opt')).map(i => i.value.trim());
            const ans = parseInt(card.querySelector('.build-ans').value);
            if (!qText || opts.some(o => !o)) {
                error = "Please fill out all fields in every question";
                return;
            }
            questions.push({ q: qText, options: opts, answer: ans });
        });
        if (error) return { error };
        return { title, subject, questions };
    }

    clearBuilder() {
        document.getElementById('newQuizTitle').value = '';
        document.getElementById('builderQuestions').innerHTML = '';
        this.addBuilderQuestion();
    }

    renderRoster(students) {
        const container = document.getElementById('rosterList');
        if (!students || students.length === 0) {
            container.innerHTML = '<div class="text-muted">No students found.</div>';
            return;
        }
        container.innerHTML = students.map(s => `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding:1rem">
                <div>
                    <div style="font-weight:bold">${s.name || s.email}</div>
                    <div class="text-muted" style="font-size:0.85rem">${s.email}</div>
                </div>
                <div style="background:rgba(34, 197, 94, 0.1); color:#22c55e; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.8rem">Active</div>
            </div>
        `).join('');
    }

    renderLeaderboard(entries) {
        const container = document.getElementById('leaderboardList');
        if (!entries || entries.length === 0) {
            container.innerHTML = '<div class="text-muted">No analytics available yet.</div>';
            return;
        }
        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse; text-align:left">
                <thead>
                    <tr style="border-bottom:1px solid var(--border-light); color:var(--text-muted)">
                        <th style="padding:0.5rem">Rank</th>
                        <th style="padding:0.5rem">Student</th>
                        <th style="padding:0.5rem">Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map((e, i) => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
                            <td style="padding:0.75rem 0.5rem">${i + 1}</td>
                            <td style="padding:0.75rem 0.5rem; font-weight:600">${e.name}</td>
                            <td style="padding:0.75rem 0.5rem; color:var(--text-highlight)">${e.score}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Animations
    updateDemonHealth(hp) { this.els.demonHealthBar.style.width = `${hp}%`; }
    animateDemonHurt() {
        this.els.demonWrapper.classList.add('demon-hurt');
        setTimeout(() => this.els.demonWrapper.classList.remove('demon-hurt'), 400);
    }
    animateDemonDeath() { this.els.demonWrapper.classList.add('demon-dead'); }
    resetDemonAnimation() { this.els.demonWrapper.classList.remove('demon-dead'); }
    updateJarFill(percent) {
        const totalHeight = 260;
        const newY = totalHeight - (totalHeight * percent / 100);
        this.els.liquid.setAttribute('y', newY);
        this.els.liquid.setAttribute('height', totalHeight - newY);
    }
    animateJarFill() {
        this.els.jarWrapper.classList.add('filling');
        setTimeout(() => this.els.jarWrapper.classList.remove('filling'), 500);
    }
}

// --- BOOTSTRAP ---
const firebaseConfig = {
    apiKey: "AIzaSyCjCJAXzCzDYGpZaS544Y9VnBowWqIQyo4",
    authDomain: "gl-platform-3b824.firebaseapp.com",
    projectId: "gl-platform-3b824",
    storageBucket: "gl-platform-3b824.firebasestorage.app",
    messagingSenderId: "548293664159",
    appId: "1:548293664159:web:73946cd5cf2e910046f1aa",
    measurementId: "G-WQE9661CD8"
};

// Start
try {
    if (window.firebase) {
        firebase.initializeApp(firebaseConfig);
        firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(() => { });
        console.log("Firebase Init Success");
    } else {
        console.error("Firebase library not loaded");
    }
} catch (e) { console.warn("Firebase Init:", e); }

const ui = new UI();
const auth = new Auth();
const db = new DB();
const mathGame = new MathGame(ui);
const scienceGame = new ScienceGame(ui);
let currentGame = null;

// Auth Observer
auth.onStateChanged((user) => {
    State.setUser(user);
    ui.updateUserTag(user);
    if (user) {
        if (user.role === 'teacher') {
            ui.showPanel('teacherView');
            loadTeacherDashboard();
        } else {
            ui.showPanel('studentView');
            // Show streak
            db.getStreak(user.uid).then(s => ui.showStreak(s));
        }
    } else {
        ui.showPanel('landing');
    }
});

// Window Global Exports for HTML onclick
window.loginAs = async (role) => {
    const emailId = role === 'student' ? 'studentEmail' : 'teacherEmail';
    const passId = role === 'student' ? 'studentPass' : 'teacherPass';
    const email = document.getElementById(emailId).value.trim();
    const pass = document.getElementById(passId).value;
    if (!email || !pass) {
        ui.showToast('Please enter credentials', 'error');
        return;
    }
    try {
        await auth.login(email, pass);
    } catch (e) {
        ui.showToast(e.message, 'error');
    }
};

window.signOut = () => auth.logout();

window.playSubject = async (subject) => {
    ui.setupQuizView(subject);

    // Check attempt
    if (State.user) {
        const attempted = await db.hasAttemptedToday(State.user, subject);
        if (attempted) {
            ui.showToast("You have already attempted today's quiz!", 'error');
            setTimeout(() => ui.showPanel('studentView'), 2000);
            return;
        }
    }

    currentGame = subject === 'math' ? mathGame : scienceGame;
    currentGame.start();
    const quizData = await db.getDailyQuiz(subject);
    State.startQuiz(quizData);
    nextQuestion();
};

function nextQuestion() {
    if (State.isQuizComplete()) {
        const finalScore = State.quizProgress.score;
        ui.showQuizComplete(finalScore, () => ui.showPanel('studentView'));
        if (State.user) db.saveProgress(State.user, State.currentQuiz.subject || 'unknown', finalScore, 50);
        return;
    }
    const q = State.getCurrentQuestion();
    ui.renderQuestion(q, State.quizProgress.index, State.currentQuiz.questions.length, (chosenIdx, btnEl) => {
        handleAnswer(chosenIdx, q.answer, btnEl);
    });
}

function handleAnswer(chosenIdx, correctIdx, btnEl) {
    const isCorrect = chosenIdx === correctIdx;
    ui.markAnswer(btnEl, isCorrect);
    if (isCorrect) {
        State.incrementProgress(10);
        currentGame.onCorrectAnswer();
    } else {
        State.incrementProgress(0);
        currentGame.onWrongAnswer();
    }
    ui.updateScore(State.quizProgress.score);
    setTimeout(nextQuestion, 1500);
}

// Teacher Globals
window.switchTeacherTab = async (tab) => {
    ui.switchTeacherTab(tab);
    if (tab === 'roster') {
        const students = await db.getStudents(State.user.classId);
        ui.renderRoster(students);
    } else if (tab === 'leaderboard') {
        const lb = await db.getLeaderboard(State.user.classId);
        ui.renderLeaderboard(lb);
    }
};

window.addBuilderQuestion = () => ui.addBuilderQuestion();

window.saveBuilderQuiz = async () => {
    const data = ui.getBuilderData();
    if (data.error) {
        ui.showToast(data.error, 'error');
        return;
    }
    try {
        await db.saveDailyQuiz(data, State.user);
        ui.showToast(`Quiz published for today (${data.subject})`);
        ui.clearBuilder();
    } catch (e) {
        ui.showToast("Failed to save quiz", 'error');
    }
};

async function loadTeacherDashboard() {
    const nameEl = document.getElementById('teacherNameDisplay');
    if (nameEl && State.user) nameEl.textContent = `Welcome, ${State.user.name}`;
    ui.clearBuilder();
}

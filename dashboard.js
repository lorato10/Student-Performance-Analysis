const db = firebase.database();
const auth = firebase.auth();

// --- 1. AUTHENTICATION LOGIC ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;

        auth.signInWithEmailAndPassword(email, pass)
            .catch(err => {
                const errBox = document.getElementById('loginError');
                if (errBox) errBox.style.display = 'block';
            });
    });
}

auth.onAuthStateChanged(user => {
    const authScreen = document.getElementById('authScreen');
    const adminPanel = document.getElementById('adminPanel');

    if (user) {
        if (authScreen) authScreen.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'flex';
    } else {
        if (authScreen) authScreen.style.display = 'flex';
        if (adminPanel) adminPanel.style.display = 'none';
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => auth.signOut());

// --- 2. CORE DATA ENGINE (Real-time Sync) ---
let charts = {}; // Store chart instances to prevent glitches

db.ref('students').on('value', (snapshot) => {
    const data = snapshot.val();
    const studentArray = [];

    for (let key in data) {
        studentArray.push({ ...data[key], firebaseKey: key });
    }

    // Run all updates simultaneously
    updateAdminTable(studentArray);
    renderPublicDashboard(studentArray);
    updateAnalytics(studentArray);
});

// --- 3. ADMIN ACTIONS ---
const entryForm = document.getElementById('adminEntryForm');
if (entryForm) {
    entryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const studentData = {
            id: document.getElementById('stuId').value,
            name: document.getElementById('stuName').value,
            type: document.getElementById('stuType').value,
            dept: document.getElementById('stuDept').value, // Matches 'Domain'
            attendance: document.getElementById('stuAtt').value,
            marks: document.getElementById('stuMarks').value
        };

        db.ref('students').push(studentData).then(() => {
            entryForm.reset();
            alert("Data pushed to Firebase successfully!");
        });
    });
}

window.deleteStudent = (key) => {
    if (confirm("Permanently delete this record?")) {
        db.ref('students').child(key).remove();
    }
};

function updateAdminTable(students) {
    const adminTable = document.getElementById('adminTableBody');
    if (!adminTable) return;

    adminTable.innerHTML = students.map(s => `
        <tr>
            <td>
                <strong>${s.name}</strong><br>
                <small style="color:var(--secondary)">${s.dept} | ${s.type}</small>
            </td>
            <td style="text-align: right;">
                <button onclick="deleteStudent('${s.firebaseKey}')" 
                        style="color:#ef4444; background:none; border:none; cursor:pointer; font-weight:600;">
                    Delete
                </button>
            </td>
        </tr>
    `).join('');
}

// --- 4. PUBLIC DASHBOARD RENDERING ---
function renderPublicDashboard(students) {
    const tableBody = document.getElementById('publicTableBody');
    const leaderboard = document.getElementById('leaderboard');
    if (!tableBody) return;

    let totalAttendance = 0;
    let uniqueDepts = new Set();
    let tableRows = "";

    students.forEach(s => {
        totalAttendance += parseInt(s.attendance || 0);
        uniqueDepts.add(s.dept);

        // Define status based on performance
        let status = "Pass", sClass = "status-pass";
        if (parseInt(s.marks) < 50) {
            status = "Failed"; sClass = "status-failed";
        } else if (parseInt(s.attendance) < 75) {
            status = "Inactive"; sClass = "status-inactive";
        }

        tableRows += `
            <tr>
                <td>${s.id}</td>
                <td><strong>${s.name}</strong></td>
                <td><span class="type-badge">${s.type}</span></td>
                <td>${s.dept}</td>
                <td>${s.attendance}%</td>
                <td>${s.marks}</td>
                <td><span class="status-pill ${sClass}">${status}</span></td>
            </tr>`;
    });

    tableBody.innerHTML = tableRows;

    // Update KPI Cards
    const totalCountEl = document.getElementById('totalCount');
    const avgAttEl = document.getElementById('avgAtt');
    const deptCountEl = document.getElementById('deptCount');

    if (totalCountEl) totalCountEl.innerText = students.length;
    if (avgAttEl) avgAttEl.innerText = students.length > 0
        ? Math.round(totalAttendance / students.length) + "%"
        : "0%";
    if (deptCountEl) deptCountEl.innerText = uniqueDepts.size;

    // Update Elite Performers (Top 5)
    if (leaderboard) {
        const topPerformers = [...students].sort((a, b) => {
            const scoreA = (parseInt(a.attendance) + parseInt(a.marks)) / 2;
            const scoreB = (parseInt(b.attendance) + parseInt(b.marks)) / 2;
            return scoreB - scoreA;
        }).slice(0, 5);

        leaderboard.innerHTML = topPerformers.map((s, i) => `
            <div class="rank-item">
                <div class="rank-number">${i + 1}</div>
                <div class="rank-info">
                    <strong>${s.name}</strong>
                    <span>${s.type} • ${s.dept}</span>
                </div>
                <div class="rank-score">${Math.round((parseInt(s.attendance) + parseInt(s.marks)) / 2)}</div>
            </div>
        `).join('');
    }
}

// --- 5. ANALYTICS ENGINE ---
function updateAnalytics(students) {
    const config = [
        { id: 'statusDistributionChart', type: 'doughnut', getData: getStatusData },
        { id: 'domainPerformanceChart', type: 'bar', getData: getDomainData }
    ];

    config.forEach(chartConf => {
        const ctx = document.getElementById(chartConf.id)?.getContext('2d');
        if (!ctx) return;

        // Destroy existing chart to allow data refresh without glitches
        if (charts[chartConf.id]) charts[chartConf.id].destroy();

        charts[chartConf.id] = new Chart(ctx, {
            type: chartConf.type,
            data: chartConf.getData(students),
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#64748b' } // Adjust label color for UI consistency
                    }
                }
            }
        });
    });
}

function getStatusData(students) {
    const pass = students.filter(s => parseInt(s.marks) >= 50).length;
    const fail = students.length - pass;
    return {
        labels: ['Pass', 'Fail'],
        datasets: [{
            data: [pass, fail],
            backgroundColor: ['#22c55e', '#ef4444'],
            borderWidth: 0
        }]
    };
}

function getDomainData(students) {
    const domains = {};
    students.forEach(s => {
        if (!domains[s.dept]) domains[s.dept] = { total: 0, count: 0 };
        domains[s.dept].total += parseInt(s.marks);
        domains[s.dept].count++;
    });

    return {
        labels: Object.keys(domains),
        datasets: [{
            label: 'Avg Score',
            data: Object.values(domains).map(d => Math.round(d.total / d.count)),
            backgroundColor: '#2563eb',
            borderRadius: 4
        }]
    };
}
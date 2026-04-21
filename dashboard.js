const db = firebase.database();
const auth = firebase.auth();
let charts = {};

// Global Chart.js configuration for Premium Dark Mode
if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#94a3b8'; 
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
    Chart.defaults.plugins.tooltip.bodyColor = '#cbd5e1';
    Chart.defaults.plugins.tooltip.borderColor = '#334155';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = false;
}

// Helper safely set value or property
const safeSetVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
};
const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
};

// --- 1. AUTHENTICATION & UI ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        auth.signInWithEmailAndPassword(email, pass).catch(err => {
            const errBox = document.getElementById('loginError');
            if (errBox) errBox.style.display = 'block';
        });
    });
}

let isAdminMode = false;
let attendanceDates = [];
let currentAttendanceTab = 'Student';

auth.onAuthStateChanged(user => {
    const authScreen = document.getElementById('authScreen');
    const adminPanel = document.getElementById('adminPanel');
    const adminWarning = document.getElementById('adminWarning');
    const adminLockedInfo = document.getElementById('adminLockedInfo');

    if (user) {
        isAdminMode = true;
        if (authScreen) authScreen.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'flex';
        if (adminWarning) adminWarning.style.display = 'block';
        if (adminLockedInfo) adminLockedInfo.style.display = 'none';
    } else {
        isAdminMode = false;
        if (authScreen) authScreen.style.display = 'flex';
        if (adminPanel) adminPanel.style.display = 'none';
        if (adminWarning) adminWarning.style.display = 'none';
        if (adminLockedInfo) adminLockedInfo.style.display = 'block';
    }
    
    if (typeof renderAttendanceMatrix === 'function') {
        renderAttendanceMatrix();
    }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => auth.signOut());

// Mobile Menu Toggle Logic
document.getElementById('menuToggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
});

// --- 2. THE REAL-TIME SYNC (Admin -> Public) ---
db.ref('students').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    const studentArray = [];
    for (let key in data) {
        let studentData = { ...data[key], firebaseKey: key };
        
        // Dynamic Attendance Calculation
        let log = studentData.attendanceLog || {};
        let totalRecorded = Object.keys(log).length;
        
        if (totalRecorded > 0) {
            let presentCount = Object.values(log).filter(v => v === 'Present').length;
            studentData.presentDays = presentCount;
            // Use manually set totalDays if available, otherwise use recorded days
            const denom = parseInt(studentData.totalDays || totalRecorded);
            if (denom > 0) {
                studentData.attendance = Math.round((presentCount / denom) * 100);
            }
        } else if (!studentData.attendance) {
            studentData.attendance = 0;
        }
        
        // Automatic Financial Calculation based on rules
        if (studentData.type === 'Student') {
            studentData.funds = 35000; // 30,000 base fee + (2,500 * 2 exams)
        } else if (studentData.type === 'Intern') {
            studentData.funds = 15000;
        }
        
        studentArray.push(studentData);
    }

    allStudents = studentArray; // Global scope
    
    // Route to appropriate rendering function based on current page
    const path = window.location.pathname;
    if (path.includes('index.html') || path.endsWith('/')) {
        renderHomeDashboard(studentArray);
    } else if (path.includes('interns.html')) {
        renderInternDashboard(studentArray);
    } else if (path.includes('students.html')) {
        renderStudentDashboard(studentArray);
    }

    if (typeof updateAdminTable === 'function') updateAdminTable(studentArray);
    if (typeof renderAttendanceMatrix === 'function') renderAttendanceMatrix();
});

// --- 3. DATA ENTRY & MANAGEMENT ---
let editingKey = null;
const entryForm = document.getElementById('adminEntryForm');
const submitBtn = entryForm?.querySelector('button[type="submit"]');

const courseOptions = {
    Student: [
        "Pre nursery", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th",
        "+1 Medical", "+1 Non Medical", "+1 Art", "+1 Commerce",
        "+2 Medical", "+2 Non Medical", "+2 Art", "+2 Commerce",
        "B. Com", "IELTS", "PTE",
        "Computer Basic Course", "Computer Web Designing", "Computer Coding"
    ],
    Intern: [
        "Web Development", "Digital Marketing", "Graphic Designing", "Data Analysis", "Cyber Security"
    ]
};

const stuTypeSelect = document.getElementById('stuType');
const stuDeptSelect = document.getElementById('stuDept');



window.populateCourses = () => {
    if (!stuTypeSelect || !stuDeptSelect) return;
    const type = stuTypeSelect.value;
    const options = courseOptions[type] || [];
    stuDeptSelect.innerHTML = options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    
    const studentFields = document.getElementById('studentPerformanceFields');
    const internFields = document.getElementById('internPerformanceFields');
    const halfYearlyInput = document.getElementById('stuHalfYearly');
    const annualInput = document.getElementById('stuAnnual');
    const projectsInput = document.getElementById('stuProjects');
    
    if (type === 'Student') {
        if (studentFields) studentFields.style.display = 'block';
        if (internFields) internFields.style.display = 'none';
        if (halfYearlyInput) halfYearlyInput.required = true;
        if (annualInput) annualInput.required = true;
        if (projectsInput) projectsInput.required = false;
    } else if (type === 'Intern') {
        if (studentFields) studentFields.style.display = 'none';
        if (internFields) internFields.style.display = 'block';
        if (halfYearlyInput) halfYearlyInput.required = false;
        if (annualInput) annualInput.required = false;
        if (projectsInput) projectsInput.required = true;
    }
};

if (stuTypeSelect) {
    stuTypeSelect.addEventListener('change', window.populateCourses);
    window.populateCourses();
}

if (entryForm) {
    entryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('stuType').value;
        const duration = document.getElementById('stuDuration').value;
        
        let calculatedFunds = 0;
        if (type === 'Student') {
            calculatedFunds = 35000; // 30000 + 2500*2
        } else if (type === 'Intern') {
            calculatedFunds = 15000;
        }

        const studentData = {
            id: document.getElementById('stuId').value,
            name: document.getElementById('stuName').value,
            type: type,
            dept: document.getElementById('stuDept').value,
            duration: duration,
            marks: document.getElementById('stuMarks').value,
            funds: calculatedFunds, // Automatically calculated
            halfYearly: document.getElementById('stuHalfYearly')?.value || 0,
            annual: document.getElementById('stuAnnual')?.value || 0,
            projectsDone: document.getElementById('stuProjects')?.value || 0
        };

        if (editingKey) {
            db.ref('students').child(editingKey).update(studentData).then(() => {
                entryForm.reset();
                editingKey = null;
                if (submitBtn) submitBtn.innerText = "Push to Dashboard";
                alert("Record updated successfully!");
                window.populateCourses();
            });
        } else {
            db.ref('students').push(studentData).then(() => {
                entryForm.reset();
                alert("Record added successfully!");
                window.populateCourses();
            });
        }
    });
}

window.editStudent = (key) => {
    const student = allStudents.find(s => s.firebaseKey === key);
    if (!student) return;

    editingKey = key;
    safeSetVal('stuId', student.id);
    safeSetVal('stuName', student.name);
    safeSetVal('stuType', student.type);
    
    if (window.populateCourses) window.populateCourses();

    safeSetVal('stuDept', student.dept);
    safeSetVal('stuDuration', student.duration || '');
    safeSetVal('stuMarks', student.marks);
    safeSetVal('stuFunds', student.funds || '');
    
    safeSetVal('stuHalfYearly', student.halfYearly || '');
    safeSetVal('stuAnnual', student.annual || '');
    safeSetVal('stuProjects', student.projectsDone || '');

    if (submitBtn) submitBtn.innerText = "Update Record";
    document.querySelector('.admin-grid')?.scrollIntoView({ behavior: 'smooth' });
};

window.deleteStudent = (key) => {
    if (confirm("Permanently delete this record?")) {
        db.ref('students').child(key).remove();
    }
};

// --- 4. DASHBOARD RENDERING LOGIC ---
let allStudents = [];

function getFilteredData(students) {
    const searchTerm = document.getElementById('studentSearch')?.value.toLowerCase() || "";
    return students.filter(s => 
        (s.name || "").toLowerCase().includes(searchTerm) ||
        (s.id || "").toLowerCase().includes(searchTerm) ||
        (s.dept || "").toLowerCase().includes(searchTerm)
    );
}

function renderHomeDashboard(students) {
    const filtered = getFilteredData(students);
    
    const totalFees = students.reduce((acc, s) => acc + (s.type === 'Student' ? parseFloat(s.funds || 0) : 0), 0);
    const totalSalary = students.reduce((acc, s) => acc + (s.type === 'Intern' ? parseFloat(s.funds || 0) : 0), 0);
    const avgAtt = students.length ? Math.round(students.reduce((acc, s) => acc + parseInt(s.attendance || 0), 0) / students.length) : 0;
    const depts = new Set(students.map(s => s.dept));

    safeSetText('totalCount', students.length);
    safeSetText('deptCount', depts.size);
    safeSetText('avgAtt', avgAtt + "%");
    safeSetText('netBalance', '₹' + Math.max(0, totalFees - totalSalary).toLocaleString('en-IN'));

    // ── Top 3 Students (ranked by exam marks) ──
    const topStudentsTable = document.getElementById('topStudentsTable');
    if (topStudentsTable) {
        const rankIcons = ['🥇', '🥈', '🥉'];
        const top3Students = [...students]
            .filter(s => s.type === 'Student')
            .sort((a, b) => parseInt(b.marks || 0) - parseInt(a.marks || 0))
            .slice(0, 3);

        if (top3Students.length === 0) {
            topStudentsTable.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--secondary);padding:1.5rem;">No student data available.</td></tr>`;
        } else {
            topStudentsTable.innerHTML = top3Students.map((s, i) => {
                const score = parseInt(s.marks || 0);
                const att = parseInt(s.attendance || 0);
                const statusClass = score >= 75 ? 'status-pass' : score >= 50 ? 'status-active' : 'status-fail';
                const statusLabel = score >= 75 ? 'Excellent' : score >= 50 ? 'Promoted' : 'Needs Work';
                return `
                <tr>
                    <td style="font-size:1.2rem;text-align:center;">${rankIcons[i] || (i + 1)}</td>
                    <td><strong style="color:#f8fafc;">${s.name}</strong><br><small style="color:var(--secondary);">${s.id}</small></td>
                    <td style="color:var(--secondary);font-size:0.85rem;">${s.dept}</td>
                    <td><strong style="color:#a855f7;">${score}%</strong></td>
                    <td><strong style="color:${att >= 75 ? '#22c55e' : att >= 50 ? '#fbbf24' : '#ef4444'};">${att}%</strong></td>
                    <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                </tr>`;
            }).join('');
        }
    }

    // ── Top 3 Interns (ranked by projects done, then marks) ──
    const topInternsTable = document.getElementById('topInternsTable');
    if (topInternsTable) {
        const rankIcons = ['🥇', '🥈', '🥉'];
        const top3Interns = [...students]
            .filter(s => s.type === 'Intern')
            .sort((a, b) => {
                const pd = parseInt(b.projectsDone || 0) - parseInt(a.projectsDone || 0);
                if (pd !== 0) return pd;
                return parseInt(b.marks || 0) - parseInt(a.marks || 0);
            })
            .slice(0, 3);

        if (top3Interns.length === 0) {
            topInternsTable.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--secondary);padding:1.5rem;">No intern data available.</td></tr>`;
        } else {
            topInternsTable.innerHTML = top3Interns.map((s, i) => {
                const projects = parseInt(s.projectsDone || 0);
                const att = parseInt(s.attendance || 0);
                const statusClass = att >= 75 ? 'status-pass' : att >= 50 ? 'status-active' : 'status-fail';
                const statusLabel = att >= 75 ? 'Active' : att >= 50 ? 'Warning' : 'Inactive';
                return `
                <tr>
                    <td style="font-size:1.2rem;text-align:center;">${rankIcons[i] || (i + 1)}</td>
                    <td><strong style="color:#f8fafc;">${s.name}</strong><br><small style="color:var(--secondary);">${s.id}</small></td>
                    <td style="color:var(--secondary);font-size:0.85rem;">${s.dept}</td>
                    <td><strong style="color:#0ea5e9;">${projects}</strong></td>
                    <td><strong style="color:${att >= 75 ? '#22c55e' : att >= 50 ? '#fbbf24' : '#ef4444'};">${att}%</strong></td>
                    <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                </tr>`;
            }).join('');
        }
    }
    renderHomeCharts(students);
}

function renderInternDashboard(students) {
    const interns = students.filter(s => s.type === 'Intern');
    const filtered = getFilteredData(interns);

    const totalProjects = interns.reduce((acc, s) => acc + parseInt(s.projectsDone || 0), 0);
    const totalFees = interns.reduce((acc, s) => acc + parseFloat(s.funds || 0), 0);
    const avgAtt = interns.length ? Math.round(interns.reduce((acc, s) => acc + parseInt(s.attendance || 0), 0) / interns.length) : 0;

    safeSetText('internCount', interns.length);
    safeSetText('totalProjects', totalProjects);
    safeSetText('internFees', '₹' + totalFees.toLocaleString('en-IN'));
    safeSetText('internAvgAtt', avgAtt + "%");

    const table = document.getElementById('internTableBody');
    if (table) {
        table.innerHTML = filtered.map(s => `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>${s.id}</td>
                <td>${s.dept}</td>
                <td>${s.projectsDone || 0}</td>
                <td>${s.attendance}%</td>
                <td>₹${parseFloat(s.funds || 0).toLocaleString('en-IN')}</td>
                <td>${s.duration || '-'}</td>
                <td><span class="status-pill ${parseInt(s.attendance) >= 75 ? 'status-pass' : 'status-fail'}">${parseInt(s.attendance) >= 75 ? 'Active' : 'Warning'}</span></td>
            </tr>
        `).join('');
    }
    renderInternCharts(filtered);
}

function renderInternCharts(interns) {
    if (typeof Chart === 'undefined') return;

    // 1. Intern Attendance Trend (Last 7 Days)
    const attCtx = document.getElementById('internAttendanceChart')?.getContext('2d');
    if (attCtx) {
        if (charts['internAtt']) charts['internAtt'].destroy();
        const labels = [];
        const data = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
            const presentCount = interns.filter(s => s.attendanceLog?.[dateKey] === 'Present').length;
            data.push(interns.length ? Math.round((presentCount / interns.length) * 100) : 0);
        }
        charts['internAtt'] = new Chart(attCtx, {
            type: 'line',
            data: { 
                labels, 
                datasets: [{ 
                    label: 'Avg Attendance %', 
                    data, 
                    borderColor: '#0ea5e9', 
                    backgroundColor: 'rgba(14, 165, 233, 0.1)', 
                    fill: true, 
                    tension: 0.4 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } }, 
                    x: { grid: { display: false } } 
                } 
            }
        });
    }

    // 2. Domain Monetary Analysis (Doughnut)
    const monCtx = document.getElementById('internMonetaryChart')?.getContext('2d');
    if (monCtx) {
        if (charts['internMon']) charts['internMon'].destroy();
        
        // Define standard domains to match admin portal
        const domains = ["Web Development", "Digital Marketing", "Graphic Designing", "Data Analysis", "Cyber Security"];
        const domainMap = {};
        domains.forEach(d => domainMap[d] = 0);
        
        interns.forEach(s => {
            if (domainMap.hasOwnProperty(s.dept)) {
                domainMap[s.dept] += parseFloat(s.funds || 0);
            }
        });
        
        charts['internMon'] = new Chart(monCtx, {
            type: 'doughnut',
            data: { 
                labels: domains, 
                datasets: [{ 
                    data: domains.map(d => domainMap[d]), 
                    backgroundColor: ['#a855f7', '#0ea5e9', '#f97316', '#22c55e', '#ef4444'],
                    borderWidth: 0
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                cutout: '70%', 
                plugins: { 
                    legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, padding: 20 } } 
                } 
            }
        });
    }
}

function renderStudentDashboard(students) {
    const studentList = students.filter(s => s.type === 'Student');
    const filtered = getFilteredData(studentList);

    const totalFees = studentList.reduce((acc, s) => acc + parseFloat(s.funds || 0), 0);
    const avgAtt = studentList.length ? Math.round(studentList.reduce((acc, s) => acc + parseInt(s.attendance || 0), 0) / studentList.length) : 0;
    const avgExam = studentList.length ? Math.round(studentList.reduce((acc, s) => acc + (parseFloat(s.halfYearly || 0) + parseFloat(s.annual || 0))/2, 0) / studentList.length) : 0;

    safeSetText('studentCount', studentList.length);
    safeSetText('studentAvgExam', avgExam + "%");
    safeSetText('studentFees', '₹' + totalFees.toLocaleString('en-IN'));
    safeSetText('studentAvgAtt', avgAtt + "%");

    const table = document.getElementById('studentTableBody');
    if (table) {
        table.innerHTML = filtered.map(s => `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>${s.id}</td>
                <td>${s.dept}</td>
                <td>${s.halfYearly || 0}%</td>
                <td>${s.annual || 0}%</td>
                <td>${s.attendance}%</td>
                <td>₹${parseFloat(s.funds || 0).toLocaleString('en-IN')}</td>
                <td>${s.duration || '-'}</td>
                <td><span class="status-pill ${parseFloat(s.annual) >= 50 ? 'status-pass' : 'status-fail'}">${parseFloat(s.annual) >= 50 ? 'Promoted' : 'Delayed'}</span></td>
            </tr>
        `).join('');
    }
    renderStudentCharts(filtered);
}

function renderStudentCharts(students) {
    if (typeof Chart === 'undefined') return;

    // 1. Student Attendance Trend (Last 7 Days)
    const attCtx = document.getElementById('studentAttendanceChart')?.getContext('2d');
    if (attCtx) {
        if (charts['studentAtt']) charts['studentAtt'].destroy();
        const labels = [];
        const data = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
            const presentCount = students.filter(s => s.attendanceLog?.[dateKey] === 'Present').length;
            data.push(students.length ? Math.round((presentCount / students.length) * 100) : 0);
        }
        charts['studentAtt'] = new Chart(attCtx, {
            type: 'line',
            data: { 
                labels, 
                datasets: [{ 
                    label: 'Avg Attendance %', 
                    data, 
                    borderColor: '#a855f7', 
                    backgroundColor: 'rgba(168, 85, 247, 0.1)', 
                    fill: true, 
                    tension: 0.4 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } }, 
                    x: { grid: { display: false } } 
                } 
            }
        });
    }

    // 2. Fee Collection by Class (Bar Chart)
    const monCtx = document.getElementById('studentMonetaryChart')?.getContext('2d');
    if (monCtx) {
        if (charts['studentMon']) charts['studentMon'].destroy();
        const classMap = {};
        students.forEach(s => {
            classMap[s.dept] = (classMap[s.dept] || 0) + parseFloat(s.funds || 0);
        });
        charts['studentMon'] = new Chart(monCtx, {
            type: 'bar',
            data: { 
                labels: Object.keys(classMap), 
                datasets: [{ 
                    label: 'Fees Collected (₹)',
                    data: Object.values(classMap), 
                    backgroundColor: 'rgba(168, 85, 247, 0.6)',
                    borderRadius: 4
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, 
                    x: { grid: { display: false } } 
                } 
            }
        });
    }
}

function renderHomeCharts(students) {
    if (typeof Chart === 'undefined') return;

    // 1. All Exam Results Chart: Grouped Bar Chart (Avg Score per Department)
    // This is much more practical than a fake trend.
    const trendCtx = document.getElementById('allExamTrendChart')?.getContext('2d');
    if (trendCtx) {
        if (charts['allExamTrend']) charts['allExamTrend'].destroy();
        
        // Collect departments and their avg scores
        const deptPerformance = {};
        students.forEach(s => {
            if (!deptPerformance[s.dept]) {
                deptPerformance[s.dept] = { studentSum: 0, studentCount: 0, internSum: 0, internCount: 0 };
            }
            if (s.type === 'Student') {
                deptPerformance[s.dept].studentSum += parseInt(s.marks || 0);
                deptPerformance[s.dept].studentCount++;
            } else {
                deptPerformance[s.dept].internSum += parseInt(s.marks || 0);
                deptPerformance[s.dept].internCount++;
            }
        });

        // Pick top 6 departments by total member count for clarity
        const sortedDepts = Object.keys(deptPerformance)
            .sort((a, b) => (deptPerformance[b].studentCount + deptPerformance[b].internCount) - (deptPerformance[a].studentCount + deptPerformance[a].internCount))
            .slice(0, 6);

        const studentAvgData = sortedDepts.map(d => deptPerformance[d].studentCount ? Math.round(deptPerformance[d].studentSum / deptPerformance[d].studentCount) : 0);
        const internAvgData = sortedDepts.map(d => deptPerformance[d].internCount ? Math.round(deptPerformance[d].internSum / deptPerformance[d].internCount) : 0);

        charts['allExamTrend'] = new Chart(trendCtx, {
            type: 'bar',
            data: {
                labels: sortedDepts,
                datasets: [
                    {
                        label: 'Students Avg Score',
                        data: studentAvgData,
                        backgroundColor: '#a855f7',
                        borderRadius: 4,
                        barThickness: 20
                    },
                    {
                        label: 'Interns Avg Score',
                        data: internAvgData,
                        backgroundColor: '#0ea5e9',
                        borderRadius: 4,
                        barThickness: 20
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bars for easier label reading
                plugins: { 
                    legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true } },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.raw}%`
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Average Score (%)', color: '#94a3b8' } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    // 2. Member Distribution Chart (Enhanced Doughnut)
    const distCtx = document.getElementById('memberDistributionChart')?.getContext('2d');
    if (distCtx) {
        if (charts['memberDist']) charts['memberDist'].destroy();
        const studentCount = students.filter(s => s.type === 'Student').length;
        const internCount = students.filter(s => s.type === 'Intern').length;
        
        charts['memberDist'] = new Chart(distCtx, {
            type: 'doughnut',
            data: {
                labels: ['Students', 'Interns'],
                datasets: [{
                    data: [studentCount, internCount],
                    backgroundColor: ['#a855f7', '#f97316'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: (info) => ` ${info.label}: ${info.raw} members`
                        }
                    }
                }
            }
        });
    }

    // 3. Attendance Analytics: Combined 30-day area chart
    const buildCombinedAttChart = () => {
        const canvasId = 'combinedAttChart30';
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;
        if (charts[canvasId]) charts[canvasId].destroy();

        const labels = [];
        const fullDates = [];
        const studentData = [];
        const internData = [];
        
        const now = new Date();
        const studentMembers = students.filter(s => s.type === 'Student');
        const internMembers = students.filter(s => s.type === 'Intern');

        let stPresentTotal = 0, stDenomTotal = 0, stNonZero = 0, stBest = 0, stLowest = Infinity;
        let inPresentTotal = 0, inDenomTotal = 0, inNonZero = 0, inBest = 0, inLowest = Infinity;

        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            fullDates.push(d);
            
            const label = (i % 5 === 0) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
            labels.push(label);
            
            // Student stats this day
            const stPresent = studentMembers.filter(m => m.attendanceLog?.[dateKey] === 'Present').length;
            const stTotal = studentMembers.length;
            const stRate = stTotal ? Math.round((stPresent / stTotal) * 100) : 0;
            studentData.push(stRate);
            
            if (stTotal > 0) {
                stPresentTotal += stRate;
                stDenomTotal++;
            }
            if (stRate > 0) {
                stNonZero++;
                if (stRate > stBest) stBest = stRate;
                if (stRate < stLowest) stLowest = stRate;
            }

            // Intern stats this day
            const inPresent = internMembers.filter(m => m.attendanceLog?.[dateKey] === 'Present').length;
            const inTotal = internMembers.length;
            const inRate = inTotal ? Math.round((inPresent / inTotal) * 100) : 0;
            internData.push(inRate);
            
            if (inTotal > 0) {
                inPresentTotal += inRate;
                inDenomTotal++;
            }
            if (inRate > 0) {
                inNonZero++;
                if (inRate > inBest) inBest = inRate;
                if (inRate < inLowest) inLowest = inRate;
            }
        }

        if (stLowest === Infinity) stLowest = 0;
        if (inLowest === Infinity) inLowest = 0;

        const stAvg = stDenomTotal ? Math.round(stPresentTotal / stDenomTotal) : 0;
        const inAvg = inDenomTotal ? Math.round(inPresentTotal / inDenomTotal) : 0;

        safeSetText('studentAvgRate', stAvg + '%');
        safeSetText('studentBestDay', stBest + '%');
        safeSetText('studentLowestDay', stLowest + '%');

        safeSetText('internAvgRate', inAvg + '%');
        safeSetText('internBestDay', inBest + '%');
        safeSetText('internLowestDay', inLowest + '%');

        const studentGradient = ctx.createLinearGradient(0, 0, 0, 350);
        studentGradient.addColorStop(0, 'rgba(168,85,247,0.4)');
        studentGradient.addColorStop(1, 'rgba(168,85,247,0.0)');

        const internGradient = ctx.createLinearGradient(0, 0, 0, 350);
        internGradient.addColorStop(0, 'rgba(14,165,233,0.4)');
        internGradient.addColorStop(1, 'rgba(14,165,233,0.0)');

        charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Students',
                        data: studentData,
                        borderColor: '#a855f7',
                        backgroundColor: studentGradient,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 2,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'Interns',
                        data: internData,
                        borderColor: '#0ea5e9',
                        backgroundColor: internGradient,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 2,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { usePointStyle: true, font: { size: 12 } }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: (items) => fullDates[items[0].dataIndex].toLocaleDateString('en-US', {
                                weekday: 'short', month: 'short', day: 'numeric'
                            }),
                            label: (item) => `  ${item.dataset.label}: ${item.raw}%`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { stepSize: 25, callback: v => v + '%' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b' }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    };

    buildCombinedAttChart();
}

document.getElementById('studentSearch')?.addEventListener('input', () => {
    const path = window.location.pathname;
    if (path.includes('index.html') || path.endsWith('/')) renderHomeDashboard(allStudents);
    else if (path.includes('interns.html')) renderInternDashboard(allStudents);
    else if (path.includes('students.html')) renderStudentDashboard(allStudents);
});

function updateAdminTable(students) {
    const adminTable = document.getElementById('adminTableBody');
    if (!adminTable) return;
    adminTable.innerHTML = students.map(s => `
        <tr>
            <td><strong>${s.name}</strong><br><small>${s.id} | ${s.dept}</small></td>
            <td style="text-align: right;">
                <button onclick="editStudent('${s.firebaseKey}')" style="color:#fbbf24; background:none; border:none; cursor:pointer; font-weight: 500; margin-right: 1rem;">Edit</button>
                <button onclick="deleteStudent('${s.firebaseKey}')" style="color:#ef4444; background:none; border:none; cursor:pointer; font-weight: 500;">Delete</button>
            </td>
        </tr>`).join('');
}

// --- 7. ATTENDANCE MATRIX LOGIC ---
function renderAttendanceMatrix() {
    const tHead = document.getElementById('attendanceHead');
    const tBody = document.getElementById('attendanceBody');
    if (!tHead || !tBody) return; 

    if (attendanceDates.length === 0) {
        let d = new Date();
        d.setHours(0,0,0,0);
        for(let i=0; i<182; i++) {
            attendanceDates.push(new Date(d));
            d.setDate(d.getDate() - 1);
        }
    }

    const members = allStudents.filter(s => s.type === currentAttendanceTab);

    let headHTML = `<tr><th class="sticky-col">Name / ID</th>`;
    attendanceDates.forEach(date => {
        let dateStr = date.toISOString().split('T')[0].slice(5); 
        headHTML += `<th style="text-align: center; font-size: 0.75rem; color: var(--secondary); border-bottom: 1px solid var(--border); padding: 0.5rem;">${dateStr}</th>`;
    });
    headHTML += `</tr>`;
    tHead.innerHTML = headHTML;

    let bodyHTML = "";
    const now = new Date();
    // Check if override has been unlocked from attendance.html
    const overrideActive = (typeof window.isOverrideUnlocked === 'function') ? window.isOverrideUnlocked() : false;

    members.forEach(m => {
        let log = m.attendanceLog || {};
        let rowHTML = `<tr><td class="sticky-col"><strong style="color: #f8fafc;">${m.name}</strong><br><small style="color: var(--secondary)">${m.id}</small></td>`;
        
        attendanceDates.forEach(date => {
            const dateKey = date.toISOString().split('T')[0];
            const diffTime = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const isLocked = diffDays > 3;
            // Editable if: admin logged in AND (within 3-day window OR override is active)
            const isEditable = isAdminMode && (!isLocked || overrideActive);
            const editableClass = isEditable ? 'editable' : '';
            // Locked visual only shown when actually locked and override not active
            const lockedClass = (isLocked && !overrideActive) ? 'att-status-locked' : '';
            // Override-locked: admin logged in, locked, but override not yet granted
            const needsOverride = isAdminMode && isLocked && !overrideActive;
            let status = log[dateKey] === 'Present' ? 'P' : 'A';
            let badgeClass = status === 'P' ? 'att-status-p' : 'att-status-a';

            rowHTML += `<td class="att-cell ${editableClass}" title="${needsOverride ? 'Click to enter override password' : isEditable ? 'Click to toggle' : 'Read-only'}">
                            <span class="${badgeClass} ${lockedClass}" 
                                data-key="${m.firebaseKey}" 
                                data-date="${dateKey}" 
                                data-status="${status}" 
                                data-editable="${isEditable}"
                                data-needs-override="${needsOverride}">
                                ${status}
                            </span>
                        </td>`;
        });
        rowHTML += `</tr>`;
        bodyHTML += rowHTML;
    });
    tBody.innerHTML = bodyHTML;

    // Attach click handlers — editable cells toggle; locked cells prompt override
    document.querySelectorAll('.att-cell.editable span').forEach(el => {
        el.addEventListener('click', toggleDailyAttendance);
    });

    // Locked cells that need override: show modal on click
    document.querySelectorAll('.att-cell:not(.editable) span[data-needs-override="true"]').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
            if (typeof window.openOverrideModal === 'function') {
                window.openOverrideModal();
            } else {
                alert('Override password required to edit locked records.');
            }
        });
    });
}

function toggleDailyAttendance(e) {
    const trg = e.target;
    if (!isAdminMode) {
        alert('Admin login required to edit attendance.');
        return;
    }
    if (trg.getAttribute('data-editable') !== 'true') {
        // Check if override modal is available
        if (typeof window.openOverrideModal === 'function') {
            window.openOverrideModal();
        } else {
            alert('This record is locked. Use the Override Lock button to unlock it.');
        }
        return;
    }
    const key = trg.getAttribute('data-key');
    const dateKey = trg.getAttribute('data-date');
    const currentStatus = trg.getAttribute('data-status');
    const newStatus = currentStatus === 'P' ? 'Absent' : 'Present';
    db.ref('students').child(key).child('attendanceLog').child(dateKey).set(newStatus);
}

document.getElementById('tabStudent')?.addEventListener('click', () => {
    currentAttendanceTab = 'Student';
    renderAttendanceMatrix();
});
document.getElementById('tabIntern')?.addEventListener('click', () => {
    currentAttendanceTab = 'Intern';
    renderAttendanceMatrix();
});
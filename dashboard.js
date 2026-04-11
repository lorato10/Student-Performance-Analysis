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

// Auto-calculate attendance
const stuTotalDays = document.getElementById('stuTotalDays');
const stuPresentDays = document.getElementById('stuPresentDays');
const stuAtt = document.getElementById('stuAtt');

window.calcAttendance = () => {
    if (!stuTotalDays || !stuPresentDays || !stuAtt) return;
    
    if (stuTotalDays.value < 0) stuTotalDays.value = 0;
    if (stuPresentDays.value < 0) stuPresentDays.value = 0;
    
    const total = parseInt(stuTotalDays.value || 0);
    let present = parseInt(stuPresentDays.value || 0);

    if (total > 0) {
        if (present > total) {
            present = total; 
            stuPresentDays.value = present;
        }
        stuAtt.value = Math.round((present / total) * 100);
    } else {
        stuAtt.value = '';
    }
};

if (stuTotalDays && stuPresentDays) {
    stuTotalDays.addEventListener('input', window.calcAttendance);
    stuPresentDays.addEventListener('input', window.calcAttendance);
}

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
        const studentData = {
            id: document.getElementById('stuId').value,
            name: document.getElementById('stuName').value,
            type: document.getElementById('stuType').value,
            dept: document.getElementById('stuDept').value,
            duration: document.getElementById('stuDuration').value,
            totalDays: document.getElementById('stuTotalDays').value,
            presentDays: document.getElementById('stuPresentDays').value,
            attendance: document.getElementById('stuAtt').value,
            marks: document.getElementById('stuMarks').value,
            funds: document.getElementById('stuFunds').value,
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
    safeSetVal('stuTotalDays', student.totalDays || '');
    safeSetVal('stuPresentDays', student.presentDays || '');
    safeSetVal('stuAtt', parseInt(student.attendance || 0));
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
    safeSetText('netBalance', '₹' + (totalFees - totalSalary).toLocaleString('en-IN'));

    const starTable = document.getElementById('starPerformersTable');
    if (starTable) {
        const top5 = [...students].sort((a, b) => parseInt(b.marks || 0) - parseInt(a.marks || 0)).slice(0, 5);
        starTable.innerHTML = top5.map(s => `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>${s.id}</td>
                <td><span class="type-badge">${s.type}</span></td>
                <td>${s.dept}</td>
                <td>${s.marks}</td>
                <td><span class="status-pill status-pass">${parseInt(s.marks) >= 50 ? 'Excellent' : 'Average'}</span></td>
            </tr>
        `).join('');
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

    // 1. Performance Trend Chart (Mock dynamic data for now as we only have current scores)
    const trendCtx = document.getElementById('allExamTrendChart')?.getContext('2d');
    if (trendCtx) {
        if (charts['allExamTrend']) charts['allExamTrend'].destroy();
        const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
        
        // Calculate average performance for Students and Interns
        const avgS = students.filter(s => s.type === 'Student').reduce((acc, s) => acc + parseInt(s.marks || 0), 0) / (students.filter(s => s.type === 'Student').length || 1);
        const avgI = students.filter(s => s.type === 'Intern').reduce((acc, s) => acc + parseInt(s.marks || 0), 0) / (students.filter(s => s.type === 'Intern').length || 1);

        charts['allExamTrend'] = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Students Performance',
                        data: [avgS * 0.8, avgS * 0.9, avgS * 0.95, avgS],
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Interns Performance',
                        data: [avgI * 0.7, avgI * 0.85, avgI * 0.9, avgI],
                        borderColor: '#0ea5e9',
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, usePointStyle: true } } },
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 2. Member Distribution Chart
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
                    weight: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '80%',
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
                }
            }
        });
    }

    // 3. Attendance Overview Chart (7-day trend)
    const attCtx = document.getElementById('attendanceOverviewChart')?.getContext('2d');
    if (attCtx) {
        if (charts['attOverview']) charts['attOverview'].destroy();
        
        const labels = [];
        const studentData = [];
        const internData = [];
        const now = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
            
            const dayStudents = students.filter(s => s.type === 'Student');
            const dayInterns = students.filter(s => s.type === 'Intern');
            
            const sPresent = dayStudents.filter(s => s.attendanceLog?.[dateKey] === 'Present').length;
            const iPresent = dayInterns.filter(s => s.attendanceLog?.[dateKey] === 'Present').length;
            
            studentData.push(dayStudents.length ? Math.round((sPresent / dayStudents.length) * 100) : 0);
            internData.push(dayInterns.length ? Math.round((iPresent / dayInterns.length) * 100) : 0);
        }

        charts['attOverview'] = new Chart(attCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Students (%)',
                        data: studentData,
                        backgroundColor: '#a855f7',
                        borderRadius: 6
                    },
                    {
                        label: 'Interns (%)',
                        data: internData,
                        backgroundColor: '#0ea5e9',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, usePointStyle: true } } },
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
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
    members.forEach(m => {
        let log = m.attendanceLog || {};
        let rowHTML = `<tr><td class="sticky-col"><strong style="color: #f8fafc;">${m.name}</strong><br><small style="color: var(--secondary)">${m.id}</small></td>`;
        
        attendanceDates.forEach(date => {
            const dateKey = date.toISOString().split('T')[0];
            const diffTime = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const isLocked = diffDays > 3; 
            const isEditable = isAdminMode && !isLocked;
            const editableClass = isEditable ? 'editable' : '';
            const lockedClass = isLocked ? 'att-status-locked' : '';
            let status = log[dateKey] === 'Present' ? 'P' : 'A';
            let badgeClass = status === 'P' ? 'att-status-p' : 'att-status-a';

            rowHTML += `<td class="att-cell ${editableClass}">
                            <span class="${badgeClass} ${lockedClass}" data-key="${m.firebaseKey}" data-date="${dateKey}" data-status="${status}" data-editable="${isEditable}">
                                ${status}
                            </span>
                        </td>`;
        });
        rowHTML += `</tr>`;
        bodyHTML += rowHTML;
    });
    tBody.innerHTML = bodyHTML;

    document.querySelectorAll('.att-cell.editable span').forEach(el => {
        el.addEventListener('click', toggleDailyAttendance);
    });
}

function toggleDailyAttendance(e) {
    const trg = e.target;
    if (!isAdminMode) return alert("Admin login required.");
    if (trg.getAttribute('data-editable') !== 'true') return alert("Record locked.");
    
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
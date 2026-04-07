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

// Mobile Menu Toggle Logic
document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// --- 2. THE REAL-TIME SYNC (Admin -> Public) ---
db.ref('students').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    const studentArray = [];
    for (let key in data) {
        let studentData = { ...data[key], firebaseKey: key };
        // Map legacy domains for seamless UI transition
        if (studentData.dept === 'Engineering') studentData.dept = 'Full Stack';
        if (studentData.dept === 'Cyber Security') studentData.dept = 'Data Analysis';
        studentArray.push(studentData);
    }

    // Update all sections
    renderPublicDashboard(studentArray);
    updateAdminTable(studentArray);
    updateAnalytics(studentArray);
});

// --- 3. DATA ENTRY & MANAGEMENT ---
let editingKey = null;
const entryForm = document.getElementById('adminEntryForm');
const submitBtn = entryForm?.querySelector('button[type="submit"]');

if (entryForm) {
    entryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const studentData = {
            id: document.getElementById('stuId').value,
            name: document.getElementById('stuName').value,
            type: document.getElementById('stuType').value,
            dept: document.getElementById('stuDept').value,
            duration: document.getElementById('stuDuration').value,
            attendance: document.getElementById('stuAtt').value,
            marks: document.getElementById('stuMarks').value,
            funds: document.getElementById('stuFunds').value
        };

        if (editingKey) {
            db.ref('students').child(editingKey).update(studentData).then(() => {
                entryForm.reset();
                editingKey = null;
                if (submitBtn) submitBtn.innerText = "Push to Dashboard";
                alert("Record updated successfully!");
            });
        } else {
            db.ref('students').push(studentData).then(() => {
                entryForm.reset();
                alert("Record added successfully!");
            });
        }
    });
}

window.editStudent = (key) => {
    const student = allStudents.find(s => s.firebaseKey === key);
    if (!student) return;

    editingKey = key;
    document.getElementById('stuId').value = student.id;
    document.getElementById('stuName').value = student.name;
    document.getElementById('stuType').value = student.type;
    document.getElementById('stuDept').value = student.dept;
    if (document.getElementById('stuDuration')) document.getElementById('stuDuration').value = student.duration || '';
    document.getElementById('stuAtt').value = student.attendance;
    document.getElementById('stuMarks').value = student.marks;
    if (document.getElementById('stuFunds')) document.getElementById('stuFunds').value = student.funds || '';

    if (submitBtn) submitBtn.innerText = "Update Record";
    document.querySelector('.admin-grid').scrollIntoView({ behavior: 'smooth' });
};

window.deleteStudent = (key) => {
    if (confirm("Permanently delete this record?")) {
        db.ref('students').child(key).remove();
    }
};

// --- 4. PUBLIC DISPLAY LOGIC ---
let allStudents = [];
function renderPublicDashboard(students) {
    allStudents = students; // Keep reference for search
    const tableBody = document.getElementById('publicTableBody');
    if (!tableBody) return;

    // Search Filtering
    const searchTerm = document.getElementById('studentSearch')?.value.toLowerCase() || "";
    const filtered = students.filter(s => {
        const nameMatch = (s.name || "").toLowerCase().includes(searchTerm);
        const idMatch = (s.id || "").toLowerCase().includes(searchTerm);
        const deptMatch = (s.dept || "").toLowerCase().includes(searchTerm);
        const durMatch = (s.duration || "").toLowerCase().includes(searchTerm);
        return nameMatch || idMatch || deptMatch || durMatch;
    });

    // Update Filter Status text
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) {
        filterStatus.innerText = searchTerm ? `Results for "${searchTerm}"` : "Showing all members";
    }

    let totalAttendance = 0;
    let uniqueDepts = new Set();

    tableBody.innerHTML = filtered.map(s => {
        totalAttendance += parseInt(s.attendance || 0);
        uniqueDepts.add(s.dept);
        const marks = parseInt(s.marks || 0);
        const status = marks >= 50 ? "Pass" : "Fail";
        const sClass = status.toLowerCase();
        
        const attendance = parseInt(s.attendance || 0);
        const riskProfile = attendance < 75 ? "High Risk" : "Optimal";
        const riskClass = attendance < 75 ? "fail" : "pass";

        return `
            <tr>
                <td>${s.id}</td>
                <td><strong>${s.name}</strong></td>
                <td><span class="type-badge">${s.type}</span></td>
                <td>${s.dept}</td>
                <td>${s.duration || '-'}</td>
                <td>${attendance}%</td>
                <td>${marks}</td>
                <td><span class="status-pill status-${riskClass}">${riskProfile}</span></td>
                <td><span class="status-pill status-${sClass}">${status}</span></td>
            </tr>`;
    }).join('');

    // Update KPI Cards (based on full student list)
    if (document.getElementById('totalCount')) document.getElementById('totalCount').innerText = students.length;
    if (document.getElementById('avgAtt')) {
        const avg = students.length ? Math.round(students.reduce((acc, curr) => acc + parseInt(curr.attendance || 0), 0) / students.length) : 0;
        document.getElementById('avgAtt').innerText = avg + "%";
    }
    if (document.getElementById('deptCount')) {
        const depts = new Set(students.map(s => s.dept));
        document.getElementById('deptCount').innerText = depts.size;
    }

    // --- Financial Tracker Logic ---
    let totalFees = 0;
    let totalEarnings = 0;
    
    filtered.forEach(s => {
        const amount = parseFloat(s.funds || 0);
        if (s.type === 'Student') totalFees += amount;
        if (s.type === 'Intern') totalEarnings += amount;
    });

    if (document.getElementById('totalFees')) document.getElementById('totalFees').innerText = '₹' + totalFees.toLocaleString('en-IN');
    if (document.getElementById('totalEarnings')) document.getElementById('totalEarnings').innerText = '₹' + totalEarnings.toLocaleString('en-IN');
    if (document.getElementById('netBalance')) {
        const net = totalFees - totalEarnings;
        const netEl = document.getElementById('netBalance');
        netEl.innerText = '₹' + Math.abs(net).toLocaleString('en-IN');
        netEl.innerText = (net < 0 ? '-' : '') + netEl.innerText;
        netEl.style.color = net >= 0 ? '#16a34a' : '#ef4444';
    }

    const financialTable = document.getElementById('financialTableBody');
    if (financialTable) {
        financialTable.innerHTML = filtered.map(s => {
            const amount = parseFloat(s.funds || 0).toLocaleString('en-IN');
            return `
                <tr>
                    <td>${s.id}</td>
                    <td><strong>${s.name}</strong></td>
                    <td><span class="type-badge">${s.type}</span></td>
                    <td>${s.dept}</td>
                    <td style="text-align: right; font-weight: 600; color: ${s.type === 'Student' ? '#16a34a' : '#ef4444'};">₹${amount}</td>
                </tr>`;
        }).join('');
    }

    // Update Leaderboard (Top 5)
    const leaderboard = document.getElementById('leaderboard');
    if (leaderboard) {
        const top5 = [...students].sort((a, b) => parseInt(b.marks || 0) - parseInt(a.marks || 0)).slice(0, 5);
        leaderboard.innerHTML = top5.map((s, i) => `
            <div class="rank-item">
                <div class="rank-number">#${i + 1}</div>
                <div class="rank-info" style="line-height: 1.4;">
                    <span style="font-weight: 600; font-size: 0.95rem; color: #f8fafc;">${s.name}</span><br>
                    <span style="font-size: 0.75rem; color: var(--secondary);">${s.dept} • ${s.type}</span>
                </div>
                <div class="rank-score">${s.marks}</div>
            </div>
        `).join('');
    }
}

// Search Listener
document.getElementById('studentSearch')?.addEventListener('input', () => {
    renderPublicDashboard(allStudents);
});

function updateAdminTable(students) {
    const adminTable = document.getElementById('adminTableBody');
    if (!adminTable) return;
    adminTable.innerHTML = students.map(s => `
        <tr>
            <td><strong>${s.name}</strong><br><small>${s.id} | ${s.dept}</small></td>
            <td style="text-align: right;">
                <button onclick="editStudent('${s.firebaseKey}')" style="color:#d4af37; background:none; border:none; cursor:pointer; font-weight: 500; margin-right: 1rem;">Edit</button>
                <button onclick="deleteStudent('${s.firebaseKey}')" style="color:#ef4444; background:none; border:none; cursor:pointer; font-weight: 500;">Delete</button>
            </td>
        </tr>`).join('');
}

// --- 5. CHARTS ---
function updateAnalytics(students) {
    if (!students || students.length === 0) return;
    
    // Per-chart dynamic configuration map
    const config = [
        { 
            id: 'statusDistributionChart', 
            type: 'doughnut', 
            func: getStatusData,
            options: { cutout: '75%' } // Thin, elegant rim
        },
        { 
            id: 'riskDistributionChart', 
            type: 'doughnut', 
            func: getRiskData,
            options: { cutout: '75%' }
        },
        { 
            id: 'domainPerformanceChart', 
            type: 'polarArea', 
            func: getDomainData,
            options: {
                scales: { 
                    r: { ticks: { display: false }, grid: { color: 'rgba(51, 65, 85, 0.4)' } } 
                }
            }
        },
        { 
            id: 'typeComparisonChart', 
            type: 'bar', 
            func: getTypeData,
            options: {
                indexAxis: 'y', // Turns it into a sleek Horizontal Bar Chart
                scales: {
                    x: { grid: { color: 'rgba(51, 65, 85, 0.4)' }, ticks: { padding: 10 } },
                    y: { grid: { display: false } }
                }
            }
        }
    ];

    config.forEach(c => {
        const el = document.getElementById(c.id);
        if (!el) return;
        if (charts[c.id]) charts[c.id].destroy();
        charts[c.id] = new Chart(el.getContext('2d'), {
            type: c.type,
            data: c.func(students),
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                animation: {
                    duration: 2500,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: { padding: 20, font: { size: 13, weight: 500 }, usePointStyle: true }
                    }
                },
                ...c.options // Inherit specialized overrides
            }
        });
    });
}

function getStatusData(students) {
    const pass = students.filter(s => parseInt(s.marks) >= 50).length;
    return {
        labels: ['Pass', 'Fail'],
        datasets: [{ 
            data: [pass, students.length - pass], 
            backgroundColor: ['rgba(52, 211, 153, 0.9)', 'rgba(248, 113, 113, 0.9)'], 
            borderWidth: 4,
            borderColor: '#0b0f19',
            hoverOffset: 12
        }]
    };
}

function getRiskData(students) {
    const highRisk = students.filter(s => parseInt(s.attendance || 0) < 75).length;
    const optimal = students.length - highRisk;
    return {
        labels: ['Optimal', 'High Risk'],
        datasets: [{ 
            data: [optimal, highRisk], 
            backgroundColor: ['rgba(52, 211, 153, 0.9)', 'rgba(251, 191, 36, 0.9)'], 
            borderWidth: 4,
            borderColor: '#0b0f19',
            hoverOffset: 12
        }]
    };
}

function getDomainData(students) {
    const domains = {};
    students.forEach(s => {
        if (!domains[s.dept]) domains[s.dept] = { total: 0, count: 0 };
        domains[s.dept].total += parseInt(s.marks || 0);
        domains[s.dept].count++;
    });
    
    const paletteBg = [
        'rgba(251, 191, 36, 0.85)', 'rgba(56, 189, 248, 0.85)', 
        'rgba(167, 139, 250, 0.85)', 'rgba(244, 63, 94, 0.85)', 
        'rgba(52, 211, 153, 0.85)', 'rgba(251, 146, 60, 0.85)',
        'rgba(236, 72, 153, 0.85)'
    ];
    const paletteBorder = ['#fbbf24', '#38bdf8', '#a78bfa', '#f43f5e', '#34d399', '#fb923c', '#ec4899'];

    return {
        labels: Object.keys(domains),
        datasets: [{ 
            label: 'Avg Marks', 
            data: Object.values(domains).map(d => Math.round(d.total / d.count)), 
            backgroundColor: paletteBg.slice(0, Object.keys(domains).length), 
            borderColor: paletteBorder.slice(0, Object.keys(domains).length),
            borderWidth: 2
        }]
    };
}

function getTypeData(students) {
    const getAvg = (type) => {
        const filtered = students.filter(s => s.type === type);
        return filtered.length ? (filtered.reduce((a, b) => a + parseInt(b.marks || 0), 0) / filtered.length).toFixed(1) : 0;
    };
    return {
        labels: ['Students', 'Interns'],
        datasets: [{ 
            label: 'Avg Score', 
            data: [getAvg('Student'), getAvg('Intern')], 
            backgroundColor: ['rgba(56, 189, 248, 0.85)', 'rgba(167, 139, 250, 0.85)'], 
            borderColor: ['#38bdf8', '#a78bfa'],
            borderWidth: 2,
            borderRadius: 8,
            barThickness: 36
        }]
    };
}

// --- 6. EXPORT TO PDF ---
window.exportAuditPDF = () => {
    if (typeof window.jspdf === 'undefined') {
        alert("PDF generator not yet loaded. Please try again in a moment.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    // Branding & Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(212, 175, 55); // Gold
    doc.text("Excellence Web Service", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.text("System Audit & Human Capital Registry", 14, 28);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);
    doc.text(`Total Headcount: ${allStudents.length} Active Entities`, 14, 39);

    // Prepare Table Data
    const tableHeaders = [["ID", "Entity Name", "Contract Type", "Functional Unit", "Tenure", "Availability (%)", "Metric", "Risk Profile", "Status"]];
    const tableData = allStudents.map(s => {
        const attendance = parseInt(s.attendance || 0);
        const marks = parseInt(s.marks || 0);
        return [
            s.id || '-',
            s.name || '-',
            s.type || '-',
            s.dept || '-',
            s.duration || '-',
            attendance.toString(),
            marks.toString(),
            attendance < 75 ? "High Risk" : "Optimal",
            marks >= 50 ? "Pass" : "Fail"
        ];
    });

    doc.autoTable({
        startY: 45,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: function(data) {
            // Apply conditional styling for Risk Profile (Column 7)
            if (data.section === 'body' && data.column.index === 7) {
                if (data.cell.raw === 'High Risk') {
                    data.cell.styles.textColor = [220, 38, 38]; // Red
                    data.cell.styles.fontStyle = 'bold';
                } else {
                    data.cell.styles.textColor = [22, 163, 74]; // Green
                }
            }
            // Apply conditional styling for Status (Column 8)
            if (data.section === 'body' && data.column.index === 8) {
                if (data.cell.raw === 'Fail') {
                    data.cell.styles.textColor = [220, 38, 38];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    doc.save("System_Audit_Excellence.pdf");
};
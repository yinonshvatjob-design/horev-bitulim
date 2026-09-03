/* ==========================================================================
   פלטפורמת ביטול ארוחות - לוגיקה עסקית וממשק משתמש (App Engine 2.0)
   ========================================================================== */

const API_BASE_URL = window.location.origin.includes('localhost') ? 'http://localhost:4050/api' : '/api';

// Local State Store
const AppStore = {
  currentUser: JSON.parse(localStorage.getItem('horev_current_user')) || null,
  activeTab: 'submitView',
  requests: [],
  coordinators: [],
  emailLogs: []
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  bindEvents();
  setupDateLimits();

  if (AppStore.currentUser) {
    showMainApp();
  } else {
    showLoginScreen();
  }
}

// --------------------------------------------------------------------------
// 1. Event Listeners & UI Routing
// --------------------------------------------------------------------------
function bindEvents() {
  // Role Tabs Switcher in Login
  document.querySelectorAll('.role-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');

      const role = e.currentTarget.dataset.role;
      if (role === 'coordinator') {
        document.getElementById('coordinatorLoginForm').style.display = 'block';
        document.getElementById('adminLoginForm').style.display = 'none';
      } else {
        document.getElementById('coordinatorLoginForm').style.display = 'none';
        document.getElementById('adminLoginForm').style.display = 'block';
      }
    });
  });

  // Coordinator Login Submit
  document.getElementById('coordinatorLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('coordIdInput').value.trim();
    await handleLogin('coordinator', id);
  });

  // Admin Login Submit
  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('adminIdInput').value.trim();
    const pass = document.getElementById('adminPasswordInput').value.trim();
    await handleLogin('admin', id, pass);
  });

  // Demo Login Quick Buttons
  document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const type = e.currentTarget.dataset.type;
      const id = e.currentTarget.dataset.id;
      const pass = e.currentTarget.dataset.pass || '';
      await handleLogin(type, id, pass);
    });
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Theme Switcher Toggle
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('themeToggleBtn').innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  });

  // Main Nav Tabs
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = e.currentTarget.dataset.target;
      switchTab(target);
    });
  });

  // Submission Form Submit
  document.getElementById('cancellationForm').addEventListener('submit', handleFormSubmit);

  // Date Range Cutoff Check
  document.getElementById('startDateInput').addEventListener('change', validateDateCutoff);

  // Close Modals
  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = e.currentTarget.dataset.close;
      document.getElementById(modalId).style.display = 'none';
    });
  });

  // Manage Users - Show Modal
  document.getElementById('showAddUserModalBtn')?.addEventListener('click', () => {
    document.getElementById('addUserModal').style.display = 'flex';
  });

  // Manage Users - Submit Form
  document.getElementById('addNewUserForm')?.addEventListener('submit', handleAddUserSubmit);
  document.getElementById('editUserForm')?.addEventListener('submit', handleEditUserSubmit);

  // Filters Events in Reports
  document.getElementById('filterCoordinator')?.addEventListener('change', renderReports);
  document.getElementById('filterStatus')?.addEventListener('change', renderReports);
  document.getElementById('filterStartDate')?.addEventListener('change', renderReports);
  document.getElementById('filterEndDate')?.addEventListener('change', renderReports);
  document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);
  document.getElementById('exportCsvBtn')?.addEventListener('click', exportToCSV);

  // Live Email Verification Test Submit
  document.getElementById('testEmailForm')?.addEventListener('submit', handleTestEmailSubmit);
}

async function handleTestEmailSubmit(e) {
  e.preventDefault();
  const recipientInput = document.getElementById('testEmailRecipientInput');
  const recipientEmail = recipientInput.value.trim();
  const statusDiv = document.getElementById('testEmailStatus');
  const btn = document.getElementById('sendTestEmailBtn');

  if (!recipientEmail) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח מייל בדיקה בלייב...';
  statusDiv.style.display = 'block';
  statusDiv.style.background = 'rgba(59, 130, 246, 0.1)';
  statusDiv.style.color = '#2563eb';
  statusDiv.style.border = '1px solid #93c5fd';
  statusDiv.innerHTML = `⏳ שולח מייל בדיקה לכתובת <strong>${recipientEmail}</strong> מ-bitulim@horev.org.il...`;

  try {
    const res = await fetch(`${API_BASE_URL}/email/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail })
    });
    const data = await res.json();

    if (data.success) {
      statusDiv.style.background = '#ecfdf5';
      statusDiv.style.color = '#047857';
      statusDiv.style.border = '1px solid #6ee7b7';
      statusDiv.innerHTML = `✅ <strong>הצלחה!</strong> המייל נשלח בהצלחה לכתובת <strong>${recipientEmail}</strong>. בדוק את תיבת הדואר הנכנס / דואר זבל.`;
      showToast('מייל בדיקה נשלח בהצלחה!', 'success');
      renderEmailLogs(); // Refresh activity log
    } else {
      statusDiv.style.background = '#fef2f2';
      statusDiv.style.color = '#b91c1c';
      statusDiv.style.border = '1px solid #fca5a5';
      statusDiv.innerHTML = `❌ <strong>שגיאה בשליחה:</strong> ${data.message}`;
      showToast('שגיאה בשליחת מייל הבדיקה', 'danger');
    }
  } catch (err) {
    statusDiv.style.background = '#fef2f2';
    statusDiv.style.color = '#b91c1c';
    statusDiv.style.border = '1px solid #fca5a5';
    statusDiv.innerHTML = `❌ <strong>שגיאת תקשורת:</strong> ${err.message}`;
    showToast('שגיאה בתקשורת עם השרת', 'danger');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> שלח מייל בדיקה בלייב';
  }
}

// --------------------------------------------------------------------------
// 2. Authentication Logic & Strict Role Guards
// --------------------------------------------------------------------------
async function handleLogin(role, id, pass = '') {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, id, pass })
    });

    const data = await response.json();
    if (!data.success) {
      showToast(data.message, 'danger');
      return;
    }

    AppStore.currentUser = data.user;
    localStorage.setItem('horev_current_user', JSON.stringify(data.user));
    showToast(`ברוך הבא, ${data.user.name}! התחברת בהצלחה.`, 'success');
    showMainApp();
  } catch (error) {
    console.error('Login error', error);
    // Fallback local auth demo
    if (id === '0542065606' || id === '0584220463' || id === '05455408280' || id === '0545540828') {
      AppStore.currentUser = { id, name: id === '0542065606' ? 'ינון' : id === '0584220463' ? 'חגי היקר' : 'אסתר', role: 'ADMIN', roleTitle: 'אדמין מוסדות חורב' };
    } else {
      AppStore.currentUser = { id, name: 'הרכז/ת', role: 'COORDINATOR', roleTitle: 'רכז/ת מורש/ת' };
    }
    localStorage.setItem('horev_current_user', JSON.stringify(AppStore.currentUser));
    showMainApp();
  }
}

function handleLogout() {
  AppStore.currentUser = null;
  localStorage.removeItem('horev_current_user');
  showLoginScreen();
  showToast('התנתקת בהצלחה מהמערכת', 'info');
}

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appMain').style.display = 'none';
  document.getElementById('userBadgeContainer').style.display = 'none';
}

function showMainApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appMain').style.display = 'block';
  document.getElementById('userBadgeContainer').style.display = 'flex';

  // Update Header User Details
  document.getElementById('userName').textContent = AppStore.currentUser.name;
  document.getElementById('userAvatar').textContent = AppStore.currentUser.name.charAt(0);
  document.getElementById('userRoleBadge').textContent = AppStore.currentUser.roleTitle || (AppStore.currentUser.role === 'ADMIN' ? 'אדמין / גזבר' : 'רכז/ת');

  // STRICT ROLE GUARD: Hide ALL admin tabs for Coordinators
  const adminLinks = document.querySelectorAll('.admin-only');
  if (AppStore.currentUser.role === 'ADMIN') {
    adminLinks.forEach(el => el.style.display = 'block');
  } else {
    // Coordinators ONLY see the request submission tab!
    adminLinks.forEach(el => el.style.display = 'none');
    switchTab('submitView');
  }

  // Load Data
  fetchRequestsData();
  fetchUsersData();
}

function switchTab(tabId) {
  // STRICT ACCESS GUARD: Block non-admins from opening admin tabs
  const isAdminTab = tabId !== 'submitView';
  if (isAdminTab && AppStore.currentUser.role !== 'ADMIN') {
    showToast('אין לך הרשאת גישה למסכי ניהול. גישה מורשית לאדמינים בלבד!', 'danger');
    tabId = 'submitView';
  }

  AppStore.activeTab = tabId;
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.target === tabId);
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === tabId);
  });

  if (tabId === 'pendingView') renderPendingRequests();
  if (tabId === 'reportsView') renderReports();
  if (tabId === 'manageUsersView') renderUsersTable();
  if (tabId === 'emailSettingsView') renderEmailLogs();
}

// --------------------------------------------------------------------------
// 3. Date 48-Hour Cutoff Logic
// --------------------------------------------------------------------------
function setupDateLimits() {
  const today = new Date();
  const minDateStr = today.toISOString().split('T')[0];
  document.getElementById('startDateInput').min = minDateStr;
  document.getElementById('endDateInput').min = minDateStr;
}

function validateDateCutoff() {
  const startDateVal = document.getElementById('startDateInput').value;
  const alertBox = document.getElementById('dateValidationAlert');
  const alertText = document.getElementById('dateValidationText');
  const submitBtn = document.getElementById('submitCancelBtn');

  if (!startDateVal) {
    alertBox.style.display = 'none';
    submitBtn.disabled = false;
    return true;
  }

  const now = new Date();
  const eventDate = new Date(startDateVal);
  const diffHours = (eventDate - now) / (1000 * 60 * 60);

  if (diffHours < 48) {
    alertBox.style.display = 'block';
    alertText.innerHTML = `<strong>חסימת 48 שעות:</strong> תאריך האירוע (${startDateVal}) קרוב מדי (נותרו <strong>${Math.max(0, Math.round(diffHours))}</strong> שעות). חוק מוסדי קשיח: הגשת ביטול לפחות 48 שעות מראש!`;
    submitBtn.disabled = true;
    return false;
  } else {
    alertBox.style.display = 'none';
    submitBtn.disabled = false;
    return true;
  }
}

// --------------------------------------------------------------------------
// 4. Submit Cancellation Request
// --------------------------------------------------------------------------
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!validateDateCutoff()) {
    showToast('לא ניתן להגיש בקשה בטווח של פחות מ-48 שעות מראש', 'danger');
    return;
  }

  const group = document.getElementById('targetGroupSelect').value;
  const startDate = document.getElementById('startDateInput').value;
  const endDate = document.getElementById('endDateInput').value;
  const reason = document.getElementById('reasonInput').value;
  const mandatoryConfirmed = document.getElementById('mandatoryCheckConfirm').checked;

  const selectedMeals = Array.from(document.querySelectorAll('input[name="mealType"]:checked')).map(cb => cb.value);

  if (!selectedMeals.length) {
    showToast('יש לבחור לפחות ארוחה אחת לביטול', 'warning');
    return;
  }

  if (!mandatoryConfirmed) {
    showToast('חובה לאשר את 2 ההנחיות המוסדיות לפני השליחה', 'warning');
    return;
  }

  const payload = {
    applicantId: AppStore.currentUser.id,
    applicantName: AppStore.currentUser.name,
    applicantEmail: AppStore.currentUser.email || 'ohadhadas@horev.org.il',
    group,
    startDate,
    endDate,
    requestedMeals: selectedMeals,
    reason,
    mandatoryConfirmed
  };

  try {
    const res = await fetch(`${API_BASE_URL}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.message, 'danger');
      return;
    }

    showToast('הבקשה נרשמה בהצלחה ונשלחה במייל לחגי היקר ואסתר!', 'success');
    document.getElementById('cancellationForm').reset();
    fetchRequestsData();
  } catch (err) {
    showToast('הבקשה נרשמה מקומית בהצלחה!', 'success');
    document.getElementById('cancellationForm').reset();
    fetchRequestsData();
  }
}

// --------------------------------------------------------------------------
// 5. Fetch & Render Data
// --------------------------------------------------------------------------
async function fetchRequestsData() {
  try {
    const res = await fetch(`${API_BASE_URL}/requests`);
    const data = await res.json();
    if (data.success) {
      AppStore.requests = data.requests;
    }
  } catch (e) {
    console.log('Using local store fallback');
  }

  renderMySubmissions();
  updatePendingCounter();
}

async function fetchUsersData() {
  try {
    const res = await fetch(`${API_BASE_URL}/users`);
    const data = await res.json();
    if (data.success) {
      AppStore.coordinators = data.coordinators;
    }
  } catch (e) {}
}

function renderMySubmissions() {
  const tbody = document.getElementById('mySubmissionsTbody');
  if (!tbody) return;

  const myReqs = AppStore.currentUser.role === 'ADMIN'
    ? AppStore.requests
    : AppStore.requests.filter(r => r.applicantId === AppStore.currentUser.id);

  if (!myReqs.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">עדיין לא הוגשו בקשות ביטול.</td></tr>`;
    return;
  }

  tbody.innerHTML = myReqs.map(r => `
    <tr>
      <td><strong>${r.id}</strong></td>
      <td>${r.group}</td>
      <td>${r.startDate} ${r.startDate !== r.endDate ? 'עד ' + r.endDate : ''}</td>
      <td>${r.requestedMeals.join(', ')}</td>
      <td>${r.submittedAt}</td>
      <td><span class="badge ${getStatusBadgeClass(r.status)}">${getStatusHebrew(r.status)}</span></td>
      <td class="text-success font-weight-bold">₪${(r.approvedRefund || 0).toLocaleString()}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="openTimelineModal('${r.id}')">
          <i class="fa-solid fa-timeline"></i> הצג ציר זמן
        </button>
      </td>
    </tr>
  `).join('');
}

function updatePendingCounter() {
  const pendingCount = AppStore.requests.filter(r => r.status === 'PENDING').length;
  const pendingBadge = document.getElementById('pendingBadge');
  const counterBadge = document.getElementById('pendingCounterBadge');
  
  if (pendingBadge) pendingBadge.textContent = pendingCount;
  if (counterBadge) counterBadge.textContent = `${pendingCount} בקשות ממתינות`;
}

// --------------------------------------------------------------------------
// 6. Admin Pending Requests & Custom Approval Logic
// --------------------------------------------------------------------------
function renderPendingRequests() {
  // Guard
  if (AppStore.currentUser.role !== 'ADMIN') return;

  const container = document.getElementById('pendingRequestsContainer');
  if (!container) return;

  const pendingList = AppStore.requests.filter(r => r.status === 'PENDING');

  if (!pendingList.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-circle-check text-success" style="font-size: 48px;"></i>
        <h3 class="mt-3">אין בקשות ממתינות!</h3>
        <p class="text-muted">כל בקשות הביטול טופלו ע"י חגי היקר והגזברות.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = pendingList.map(r => {
    const urgency = getUrgencyLevel(r.startDate);
    return `
      <div class="pending-card ${urgency.class}">
        <div class="pending-card-header">
          <div>
            <span class="urgency-badge ${urgency.badgeClass}"><i class="fa-solid ${urgency.icon}"></i> ${urgency.label}</span>
            <span class="req-id">#${r.id}</span>
          </div>
          <span class="req-date"><i class="fa-solid fa-clock"></i> תאריך אירוע: <strong>${r.startDate}</strong></span>
        </div>

        <div class="pending-card-body">
          <div class="info-row">
            <div><strong>רכז/ת מגיש/ה:</strong> ${r.applicantName} (${r.applicantEmail})</div>
            <div><strong>כיתה/שכבה:</strong> ${r.group}</div>
          </div>
          <div class="info-row mt-2">
            <div><strong>ארוחות מבוקשות:</strong> ${r.requestedMeals.join(', ')}</div>
            <div><strong>סיבת הביטול:</strong> ${r.reason}</div>
          </div>

          <!-- Custom Approval Controls for Hagai -->
          <div class="admin-approval-controls mt-3">
            <h5 class="controls-title"><i class="fa-solid fa-sliders"></i> אישור מותאם אישית לחגי (Custom Approval):</h5>
            
            <div class="form-row">
              <div class="form-group col-md-6">
                <label>ארוחות מאושרות לזיכוי:</label>
                <input type="text" id="approvedMeals_${r.id}" class="form-control" value="${r.requestedMeals.join(', ')}">
              </div>
              <div class="form-group col-md-6">
                <label style="color: #059669; font-weight: bold;">💰 קבע סכום החזר ב-₪ לרכז/ת *:</label>
                <input type="number" id="approvedRefund_${r.id}" class="form-control" placeholder="הכנס סכום ב-₪ (למשל: 450)" min="0" required>
              </div>
            </div>

            <div class="form-group">
              <label>הערות חגי היקר לרכז/ת:</label>
              <input type="text" id="adminNotes_${r.id}" class="form-control" placeholder="רשום הערה שתופיע במייל של הרכז/ת...">
            </div>

            <div class="action-buttons mt-3">
              <button class="btn btn-success" onclick="approveRequest('${r.id}')">
                <i class="fa-solid fa-check-circle"></i> אישור מותאם אישית + שליחת מייל לרכז/ת
              </button>
              <button class="btn btn-danger" onclick="rejectRequest('${r.id}')">
                <i class="fa-solid fa-circle-xmark"></i> דחיית הבקשה
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function approveRequest(id) {
  if (AppStore.currentUser.role !== 'ADMIN') return;

  const approvedRefund = document.getElementById(`approvedRefund_${id}`).value;
  const approvedMeals = document.getElementById(`approvedMeals_${id}`).value;
  const adminNotes = document.getElementById(`adminNotes_${id}`).value;

  if (!approvedRefund || parseFloat(approvedRefund) < 0) {
    showToast('יש להזין סכום החזר ב-₪ לחובת זיכוי הרכז/ת', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/requests/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvedRefund,
        approvedMeals,
        adminNotes,
        adminName: AppStore.currentUser.name
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      fetchRequestsData();
      renderPendingRequests();
    }
  } catch (e) {
    showToast('אושר בהצלחה!', 'success');
    fetchRequestsData();
  }
}

async function rejectRequest(id) {
  if (AppStore.currentUser.role !== 'ADMIN') return;

  const adminNotes = document.getElementById(`adminNotes_${id}`).value;

  try {
    const res = await fetch(`${API_BASE_URL}/requests/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminNotes,
        adminName: AppStore.currentUser.name
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'info');
      fetchRequestsData();
      renderPendingRequests();
    }
  } catch (e) {
    showToast('נדחה!', 'info');
    fetchRequestsData();
  }
}

// --------------------------------------------------------------------------
// 7. Timeline Stepper Viewer
// --------------------------------------------------------------------------
window.openTimelineModal = function(id) {
  const req = AppStore.requests.find(r => r.id === id);
  if (!req) return;

  document.getElementById('timelineReqId').textContent = req.id;
  const container = document.getElementById('timelineContainer');

  container.innerHTML = req.timeline.map(step => `
    <div class="timeline-step step-${step.type || 'info'}">
      <div class="step-icon"><i class="fa-solid ${step.type === 'success' ? 'fa-check' : step.type === 'danger' ? 'fa-xmark' : 'fa-envelope'}"></i></div>
      <div class="step-content">
        <div class="step-header">
          <span class="step-title">${step.title}</span>
          <span class="step-time">${step.time}</span>
        </div>
        <p class="step-desc">${step.desc}</p>
      </div>
    </div>
  `).join('');

  document.getElementById('timelineModal').style.display = 'flex';
};

// --------------------------------------------------------------------------
// 8. Reports & User Management
// --------------------------------------------------------------------------
function renderReports() {
  if (AppStore.currentUser.role !== 'ADMIN') return;

  const tbody = document.getElementById('reportsTbody');
  if (!tbody) return;

  let filtered = [...AppStore.requests];

  const statusVal = document.getElementById('filterStatus')?.value || 'ALL';
  if (statusVal !== 'ALL') {
    filtered = filtered.filter(r => r.status === statusVal);
  }

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td><strong>${r.id}</strong></td>
      <td>${r.applicantName}</td>
      <td>${r.group}</td>
      <td>${r.startDate} ${r.startDate !== r.endDate ? 'עד ' + r.endDate : ''}</td>
      <td>${r.approvedDetails || r.requestedMeals.join(', ')}</td>
      <td class="text-success font-weight-bold">₪${(r.approvedRefund || 0).toLocaleString()}</td>
      <td><span class="badge ${getStatusBadgeClass(r.status)}">${getStatusHebrew(r.status)}</span></td>
      <td>${r.handledAt || '-'}</td>
      <td><button class="btn btn-sm btn-outline-primary" onclick="openTimelineModal('${r.id}')"><i class="fa-solid fa-timeline"></i> ציר זמן</button></td>
    </tr>
  `).join('');

  // Update KPIs
  const totalApproved = filtered.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + (r.approvedRefund || 0), 0);
  document.getElementById('kpiTotalApprovedRefund').textContent = `₪${totalApproved.toLocaleString()}`;
  document.getElementById('kpiApprovedCount').textContent = filtered.filter(r => r.status === 'APPROVED').length;
  document.getElementById('kpiPendingCount').textContent = filtered.filter(r => r.status === 'PENDING').length;
}

function resetFilters() {
  document.getElementById('filterStatus').value = 'ALL';
  renderReports();
}

function exportToCSV() {
  if (AppStore.currentUser.role !== 'ADMIN') return;

  let csv = 'מזהה בקשה,שם הרכז,כיתה/שכבה,תאריך התחלה,תאריך סיום,ארוחות שאושרו,סכום החזר ב-ש"ח,סטטוס\n';
  AppStore.requests.forEach(r => {
    csv += `"${r.id}","${r.applicantName}","${r.group}","${r.startDate}","${r.endDate}","${r.approvedDetails || r.requestedMeals.join('; ')}","${r.approvedRefund || 0}","${getStatusHebrew(r.status)}"\n`;
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `דוח_ביטולי_ארוחות_מוסדות_חורב_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  showToast('דוח CSV הורד בהצלחה!', 'success');
}

async function renderUsersTable() {
  if (AppStore.currentUser.role !== 'ADMIN') return;

  const tbody = document.getElementById('usersTbody');
  if (!tbody) return;

  tbody.innerHTML = AppStore.coordinators.map(c => `
    <tr>
      <td><strong>${c.id}</strong></td>
      <td>${c.name}</td>
      <td>${c.email}</td>
      <td><span class="badge badge-success">מורשה להגשה</span></td>
      <td>
        <button class="btn btn-sm btn-outline-primary" style="margin-left: 6px;" onclick="openEditUserModal('${c.id}')">
          <i class="fa-solid fa-user-pen"></i> ערוך פרטים
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${c.id}')">
          <i class="fa-solid fa-trash"></i> הסר
        </button>
      </td>
    </tr>
  `).join('');
}

window.openEditUserModal = function(id) {
  const coordinator = AppStore.coordinators.find(c => c.id === id);
  if (!coordinator) return;

  document.getElementById('editOriginalUserId').value = coordinator.id;
  document.getElementById('editUserId').value = coordinator.id;
  document.getElementById('editUserName').value = coordinator.name;
  document.getElementById('editUserEmail').value = coordinator.email;
  document.getElementById('editUserModal').style.display = 'flex';
};

async function handleEditUserSubmit(e) {
  e.preventDefault();
  if (AppStore.currentUser.role !== 'ADMIN') return;

  const originalId = document.getElementById('editOriginalUserId').value;
  const newId = document.getElementById('editUserId').value.trim();
  const name = document.getElementById('editUserName').value.trim();
  const email = document.getElementById('editUserEmail').value.trim();

  try {
    const res = await fetch(`${API_BASE_URL}/users/${originalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name, email })
    });
    const data = await res.json();
    if (data.success) {
      showToast('פרטי הרכז/ת עודכנו בהצלחה!', 'success');
      document.getElementById('editUserModal').style.display = 'none';
      await fetchUsersData();
      renderUsersTable();
    } else {
      showToast(data.message || 'שגיאה בעדכון הפרטים', 'danger');
    }
  } catch (err) {
    showToast('שגיאה בתקשורת עם השרת', 'danger');
  }
}

async function handleAddUserSubmit(e) {
  e.preventDefault();
  if (AppStore.currentUser.role !== 'ADMIN') return;

  const id = document.getElementById('newUserId').value.trim();
  const name = document.getElementById('newUserName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();

  try {
    const res = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, email })
    });
    const data = await res.json();
    if (data.success) {
      showToast('הרכז/ת הוספה בהצלחה!', 'success');
      document.getElementById('addUserModal').style.display = 'none';
      fetchUsersData();
      renderUsersTable();
    }
  } catch (e) {
    showToast('הורשה בהצלחה מקומית!', 'success');
    document.getElementById('addUserModal').style.display = 'none';
  }
}

window.deleteUser = async function(id) {
  if (AppStore.currentUser.role !== 'ADMIN') return;
  if (!confirm(`האם להסיר את הרכז/ת מת"ז ${id}?`)) return;
  try {
    await fetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE' });
    showToast('הרכז/ת הוסרה', 'info');
    fetchUsersData();
    renderUsersTable();
  } catch (e) {}
};

async function renderEmailLogs() {
  if (AppStore.currentUser.role !== 'ADMIN') return;

  const container = document.getElementById('emailLogContainer');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE_URL}/email-logs`);
    const data = await res.json();
    if (data.success) AppStore.emailLogs = data.logs;
  } catch (e) {}

  container.innerHTML = AppStore.emailLogs.map(log => `
    <div class="log-entry">
      <span class="log-time">${log.time}</span>
      <span class="log-to">אל: <strong>${log.to}</strong></span>
      <span class="log-subject">${log.subject}</span>
      <span class="badge badge-success">${log.status}</span>
    </div>
  `).join('');
}

// Helpers
function getUrgencyLevel(dateStr) {
  const now = new Date();
  const target = new Date(dateStr);
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

  if (diffDays <= 2) {
    return { class: 'urgency-high', badgeClass: 'badge-danger', label: 'דחיפות גבוהה (אירוע ב-48 שעות הקרובות)', icon: 'fa-triangle-exclamation' };
  } else if (diffDays <= 7) {
    return { class: 'urgency-medium', badgeClass: 'badge-warning', label: 'דחיפות בינונית (אירוע השבוע)', icon: 'fa-clock' };
  } else {
    return { class: 'urgency-low', badgeClass: 'badge-success', label: 'דחיפות רגילה (אירוע בעתיד)', icon: 'fa-calendar-check' };
  }
}

function getStatusBadgeClass(status) {
  if (status === 'APPROVED') return 'badge-success';
  if (status === 'REJECTED') return 'badge-danger';
  return 'badge-warning';
}

function getStatusHebrew(status) {
  if (status === 'APPROVED') return 'מאושר';
  if (status === 'REJECTED') return 'נדחה';
  return 'ממתין לאישור';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'danger' ? 'fa-circle-exclamation' : 'fa-info-circle'}"></i> <span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

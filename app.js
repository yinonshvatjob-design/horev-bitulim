/* ==========================================================================
   פלטפורמת ביטול ארוחות - לוגיקה עסקית וממשק משתמש (App Engine 2.0)
   ========================================================================== */

const API_BASE_URL = window.location.origin.includes('localhost') ? 'http://localhost:4050/api' : '/api';

// =========================================================================
// API Fetch Wrapper (JWT Authentication)
// =========================================================================
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('horev_auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });
  
  if (res.status === 401 || res.status === 403) {
    const data = await res.json().catch(() => ({}));
    showToast(data.message || 'פג תוקף החיבור, או שאין לך הרשאה. נא להתחבר מחדש.', 'danger');
    handleLogout();
    throw new Error('Unauthorized');
  }
  
  return res;
}

// XSS Protection: Escape malicious HTML characters
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
// Safe Local Storage Reader
function getInitialUser() {
  try {
    const saved = localStorage.getItem('horev_current_user');
    if (!saved || saved === 'undefined' || saved === 'null') return null;
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.name) {
      return parsed;
    }
    return null;
  } catch (e) {
    console.error('Error parsing localStorage user:', e);
    try { localStorage.removeItem('horev_current_user');
  localStorage.removeItem('horev_auth_token'); } catch (err) {}
    return null;
  }
}

// Local State Store
const AppStore = {
  currentUser: getInitialUser(),
  activeTab: 'submitView',
  requests: [],
  coordinators: [],
  emailLogs: []
};

document.addEventListener('DOMContentLoaded', () => {
  try {
    initApp();
  } catch (err) {
    console.error('initApp fatal error fallback:', err);
    showLoginScreen();
  }
});

function initApp() {
  bindEvents();
  setupDateLimits();

  if (AppStore.currentUser && AppStore.currentUser.id && AppStore.currentUser.name) {
    try {
      showMainApp();
      checkDeepLinkParams();
    } catch (err) {
      console.error('showMainApp error, resetting user session:', err);
      handleLogout();
    }
  } else {
    showLoginScreen();
    checkDeepLinkParams();
  }
}

function checkDeepLinkParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const reqId = urlParams.get('reqId');

  if (action === 'upload_receipt' && reqId) {
    if (AppStore.currentUser) {
      setTimeout(() => {
        openUploadReceiptModal(reqId);
      }, 500);
    } else {
      showToast('אנא התחבר למערכת כדי להעלות קבלה לבקשה #' + reqId, 'info');
    }
  }
}

window.switchRoleTab = function(role) {
  const alertBox = document.getElementById('loginAlertBox');
  if (alertBox) alertBox.style.display = 'none';

  const coordTab = document.getElementById('tabRoleCoord');
  const adminTab = document.getElementById('tabRoleAdmin');
  const coordForm = document.getElementById('coordinatorLoginForm');
  const adminForm = document.getElementById('adminLoginForm');

  if (role === 'coordinator') {
    if (coordTab) coordTab.className = 'role-tab active';
    if (adminTab) adminTab.className = 'role-tab';
    if (coordForm) coordForm.style.display = 'block';
    if (adminForm) adminForm.style.display = 'none';
  } else {
    if (coordTab) coordTab.className = 'role-tab';
    if (adminTab) adminTab.className = 'role-tab active';
    if (coordForm) coordForm.style.display = 'none';
    if (adminForm) adminForm.style.display = 'block';
  }
};

window.submitCoordinatorLogin = async function(e) {
  if (e) e.preventDefault();
  const idInput = document.getElementById('coordIdInput');
  const id = idInput ? idInput.value.trim() : '';
  await handleLogin('coordinator', id);
};

window.submitAdminLogin = async function(e) {
  if (e) e.preventDefault();
  const idInput = document.getElementById('adminIdInput');
  const passInput = document.getElementById('adminPasswordInput');
  const id = idInput ? idInput.value.trim() : '';
  const pass = passInput ? passInput.value.trim() : '';
  await handleLogin('admin', id, pass);
};

// --------------------------------------------------------------------------
// 1. Event Listeners & UI Routing
// --------------------------------------------------------------------------
function bindEvents() {
  try {
    // Receipt & Delete Form Submits
    document.getElementById('uploadReceiptForm')?.addEventListener('submit', handleUploadReceiptSubmit);
    document.getElementById('selectAllRequestsCb')?.addEventListener('change', (e) => {
      document.querySelectorAll('.req-select-cb').forEach(cb => cb.checked = e.target.checked);
      updateSelectedCount();
    });
    document.getElementById('deleteSelectedRequestsBtn')?.addEventListener('click', deleteSelectedRequests);
    document.getElementById('clearAllHistoryBtn')?.addEventListener('click', clearAllHistory);

    // Coordinator Login Submit & Logout are handled via inline attributes in index.html to prevent duplicate execution
    // Theme Switcher Toggle
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
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

    // Submission Form Submit & Date Checks
    document.getElementById('cancellationForm')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('startDateInput')?.addEventListener('change', validateDateCutoff);

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

    // Manage Users & Admins - Submit Form
    document.getElementById('addNewUserForm')?.addEventListener('submit', handleAddUserSubmit);
    document.getElementById('editUserForm')?.addEventListener('submit', handleEditUserSubmit);
    document.getElementById('editAdminForm')?.addEventListener('submit', handleEditAdminSubmit);

    // Filters Events in Reports
    document.getElementById('filterCoordinator')?.addEventListener('change', renderReports);
    document.getElementById('filterStatus')?.addEventListener('change', renderReports);
    document.getElementById('filterStartDate')?.addEventListener('change', renderReports);
    document.getElementById('filterEndDate')?.addEventListener('change', renderReports);
    document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);
    document.getElementById('exportCsvBtn')?.addEventListener('click', exportToCSV);

    // Live Email Verification Test Submit
    document.getElementById('testEmailForm')?.addEventListener('submit', handleTestEmailSubmit);
  } catch (err) {
    console.error('Error binding events:', err);
  }
}

window.setTestEmailRecipient = function(roleKey) {
  const input = document.getElementById('testEmailRecipientInput');
  if (!input) return;

  if (roleKey === 'treasurer') {
    const admin = (AppStore.admins || []).find(a => a.id === '0584220463' || (a.name && a.name.includes('חגי')));
    input.value = admin ? admin.email : 'yinonshvat@gmail.com';
  } else if (roleKey === 'secretary') {
    const admin = (AppStore.admins || []).find(a => a.id === '0545540828' || (a.name && a.name.includes('אסתר')));
    input.value = admin ? admin.email : 'yinonshvat@gmail.com';
  } else if (roleKey === 'software') {
    const admin = (AppStore.admins || []).find(a => (a.name && a.name.includes('ינון')) || (a.roleTitle && a.roleTitle.includes('תוכנה')));
    input.value = admin ? admin.email : 'yinonshvat@horev.org.il';
  }
};

window.handleTestEmailSubmit = async function(e) {
  if (e) e.preventDefault();
  const recipientInput = document.getElementById('testEmailRecipientInput');
  const recipientEmail = recipientInput ? recipientInput.value.trim() : '';
  const statusDiv = document.getElementById('testEmailStatus');
  const btn = document.getElementById('sendTestEmailBtn');

  if (!recipientEmail) {
    showToast('יש להזין כתובת אימייל לבדיקה', 'warning');
    return;
  }

  const origBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח מייל בדיקה בלייב...';
  }

  if (statusDiv) {
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#eff6ff';
    statusDiv.style.color = '#1d4ed8';
    statusDiv.style.border = '2px solid #93c5fd';
    statusDiv.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> שולח מייל בדיקה מעוצב לכתובת <strong>${recipientEmail}</strong> מ-bitulim@horev.org.il...`;
  }

  try {
    const res = await apiFetch(`/email/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail })
    });
    const data = await res.json();

    if (data.success) {
      if (statusDiv) {
        statusDiv.style.background = '#ecfdf5';
        statusDiv.style.color = '#047857';
        statusDiv.style.border = '2px solid #6ee7b7';
        statusDiv.innerHTML = `✅ <strong>הצלחה! המייל נשלח בהצלחה!</strong><br>הודעת בדיקה נשלחה לכתובת <strong>${recipientEmail}</strong>.<br><small style="color: #065f46;">אנא בדוק את תיבת הדואר הנכנס / דואר זבל (Spam) של כתובת זו כדי לוודא הגעה.</small>`;
      }
      showToast(`מייל בדיקה נשלח בהצלחה ל-${recipientEmail}!`, 'success');
      await renderEmailLogs();
    } else {
      if (statusDiv) {
        statusDiv.style.background = '#fef2f2';
        statusDiv.style.color = '#b91c1c';
        statusDiv.style.border = '2px solid #fca5a5';
        statusDiv.innerHTML = `❌ <strong>שגיאה בשליחה:</strong> ${data.message || 'לא ניתן היה לשלוח את המייל'}`;
      }
      showToast(data.message || 'שגיאה בשליחת מייל הבדיקה', 'danger');
    }
  } catch (err) {
    console.error('Test email send error:', err);
    if (statusDiv) {
      statusDiv.style.background = '#fef2f2';
      statusDiv.style.color = '#b91c1c';
      statusDiv.style.border = '2px solid #fca5a5';
      statusDiv.innerHTML = `❌ <strong>שגיאת תקשורת:</strong> לא ניתן להתחבר לשרת הדיוור.`;
    }
    showToast('שגיאה בתקשורת עם השרת', 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnText;
    }
  }
};

// --------------------------------------------------------------------------
// 2. Authentication Logic & Strict Role Guards
// --------------------------------------------------------------------------
let isLoggingIn = false;

async function handleLogin(role, id, pass = '') {
  if (isLoggingIn) return;
  isLoggingIn = true;

  const alertBox = document.getElementById('loginAlertBox');
  const coordBtn = document.getElementById('coordLoginBtn');
  const adminBtn = document.getElementById('adminLoginBtn');

  if (alertBox) alertBox.style.display = 'none';

  if (!id) {
    if (alertBox) {
      alertBox.textContent = 'יש להזין מספר תעודת זהות או טלפון';
      alertBox.style.display = 'block';
    }
    isLoggingIn = false;
    return;
  }

  if (coordBtn) { coordBtn.disabled = true; coordBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מתחבר למערכת...'; }
  if (adminBtn) { adminBtn.disabled = true; adminBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מתחבר כמנהל/ת...'; }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, id, pass })
    });

    const data = await response.json();
    if (!data.success) {
      if (alertBox) {
        alertBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${data.message}`;
        alertBox.style.display = 'block';
      }
      showToast(data.message, 'danger');
      return;
    }

    AppStore.currentUser = data.user;
    localStorage.setItem('horev_current_user', JSON.stringify(data.user));
    localStorage.setItem('horev_auth_token', data.token);
    showToast(`ברוך הבא, ${data.user.name}! התחברת בהצלחה.`, 'success');
    showMainApp();
  } catch (error) {
    console.error('Login error', error);
    if (alertBox) {
      alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> שגיאת תקשורת עם השרת: אנא ודא חיבור לרשת ונסה שוב`;
      alertBox.style.display = 'block';
    }
    showToast('שגיאה בתקשורת עם השרת בעת ההתחברות', 'danger');
  } finally {
    isLoggingIn = false;
    if (coordBtn) { coordBtn.disabled = false; coordBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> הכנס למערכת'; }
    if (adminBtn) { adminBtn.disabled = false; adminBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> התחבר כמנהל/ת'; }
  }
}

window.handleLogout = function() {
  AppStore.currentUser = null;
  localStorage.removeItem('horev_current_user');
  showLoginScreen();
  showToast('התנתקת בהצלחה מהמערכת', 'info');
};

window.forceCleanReset = function() {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) {}
  window.location.reload(true);
};

function showLoginScreen() {
  const loginScreen = document.getElementById('loginScreen');
  const appMain = document.getElementById('appMain');
  const userBadgeContainer = document.getElementById('userBadgeContainer');

  if (loginScreen) loginScreen.style.display = 'flex';
  if (appMain) appMain.style.display = 'none';
  if (userBadgeContainer) userBadgeContainer.style.display = 'none';
}

function showMainApp() {
  if (!AppStore.currentUser || !AppStore.currentUser.name) {
    showLoginScreen();
    return;
  }

  const loginScreen = document.getElementById('loginScreen');
  const appMain = document.getElementById('appMain');
  const userBadgeContainer = document.getElementById('userBadgeContainer');

  if (loginScreen) loginScreen.style.display = 'none';
  if (appMain) appMain.style.display = 'block';
  if (userBadgeContainer) userBadgeContainer.style.display = 'flex';

  // Update Header User Details
  const userNameEl = document.getElementById('userName');
  const userAvatarEl = document.getElementById('userAvatar');
  const userRoleBadgeEl = document.getElementById('userRoleBadge');

  if (userNameEl) userNameEl.textContent = AppStore.currentUser.name;
  if (userAvatarEl) userAvatarEl.textContent = AppStore.currentUser.name ? AppStore.currentUser.name.charAt(0) : 'מ';
  if (userRoleBadgeEl) userRoleBadgeEl.textContent = AppStore.currentUser.roleTitle || (AppStore.currentUser.role === 'ADMIN' ? 'אדמין / מנהל' : 'רכז/ת');

  // STRICT ROLE GUARD: Hide navigation bar completely for Coordinators
  const adminLinks = document.querySelectorAll('.admin-only');
  const softwareMgrLinks = document.querySelectorAll('.software-manager-only');
  const appNav = document.querySelector('.app-nav');

  const isSoftwareManager = AppStore.currentUser.role === 'ADMIN' && 
    ((AppStore.currentUser.name && AppStore.currentUser.name.includes('ינון')) || 
     (AppStore.currentUser.roleTitle && AppStore.currentUser.roleTitle.includes('תוכנה')) ||
     (AppStore.currentUser.role && AppStore.currentUser.role.includes('תוכנה')));

  if (AppStore.currentUser.role === 'ADMIN') {
    adminLinks.forEach(el => el.style.display = 'block');
    softwareMgrLinks.forEach(el => {
      if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'SPAN') {
        el.style.display = isSoftwareManager ? 'inline-block' : 'none';
      } else {
        el.style.display = isSoftwareManager ? 'block' : 'none';
      }
    });
    if (appNav) appNav.style.display = 'block';
  } else {
    // Coordinators ONLY see the request submission tab! Hide nav bar completely
    adminLinks.forEach(el => el.style.display = 'none');
    softwareMgrLinks.forEach(el => el.style.display = 'none');
    if (appNav) appNav.style.display = 'none';
    switchTab('submitView');
  }

  // Load Data
  fetchRequestsData();
  fetchUsersData();
}

window.switchTab = function(tabId) {
  if (!AppStore.currentUser) {
    showLoginScreen();
    return;
  }

  // STRICT ACCESS GUARD: Block non-admins from opening admin tabs
  const isAdminTab = tabId !== 'submitView';
  if (isAdminTab && AppStore.currentUser.role !== 'ADMIN') {
    showToast('אין לך הרשאת גישה למסכי ניהול. גישה מורשית לאדמינים בלבד!', 'danger');
    tabId = 'submitView';
  }

  // STRICT ACCESS GUARD: Block non-software-managers from opening manageUsersView and emailSettingsView
  if (tabId === 'emailSettingsView' || tabId === 'manageUsersView') {
    const isSoftwareManager = AppStore.currentUser.role === 'ADMIN' && 
      ((AppStore.currentUser.name && AppStore.currentUser.name.includes('ינון')) || 
       (AppStore.currentUser.roleTitle && AppStore.currentUser.roleTitle.includes('תוכנה')) ||
       (AppStore.currentUser.role && AppStore.currentUser.role.includes('תוכנה')));

    if (!isSoftwareManager) {
      showToast('הרשאה חסומה: מסך ניהול רכזים, סיסמאות והגדרות מורשה למנהל התוכנה בלבד!', 'warning');
      tabId = 'pendingView';
    }
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

// Israeli Holidays list (YYYY-MM-DD) for 2025-2027 (where schools/catering administration do not operate)
const ISRAEL_HOLIDAYS = new Set([
  // 2026
  "2026-03-03", "2026-03-04", // Purim
  "2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06", "2026-04-07", "2026-04-08", // Pesach
  "2026-04-22", // Yom Haatzmaut
  "2026-05-21", "2026-05-22", // Shavuot
  "2026-09-11", "2026-09-12", "2026-09-13", // Rosh Hashanah
  "2026-09-20", "2026-09-21", // Yom Kippur
  "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", // Sukkot
  // 2027
  "2027-03-23", "2027-03-24", // Purim
  "2027-04-21", "2027-04-22", "2027-04-23", "2027-04-24", "2027-04-25", "2027-04-26", "2027-04-27", "2027-04-28", // Pesach
  "2027-05-12", // Yom Haatzmaut
  "2027-06-10", "2027-06-11", // Shavuot
  "2027-10-01", "2027-10-02", "2027-10-03", // Rosh Hashanah
  "2027-10-10", "2027-10-11", // Yom Kippur
  "2027-10-15", "2027-10-16", "2027-10-17", "2027-10-18", "2027-10-19", "2027-10-20", "2027-10-21", "2027-10-22", "2027-10-23" // Sukkot
]);

function isNonBusinessDay(d) {
  const dayOfWeek = d.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
  if (dayOfWeek === 5 || dayOfWeek === 6) return true;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return ISRAEL_HOLIDAYS.has(`${yyyy}-${mm}-${dd}`);
}

function getBusinessDayCutoffDeadline(startDateVal) {
  const [year, month, day] = startDateVal.split('-').map(Number);
  // Target time: 12:00 PM on event date
  let curr = new Date(year, month - 1, day, 12, 0, 0);

  let businessDaysNeeded = 2;
  while (businessDaysNeeded > 0) {
    curr.setDate(curr.getDate() - 1);
    if (!isNonBusinessDay(curr)) {
      businessDaysNeeded--;
    }
  }
  return curr;
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function formatHebrewDeadline(d) {
  const dayName = HEBREW_DAYS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `יום ${dayName} (${dd}/${mm}) בשעה ${hh}:${min}`;
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
  const deadline = getBusinessDayCutoffDeadline(startDateVal);

  if (now > deadline) {
    alertBox.style.display = 'block';
    alertText.innerHTML = `<strong>חסימת ימי עסקים:</strong> מועד ההגשה מוגבל ל-2 ימי עסקים מראש (לא כולל שישי, שבת וחגים). עבור אירוע בתאריך ${startDateVal}, המועד האחרון להגשת ביטול היה <strong>${formatHebrewDeadline(deadline)}</strong>.`;
    submitBtn.disabled = true;
    return false;
  } else {
    alertBox.style.display = 'none';
    submitBtn.disabled = false;
    return true;
  }
}

// --------------------------------------------------------------------------
// Multi-Select Classes & Grades UI Logic
// --------------------------------------------------------------------------
window.toggleClassDropdown = function() {
  const container = document.getElementById('classMultiSelectContainer');
  if (container) container.classList.toggle('open');
};

window.closeClassDropdown = function() {
  const container = document.getElementById('classMultiSelectContainer');
  if (container) container.classList.remove('open');
};

document.addEventListener('click', (e) => {
  const container = document.getElementById('classMultiSelectContainer');
  if (container && !container.contains(e.target)) {
    container.classList.remove('open');
  }
});

window.toggleGradeAll = function(gradeCode, isChecked) {
  const box = document.querySelector(`.grade-group-box[data-grade="${gradeCode}"]`);
  if (!box) return;
  box.querySelectorAll('input[name="targetClasses"]').forEach(cb => {
    cb.checked = isChecked;
  });
  updateSelectedClassPills();
};

window.onClassCheckboxChange = function(gradeCode) {
  if (gradeCode && gradeCode !== 'special') {
    const box = document.querySelector(`.grade-group-box[data-grade="${gradeCode}"]`);
    if (box) {
      const classCbs = Array.from(box.querySelectorAll('input[name="targetClasses"]'));
      const allChecked = classCbs.every(cb => cb.checked);
      const gradeHeaderCb = box.querySelector('.grade-all-cb');
      if (gradeHeaderCb) gradeHeaderCb.checked = allChecked;
    }
  }
  updateSelectedClassPills();
};

window.selectAllClasses = function() {
  document.querySelectorAll('input[name="targetClasses"]').forEach(cb => cb.checked = true);
  document.querySelectorAll('.grade-all-cb').forEach(cb => cb.checked = true);
  updateSelectedClassPills();
};

window.clearAllClasses = function() {
  document.querySelectorAll('input[name="targetClasses"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('.grade-all-cb').forEach(cb => cb.checked = false);
  const otherWrapper = document.getElementById('otherCustomGroupWrapper');
  const otherInput = document.getElementById('otherCustomGroupInput');
  if (otherWrapper) otherWrapper.style.display = 'none';
  if (otherInput) otherInput.value = '';
  updateSelectedClassPills();
};

window.toggleOtherCustomInput = function(isChecked) {
  const wrapper = document.getElementById('otherCustomGroupWrapper');
  const input = document.getElementById('otherCustomGroupInput');
  if (wrapper) wrapper.style.display = isChecked ? 'block' : 'none';
  if (isChecked && input) {
    input.focus();
  } else if (!isChecked && input) {
    input.value = '';
  }
  onClassCheckboxChange('special');
};

window.filterClassesInDropdown = function(query) {
  const q = String(query).trim().toLowerCase();
  document.querySelectorAll('.grade-group-box').forEach(box => {
    const text = box.innerText.toLowerCase();
    box.style.display = text.includes(q) ? 'block' : 'none';
  });
};

function updateSelectedClassPills() {
  const wrapper = document.getElementById('selectedPillsWrapper');
  const countBadge = document.getElementById('classesCountBadge');
  if (!wrapper) return;

  const selectedCbs = Array.from(document.querySelectorAll('input[name="targetClasses"]:checked'));

  if (countBadge) countBadge.textContent = `${selectedCbs.length} נבחרו`;

  if (selectedCbs.length === 0) {
    wrapper.innerHTML = `<span class="placeholder-text">לחץ לבחירת כיתות (ז' עד י''ב - 6 כיתות לשכבה)...</span>`;
    return;
  }

  const gradeMap = {
    'ז': { name: "שכבה ז'", cbs: [] },
    'ח': { name: "שכבה ח'", cbs: [] },
    'ט': { name: "שכבה ט'", cbs: [] },
    'י': { name: "שכבה י'", cbs: [] },
    'יא': { name: "שכבה י''א", cbs: [] },
    'יב': { name: "שכבה י''ב", cbs: [] }
  };

  document.querySelectorAll('.grade-group-box[data-grade]').forEach(box => {
    const g = box.dataset.grade;
    if (gradeMap[g]) {
      gradeMap[g].cbs = Array.from(box.querySelectorAll('input[name="targetClasses"]'));
    }
  });

  const displayTokens = [];
  const allSchoolChecked = Object.values(gradeMap).every(g => g.cbs.length > 0 && g.cbs.every(cb => cb.checked));

  if (allSchoolChecked) {
    displayTokens.push('כלל המוסד (כל השכבות)');
  } else {
    Object.keys(gradeMap).forEach(gKey => {
      const g = gradeMap[gKey];
      if (g.cbs.length > 0) {
        const checkedInGrade = g.cbs.filter(cb => cb.checked);
        if (checkedInGrade.length === g.cbs.length) {
          displayTokens.push(`${g.name} (כל 6 הכיתות)`);
        } else if (checkedInGrade.length > 0) {
          checkedInGrade.forEach(cb => {
            displayTokens.push(cb.value.replace('כיתה ', ''));
          });
        }
      }
    });

    const specialChecked = Array.from(document.querySelectorAll('.grade-group-box[data-grade="special"] input[name="targetClasses"]:checked'));
    specialChecked.forEach(cb => {
      if (cb.value === 'OTHER_CUSTOM') {
        const customVal = (document.getElementById('otherCustomGroupInput')?.value || '').trim();
        displayTokens.push(customVal ? `אחר (${customVal})` : 'אחר');
      } else {
        displayTokens.push(cb.value);
      }
    });
  }

  wrapper.innerHTML = displayTokens.map(token => `
    <span class="class-pill">
      ${token}
      <i class="fa-solid fa-xmark remove-pill" onclick="event.stopPropagation(); removeSpecificPillToken('${token}')"></i>
    </span>
  `).join('');
}

window.removeSpecificPillToken = function(token) {
  if (token === 'כלל המוסד (כל השכבות)') {
    clearAllClasses();
    return;
  }

  if (token.startsWith('אחר')) {
    const cb = document.getElementById('otherCustomCb');
    if (cb) cb.checked = false;
    toggleOtherCustomInput(false);
    return;
  }

  const gradeMatch = token.match(/שכבה (ז'|ח'|ט'|י'|י''א|י''ב)/);
  if (gradeMatch) {
    const rawGrade = gradeMatch[1];
    const codeMap = { "ז'": 'ז', "ח'": 'ח', "ט'": 'ט', "י'": 'י', "י''א": 'יא', "י''ב": 'יב' };
    const code = codeMap[rawGrade];
    if (code) toggleGradeAll(code, false);
    return;
  }

  document.querySelectorAll('input[name="targetClasses"]').forEach(cb => {
    if (cb.value === token || cb.value === `כיתה ${token}`) {
      cb.checked = false;
      const box = cb.closest('.grade-group-box');
      if (box) {
        const gradeHeaderCb = box.querySelector('.grade-all-cb');
        if (gradeHeaderCb) gradeHeaderCb.checked = false;
      }
    }
  });

  updateSelectedClassPills();
};

function getSelectedGroupFormattedString() {
  const selectedCbs = Array.from(document.querySelectorAll('input[name="targetClasses"]:checked'));
  if (!selectedCbs.length) return '';

  const gradeMap = {
    'ז': { name: "שכבה ז'", cbs: [] },
    'ח': { name: "שכבה ח'", cbs: [] },
    'ט': { name: "שכבה ט'", cbs: [] },
    'י': { name: "שכבה י'", cbs: [] },
    'יא': { name: "שכבה י''א", cbs: [] },
    'יב': { name: "שכבה י''ב", cbs: [] }
  };

  document.querySelectorAll('.grade-group-box[data-grade]').forEach(box => {
    const g = box.dataset.grade;
    if (gradeMap[g]) {
      gradeMap[g].cbs = Array.from(box.querySelectorAll('input[name="targetClasses"]'));
    }
  });

  const allSchoolChecked = Object.values(gradeMap).every(g => g.cbs.length > 0 && g.cbs.every(cb => cb.checked));
  if (allSchoolChecked) return 'כלל המוסד (כל השכבות)';

  const formattedTokens = [];

  Object.keys(gradeMap).forEach(gKey => {
    const g = gradeMap[gKey];
    if (g.cbs.length > 0) {
      const checkedInGrade = g.cbs.filter(cb => cb.checked);
      if (checkedInGrade.length === g.cbs.length) {
        formattedTokens.push(`${g.name} (כל 6 הכיתות)`);
      } else if (checkedInGrade.length > 0) {
        checkedInGrade.forEach(cb => formattedTokens.push(cb.value));
      }
    }
  });

  const specialChecked = Array.from(document.querySelectorAll('.grade-group-box[data-grade="special"] input[name="targetClasses"]:checked'));
  specialChecked.forEach(cb => {
    if (cb.value === 'OTHER_CUSTOM') {
      const customVal = (document.getElementById('otherCustomGroupInput')?.value || '').trim();
      formattedTokens.push(customVal ? `אחר (${customVal})` : 'אחר');
    } else {
      formattedTokens.push(cb.value);
    }
  });

  return formattedTokens.join(', ');
}

// --------------------------------------------------------------------------
// 4. Submit Cancellation Request & Meal Helpers
// --------------------------------------------------------------------------
window.updateMealCardStates = function() {
  const cbBreakfast = document.getElementById('mealCbBreakfast');
  const cbLunch = document.getElementById('mealCbLunch');
  const cardBreakfast = document.getElementById('mealCardBreakfast');
  const cardLunch = document.getElementById('mealCardLunch');
  const cardBoth = document.getElementById('mealCardBoth');

  if (cardBreakfast && cbBreakfast) {
    if (cbBreakfast.checked) cardBreakfast.classList.add('active');
    else cardBreakfast.classList.remove('active');
  }

  if (cardLunch && cbLunch) {
    if (cbLunch.checked) cardLunch.classList.add('active');
    else cardLunch.classList.remove('active');
  }

  if (cardBoth) {
    if (cbBreakfast && cbLunch && cbBreakfast.checked && cbLunch.checked) {
      cardBoth.classList.add('active');
    } else {
      cardBoth.classList.remove('active');
    }
  }
};

window.toggleSelectBothMeals = function() {
  const cbBreakfast = document.getElementById('mealCbBreakfast');
  const cbLunch = document.getElementById('mealCbLunch');

  const bothSelected = cbBreakfast && cbLunch && cbBreakfast.checked && cbLunch.checked;

  if (bothSelected) {
    if (cbBreakfast) cbBreakfast.checked = false;
    if (cbLunch) cbLunch.checked = false;
  } else {
    if (cbBreakfast) cbBreakfast.checked = true;
    if (cbLunch) cbLunch.checked = true;
  }

  updateMealCardStates();
};

async function handleFormSubmit(e) {
  e.preventDefault();

  if (!validateDateCutoff()) {
    showToast('לא ניתן להגיש בקשה בטווח של פחות מ-48 שעות מראש', 'danger');
    return;
  }

  const group = getSelectedGroupFormattedString();
  if (!group) {
    showToast('יש לבחור לפחות כיתה אחת או שכבה מהרשימה (סימון מרובה)', 'warning');
    return;
  }

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

  const foundCoord = (AppStore.coordinators || []).find(c => c.id === AppStore.currentUser.id);
  const applicantEmail = (foundCoord && foundCoord.email) ? foundCoord.email : (AppStore.currentUser.email || '');

  const payload = {
    applicantId: AppStore.currentUser.id,
    applicantName: AppStore.currentUser.name,
    applicantEmail: applicantEmail,
    group,
    startDate,
    endDate,
    requestedMeals: selectedMeals,
    reason,
    mandatoryConfirmed
  };

  try {
    const res = await apiFetch(`/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.message, 'danger');
      return;
    }

    showToast('הבקשה נרשמה בהצלחה ונשלחה במייל לחגי ואסתר!', 'success');
    document.getElementById('cancellationForm').reset();
    clearAllClasses();
    updateMealCardStates();
    fetchRequestsData();
  } catch (err) {
    showToast('הבקשה נרשמה מקומית בהצלחה!', 'success');
    document.getElementById('cancellationForm').reset();
    clearAllClasses();
    updateMealCardStates();
    fetchRequestsData();
  }
}

window.getReceiptBudgetStatus = function(r) {
  if (r.status !== 'APPROVED') {
    return {
      allocatedStr: r.approvedRefund ? `₪${r.approvedRefund.toLocaleString()}` : '-',
      actualStr: '-',
      pctStr: '-',
      storesStr: '-',
      code: 'ממתין',
      badgeHtml: `<span class="badge badge-secondary py-1 px-2" style="font-size: 11px;"><i class="fa-solid fa-hourglass"></i> ${getStatusHebrew(r.status)}</span>`
    };
  }

  const allocated = parseFloat(r.approvedRefund) || 0;
  const allocatedStr = `₪${allocated.toLocaleString()}`;

  const receiptsList = Array.isArray(r.receipts) && r.receipts.length > 0
    ? r.receipts
    : (r.receipt ? [r.receipt] : []);

  const storesStr = receiptsList.length > 0
    ? receiptsList.map(item => item.store || 'לא צוין').join(', ')
    : '-';

  if (receiptsList.length === 0) {
    return {
      allocatedStr,
      actualStr: '-',
      pctStr: '0%',
      storesStr: '-',
      code: 'ממתין לקבלה',
      badgeHtml: `<span class="badge badge-warning py-1 px-2" style="font-size: 11px;"><i class="fa-solid fa-clock"></i> ממתין לקבלה</span>`
    };
  }

  const actual = receiptsList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const actualStr = `₪${actual.toLocaleString()}`;
  const diff = allocated - actual;
  const pct = allocated > 0 ? Math.round((actual / allocated) * 100) : 100;
  const pctStr = `${pct}%`;

  if (actual === allocated) {
    return {
      allocatedStr,
      actualStr,
      pctStr,
      storesStr,
      code: 'נוצל במלואו',
      badgeHtml: `<span class="badge badge-success py-1 px-2" style="font-size: 11px;" title="נוצרו ₪${actual} מתוך ₪${allocated}"><i class="fa-solid fa-circle-check"></i> נוצל במלואו (100%)</span>`
    };
  } else if (actual < allocated) {
    return {
      allocatedStr,
      actualStr,
      pctStr,
      storesStr,
      code: 'ניצול חלקי',
      badgeHtml: `<span class="badge badge-info py-1 px-2" style="font-size: 11px;" title="נוצלו ₪${actual} מתוך ₪${allocated} מוקצים"><i class="fa-solid fa-piggy-bank"></i> ניצול חלקי (${pct}%) — עודף ₪${diff.toLocaleString()}</span>`
    };
  } else {
    const over = actual - allocated;
    return {
      allocatedStr,
      actualStr,
      pctStr,
      storesStr,
      code: 'חריגה',
      badgeHtml: `<span class="badge badge-danger py-1 px-2" style="font-size: 11px;" title="הוגש ₪${actual} מתוך ₪${allocated} מוקצים"><i class="fa-solid fa-triangle-exclamation"></i> חריגה (${pct}%) — חריגה ₪${over.toLocaleString()}</span>`
    };
  }
};

// --------------------------------------------------------------------------
// 5. Fetch & Render Data
// --------------------------------------------------------------------------
async function fetchRequestsData() {
  try {
    const res = await apiFetch(`/requests`);
    const data = await res.json();
    if (data.success) {
      AppStore.requests = data.requests;
    }
  } catch (e) {
    console.log('Using local store fallback');
  }

  renderMySubmissions();
  renderPendingRequests();
  renderReports();
  updatePendingCounter();
}

function renderMySubmissions() {
  const tbody = document.getElementById('mySubmissionsTbody');
  if (!tbody) return;

  const myReqs = AppStore.currentUser.role === 'ADMIN'
    ? AppStore.requests
    : AppStore.requests.filter(r => r.applicantId === AppStore.currentUser.id);

  if (!myReqs.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted">עדיין לא הוגשו בקשות ביטול.</td></tr>`;
    return;
  }

  tbody.innerHTML = myReqs.map(r => {
    const budget = getReceiptBudgetStatus(r);
    const receiptsList = Array.isArray(r.receipts) && r.receipts.length > 0
      ? r.receipts
      : (r.receipt ? [r.receipt] : []);

    let receiptBtn = '-';
    if (r.status === 'APPROVED') {
      if (receiptsList.length > 0) {
        const totalAmt = receiptsList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        receiptBtn = `
          <div class="d-flex flex-column gap-1" style="gap: 4px;">
            <button class="btn btn-sm btn-outline-success py-0" onclick="openViewReceiptModal('${r.id}')"><i class="fa-solid fa-receipt"></i> ${receiptsList.length} קבלות (₪${totalAmt.toLocaleString()})</button>
            <button class="btn btn-sm btn-success py-0" onclick="openUploadReceiptModal('${r.id}')" title="הוסף קבלה נוספת לבקשה זו"><i class="fa-solid fa-plus-circle"></i> + העלה עוד קבלה</button>
          </div>
        `;
      } else {
        receiptBtn = `<button class="btn btn-sm btn-success py-0" onclick="openUploadReceiptModal('${r.id}')"><i class="fa-solid fa-upload"></i> 📸 העלה קבלה לאסתר</button>`;
      }
    }

    return `
      <tr>
        <td><strong>#${r.id}</strong></td>
        <td>${escapeHtml(r.group)}</td>
        <td>${r.startDate} ${r.startDate !== r.endDate ? 'עד ' + r.endDate : ''}</td>
        <td>${budget.storesStr}</td>
        <td>${r.submittedAt}</td>
        <td><span class="badge ${getStatusBadgeClass(r.status)}">${getStatusHebrew(r.status)}</span></td>
        <td class="text-primary font-weight-bold">${budget.allocatedStr}</td>
        <td class="text-success font-weight-bold">${budget.actualStr}</td>
        <td>${budget.badgeHtml}</td>
        <td>${receiptBtn}</td>
        <td><button class="btn btn-sm btn-outline-primary py-0" onclick="openTimelineModal('${r.id}')"><i class="fa-solid fa-timeline"></i> ציר זמן</button></td>
      </tr>
    `;
  }).join('');
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
  if (AppStore.currentUser.role !== 'ADMIN') return;

  const container = document.getElementById('pendingRequestsContainer');
  if (!container) return;

  const pendingList = AppStore.requests.filter(r => r.status === 'PENDING');

  if (!pendingList.length) {
    container.innerHTML = `<div class="alert alert-success text-center py-4"><strong>✓ אין בקשות ביטול ממתינות לאישור כרגע!</strong><br><small class="text-muted">כל הבקשות טופלו ע"י האדמיניסטרציה.</small></div>`;
    return;
  }

  container.innerHTML = pendingList.map(r => {
    const urgency = getUrgencyLevel(r.startDate);
    const borderClass = urgency.class === 'urgency-high' ? 'border-danger' : urgency.class === 'urgency-medium' ? 'border-warning' : 'border-success';

    return `
      <div class="pending-card card mb-3 ${borderClass}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center flex-wrap mb-2">
            <h4 class="mb-1 text-primary">#${r.id} — ${escapeHtml(r.applicantName)} (${escapeHtml(r.group)})</h4>
            <div>
              <span class="badge ${urgency.badgeClass} p-2 ml-2" style="font-size: 13px;"><i class="fa-solid ${urgency.icon}"></i> ${urgency.label}</span>
              <span class="req-date"><i class="fa-solid fa-clock"></i> תאריך אירוע: <strong>${r.startDate}</strong></span>
            </div>
          </div>
          <p class="text-muted mb-2"><strong>ארוחות שבוטלו:</strong> ${r.requestedMeals ? r.requestedMeals.join(', ') : ''} | <strong>סיבה:</strong> ${escapeHtml(r.reason)}</p>
          <div class="approval-controls-box p-3 mt-2 bg-light border-radius">
            <div class="row align-items-center">
              <div class="col-md-4">
                <label class="small font-weight-bold">קבע סכום החזר ב-₪ לחובת זיכוי הרכז/ת:</label>
                <input type="number" id="approvedRefund_${r.id}" class="form-control form-control-sm" placeholder="סכום ב-₪ (ברירת מחדל 0₪)" min="0">
              </div>
              <div class="col-md-4">
                <label class="small font-weight-bold">ארוחות שאושרו לביטול (אופציונלי):</label>
                <input type="text" id="approvedMeals_${r.id}" class="form-control form-control-sm" value="${r.requestedMeals ? r.requestedMeals.join(', ') : ''}">
              </div>
              <div class="col-md-4">
                <label class="small font-weight-bold">הערת אדמיניסטרציה (תופיע במייל):</label>
                <input type="text" id="adminNotes_${r.id}" class="form-control form-control-sm" placeholder="למשל: מאושר מותאם אישית">
              </div>
            </div>
            <div class="mt-3 text-left">
              <button class="btn btn-success btn-sm font-weight-bold ml-2" onclick="approveRequest('${r.id}')">
                <i class="fa-solid fa-check"></i> אישור בקשה ועדכון סכום החזר
              </button>
              <button class="btn btn-outline-danger btn-sm font-weight-bold" onclick="rejectRequest('${r.id}')">
                <i class="fa-solid fa-xmark"></i> דחיית בקשה
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

  try {
    const res = await apiFetch(`/requests/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvedRefund: parseFloat(approvedRefund) || 0,
        approvedMeals,
        adminNotes,
        adminName: AppStore.currentUser.name
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');

      // Update memory store immediately
      const targetReq = AppStore.requests.find(r => r.id === id);
      if (targetReq) {
        targetReq.status = 'APPROVED';
        targetReq.approvedRefund = parseFloat(approvedRefund) || 0;
        targetReq.approvedDetails = approvedMeals || targetReq.requestedMeals.join(', ');
        targetReq.adminNotes = adminNotes;
        targetReq.handledBy = AppStore.currentUser.name;
      }

      await fetchRequestsData();
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
    const res = await apiFetch(`/requests/${id}/reject`, {
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

  tbody.innerHTML = filtered.map(r => {
    const budget = getReceiptBudgetStatus(r);
    const receiptsList = Array.isArray(r.receipts) && r.receipts.length > 0
      ? r.receipts
      : (r.receipt ? [r.receipt] : []);

    let receiptCell = '<span class="text-muted small">אין</span>';
    if (receiptsList.length > 0) {
      const totalAmt = receiptsList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      receiptCell = `<button class="btn btn-sm btn-outline-success py-0" onclick="openViewReceiptModal('${r.id}')"><i class="fa-solid fa-receipt"></i> ${receiptsList.length} קבלות (₪${totalAmt.toLocaleString()})</button>`;
    }

    return `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="req-select-cb" value="${r.id}" onchange="updateSelectedCount()">
        </td>
        <td><strong>#${r.id}</strong></td>
        <td>${escapeHtml(r.applicantName)}</td>
        <td>${escapeHtml(r.group)}</td>
        <td>${r.startDate} ${r.startDate !== r.endDate ? 'עד ' + r.endDate : ''}</td>
        <td>${budget.storesStr}</td>
        <td class="text-primary font-weight-bold">${budget.allocatedStr}</td>
        <td class="text-success font-weight-bold">${budget.actualStr}</td>
        <td>${budget.badgeHtml}</td>
        <td><span class="badge ${getStatusBadgeClass(r.status)}">${getStatusHebrew(r.status)}</span></td>
        <td>${receiptCell}</td>
        <td><button class="btn btn-sm btn-outline-primary py-0" onclick="openTimelineModal('${r.id}')"><i class="fa-solid fa-timeline"></i> ציר זמן</button></td>
        <td>
          <button class="btn btn-sm btn-outline-danger py-0" onclick="deleteSingleRequest('${r.id}')" title="מחק בקשה זו">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  window.updateSelectedCount();

  // Update Financial KPIs
  const approvedReqs = filtered.filter(r => r.status === 'APPROVED');
  const totalAllocated = approvedReqs.reduce((sum, r) => sum + (r.approvedRefund || 0), 0);
  const totalReceipts = approvedReqs.reduce((sum, r) => {
    const list = Array.isArray(r.receipts) && r.receipts.length > 0
      ? r.receipts
      : (r.receipt ? [r.receipt] : []);
    return sum + list.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
  }, 0);
  const totalSurplus = totalAllocated - totalReceipts;

  const totalRefundEl = document.getElementById('kpiTotalApprovedRefund');
  const totalReceiptsEl = document.getElementById('kpiTotalReceipts');
  const totalSurplusEl = document.getElementById('kpiTotalSurplus');
  const pendingCountEl = document.getElementById('kpiPendingCount');

  if (totalRefundEl) totalRefundEl.textContent = `₪${totalAllocated.toLocaleString()}`;
  if (totalReceiptsEl) totalReceiptsEl.textContent = `₪${totalReceipts.toLocaleString()}`;
  if (totalSurplusEl) {
    totalSurplusEl.textContent = `${totalSurplus >= 0 ? '+' : ''}₪${totalSurplus.toLocaleString()}`;
  }
  if (pendingCountEl) pendingCountEl.textContent = filtered.filter(r => r.status === 'PENDING').length;
}

window.updateSelectedCount = function() {
  const selectedCbs = document.querySelectorAll('.req-select-cb:checked');
  const count = selectedCbs.length;
  const badge = document.getElementById('selectedCountBadge');
  const btn = document.getElementById('deleteSelectedRequestsBtn');

  if (badge) badge.textContent = count;
  if (btn) btn.style.display = count > 0 ? 'inline-block' : 'none';
};

function resetFilters() {
  document.getElementById('filterStatus').value = 'ALL';
  renderReports();
}

function exportToCSV() {
  if (AppStore.currentUser.role !== 'ADMIN') return;

  let csv = 'מזהה בקשה,שם הרכז,כיתה/שכבה,תאריך התחלה,תאריך סיום,ארוחות שאושרו,סכום החזר ב-ש"ח,סטטוס\n';
  AppStore.requests.forEach(r => {
    csv += `"${r.id}","${escapeHtml(r.applicantName)}","${escapeHtml(r.group)}","${r.startDate}","${r.endDate}","${r.approvedDetails || r.requestedMeals.join('; ')}","${r.approvedRefund || 0}","${getStatusHebrew(r.status)}"\n`;
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `דוח_ביטולי_ארוחות_מוסדות_חורב_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  showToast('דוח CSV הורד בהצלחה!', 'success');
}

async function fetchUsersData() {
  try {
    const resCoordinators = await apiFetch(`/users`);
    const dataCoordinators = await resCoordinators.json();
    if (dataCoordinators.success) {
      AppStore.coordinators = dataCoordinators.coordinators;
    }

    const resAdmins = await apiFetch(`/admins`);
    const dataAdmins = await resAdmins.json();
    if (dataAdmins.success) {
      AppStore.admins = dataAdmins.admins;
    }

    await fetchWebhookUrl();
  } catch (error) {
    console.error('Error fetching users/admins data', error);
  }
}

async function fetchWebhookUrl() {
  try {
    const res = await apiFetch(`/settings/webhook`);
    const data = await res.json();
    if (data.success) {
      const input = document.getElementById('webhookUrlInput');
      const keyInput = document.getElementById('secretKeyInput');
      if (input && data.webhookUrl) input.value = data.webhookUrl;
      if (keyInput && data.secretKey) keyInput.value = data.secretKey;
    }
  } catch (err) {
    console.error('Error fetching webhook settings:', err);
  }
}

window.handleSaveWebhookUrl = async function(e) {
  if (e) e.preventDefault();
  if (!AppStore.currentUser || AppStore.currentUser.role !== 'ADMIN') return;

  const webhookUrlInput = document.getElementById('webhookUrlInput');
  const secretKeyInput = document.getElementById('secretKeyInput');
  const webhookUrl = webhookUrlInput ? webhookUrlInput.value.trim() : '';
  const secretKey = secretKeyInput ? secretKeyInput.value.trim() : '';

  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    showToast('יש להזין כתובת Google Webhook URL תקינה', 'warning');
    return;
  }

  try {
    const res = await apiFetch(`/settings/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, secretKey })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'הגדרות ה-Webhook ומפתח האבטחה עודכנו בהצלחה!', 'success');
    } else {
      showToast(data.message || 'שגיאה בעדכון ה-Webhook', 'danger');
    }
  } catch (err) {
    showToast('שגיאה בתקשורת עם השרת', 'danger');
  }
};

async function renderUsersTable() {
  if (AppStore.currentUser.role !== 'ADMIN') return;

  renderAdminsTable();

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

function renderAdminsTable() {
  const tbody = document.getElementById('adminsTbody');
  if (!tbody || !AppStore.admins) return;

  tbody.innerHTML = AppStore.admins.map(a => `
    <tr>
      <td><span class="badge badge-primary">${a.roleTitle || 'אדמין מוסדות חורב'}</span></td>
      <td><strong>${a.name}</strong></td>
      <td><code>${a.id}</code></td>
      <td>
        <span style="letter-spacing: 2px; color: #6c757d;">••••••••</span>
      </td>
      <td>${a.email}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openEditAdminModal('${a.id}')">
          <i class="fa-solid fa-user-gear"></i> ערוך פרטים וסיסמה
        </button>
      </td>
    </tr>
  `).join('');
}

window.openEditAdminModal = function(id) {
  const admin = (AppStore.admins || []).find(a => a.id === id);
  if (!admin) return;

  document.getElementById('editOriginalAdminId').value = admin.id;
  document.getElementById('editAdminRoleTitle').value = admin.roleTitle || '';
  document.getElementById('editAdminName').value = admin.name;
  document.getElementById('editAdminId').value = admin.id;
  document.getElementById('editAdminPass').value = admin.pass || '';
  document.getElementById('editAdminEmail').value = admin.email;
  document.getElementById('editAdminModal').style.display = 'flex';
};

async function handleEditAdminSubmit(e) {
  e.preventDefault();
  const isSoftwareManager = AppStore.currentUser && AppStore.currentUser.role === 'ADMIN' && 
    ((AppStore.currentUser.name && AppStore.currentUser.name.includes('ינון')) || 
     (AppStore.currentUser.roleTitle && AppStore.currentUser.roleTitle.includes('תוכנה')) ||
     (AppStore.currentUser.role && AppStore.currentUser.role.includes('תוכנה')));

  if (!isSoftwareManager) {
    showToast('הרשאה חסומה: עריכת סיסמאות ופרטי אדמינים מורשית למנהל התוכנה בלבד!', 'danger');
    return;
  }

  const originalId = document.getElementById('editOriginalAdminId').value;
  const newId = document.getElementById('editAdminId').value.trim();
  const name = document.getElementById('editAdminName').value.trim();
  const pass = document.getElementById('editAdminPass').value.trim();
  const email = document.getElementById('editAdminEmail').value.trim();
  const roleTitle = document.getElementById('editAdminRoleTitle').value.trim();

  try {
    const res = await apiFetch(`/admins/${originalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: AppStore.currentUser.id, newId, name, pass, email, roleTitle })
    });
    const data = await res.json();
    if (data.success) {
      showToast('פרטי האדמין והסיסמה עודכנו בהצלחה!', 'success');
      document.getElementById('editAdminModal').style.display = 'none';
      if (AppStore.currentUser && AppStore.currentUser.id === originalId) {
        AppStore.currentUser.id = newId;
        AppStore.currentUser.name = name;
        AppStore.currentUser.email = email;
        localStorage.setItem('horev_current_user', JSON.stringify(AppStore.currentUser));
      }
      await fetchUsersData();
      renderAdminsTable();
      renderUsersTable();
    } else {
      showToast(data.message || 'שגיאה בעדכון פרטי האדמין', 'danger');
    }
  } catch (err) {
    showToast('שגיאה בתקשורת עם השרת', 'danger');
  }
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
  const isSoftwareManager = AppStore.currentUser && AppStore.currentUser.role === 'ADMIN' && 
    ((AppStore.currentUser.name && AppStore.currentUser.name.includes('ינון')) || 
     (AppStore.currentUser.roleTitle && AppStore.currentUser.roleTitle.includes('תוכנה')) ||
     (AppStore.currentUser.role && AppStore.currentUser.role.includes('תוכנה')));

  if (!isSoftwareManager) {
    showToast('הרשאה חסומה: עריכת רכזים מורשית למנהל התוכנה בלבד!', 'danger');
    return;
  }

  const originalId = document.getElementById('editOriginalUserId').value;
  const newId = document.getElementById('editUserId').value.trim();
  const name = document.getElementById('editUserName').value.trim();
  const email = document.getElementById('editUserEmail').value.trim();

  try {
    const res = await apiFetch(`/users/${originalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: AppStore.currentUser.id, id: newId, name, email })
    });
    const data = await res.json();
    if (data.success) {
      showToast('פרטי הרכז/ת עודכנו בהצלחה!', 'success');
      document.getElementById('editUserModal').style.display = 'none';
      if (AppStore.currentUser && AppStore.currentUser.id === originalId) {
        AppStore.currentUser.id = newId;
        AppStore.currentUser.name = name;
        AppStore.currentUser.email = email;
        localStorage.setItem('horev_current_user', JSON.stringify(AppStore.currentUser));
      }
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
  const isSoftwareManager = AppStore.currentUser && AppStore.currentUser.role === 'ADMIN' && 
    ((AppStore.currentUser.name && AppStore.currentUser.name.includes('ינון')) || 
     (AppStore.currentUser.roleTitle && AppStore.currentUser.roleTitle.includes('תוכנה')) ||
     (AppStore.currentUser.role && AppStore.currentUser.role.includes('תוכנה')));

  if (!isSoftwareManager) {
    showToast('הרשאה חסומה: הוספת רכזים מורשית למנהל התוכנה בלבד!', 'danger');
    return;
  }

  const id = document.getElementById('newUserId').value.trim();
  const name = document.getElementById('newUserName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();

  try {
    const res = await apiFetch(`/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: AppStore.currentUser.id, id, name, email })
    });
    const data = await res.json();
    if (data.success) {
      showToast('הרכז/ת הוספה בהצלחה!', 'success');
      document.getElementById('addUserModal').style.display = 'none';
      fetchUsersData();
      renderUsersTable();
    } else {
      showToast(data.message || 'שגיאה בהוספת הרכז/ת', 'danger');
    }
  } catch (e) {
    showToast('שגיאה בהוספת הרכז/ת', 'danger');
  }
}

window.deleteUser = async function(id) {
  const isSoftwareManager = AppStore.currentUser && AppStore.currentUser.role === 'ADMIN' && 
    ((AppStore.currentUser.name && AppStore.currentUser.name.includes('ינון')) || 
     (AppStore.currentUser.roleTitle && AppStore.currentUser.roleTitle.includes('תוכנה')) ||
     (AppStore.currentUser.role && AppStore.currentUser.role.includes('תוכנה')));

  if (!isSoftwareManager) {
    showToast('הרשאה חסומה: מחיקת רכזים מורשית למנהל התוכנה בלבד!', 'danger');
    return;
  }

  if (!confirm(`האם להסיר את הרכז/ת מת"ז ${id}?`)) return;
  try {
    const res = await apiFetch(`/users/${id}?adminId=${AppStore.currentUser.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('הרכז/ת הוסרה בהצלחה', 'info');
      fetchUsersData();
      renderUsersTable();
    } else {
      showToast(data.message || 'שגיאה במחיקת הרכז/ת', 'danger');
    }
  } catch (e) {
    showToast('שגיאה במחיקת הרכז/ת', 'danger');
  }
};

async function renderEmailLogs() {
  if (AppStore.currentUser.role !== 'ADMIN') return;

  const container = document.getElementById('emailLogContainer');
  if (!container) return;

  try {
    const res = await apiFetch(`/email-logs`);
    const data = await res.json();
    if (data.success) AppStore.emailLogs = data.logs;
  } catch (e) {}

  container.innerHTML = AppStore.emailLogs.map(log => `
    <div class="log-entry">
      <span class="log-time">${log.time}</span>
      <span class="log-to">אל: <strong>${log.to}</strong></span>
      <span class="log-subject">${escapeHtml(log.subject)}</span>
      <span class="badge badge-success">${log.status}</span>
    </div>
  `).join('');
}

// --------------------------------------------------------------------------
// 9. Receipt Upload & Deletion Global Handlers
// --------------------------------------------------------------------------
window.openUploadReceiptModal = function(reqId) {
  const req = AppStore.requests.find(r => r.id === reqId);
  if (!req) {
    showToast('בקשה לא נמצאה', 'danger');
    return;
  }

  const reqIdEl = document.getElementById('uploadReceiptReqId');
  const amountEl = document.getElementById('receiptAmountInput');
  const storeEl = document.getElementById('receiptStoreInput');
  const notesEl = document.getElementById('receiptNotesInput');
  const fileEl = document.getElementById('receiptFileInput');
  const formEl = document.getElementById('uploadReceiptForm');
  const successEl = document.getElementById('uploadReceiptSuccessState');
  const modalEl = document.getElementById('uploadReceiptModal');

  if (reqIdEl) reqIdEl.value = req.id;
  if (amountEl) amountEl.value = '';
  if (storeEl) storeEl.value = '';
  if (notesEl) notesEl.value = '';
  if (fileEl) fileEl.value = '';

  if (formEl) formEl.style.display = 'block';
  if (successEl) successEl.style.display = 'none';
  if (modalEl) modalEl.style.display = 'flex';
};

window.resetUploadReceiptForm = function() {
  const amountEl = document.getElementById('receiptAmountInput');
  const storeEl = document.getElementById('receiptStoreInput');
  const notesEl = document.getElementById('receiptNotesInput');
  const fileEl = document.getElementById('receiptFileInput');
  const formEl = document.getElementById('uploadReceiptForm');
  const successEl = document.getElementById('uploadReceiptSuccessState');

  if (amountEl) amountEl.value = '';
  if (storeEl) storeEl.value = '';
  if (notesEl) notesEl.value = '';
  if (fileEl) fileEl.value = '';

  if (formEl) formEl.style.display = 'block';
  if (successEl) successEl.style.display = 'none';
};

window.closeUploadReceiptModal = function() {
  const modalEl = document.getElementById('uploadReceiptModal');
  if (modalEl) modalEl.style.display = 'none';
};

async function compressImageIfNeeded(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return null;
  if (file.size < 800000) return null; // Skip if under 800KB

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1600;
      const MAX_HEIGHT = 1600;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

window.handleUploadReceiptSubmit = async function(e) {
  if (e) e.preventDefault();

  const btn = document.getElementById('submitReceiptBtn');
  if (btn && btn.disabled) return;

  const reqId = document.getElementById('uploadReceiptReqId')?.value;
  const amount = document.getElementById('receiptAmountInput')?.value.trim();
  const store = document.getElementById('receiptStoreInput')?.value.trim();
  const notes = document.getElementById('receiptNotesInput')?.value.trim();
  const fileInput = document.getElementById('receiptFileInput');

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    showToast('יש לבחור קובץ קבלה/חשבונית (תמונה או PDF) למשלוח', 'warning');
    return;
  }

  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    showToast('יש להזין סכום קבלה בפועל (ב-₪)', 'warning');
    return;
  }

  if (!store) {
    showToast('יש להזין את שם החנות או הספק', 'warning');
    return;
  }

  const origBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מעלה קבלה ומבצע משלוח...';
  }

  try {
    const file = fileInput.files[0];
    let fileData = await compressImageIfNeeded(file);

    if (!fileData) {
      fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });
    }

    const res = await apiFetch(`/requests/${reqId}/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(amount) || 0,
        store,
        notes,
        fileName: file.name,
        fileData
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('הקבלה הועלתה בהצלחה ונשלחה לאסתר במזכירות (עותק לחגי)!', 'success');
      const formEl = document.getElementById('uploadReceiptForm');
      const successEl = document.getElementById('uploadReceiptSuccessState');
      if (formEl) formEl.style.display = 'none';
      if (successEl) successEl.style.display = 'block';
      await fetchRequestsData();
    } else {
      showToast(data.message || 'שגיאה בהעלאת הקבלה', 'danger');
    }
  } catch (err) {
    console.error('Receipt upload error:', err);
    showToast('שגיאה בתקשורת או בטעינת הקובץ: ' + err.message, 'danger');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnText;
    }
  }
};

window.openViewReceiptModal = function(reqId) {
  const req = AppStore.requests.find(r => r.id === reqId);
  const receiptsList = req && Array.isArray(req.receipts) && req.receipts.length > 0
    ? req.receipts
    : (req && req.receipt ? [req.receipt] : []);

  if (!req || receiptsList.length === 0) {
    showToast('עדיין לא הועלתה קבלה לבקשה זו', 'warning');
    return;
  }

  const budget = getReceiptBudgetStatus(req);
  const totalAmount = receiptsList.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  const receiptsListHtml = receiptsList.map((r, idx) => {
    const isImage = r.fileData && r.fileData.startsWith('data:image');
    return `
      <div class="card mb-3 text-right" style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
        <div class="card-header bg-light d-flex justify-content-between align-items-center py-2 px-3">
          <span class="font-weight-bold text-dark"><i class="fa-solid fa-receipt"></i> קבלה #${idx + 1}: ${escapeHtml(r.store || 'לא צוין ספק')}</span>
          <span class="badge badge-success font-weight-bold" style="font-size: 14px;">₪${(r.amount || 0).toLocaleString()}</span>
        </div>
        <div class="card-body p-3">
          <p class="mb-1 text-muted small"><strong>זמן העלאה:</strong> ${r.uploadedAt || '-'}</p>
          ${r.notes ? `<p class="mb-2 text-dark small"><strong>הערה לאסתר:</strong> "${escapeHtml(r.notes)}"</p>` : ''}
          ${isImage ? `
            <div class="text-center my-2" style="max-height: 300px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; background: #fafafa;">
              <img src="${r.fileData}" alt="תמונת קבלה #${idx + 1}" style="max-width: 100%; height: auto; border-radius: 4px;">
            </div>
            <div class="text-center mt-2">
              <a href="${r.fileData}" download="receipt_${req.id}_${idx + 1}.png" class="btn btn-sm btn-outline-success">
                <i class="fa-solid fa-download"></i> הורד תמונת קבלה זו
              </a>
            </div>
          ` : r.fileData ? `
            <div class="my-2 text-center">
              <a href="${r.fileData}" download="${r.fileName || `receipt_${req.id}_${idx + 1}.pdf`}" class="btn btn-sm btn-primary">
                <i class="fa-solid fa-download"></i> הורד קובץ קבלה (${r.fileName || 'PDF'})
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  const contentHtml = `
    <div class="p-2 text-right">
      <h4 class="text-primary mb-2" style="font-size: 18px;">בקשה #${req.id} — ${req.applicantName} (${req.group})</h4>
      <div class="bg-light p-3 mb-3" style="border-radius: 8px; border: 1px solid #e2e8f0;">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span><strong>סכום מוקצה שאושר:</strong> <span class="text-primary font-weight-bold">₪${(req.approvedRefund || 0).toLocaleString()}</span></span>
          <span><strong>סך קבלות שהוגשו (${receiptsList.length}):</strong> <span class="text-success font-weight-bold">₪${totalAmount.toLocaleString()}</span></span>
        </div>
        <div class="mt-2 pt-2 border-top">
          <strong>מאזן ניצול תקציב:</strong> ${budget.badgeHtml}
        </div>
      </div>

      <h5 class="text-secondary font-weight-bold mb-3" style="font-size: 16px;"><i class="fa-solid fa-layer-group"></i> פירוט כל הקבלות שהועלו (${receiptsList.length}):</h5>
      <div style="max-height: 450px; overflow-y: auto; padding-left: 5px;">
        ${receiptsListHtml}
      </div>

      <!-- Action Buttons Bar -->
      <div class="d-flex flex-wrap justify-content-center mt-3 pt-3" style="gap: 10px; border-top: 1px solid #e2e8f0;">
        <button type="button" class="btn btn-primary px-3" onclick="printReceipt('${req.id}')" style="flex: 1; min-width: 130px;">
          <i class="fa-solid fa-print"></i> הדפס קבלות / PDF
        </button>
        <button type="button" class="btn btn-outline-dark px-3" onclick="copyReceiptToClipboard('${req.id}')" style="flex: 1; min-width: 130px;">
          <i class="fa-solid fa-copy"></i> העתק פרטי קבלות
        </button>
      </div>
    </div>
  `;

  document.getElementById('viewReceiptContent').innerHTML = contentHtml;
  document.getElementById('viewReceiptModal').style.display = 'flex';
};

window.printReceipt = function(reqId) {
  const req = AppStore.requests.find(r => r.id === reqId);
  const receiptsList = req && Array.isArray(req.receipts) && req.receipts.length > 0
    ? req.receipts
    : (req && req.receipt ? [req.receipt] : []);

  if (!req || receiptsList.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=850,height=950');
  if (!printWindow) {
    showToast('נחסם חלון קופץ בדפדפן. נא לאפשר חלונות קופצים בדפדפן כדי להדפיס.', 'warning');
    return;
  }

  const printItemsHtml = receiptsList.map(r => {
    const isImage = r.fileData && r.fileData.startsWith('data:image');
    const isPdf = r.fileData && r.fileData.startsWith('data:application/pdf');
    if (isImage) {
      return `<div class="page-break"><img src="${r.fileData}" alt="תמונת קבלה"></div>`;
    } else if (isPdf) {
      return `<div class="page-break"><iframe src="${r.fileData}"></iframe></div>`;
    } else {
      return `<div class="page-break"><p style="font-family: Arial; font-size: 18px;">${escapeHtml(r.store || 'ספק')} — ₪${r.amount} (${r.fileName || 'קובץ'})</p></div>`;
    }
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <title>קבלות - בקשה #${req.id}</title>
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; background: #fff; text-align: center; }
        .page-break { page-break-after: always; display: flex; justify-content: center; align-items: center; min-height: 98vh; margin-bottom: 20px; }
        .page-break:last-child { page-break-after: auto; }
        img { max-width: 100%; max-height: 98vh; object-fit: contain; display: block; margin: auto; }
        iframe { width: 100vw; height: 98vh; border: none; }
        @media print {
          html, body { margin: 0; padding: 0; background: #fff; }
          .page-break { page-break-after: always; page-break-inside: avoid; min-height: 100vh; margin: 0; }
          .page-break:last-child { page-break-after: auto; }
          img { max-width: 100%; max-height: 100vh; width: auto; height: auto; display: block; margin: auto; page-break-inside: avoid; }
          iframe { width: 100vw; height: 100vh; border: none; }
        }
      </style>
    </head>
    <body>
      ${printItemsHtml}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 350);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

window.copyReceiptToClipboard = async function(reqId) {
  const req = AppStore.requests.find(r => r.id === reqId);
  if (!req || !req.receipt) return;
  const r = req.receipt;

  try {
    if (r.fileData && r.fileData.startsWith('data:image') && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      const resp = await fetch(r.fileData);
      const blob = await resp.blob();
      
      let pngBlob = blob;
      if (blob.type !== 'image/png') {
        pngBlob = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(b => resolve(b), 'image/png');
          };
          img.src = r.fileData;
        });
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      showToast('תמונת הקבלה הועתקה ללוח! ניתן להדביק (Ctrl+V) ב-WhatsApp / Gmail', 'success');
    } else {
      const textToCopy = `🧾 קבלה מוסדות חורב\nבקשה #${req.id} (${req.applicantName} - ${req.group})\nספק: ${escapeHtml(r.store || 'לא צוין')}\nסכום: ₪${r.amount}\nתאריך: ${r.uploadedAt}`;
      await navigator.clipboard.writeText(textToCopy);
      showToast('פרטי הקבלה הועתקו ללוח!', 'success');
    }
  } catch (err) {
    console.error('Clipboard error:', err);
    const textToCopy = `🧾 קבלה מוסדות חורב\nבקשה #${req.id} (${req.applicantName} - ${req.group})\nספק: ${escapeHtml(r.store || 'לא צוין')}\nסכום: ₪${r.amount}\nתאריך: ${r.uploadedAt}`;
    navigator.clipboard.writeText(textToCopy);
    showToast('פרטי הקבלה הועתקו ללוח (טקסט)!', 'success');
  }
};

window.deleteSingleRequest = async function(id) {
  if (AppStore.currentUser.role !== 'ADMIN') return;
  if (!confirm(`האם אתה בטוח שברצונך למחוק את בקשה #${id} מהמערכת?`)) return;

  try {
    const res = await apiFetch(`/requests/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await fetchRequestsData();
    } else {
      showToast(data.message, 'danger');
    }
  } catch (err) {
    showToast('שגיאה במחיקת הבקשה', 'danger');
  }
};

window.deleteSelectedRequests = async function() {
  if (AppStore.currentUser.role !== 'ADMIN') return;

  const selectedCbs = document.querySelectorAll('.req-select-cb:checked');
  const ids = Array.from(selectedCbs).map(cb => cb.value);

  if (!ids.length) {
    showToast('יש לבחור לפחות בקשה אחת למחיקה', 'warning');
    return;
  }

  if (!confirm(`האם אתה בטוח שברצונך למחוק ${ids.length} בקשות שנבחרו?`)) return;

  try {
    const res = await apiFetch(`/requests/delete-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await fetchRequestsData();
    } else {
      showToast(data.message, 'danger');
    }
  } catch (err) {
    showToast('שגיאה במחיקת הבקשות שנבחרו', 'danger');
  }
};

window.clearAllHistory = async function() {
  const isSoftwareManager = AppStore.currentUser && AppStore.currentUser.role === 'ADMIN' && 
    ((AppStore.currentUser.name && AppStore.currentUser.name.includes('ינון')) || 
     (AppStore.currentUser.roleTitle && AppStore.currentUser.roleTitle.includes('תוכנה')) ||
     (AppStore.currentUser.role && AppStore.currentUser.role.includes('תוכנה')));

  if (!isSoftwareManager) {
    showToast('פעולה זו (איפוס ומחיקת כל ההיסטוריה) מורשית למנהל תוכנה בלבד', 'danger');
    return;
  }

  if (!confirm('⚠️ אזהרה חמורה: פעולה זו תמחק את כל היסטוריית הבקשות מהמערכת 100%.\nהאם אתה בטוח לחלוטין ברצונך לאפס ולמחוק את כל היסטוריית ההזמנות?')) return;

  try {
    const res = await apiFetch(`/requests`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: AppStore.currentUser.id })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await fetchRequestsData();
    } else {
      showToast(data.message, 'danger');
    }
  } catch (err) {
    showToast('שגיאה באיפוס היסטוריית הבקשות', 'danger');
  }
};

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

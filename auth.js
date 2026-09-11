// ============================================================
//  Firebase Authentication & Central RBAC Security System
// ============================================================
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  collection, 
  query, 
  where 
} from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBBX0K_Z9rDfDUclNYB17FXywXXJi9rA0s",
  authDomain: "leads-84ea5.firebaseapp.com",
  databaseURL: "https://leads-84ea5-default-rtdb.firebaseio.com",
  projectId: "leads-84ea5",
  storageBucket: "leads-84ea5.firebasestorage.app",
  messagingSenderId: "679803805448",
  appId: "1:679803805448:web:5e31f599297f483b8b16bd",
  measurementId: "G-4WZSQFM2XZ"
};

// Initialize Firebase
let app = null;
let analytics = null;
let auth = null;
let db = null;

try {
  app = initializeApp(firebaseConfig);
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    // Analytics is optional in sandbox
  }
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.warn("Firebase initialization notice:", err);
}

// ============================================================
//  Role Definitions & Page Permissions
// ============================================================
export const ROLES = {
  ADMIN: 'admin',
  OM: 'om',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  ACCOUNTS: 'accounts'
};

export const ROLE_LABELS = {
  admin: 'مدير النظام (Admin)',
  om: 'مدير العمليات (OM)',
  manager: 'مدير الصالة (Manager)',
  cashier: 'كاشير (Cashier)',
  accounts: 'محاسب (Accounts)'
};

// Allowed pages per role (Explicit whitelist)
export const ROLE_ALLOWED_PAGES = {
  admin: [
    'dashboard.html',
    'pos.html',
    'orders.html',
    'tables.html',
    'delivery.html',
    'kitchen.html',
    'inventory.html',
    'accounts.html',
    'expenses.html',
    'crm.html',
    'settings.html',
    'guard.html',
    'customer-display.html'
  ],
  om: [
    'dashboard.html',
    'pos.html',
    'orders.html',
    'tables.html',
    'delivery.html',
    'kitchen.html',
    'inventory.html',
    'accounts.html',
    'expenses.html',
    'crm.html',
    'guard.html',
    'customer-display.html'
    // Excludes: settings.html
  ],
  manager: [
    'dashboard.html',
    'pos.html',
    'orders.html',
    'tables.html',
    'delivery.html',
    'kitchen.html',
    'inventory.html',
    'crm.html',
    'guard.html',
    'customer-display.html'
    // Excludes: settings.html, accounts.html, expenses.html
  ],
  cashier: [
    'dashboard.html',
    'pos.html',
    'tables.html',
    'delivery.html',
    'customer-display.html'
    // Excludes: settings.html, orders.html, accounts.html, expenses.html, inventory.html, crm.html, guard.html
  ],
  accounts: [
    'dashboard.html',
    'orders.html',
    'accounts.html',
    'expenses.html'
    // Excludes: settings.html, pos.html, tables.html, delivery.html, kitchen.html, inventory.html, crm.html, guard.html
  ]
};

// Default Landing Page when user logs in or is redirected
export const ROLE_HOME_PAGES = {
  admin: 'dashboard.html',
  om: 'dashboard.html',
  manager: 'dashboard.html',
  cashier: 'pos.html',
  accounts: 'accounts.html'
};

// ============================================================
//  Default Seed Users
// ============================================================
const DEFAULT_USERS = [
  {
    id: '3SNhsc2ilvc42YWXhKpLzBO5Yu32',
    username: 'mahmoud.mostfa',
    email: 'mahmoud.mostfa@app.com',
    fullName: 'Mahmoud Mostafa',
    role: 'admin',
    active: true,
    createdAt: new Date().toISOString(),
    permissions: ['all']
  },
  {
    id: 'user_admin',
    username: 'admin',
    email: 'admin@system.local',
    fullName: 'مدير النظام (Admin)',
    password: btoa('admin123'),
    role: 'admin',
    active: true,
    createdAt: new Date().toISOString(),
    permissions: ['all']
  },
  {
    id: 'user_om',
    username: 'om',
    email: 'om@system.local',
    fullName: 'مدير العمليات (OM)',
    password: btoa('om123'),
    role: 'om',
    active: true,
    createdAt: new Date().toISOString(),
    permissions: ['operations', 'pos', 'tables', 'inventory', 'accounts']
  },
  {
    id: 'user_manager',
    username: 'manager',
    email: 'manager@system.local',
    fullName: 'مدير الصالة (Manager)',
    password: btoa('manager123'),
    role: 'manager',
    active: true,
    createdAt: new Date().toISOString(),
    permissions: ['pos', 'tables', 'delivery', 'inventory', 'crm']
  },
  {
    id: 'user_cashier',
    username: 'cashier',
    email: 'cashier@system.local',
    fullName: 'كاشير المناوبة (Cashier)',
    password: btoa('cashier123'),
    role: 'cashier',
    active: true,
    createdAt: new Date().toISOString(),
    permissions: ['pos', 'tables', 'delivery']
  },
  {
    id: 'user_accounts',
    username: 'accounts',
    email: 'accounts@system.local',
    fullName: 'محاسب الوردية (Accounts)',
    password: btoa('accounts123'),
    role: 'accounts',
    active: true,
    createdAt: new Date().toISOString(),
    permissions: ['orders', 'accounts', 'expenses']
  }
];

// Seed users if empty & ensure Mahmoud Mostafa admin presence
export function seedUsersIfEmpty() {
  let existing = [];
  try {
    existing = JSON.parse(localStorage.getItem('cs_users') || '[]');
  } catch (e) {
    existing = [];
  }

  let modified = false;

  // Always ensure Mahmoud Mostafa is registered as primary Admin
  const mahmoudIdx = existing.findIndex(u => 
    u.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32' || 
    (u.email && u.email.toLowerCase() === 'mahmoud.mostfa@app.com') ||
    u.username === 'mahmoud.mostfa'
  );

  if (mahmoudIdx === -1) {
    existing.unshift({
      id: '3SNhsc2ilvc42YWXhKpLzBO5Yu32',
      username: 'mahmoud.mostfa',
      email: 'mahmoud.mostfa@app.com',
      fullName: 'Mahmoud Mostafa',
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString(),
      permissions: ['all']
    });
    modified = true;
  } else {
    if (existing[mahmoudIdx].role !== 'admin' || existing[mahmoudIdx].active !== true) {
      existing[mahmoudIdx].role = 'admin';
      existing[mahmoudIdx].active = true;
      existing[mahmoudIdx].fullName = 'Mahmoud Mostafa';
      modified = true;
    }
  }

  DEFAULT_USERS.forEach(defU => {
    if (!existing.some(u => u.username === defU.username || (defU.email && u.email === defU.email))) {
      existing.push(defU);
      modified = true;
    }
  });

  if (modified) {
    localStorage.setItem('cs_users', JSON.stringify(existing));
  }
  return existing;
}

// Auto seed on load
seedUsersIfEmpty();

// ============================================================
//  Auth Service
// ============================================================
export const AuthService = {
  // Get all users
  getUsers: () => {
    let users = [];
    try {
      users = JSON.parse(localStorage.getItem('cs_users') || '[]');
    } catch (e) {
      users = [];
    }
    let dirty = false;
    users = users.map((u, i) => {
      if (!u.id) {
        u.id = u.username ? 'user_' + u.username : 'user_' + (i + 1);
        dirty = true;
      }
      return u;
    });
    if (dirty) {
      try {
        localStorage.setItem('cs_users', JSON.stringify(users));
      } catch (e) {}
    }
    return users;
  },

  // Get specific user by ID, username or email
  getUser: (id) => {
    if (!id) return null;
    const users = AuthService.getUsers();
    const strId = String(id).trim().toLowerCase();
    return users.find(u => 
      (u.id && String(u.id).trim().toLowerCase() === strId) ||
      (u.username && String(u.username).trim().toLowerCase() === strId) ||
      (u.email && String(u.email).trim().toLowerCase() === strId)
    ) || null;
  },

  // Save users
  saveUsers: (users) => {
    localStorage.setItem('cs_users', JSON.stringify(users));
  },

  // Current session
  getSession: () => {
    try {
      return JSON.parse(localStorage.getItem('cs_session') || 'null');
    } catch {
      return null;
    }
  },

  // Set session
  setSession: (sessionData) => {
    localStorage.setItem('cs_session', JSON.stringify(sessionData));
  },

  // Clear session / Logout
  clearSession: async () => {
    try {
      localStorage.removeItem('cs_session');
      sessionStorage.clear();
    } catch (e) {
      console.warn("Session clear warning:", e);
    }
    if (auth && auth.currentUser) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn("Firebase signout notice:", err);
      }
    }
  },

  // Perform immediate clean logout and redirect to index.html
  logout: async () => {
    try {
      localStorage.removeItem('cs_session');
      sessionStorage.clear();
    } catch (e) {
      console.warn("Session clear warning:", e);
    }
    if (auth && auth.currentUser) {
      try {
        signOut(auth).catch(() => {});
      } catch (err) {
        console.warn("Firebase signout notice:", err);
      }
    }
    window.location.href = 'index.html';
  },

  // Login handler: Authenticates via Firebase Authentication + Local user fallback
  login: async (identifier, password) => {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanId || !cleanPass) {
      throw new Error('يرجى إدخال اسم المستخدم/البريد الإلكتروني وكلمة المرور');
    }

    const users = AuthService.getUsers();
    let matchedUser = null;
    let firebaseUser = null;
    let firestoreDocData = null;

    const isMahmoudTarget = cleanId === 'mahmoud.mostfa@app.com' || cleanId === 'mahmoud.mostfa';

    // 1. If identifier looks like an email and Firebase auth is ready, try Firebase Auth
    if (cleanId.includes('@') && auth) {
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanId, cleanPass);
        firebaseUser = cred.user;

        // Fetch user document from Firestore
        if (db) {
          try {
            // Check by Firebase Auth UID
            const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDocSnap.exists()) {
              firestoreDocData = userDocSnap.data();
            } else {
              // Check by document ID shown in console: 3SNhsc2ilvc42YWXhKpLzBO5Yu32
              const specDocSnap = await getDoc(doc(db, 'users', '3SNhsc2ilvc42YWXhKpLzBO5Yu32'));
              if (specDocSnap.exists()) {
                const sData = specDocSnap.data();
                if ((sData.email || '').toLowerCase() === cleanId || isMahmoudTarget) {
                  firestoreDocData = sData;
                }
              }
              // Check by email query
              if (!firestoreDocData) {
                const q = query(collection(db, 'users'), where('email', '==', cleanId));
                const qSnap = await getDocs(q);
                if (!qSnap.empty) {
                  firestoreDocData = qSnap.docs[0].data();
                }
              }
            }
          } catch (fsErr) {
            console.warn("Firestore user fetch notice:", fsErr);
          }
        }

        const resolvedRole = isMahmoudTarget ? 'admin' : (firestoreDocData?.role || 'admin');
        const resolvedName = firestoreDocData?.name || firestoreDocData?.fullName || (isMahmoudTarget ? 'Mahmoud Mostafa' : (firebaseUser.displayName || cleanId.split('@')[0]));

        // Find or create profile
        matchedUser = users.find(u => 
          (u.email || '').toLowerCase() === cleanId || 
          u.id === firebaseUser.uid ||
          (isMahmoudTarget && (u.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32' || u.username === 'mahmoud.mostfa'))
        );

        if (!matchedUser) {
          matchedUser = {
            id: isMahmoudTarget ? '3SNhsc2ilvc42YWXhKpLzBO5Yu32' : firebaseUser.uid,
            username: cleanId.split('@')[0],
            email: cleanId,
            fullName: resolvedName,
            password: btoa(cleanPass),
            role: resolvedRole,
            active: true,
            createdAt: new Date().toISOString()
          };
          users.unshift(matchedUser);
        } else {
          matchedUser.role = resolvedRole;
          matchedUser.fullName = resolvedName;
          matchedUser.password = btoa(cleanPass);
          matchedUser.active = true;
          if (isMahmoudTarget) {
            matchedUser.id = '3SNhsc2ilvc42YWXhKpLzBO5Yu32';
          }
        }
        AuthService.saveUsers(users);
      } catch (fbErr) {
        console.warn("Firebase Auth attempt notice:", fbErr.code || fbErr.message);
        // Fall back to local check if offline or network failure
      }
    }

    // 2. Local credential check (for username or offline fallback)
    if (!matchedUser) {
      const encodedPass = btoa(cleanPass);
      matchedUser = users.find(u => {
        const uEmail = (u.email || '').toLowerCase();
        const uName = (u.username || '').toLowerCase();
        const matchesIdentity = uName === cleanId || uEmail === cleanId;
        if (!matchesIdentity) return false;
        // If password stored, check it. If empty (first time seed without password), accept and save
        if (!u.password) {
          u.password = encodedPass;
          return true;
        }
        return u.password === encodedPass;
      });

      if (matchedUser && (isMahmoudTarget || matchedUser.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32' || (matchedUser.email && matchedUser.email.toLowerCase() === 'mahmoud.mostfa@app.com'))) {
        matchedUser.role = 'admin';
        matchedUser.fullName = 'Mahmoud Mostafa';
        matchedUser.active = true;
        AuthService.saveUsers(users);
      }
    }

    if (!matchedUser) {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    if (matchedUser.active === false) {
      throw new Error('هذا الحساب معطل حالياً من قِبل مدير النظام');
    }

    // Create session object
    const session = {
      id: matchedUser.id,
      username: matchedUser.username,
      email: matchedUser.email || `${matchedUser.username}@system.local`,
      fullName: matchedUser.fullName || matchedUser.username,
      role: (isMahmoudTarget || matchedUser.email === 'mahmoud.mostfa@app.com' || matchedUser.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32') ? 'admin' : (matchedUser.role || 'cashier'),
      loginAt: new Date().toISOString(),
      firebaseUid: firebaseUser ? firebaseUser.uid : null
    };

    AuthService.setSession(session);
    return session;
  },

  // Create user (Admin only)
  createUser: async ({ username, email, fullName, password, role, permissions = [], active = true }) => {
    const users = AuthService.getUsers();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = (email || `${cleanUsername}@system.local`).trim().toLowerCase();

    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      throw new Error('اسم المستخدم موجود بالفعل');
    }
    if (users.some(u => (u.email || '').toLowerCase() === cleanEmail)) {
      throw new Error('البريد الإلكتروني مسجل لمستخدم آخر');
    }

    let firebaseUid = null;
    // Attempt Firebase User creation if email and auth exist
    if (auth && cleanEmail.includes('@')) {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        firebaseUid = userCred.user.uid;
      } catch (err) {
        console.warn("Firebase user registration notice:", err.message);
      }
    }

    const newUser = {
      id: firebaseUid || 'user_' + Date.now(),
      username: cleanUsername,
      email: cleanEmail,
      fullName: fullName.trim() || cleanUsername,
      password: btoa(password),
      role: role || 'cashier',
      permissions: permissions.length ? permissions : [role],
      active: Boolean(active),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    AuthService.saveUsers(users);
    return newUser;
  },

  // Update existing user safely
  updateUser: (id, updates = {}) => {
    if (!id && !updates.username && !updates.email) {
      console.warn('updateUser called without identifier');
      return null;
    }
    const users = AuthService.getUsers();
    const strId = String(id || '').trim().toLowerCase();

    let idx = -1;
    if (strId && strId !== 'undefined' && strId !== 'null') {
      idx = users.findIndex(u => 
        (u.id && String(u.id).trim().toLowerCase() === strId) ||
        (u.username && String(u.username).trim().toLowerCase() === strId) ||
        (u.email && String(u.email).trim().toLowerCase() === strId)
      );
    }

    if (idx === -1 && updates.username) {
      const uName = String(updates.username).trim().toLowerCase();
      idx = users.findIndex(u => u.username && String(u.username).trim().toLowerCase() === uName);
    }

    if (idx === -1 && updates.email) {
      const uMail = String(updates.email).trim().toLowerCase();
      idx = users.findIndex(u => u.email && String(u.email).trim().toLowerCase() === uMail);
    }

    if (idx === -1) {
      console.warn('updateUser: لم يتم العثور على المستخدم المطلوب تحديثه:', id, updates);
      return null;
    }

    if (updates.password) {
      updates.password = btoa(updates.password);
    }

    users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
    AuthService.saveUsers(users);

    // If updating current active session user, reflect updates in current session
    try {
      const sess = AuthService.getSession();
      if (sess && (sess.id === users[idx].id || sess.username === users[idx].username)) {
        sess.fullName = users[idx].fullName || sess.fullName;
        sess.role = users[idx].role || sess.role;
        sess.email = users[idx].email || sess.email;
        AuthService.setSession(sess);
      }
    } catch (e) {}

    return users[idx];
  },

  // Delete user safely
  deleteUser: (id) => {
    if (!id) return false;
    const strId = String(id).trim().toLowerCase();
    const users = AuthService.getUsers();
    const target = users.find(u => 
      (u.id && String(u.id).trim().toLowerCase() === strId) ||
      (u.username && String(u.username).trim().toLowerCase() === strId) ||
      (u.email && String(u.email).trim().toLowerCase() === strId)
    );

    if (target && (
      target.username === 'admin' || 
      target.username === 'mahmoud.mostfa' || 
      (target.email && target.email.toLowerCase() === 'mahmoud.mostfa@app.com') || 
      target.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32'
    )) {
      throw new Error('لا يمكن حذف حساب الأدمن الرئيسي للنظام');
    }

    const filtered = users.filter(u => 
      (!u.id || String(u.id).trim().toLowerCase() !== strId) &&
      (!u.username || String(u.username).trim().toLowerCase() !== strId) &&
      (!u.email || String(u.email).trim().toLowerCase() !== strId)
    );

    AuthService.saveUsers(filtered);
    return true;
  },

  // Check if current user has permission for page
  hasPermission: (pageName) => {
    const session = AuthService.getSession();
    if (!session) return false;
    const role = session.role || 'cashier';
    const allowed = ROLE_ALLOWED_PAGES[role] || [];
    return allowed.includes(pageName);
  },

  // Guard page access
  enforcePage: (pageName) => {
    const session = AuthService.getSession();
    if (!session) {
      window.location.href = 'index.html';
      return false;
    }

    const role = session.role || 'cashier';
    const allowed = ROLE_ALLOWED_PAGES[role] || [];
    const normalizedPage = pageName.split('/').pop().split('?')[0];

    if (!allowed.includes(normalizedPage)) {
      const home = ROLE_HOME_PAGES[role] || 'index.html';
      alert(`غير مصرح لك بالدخول إلى صفحة (${normalizedPage}). سيتم تحويلك إلى صفحتك المخصصة.`);
      window.location.href = home;
      return false;
    }

    return true;
  },

  // Render navigation and user card in sidebar
  renderSidebarUI: () => {
    const session = AuthService.getSession();
    if (!session) return;

    // 1. Update user info elements
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');

    if (nameEl) nameEl.textContent = session.fullName || session.username;
    if (roleEl) roleEl.textContent = ROLE_LABELS[session.role] || session.role;
    if (avatarEl) {
      const roleInitials = (session.fullName || session.username).substring(0, 2).toUpperCase();
      avatarEl.textContent = roleInitials;
    }

    // 2. Hide unauthorized links
    const role = session.role || 'cashier';
    const allowed = ROLE_ALLOWED_PAGES[role] || [];

    const navButtons = document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-nav button.nav-item');
    navButtons.forEach(btn => {
      const onclickVal = btn.getAttribute('onclick') || '';
      let targetFile = '';
      const match = onclickVal.match(/navigate\(['"]([^'"]+)['"]\)/);
      if (match && match[1]) {
        targetFile = match[1].split('?')[0];
      }
      if (targetFile) {
        if (!allowed.includes(targetFile)) {
          btn.style.display = 'none';
        } else {
          btn.style.display = 'flex';
          // Mark active if current page matches
          const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
          if (currentPage === targetFile) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        }
      }
    });

    // 3. Hide section titles if all child links are hidden
    const sectionTitles = document.querySelectorAll('.sidebar-nav .nav-section-title');
    sectionTitles.forEach(title => {
      let next = title.nextElementSibling;
      let hasVisibleChild = false;
      while (next && !next.classList.contains('nav-section-title')) {
        if (next.classList.contains('nav-item') && next.style.display !== 'none') {
          hasVisibleChild = true;
          break;
        }
        next = next.nextElementSibling;
      }
      title.style.display = hasVisibleChild ? 'block' : 'none';
    });

    // 4. Bind logout button reliably
    const logoutBtns = document.querySelectorAll('.btn-logout, #btnLogout, [data-action="logout"]');
    logoutBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        AuthService.logout();
      };
    });
  }
};

// ============================================================
//  Table Management System & Deep POS Integration
// ============================================================
export const TABLE_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  OCCUPIED: 'occupied',
  CLEANING: 'cleaning'
};

export const TABLE_STATUS_LABELS = {
  available: 'متاحة',
  reserved: 'محجوزة',
  occupied: 'مشغولة',
  cleaning: 'قيد التنظيف'
};

const DEFAULT_TABLES = [
  { id: 1, number: '1', zone: 'صالة العوائل', seats: '4 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 2, number: '2', zone: 'صالة العوائل', seats: '6 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 3, number: '3', zone: 'صالة العوائل', seats: '4 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 4, number: 'VIP 1', zone: 'الكابينة الفاخرة', seats: '8 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 5, number: 'VIP 2', zone: 'الكابينة الفاخرة', seats: '6 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 6, number: 'T 1', zone: 'التراس الخارجي', seats: '2 مقعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 7, number: 'T 2', zone: 'التراس الخارجي', seats: '4 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 8, number: 'T 3', zone: 'التراس الخارجي', seats: '4 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { 
    id: 12, 
    number: '12', 
    zone: 'صالة العوائل', 
    seats: '4 مقاعد', 
    status: 'reserved', 
    currentSession: null, 
    reservation: {
      customerName: 'أحمد محمود',
      customerPhone: '01012345678',
      date: new Date().toISOString().split('T')[0],
      time: '20:00',
      guestsCount: 4,
      notes: 'حجز اليوم عائلي 4 أفراد - رغبة بمائدة هادئة',
      createdAt: new Date().toISOString()
    },
    total: 0, 
    waiter: '—' 
  }
];

export const TableManager = {
  getTables: () => {
    let raw = localStorage.getItem('cs_tables');
    if (!raw) {
      localStorage.setItem('cs_tables', JSON.stringify(DEFAULT_TABLES));
      return DEFAULT_TABLES;
    }
    let tables = JSON.parse(raw);
    // Normalize status names from legacy ('free' -> 'available', 'busy' -> 'occupied')
    let changed = false;
    tables.forEach(t => {
      if (t.status === 'free') { t.status = 'available'; changed = true; }
      if (t.status === 'busy') { t.status = 'occupied'; changed = true; }
      if (!t.currentSession && t.status === 'occupied') {
        t.currentSession = {
          sessionId: 'sess_' + Date.now(),
          customerName: t.reserveCust || 'عميل صالة',
          waiter: t.waiter || 'وليد صبحي صالة',
          openedAt: new Date().toISOString(),
          rounds: [
            {
              roundNumber: 1,
              time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
              waiter: t.waiter || 'وليد صبحي صالة',
              items: t.items || [],
              subtotal: t.total || 0
            }
          ],
          total: t.total || 0
        };
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem('cs_tables', JSON.stringify(tables));
    }
    return tables;
  },

  saveTables: (tables) => {
    localStorage.setItem('cs_tables', JSON.stringify(tables));
  },

  getTable: (id) => {
    const tables = TableManager.getTables();
    return tables.find(t => String(t.id) === String(id) || String(t.number) === String(id)) || null;
  },

  // 1. Reserve Table
  reserveTable: (tableId, { customerName, customerPhone, date, time, guestsCount, notes }) => {
    const tables = TableManager.getTables();
    const t = tables.find(t => t.id == tableId);
    if (!t) throw new Error('الطاولة غير موجودة');

    t.status = TABLE_STATUS.RESERVED;
    t.reservation = {
      customerName: customerName.trim(),
      customerPhone: (customerPhone || '').trim(),
      date: date || new Date().toISOString().split('T')[0],
      time: time || '20:00',
      guestsCount: parseInt(guestsCount) || 2,
      notes: (notes || '').trim(),
      createdAt: new Date().toISOString()
    };
    t.currentSession = null;
    t.total = 0;
    TableManager.saveTables(tables);
    return t;
  },

  // 2. Check-in Reservation (Customer Arrived -> Reserved to Occupied)
  checkInReservation: (tableId, waiter = 'وليد صبحي صالة') => {
    const tables = TableManager.getTables();
    const t = tables.find(t => t.id == tableId);
    if (!t) throw new Error('الطاولة غير موجودة');

    const customerName = (t.reservation && t.reservation.customerName) ? t.reservation.customerName : 'عميل محجوز';
    const customerPhone = (t.reservation && t.reservation.customerPhone) ? t.reservation.customerPhone : '';

    t.status = TABLE_STATUS.OCCUPIED;
    t.currentSession = {
      sessionId: 'sess_' + Date.now(),
      customerName: customerName,
      customerPhone: customerPhone,
      waiter: waiter,
      openedAt: new Date().toISOString(),
      rounds: [],
      discount: 0,
      discountType: 'flat',
      total: 0
    };
    t.reservation = null;
    t.waiter = waiter;
    t.total = 0;
    TableManager.saveTables(tables);
    return t;
  },

  // 3. Open New Session (Available to Occupied)
  openSession: (tableId, customerName = 'عميل صالة', waiter = 'وليد صبحي صالة') => {
    const tables = TableManager.getTables();
    const t = tables.find(t => t.id == tableId);
    if (!t) throw new Error('الطاولة غير موجودة');

    t.status = TABLE_STATUS.OCCUPIED;
    t.currentSession = {
      sessionId: 'sess_' + Date.now(),
      customerName: customerName.trim() || 'عميل صالة',
      customerPhone: '',
      waiter: waiter || 'وليد صبحي صالة',
      openedAt: new Date().toISOString(),
      rounds: [],
      discount: 0,
      discountType: 'flat',
      total: 0
    };
    t.reservation = null;
    t.waiter = waiter;
    t.total = 0;
    TableManager.saveTables(tables);
    return t;
  },

  // 4. Add a Round of orders to the Table Session
  addRound: (tableId, items, waiter = null, note = '') => {
    const tables = TableManager.getTables();
    const t = tables.find(t => t.id == tableId);
    if (!t) throw new Error('الطاولة غير موجودة');

    if (t.status !== TABLE_STATUS.OCCUPIED || !t.currentSession) {
      // Auto-open session if table wasn't marked occupied yet
      TableManager.openSession(tableId, 'عميل صالة', waiter || 'وليد صبحي صالة');
      return TableManager.addRound(tableId, items, waiter, note);
    }

    const roundNum = (t.currentSession.rounds ? t.currentSession.rounds.length : 0) + 1;
    const now = new Date();
    const roundSubtotal = items.reduce((sum, it) => sum + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 1), 0);

    const newRound = {
      roundNumber: roundNum,
      time: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      waiter: waiter || t.currentSession.waiter || 'وليد صبحي صالة',
      note: note || '',
      items: items.map(it => ({
        itemId: it.itemId,
        name: it.name,
        price: parseFloat(it.price) || 0,
        qty: parseInt(it.qty) || 1,
        note: it.note || ''
      })),
      subtotal: roundSubtotal
    };

    if (!t.currentSession.rounds) t.currentSession.rounds = [];
    t.currentSession.rounds.push(newRound);

    // Recalculate total
    const totalSub = t.currentSession.rounds.reduce((sum, r) => sum + (r.subtotal || 0), 0);
    t.currentSession.total = totalSub;
    t.total = totalSub;
    t.items = t.currentSession.rounds.flatMap(r => r.items);

    TableManager.saveTables(tables);
    return t;
  },

  // 5. Settle / Checkout Table and Close Session
  checkoutTable: (tableId, paymentMethod = 'cash', discountVal = 0, discountType = 'flat') => {
    const tables = TableManager.getTables();
    const t = tables.find(t => t.id == tableId);
    if (!t || !t.currentSession) throw new Error('لا توجد جلسة نشطة على هذه الطاولة');

    const session = t.currentSession;
    const allItems = (session.rounds || []).flatMap(r => r.items);
    const subtotal = allItems.reduce((sum, it) => sum + (it.price * it.qty), 0);

    const discNum = parseFloat(discountVal) || 0;
    const discount = discountType === 'pct' ? (subtotal * (discNum / 100)) : Math.min(discNum, subtotal);
    const total = Math.max(0, subtotal - discount);

    const now = new Date();
    const orders = JSON.parse(localStorage.getItem('cs_orders') || '[]');
    const oId = orders.length > 0 ? (Math.max(...orders.map(o => parseInt(o.id) || 0)) + 1) : 1;

    const completedInvoice = {
      id: oId,
      type: 'dine',
      tableId: t.id,
      tableNumber: t.number,
      tableLabel: 'طاولة ' + t.number,
      tableSessionId: session.sessionId,
      customer: session.customerName || 'عميل صالة',
      customerPhone: session.customerPhone || '',
      waiter: session.waiter || t.waiter,
      openedAt: session.openedAt,
      closedAt: now.toISOString(),
      rounds: session.rounds,
      items: allItems,
      subtotal: subtotal,
      discount: discount,
      total: total,
      payMethod: paymentMethod,
      status: 'paid',
      time: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      date: now.toISOString().split('T')[0],
      createdAt: now.toISOString()
    };

    orders.push(completedInvoice);
    localStorage.setItem('cs_orders', JSON.stringify(orders));

    // Reset Table to Cleaning or Available
    t.status = TABLE_STATUS.AVAILABLE;
    t.currentSession = null;
    t.reservation = null;
    t.total = 0;
    t.items = [];
    t.waiter = '—';

    TableManager.saveTables(tables);
    return completedInvoice;
  },

  // 6. Set table to cleaning
  setCleaning: (tableId) => {
    const tables = TableManager.getTables();
    const strId = String(tableId);
    const t = tables.find(t => String(t.id) === strId || String(t.number) === strId);
    if (!t) return null;
    t.status = TABLE_STATUS.CLEANING;
    t.currentSession = null;
    t.reservation = null;
    t.items = [];
    t.total = 0;
    t.waiter = '—';
    TableManager.saveTables(tables);
    return t;
  },

  // 7. Set table to available
  setAvailable: (tableId) => {
    const tables = TableManager.getTables();
    const strId = String(tableId);
    const t = tables.find(t => String(t.id) === strId || String(t.number) === strId);
    if (!t) return null;
    t.status = TABLE_STATUS.AVAILABLE;
    t.currentSession = null;
    t.reservation = null;
    t.items = [];
    t.total = 0;
    t.waiter = '—';
    TableManager.saveTables(tables);
    return t;
  },

  // 8. Transfer table session from one table to another
  transferTable: (fromTableId, toTableId) => {
    const tables = TableManager.getTables();
    const strFrom = String(fromTableId);
    const strTo = String(toTableId);
    const tFrom = tables.find(t => String(t.id) === strFrom || String(t.number) === strFrom);
    const tTo = tables.find(t => String(t.id) === strTo || String(t.number) === strTo);
    if (!tFrom || !tFrom.currentSession) throw new Error('طاولة المصدر لا تحتوي على جلسة نشطة');
    if (!tTo) throw new Error('طاولة الوجهة غير موجودة');

    // Transfer session
    tTo.status = TABLE_STATUS.OCCUPIED;
    tTo.currentSession = {
      ...tFrom.currentSession,
      customerName: tFrom.currentSession.customerName || 'عميل صالة',
      transferredFrom: tFrom.number,
      transferredAt: new Date().toISOString()
    };
    tTo.items = tFrom.items || [];
    tTo.total = tFrom.total || 0;
    tTo.waiter = tFrom.waiter || tTo.waiter || 'وليد صبحي صالة';

    // Free original table and set to cleaning
    tFrom.status = TABLE_STATUS.CLEANING;
    tFrom.currentSession = null;
    tFrom.reservation = null;
    tFrom.items = [];
    tFrom.total = 0;
    tFrom.waiter = '—';

    TableManager.saveTables(tables);
    return { from: tFrom, to: tTo };
  },

  // 9. Force free table
  forceFreeTable: (tableId, targetStatus = 'cleaning') => {
    if (targetStatus === 'available') {
      return TableManager.setAvailable(tableId);
    }
    return TableManager.setCleaning(tableId);
  }
};

// Sync Admin and Firestore users into local storage
export async function syncFirestoreUsers() {
  if (!db) return;
  try {
    const adminDocRef = doc(db, 'users', '3SNhsc2ilvc42YWXhKpLzBO5Yu32');
    const adminSnap = await getDoc(adminDocRef);
    const users = AuthService.getUsers();
    let modified = false;

    if (adminSnap.exists()) {
      const data = adminSnap.data();
      const existingIdx = users.findIndex(u => 
        u.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32' || 
        (u.email && u.email.toLowerCase() === (data.email || '').toLowerCase()) ||
        u.username === 'mahmoud.mostfa'
      );

      if (existingIdx !== -1) {
        users[existingIdx].role = 'admin';
        users[existingIdx].fullName = data.name || data.fullName || 'Mahmoud Mostafa';
        users[existingIdx].email = data.email || 'mahmoud.mostfa@app.com';
        users[existingIdx].active = true;
        users[existingIdx].id = '3SNhsc2ilvc42YWXhKpLzBO5Yu32';
        modified = true;
      } else {
        users.unshift({
          id: '3SNhsc2ilvc42YWXhKpLzBO5Yu32',
          username: 'mahmoud.mostfa',
          email: data.email || 'mahmoud.mostfa@app.com',
          fullName: data.name || data.fullName || 'Mahmoud Mostafa',
          role: 'admin',
          active: true,
          createdAt: new Date().toISOString(),
          permissions: ['all']
        });
        modified = true;
      }
    }

    if (modified) {
      AuthService.saveUsers(users);
      const currentSession = AuthService.getSession();
      if (currentSession && (
        (currentSession.email && currentSession.email.toLowerCase() === 'mahmoud.mostfa@app.com') ||
        currentSession.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32' ||
        currentSession.username === 'mahmoud.mostfa'
      )) {
        currentSession.role = 'admin';
        currentSession.fullName = 'Mahmoud Mostafa';
        AuthService.setSession(currentSession);
      }
    }
  } catch (err) {
    console.warn("syncFirestoreUsers notice:", err);
  }
}

// Trigger background sync
syncFirestoreUsers();

// Make available globally on window
if (typeof window !== 'undefined') {
  window.AuthService = AuthService;
  window.syncFirestoreUsers = syncFirestoreUsers;
  window.handleLogout = () => AuthService.logout();
  window.ROLES = ROLES;
  window.ROLE_LABELS = ROLE_LABELS;
  window.ROLE_ALLOWED_PAGES = ROLE_ALLOWED_PAGES;
  window.ROLE_HOME_PAGES = ROLE_HOME_PAGES;
  window.TableManager = TableManager;
  window.TABLE_STATUS = TABLE_STATUS;
  window.TABLE_STATUS_LABELS = TABLE_STATUS_LABELS;
}

export default AuthService;


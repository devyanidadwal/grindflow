// GrindFlow Frontend v4 - clean navigation and fade transitions
const API_BASE_URL = window.API_BASE_URL || `http://${location.hostname}:3000`;

async function apiGet(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers,
    credentials: 'include'
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path, body, options = {}) {
  const headers = { ...(options.headers || {}) };
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body,
    credentials: 'include'
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Toast helpers (Sonner if available, else alert)
function notifySuccess(message) {
  if (window.toast && window.toast.success) window.toast.success(message); else alert(message);
}
function notifyError(message) {
  if (window.toast && window.toast.error) window.toast.error(message); else alert(message);
}

// Auth helpers (optional; requires Supabase config in index.html)
let supabaseClient = null;
if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
  supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}

async function getAuthHeader() {
  try {
    if (!supabaseClient) return {};
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (_) {
    return {};
  }
}

async function ensureAuth() {
  let auth = await getAuthHeader();
  if (auth.Authorization) return auth;
  if (!supabaseClient) return {};
  try {
    if (supabaseClient.auth.signInAnonymously) {
      await supabaseClient.auth.signInAnonymously();
      await updateAuthState?.();
      auth = await getAuthHeader();
    }
  } catch (_) {}
  return auth;
}

document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('#main-content > section');
  const pageTitle = document.getElementById('page-title');
  const logoutBtn = document.getElementById('logout');
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('file-input');
  const authToggle = document.getElementById('auth-toggle');
  const authPanel = document.getElementById('auth-panel');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authSignin = document.getElementById('auth-signin');
  const authSignup = document.getElementById('auth-signup');
  const authSignout = document.getElementById('auth-signout');
  const authStatus = document.getElementById('auth-status');
  const sidebarUsername = document.getElementById('sidebar-username');

  function showSection(id){
    sections.forEach(s => {
      s.classList.remove('visible');
      s.classList.add('hidden');
    });
    const el = document.getElementById(id);
    if(el){
      el.classList.remove('hidden');
      // trigger fade animation
      setTimeout(() => el.classList.add('visible'), 50);
    }
    pageTitle.textContent = id.replace('-', ' ').toUpperCase();
  }

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      btn.classList.add('active');
      showSection(btn.dataset.view);
    });
  });

  logoutBtn?.addEventListener('click', () => {
    if (supabaseClient) {
      supabaseClient.auth.signOut().finally(() => location.reload());
    } else {
      window.location.href = 'login.html';
    }
  });

  // Auth UI handlers
  authToggle?.addEventListener('click', () => {
    if (!authPanel) return;
    const isHidden = authPanel.classList.contains('hidden');
    sections.forEach(s => s.classList.add('hidden'));
    if (isHidden) authPanel.classList.remove('hidden');
    pageTitle.textContent = 'AUTH';
  });

  authSignin?.addEventListener('click', async () => {
    if (!supabaseClient) {
      alert('Configure SUPABASE_URL and SUPABASE_ANON_KEY in index.html');
      return;
    }
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: authEmail?.value || '',
        password: authPassword?.value || ''
      });
      if (error) throw error;
      alert('Signed in');
      updateAuthState();
    } catch (e) {
      alert(`Sign-in failed: ${e.message || e}`);
    }
  });

  authSignup?.addEventListener('click', async () => {
    if (!supabaseClient) {
      alert('Configure SUPABASE_URL and SUPABASE_ANON_KEY in index.html');
      return;
    }
    try {
      const { error } = await supabaseClient.auth.signUp({
        email: authEmail?.value || '',
        password: authPassword?.value || ''
      });
      if (error) throw error;
      alert('Sign-up successful. Check your email to confirm (if required).');
      updateAuthState();
    } catch (e) {
      alert(`Sign-up failed: ${e.message || e}`);
    }
  });

  authSignout?.addEventListener('click', async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    updateAuthState();
    alert('Signed out');
  });

  function setAuthStatusText(text) {
    if (authStatus) authStatus.textContent = text;
  }

  async function updateAuthState() {
    if (!supabaseClient) {
      setAuthStatusText('Supabase not configured');
      return;
    }
    const { data } = await supabaseClient.auth.getSession();
    const userEmail = data?.session?.user?.email;
    if (userEmail) {
      setAuthStatusText(`Signed in as ${userEmail}`);
      if (sidebarUsername) sidebarUsername.textContent = userEmail;
    } else {
      setAuthStatusText('Not signed in');
    }
  }

  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(async () => {
      await updateAuthState();
      fetchFeedIfAuthed();
    });
    // Auto guest sign-in for prototype if not signed in
    (async () => {
      await updateAuthState();
      const { data } = await supabaseClient.auth.getSession();
      const hasSession = !!data?.session;
      if (!hasSession && window.GUEST_EMAIL && window.GUEST_PASSWORD) {
        try {
          const { error } = await supabaseClient.auth.signInWithPassword({
            email: window.GUEST_EMAIL,
            password: window.GUEST_PASSWORD
          });
          if (error) {
            console.warn('Guest sign-in failed:', error.message);
            // Try to create the guest user, then sign in again
            try {
              const { error: signupErr } = await supabaseClient.auth.signUp({
                email: window.GUEST_EMAIL,
                password: window.GUEST_PASSWORD
              });
              if (signupErr) {
                console.warn('Guest sign-up failed:', signupErr.message);
              } else {
                // If email confirmation is required, sign-in may still fail until confirmed
                const { error: signinErr2 } = await supabaseClient.auth.signInWithPassword({
                  email: window.GUEST_EMAIL,
                  password: window.GUEST_PASSWORD
                });
                if (signinErr2) console.warn('Guest re-sign-in failed (pending confirmation?):', signinErr2.message);
              }
            } catch (e2) {
              console.warn('Guest sign-up error:', e2.message || e2);
            }
            // Fallback to anonymous sign-in if available
            if (supabaseClient.auth.signInAnonymously) {
              try { await supabaseClient.auth.signInAnonymously(); } catch (_) {}
            }
          }
          await updateAuthState();
          fetchFeedIfAuthed();
        } catch (e) {
          console.warn('Guest sign-in error:', e.message || e);
        }
      } else if (!hasSession && supabaseClient.auth.signInAnonymously) {
        try {
          await supabaseClient.auth.signInAnonymously();
          await updateAuthState();
          fetchFeedIfAuthed();
        } catch (_) {}
      }
    })();
  }

  // Also try once on load (in case a session already exists)
  fetchFeedIfAuthed();

  // Basic connectivity checks
  apiGet('/health')
    .then(data => console.log('Health:', data))
    .catch(err => {
      console.error('Health error:', err);
      notifyError('Backend health check failed');
    });

  async function fetchFeedIfAuthed() {
    const auth = await getAuthHeader();
    if (!auth.Authorization) {
      console.warn('Skipping /api/feed: not authenticated. Configure Supabase to enable.');
      return;
    }
    apiGet('/api/feed', { headers: auth })
      .then(data => console.log('Feed:', data))
      .catch(err => {
        console.error('Feed error:', err);
        notifyError('Failed to load feed');
      });
  }

  // Upload handler (requires auth on backend)
  uploadBtn?.addEventListener('click', async () => {
    const file = fileInput?.files?.[0];
    if (!file) {
      notifyError('Choose a PDF first.');
      return;
    }
    try {
      const form = new FormData();
      form.append('file', file);
      let auth = await ensureAuth();
      if (!auth.Authorization) {
        notifyError('Auth unavailable. Enable anonymous or guest auth in Supabase.');
        return;
      }

      async function tryUpload(path) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
          method: 'POST',
          headers: { ...auth },
          body: form,
          credentials: 'include'
        });
        const text = await res.text();
        if (!res.ok) {
          const err = new Error(text || 'Upload failed');
          err.status = res.status;
          throw err;
        }
        try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
      }

      // Try the documented path; if 404, fall back to /api/upload
      let result;
      try {
        result = await tryUpload('/api/upload/upload');
      } catch (e) {
        if (e && e.status === 404) {
          result = await tryUpload('/api/upload');
        } else {
          throw e;
        }
      }
      notifySuccess('Document uploaded!');
      console.log('Upload result:', result);
    } catch (e) {
      console.error('Upload failed:', e);
      try {
        const data = typeof e.message === 'string' ? JSON.parse(e.message) : null;
        notifyError(data?.message || 'Upload failed. Check console for details.');
      } catch (_) {
        notifyError('Upload failed. Check console for details.');
      }
    }
  });
});

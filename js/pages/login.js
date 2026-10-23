/**
 * ShopLedger - Login Page View
 * Clean blue-and-white layout: Email, Password (with show/hide), and Sign In button.
 * Redirects securely based on resolved role from backend:
 * - Super Admin -> #/admin
 * - Admin -> #/dashboard
 * - Staff -> #/my-today
 */
import { authService } from '../services/index.js';
import { showToast } from '../components/toast.js';

export function renderLogin() {
  return `
    <div class="d-flex align-items-center justify-content-center min-vh-100 p-3" style="background-color: #f8fafc;">
      <div class="sl-card w-100 p-4 p-sm-5 bg-white border" style="max-width: 420px; border-radius: 16px; box-shadow: var(--sl-shadow-sm);">
        
        <!-- Header -->
        <div class="text-center mb-4">
          <div class="mx-auto mb-3" style="width: 48px; height: 48px; border-radius: 12px; background-color: var(--sl-brand-primary); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.5rem;">
            <i class="bi bi-wallet2"></i>
          </div>
          <h4 class="fw-bold mb-1 text-dark" style="letter-spacing: -0.5px;">ShopLedger</h4>
          <p class="text-muted small mb-0">Smart Shop Accounts & Cash Flow</p>
        </div>

        <div class="mb-3">
          <h6 class="fw-bold mb-1 text-dark">Sign In</h6>
          <p class="text-muted small mb-0">Enter your credentials to access your account</p>
        </div>

        <!-- Email & Password Form -->
        <form id="login-form">
          <div class="mb-3">
            <label for="login-email" class="form-label small fw-semibold text-secondary">Email Address</label>
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0 text-muted"><i class="bi bi-envelope"></i></span>
              <input type="email" class="form-control" id="login-email" placeholder="name@example.com" required autocomplete="email">
            </div>
          </div>

          <div class="mb-4">
            <label for="login-password" class="form-label small fw-semibold text-secondary">Password</label>
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0 text-muted"><i class="bi bi-lock"></i></span>
              <input type="password" class="form-control border-start-0 border-end-0" id="login-password" placeholder="Enter password" required autocomplete="current-password">
              <button class="btn btn-outline-secondary border-start-0 bg-white text-muted" type="button" id="toggle-password-visibility" aria-label="Toggle password visibility">
                <i class="bi bi-eye"></i>
              </button>
            </div>
          </div>

          <button type="submit" id="login-submit-btn" class="sl-btn sl-btn-primary sl-btn-block sl-btn-lg w-100">
            <span>Sign In</span>
            <i class="bi bi-arrow-right ms-1"></i>
          </button>
        </form>

      </div>
    </div>
  `;
}

export function bindLoginEvents(router) {
  // Password visibility show/hide toggle
  const passToggle = document.getElementById('toggle-password-visibility');
  const passInput = document.getElementById('login-password');
  if (passToggle && passInput) {
    passToggle.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      passToggle.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  }

  // Email/Password Form Submit
  const form = document.getElementById('login-form');
  const submitBtn = document.getElementById('login-submit-btn');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pass = document.getElementById('login-password').value;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing In...';

      try {
        const user = await authService.login(email, pass);
        showToast(`Signed in successfully as ${user.name || user.email}`, 'success');

        // Role-based routing
        if (user.role === 'super_admin') {
          router.navigate('#/admin');
        } else if (user.role === 'staff') {
          router.navigate('#/my-today');
        } else {
          router.navigate('#/dashboard');
        }
      } catch (err) {
        showToast(err.message || 'Invalid email or password.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In</span> <i class="bi bi-arrow-right ms-1"></i>`;
      }
    });
  }
}

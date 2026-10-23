/**
 * ShopLedger - Staff Invitation Acceptance Page (#/invite?token=...)
 * Validates invitation securely and provisions Staff account assigned to the specific shop.
 */
import { authService } from '../services/index.js';
import { showToast } from '../components/toast.js';

export async function renderInvite() {
  const hash = window.location.hash || '';
  const queryString = hash.includes('?') ? hash.split('?')[1] : '';
  const params = new URLSearchParams(queryString);
  const token = params.get('token');

  let invite = null;
  if (token) {
    try {
      invite = await authService.getInvitation(token);
    } catch (e) {
      invite = null;
    }
  }

  if (!invite) {
    return `
      <div class="d-flex align-items-center justify-content-center min-vh-100 p-3" style="background-color: #f8fafc;">
        <div class="sl-card w-100 p-4 p-sm-5 bg-white border text-center" style="max-width: 440px; border-radius: 16px;">
          <div class="mx-auto mb-3" style="width: 56px; height: 56px; border-radius: 50%; background-color: #fee2e2; display: flex; align-items: center; justify-content: center; color: #dc2626; font-size: 1.6rem;">
            <i class="bi bi-exclamation-triangle"></i>
          </div>
          <h5 class="fw-bold text-dark mb-2">Invalid or Expired Invitation</h5>
          <p class="text-muted small mb-4">
            This invitation link is invalid, expired, or has already been used. Please contact your store administrator to issue a new invite.
          </p>
          <a href="#/login" class="sl-btn sl-btn-primary w-100">
            <span>Back to Sign In</span>
          </a>
        </div>
      </div>
    `;
  }

  return `
    <div class="d-flex align-items-center justify-content-center min-vh-100 p-3" style="background-color: #f8fafc;">
      <div class="sl-card w-100 p-4 p-sm-5 bg-white border" style="max-width: 440px; border-radius: 16px;">
        
        <div class="text-center mb-4">
          <div class="mx-auto mb-3" style="width: 48px; height: 48px; border-radius: 12px; background-color: var(--sl-brand-primary); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.5rem;">
            <i class="bi bi-person-check"></i>
          </div>
          <h4 class="fw-bold mb-1 text-dark">Staff Invitation</h4>
          <p class="text-muted small mb-0">Join <strong>${invite.shopName || 'Shop'}</strong> on ShopLedger</p>
        </div>

        <form id="accept-invite-form" data-token="${invite.token}">
          <div class="mb-3">
            <label class="form-label small fw-semibold text-secondary">Your Name</label>
            <input type="text" class="form-control bg-light" value="${invite.name}" disabled>
          </div>

          <div class="mb-3">
            <label class="form-label small fw-semibold text-secondary">Your Email</label>
            <input type="email" class="form-control bg-light" value="${invite.email}" disabled>
          </div>

          <div class="mb-3">
            <label for="invite-password" class="form-label small fw-semibold text-secondary">Create Password</label>
            <div class="input-group">
              <input type="password" class="form-control border-end-0" id="invite-password" placeholder="Min. 6 characters" required minlength="6">
              <button class="btn btn-outline-secondary border-start-0 bg-white text-muted" type="button" id="toggle-invite-pass">
                <i class="bi bi-eye"></i>
              </button>
            </div>
          </div>

          <div class="mb-4">
            <label for="invite-confirm-password" class="form-label small fw-semibold text-secondary">Confirm Password</label>
            <input type="password" class="form-control" id="invite-confirm-password" placeholder="Re-enter password" required minlength="6">
          </div>

          <button type="submit" id="btn-submit-invite" class="sl-btn sl-btn-primary sl-btn-block sl-btn-lg w-100">
            <span>Accept & Create Account</span>
            <i class="bi bi-arrow-right ms-1"></i>
          </button>
        </form>

      </div>
    </div>
  `;
}

export function bindInviteEvents(router) {
  const toggleBtn = document.getElementById('toggle-invite-pass');
  const passInput = document.getElementById('invite-password');
  if (toggleBtn && passInput) {
    toggleBtn.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      toggleBtn.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  }

  const form = document.getElementById('accept-invite-form');
  const submitBtn = document.getElementById('btn-submit-invite');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = form.dataset.token;
      const pass = document.getElementById('invite-password').value;
      const confirmPass = document.getElementById('invite-confirm-password').value;

      if (pass !== confirmPass) {
        showToast('Passwords do not match.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating Account...';

      try {
        await authService.acceptInvitation(token, pass);
        showToast('Account created successfully! Welcome.', 'success');
        router.navigate('#/my-today');
      } catch (err) {
        showToast(err.message || 'Error accepting invitation', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Accept & Create Account</span> <i class="bi bi-arrow-right ms-1"></i>`;
      }
    });
  }
}

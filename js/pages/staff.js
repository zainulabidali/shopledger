/**
 * ShopLedger - Staff Management & Invitation View (Admin Only)
 * Allows Admins to invite staff by name & email, generate secure links,
 * copy links to clipboard, and activate/deactivate existing staff accounts.
 */
import { authService, shopService } from '../services/index.js';
import { showToast } from '../components/toast.js';

export async function renderStaff() {
  const user = await authService.getCurrentUser();
  if (!user) return '';

  const shopId = user.shopId || 'shop_metro_001';
  const [staffList, pendingInvites, shop] = await Promise.all([
    authService.getStaffUsers(shopId),
    authService.getPendingInvitations(shopId),
    shopService.getShop(shopId)
  ]);

  const shopName = shop ? shop.name : 'Your Shop';

  return `
    <div class="page-container" style="max-width: 960px;">
      <!-- Page Header -->
      <div class="page-header mb-4">
        <div>
          <h2 class="page-title">Staff Management</h2>
          <p class="page-subtitle">Manage counter staff and team invitations for ${shopName}</p>
        </div>

        <button type="button" class="sl-btn sl-btn-primary sl-btn-sm" data-bs-toggle="modal" data-bs-target="#inviteStaffModal">
          <i class="bi bi-person-plus-fill me-1"></i>
          <span>Invite Staff Member</span>
        </button>
      </div>

      <!-- Generated Invite Link Container (dynamically shown upon creation) -->
      <div id="generated-invite-container" class="d-none mb-4"></div>

      <!-- Active Staff Table -->
      <div class="sl-card p-0 mb-4 overflow-hidden border">
        <div class="p-3 bg-light border-bottom d-flex align-items-center justify-content-between">
          <h6 class="fw-bold mb-0 text-dark">
            <i class="bi bi-people me-2 text-primary"></i>Active Staff (${staffList.length})
          </h6>
        </div>

        ${staffList.length === 0 ? `
          <div class="text-center py-5">
            <i class="bi bi-people text-muted fs-1 mb-2 d-block"></i>
            <h6 class="fw-bold text-dark">No Active Staff Members</h6>
            <p class="text-muted small mb-3">Invite staff to give them dedicated counter billing access.</p>
            <button type="button" class="sl-btn sl-btn-primary sl-btn-sm" data-bs-toggle="modal" data-bs-target="#inviteStaffModal">
              <i class="bi bi-envelope me-1"></i>Invite Staff
            </button>
          </div>
        ` : `
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light small text-uppercase text-secondary" style="font-size: 11px;">
                <tr>
                  <th class="ps-3 py-3">Staff Name</th>
                  <th>Email</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th class="text-end pe-3">Action</th>
                </tr>
              </thead>
              <tbody>
                ${staffList.map(s => `
                  <tr>
                    <td class="ps-3">
                      <div class="fw-bold text-dark small">${s.name}</div>
                      <div class="text-muted" style="font-size: 11px;">ID: ${s.uid ? s.uid.slice(-6) : '-'}</div>
                    </td>
                    <td class="small text-secondary">${s.email}</td>
                    <td class="small text-muted">
                      ${s.createdAt ? new Date(s.createdAt.toDate ? s.createdAt.toDate() : s.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                    </td>
                    <td>
                      <span class="badge ${s.active !== false ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-muted'} rounded-pill" style="font-size: 10px;">
                        ${s.active !== false ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td class="text-end pe-3">
                      <button type="button" class="btn btn-sm ${s.active !== false ? 'btn-outline-danger' : 'btn-outline-success'} rounded-pill px-3 btn-toggle-staff" data-uid="${s.uid}" data-active="${s.active !== false}">
                        ${s.active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- Pending Invitations Table -->
      <div class="sl-card p-0 mb-4 overflow-hidden border">
        <div class="p-3 bg-light border-bottom d-flex align-items-center justify-content-between">
          <h6 class="fw-bold mb-0 text-dark">
            <i class="bi bi-clock-history me-2 text-warning"></i>Pending Invitations (${pendingInvites.length})
          </h6>
        </div>

        ${pendingInvites.length === 0 ? `
          <div class="p-4 text-center text-muted small">No pending invitations.</div>
        ` : `
          <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light small text-uppercase text-secondary" style="font-size: 11px;">
                <tr>
                  <th class="ps-3 py-3">Name</th>
                  <th>Email</th>
                  <th>Date Sent</th>
                  <th>Status</th>
                  <th class="text-end pe-3">Invite Link</th>
                </tr>
              </thead>
              <tbody>
                ${pendingInvites.map(inv => {
                  const link = `${window.location.origin}${window.location.pathname}#/invite?token=${inv.token}`;
                  return `
                    <tr>
                      <td class="ps-3 fw-bold small text-dark">${inv.name}</td>
                      <td class="small text-secondary">${inv.email}</td>
                      <td class="small text-muted">${(inv.createdAt || '').slice(0, 10)}</td>
                      <td>
                        <span class="badge bg-warning-subtle text-warning-emphasis rounded-pill" style="font-size: 10px;">Pending</span>
                      </td>
                      <td class="text-end pe-3">
                        <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3 btn-copy-link" data-link="${link}">
                          <i class="bi bi-clipboard me-1"></i>Copy Link
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- Invite Staff Modal -->
      <div class="modal fade" id="inviteStaffModal" tabindex="-1" aria-labelledby="inviteStaffModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow" style="border-radius: 16px;">
            <div class="modal-header border-bottom-0 pb-0">
              <h5 class="modal-title fw-bold" id="inviteStaffModalLabel">
                <i class="bi bi-person-plus text-primary me-2"></i>Invite Staff Member
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <form id="invite-staff-form">
              <div class="modal-body py-3">
                <p class="text-muted small mb-3">
                  Enter the staff member's details. A secure, unique invitation link will be generated for them to set their password.
                </p>

                <div class="mb-3">
                  <label for="invite-staff-name" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">
                    Staff Name
                  </label>
                  <input type="text" id="invite-staff-name" class="form-control" placeholder="e.g. Ramesh Kumar" required>
                </div>

                <div class="mb-3">
                  <label for="invite-staff-email" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">
                    Staff Email Address
                  </label>
                  <input type="email" id="invite-staff-email" class="form-control" placeholder="ramesh@example.com" required>
                </div>
              </div>
              <div class="modal-footer border-top-0 pt-0">
                <button type="button" class="btn btn-outline-secondary rounded-pill px-3" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" id="btn-submit-invite-staff" class="sl-btn sl-btn-primary sl-btn-sm rounded-pill px-4">
                  <span>Generate Invite Link</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

    </div>
  `;
}

export function bindStaffEvents(router) {
  // Copy invitation link buttons
  document.querySelectorAll('.btn-copy-link').forEach(btn => {
    btn.addEventListener('click', async () => {
      const link = btn.dataset.link;
      try {
        await navigator.clipboard.writeText(link);
        showToast('Invitation link copied to clipboard!', 'success');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check2 me-1"></i>Copied!';
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
      } catch (err) {
        showToast('Link: ' + link, 'info');
      }
    });
  });

  // Toggle staff active/inactive status
  document.querySelectorAll('.btn-toggle-staff').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const isCurrentlyActive = btn.dataset.active === 'true';
      const newStatus = !isCurrentlyActive;

      try {
        await authService.toggleUserStatus(uid, newStatus);
        showToast(newStatus ? 'Staff account activated.' : 'Staff account deactivated.', 'info');
        router.refresh();
      } catch (err) {
        showToast(err.message || 'Error updating staff status', 'error');
      }
    });
  });

  // Create staff invitation form
  const inviteForm = document.getElementById('invite-staff-form');
  if (inviteForm) {
    inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('invite-staff-name').value.trim();
      const email = document.getElementById('invite-staff-email').value.trim();
      const submitBtn = document.getElementById('btn-submit-invite-staff');

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...';

      try {
        const user = await authService.getCurrentUser();
        const shopId = user.shopId || 'shop_metro_001';

        const invite = await authService.createInvitation(shopId, { name, email });
        const inviteUrl = `${window.location.origin}${window.location.pathname}#/invite?token=${invite.token}`;

        // Close modal
        const modalEl = document.getElementById('inviteStaffModal');
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
          const modalInstance = window.bootstrap.Modal.getInstance(modalEl);
          if (modalInstance) modalInstance.hide();
        }

        // Try automatic copy to clipboard
        try {
          await navigator.clipboard.writeText(inviteUrl);
          showToast('Invitation created and link copied to clipboard!', 'success');
        } catch (e) {
          showToast('Invitation created successfully!', 'success');
        }

        // Show prominent link container on page
        const container = document.getElementById('generated-invite-container');
        if (container) {
          container.className = 'sl-card p-4 mb-4 border border-primary bg-primary-subtle';
          container.innerHTML = `
            <div class="d-flex align-items-center justify-content-between mb-2">
              <strong class="text-primary"><i class="bi bi-check-circle-fill me-2"></i>Invitation Link Created for ${invite.name}</strong>
              <button type="button" class="btn-close" aria-label="Close" onclick="this.closest('#generated-invite-container').classList.add('d-none')"></button>
            </div>
            <p class="small text-secondary mb-2">Share this unique link with the staff member to complete account setup:</p>
            <div class="input-group">
              <input type="text" class="form-control bg-white" readonly value="${inviteUrl}" id="new-invite-url-input">
              <button class="btn btn-primary" type="button" id="btn-copy-new-invite-link">
                <i class="bi bi-clipboard me-1"></i>Copy Link
              </button>
            </div>
          `;

          const copyBtn = document.getElementById('btn-copy-new-invite-link');
          if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
              await navigator.clipboard.writeText(inviteUrl);
              showToast('Link copied to clipboard!', 'success');
              copyBtn.innerHTML = '<i class="bi bi-check2 me-1"></i>Copied!';
            });
          }
        }

        // Refresh underlying lists after a short delay
        setTimeout(() => {
          router.refresh();
        }, 3000);

      } catch (err) {
        showToast(err.message || 'Error generating invitation', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Generate Invite Link</span>';
      }
    });
  }
}

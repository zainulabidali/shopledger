/**
 * ShopLedger - Super Admin Management Console (#/admin)
 * Minimal interface to create and manage Admin accounts, assign Admins to shops,
 * and activate/deactivate accounts and shops.
 */
import { shopService, authService } from '../services/index.js';
import { showToast } from '../components/toast.js';

export async function renderAdmin() {
  const user = await authService.getCurrentUser();
  if (!user || user.role !== 'super_admin') {
    return `
      <div class="page-container">
        <div class="alert alert-danger">Access Denied. Super Admin privilege required.</div>
      </div>
    `;
  }

  const [shops, admins] = await Promise.all([
    shopService.getAllShops(),
    authService.getAllAdmins()
  ]);

  const shopMap = {};
  shops.forEach(s => { shopMap[s.shopId] = s.name; });

  return `
    <div class="page-container" style="max-width: 1040px;">
      <!-- Page Header -->
      <div class="page-header mb-4">
        <div>
          <h2 class="page-title">Super Admin Console</h2>
          <p class="page-subtitle">Manage store admins, shop assignments, and system access</p>
        </div>

        <button type="button" class="sl-btn sl-btn-primary sl-btn-sm" data-bs-toggle="modal" data-bs-target="#createAdminModal">
          <i class="bi bi-person-plus-fill me-1"></i>
          <span>Create Admin Account</span>
        </button>
      </div>

      <!-- Quick Counts -->
      <div class="row g-3 mb-4">
        <div class="col-12 col-sm-4">
          <div class="sl-card p-3 border">
            <span class="small fw-semibold text-secondary text-uppercase" style="font-size: 11px;">Admin Accounts</span>
            <div class="fs-4 fw-bold text-dark mt-1">${admins.length}</div>
          </div>
        </div>
        <div class="col-12 col-sm-4">
          <div class="sl-card p-3 border">
            <span class="small fw-semibold text-secondary text-uppercase" style="font-size: 11px;">Registered Shops</span>
            <div class="fs-4 fw-bold text-primary mt-1">${shops.length}</div>
          </div>
        </div>
        <div class="col-12 col-sm-4">
          <div class="sl-card p-3 border">
            <span class="small fw-semibold text-secondary text-uppercase" style="font-size: 11px;">Active Tenants</span>
            <div class="fs-4 fw-bold text-success mt-1">${shops.filter(s => s.active !== false).length}</div>
          </div>
        </div>
      </div>

      <!-- 1. Admin Accounts Management Table -->
      <div class="sl-card p-0 mb-4 overflow-hidden border">
        <div class="p-3 bg-light border-bottom d-flex align-items-center justify-content-between">
          <h6 class="fw-bold mb-0 text-dark">
            <i class="bi bi-shield-person me-2 text-primary"></i>Admin Accounts (${admins.length})
          </h6>
        </div>

        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light small text-uppercase text-secondary" style="font-size: 11px;">
              <tr>
                <th class="ps-3 py-3">Admin Name</th>
                <th>Email</th>
                <th>Assigned Shop</th>
                <th>Status</th>
                <th class="text-end pe-3">Action</th>
              </tr>
            </thead>
            <tbody>
              ${admins.length === 0 ? `
                <tr><td colspan="5" class="text-center py-4 text-muted small">No Admin accounts found.</td></tr>
              ` : admins.map(a => `
                <tr>
                  <td class="ps-3 fw-bold small text-dark">${a.name}</td>
                  <td class="small text-secondary">${a.email}</td>
                  <td class="small text-dark fw-semibold">
                    ${shopMap[a.shopId] || a.shopId || 'Unassigned'}
                  </td>
                  <td>
                    <span class="badge ${a.active !== false ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill" style="font-size: 10px;">
                      ${a.active !== false ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td class="text-end pe-3">
                    <button type="button" class="btn btn-sm ${a.active !== false ? 'btn-outline-danger' : 'btn-outline-success'} rounded-pill px-3 btn-toggle-admin" data-uid="${a.uid}" data-active="${a.active !== false}">
                      ${a.active !== false ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 2. Registered Shops Directory -->
      <div class="sl-card p-0 mb-4 overflow-hidden border">
        <div class="p-3 bg-light border-bottom d-flex align-items-center justify-content-between">
          <h6 class="fw-bold mb-0 text-dark">
            <i class="bi bi-shop me-2 text-primary"></i>Registered Shops (${shops.length})
          </h6>
        </div>

        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light small text-uppercase text-secondary" style="font-size: 11px;">
              <tr>
                <th class="ps-3 py-3">Shop Name & ID</th>
                <th>Category</th>
                <th>Admin Name</th>
                <th>Status</th>
                <th class="text-end pe-3">Action</th>
              </tr>
            </thead>
            <tbody>
              ${shops.map(s => `
                <tr>
                  <td class="ps-3">
                    <div class="fw-bold text-dark small">${s.name}</div>
                    <div class="text-muted" style="font-size: 11px;">${s.shopId}</div>
                  </td>
                  <td class="small text-secondary">${s.category || 'Retail'}</td>
                  <td class="small text-dark">${s.ownerName || '-'}</td>
                  <td>
                    <span class="badge ${s.active !== false ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill" style="font-size: 10px;">
                      ${s.active !== false ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td class="text-end pe-3">
                    <button type="button" class="btn btn-sm ${s.active !== false ? 'btn-outline-danger' : 'btn-outline-success'} rounded-pill px-3 btn-toggle-shop" data-shop-id="${s.shopId}" data-active="${s.active !== false}">
                      ${s.active !== false ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create Admin Account Modal -->
      <div class="modal fade" id="createAdminModal" tabindex="-1" aria-labelledby="createAdminModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow" style="border-radius: 16px;">
            <div class="modal-header border-bottom-0 pb-0">
              <h5 class="modal-title fw-bold" id="createAdminModalLabel">
                <i class="bi bi-person-plus text-primary me-2"></i>Create Admin Account
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <form id="create-admin-form">
              <div class="modal-body py-3">
                <div class="mb-3">
                  <label for="admin-name" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">Admin Name</label>
                  <input type="text" id="admin-name" class="form-control" placeholder="e.g. John Doe" required>
                </div>

                <div class="mb-3">
                  <label for="admin-email" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">Email Address</label>
                  <input type="email" id="admin-email" class="form-control" placeholder="admin@example.com" required>
                </div>

                <div class="mb-3">
                  <label for="admin-password" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">Password</label>
                  <input type="password" id="admin-password" class="form-control" value="Admin@123" required minlength="6">
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">Shop Assignment</label>
                  <select id="admin-shop-select" class="form-select">
                    <option value="__NEW__">+ Create & Assign to New Shop</option>
                    ${shops.map(s => `<option value="${s.shopId}">${s.name} (${s.shopId})</option>`).join('')}
                  </select>
                </div>

                <div id="new-shop-fields">
                  <div class="mb-3">
                    <label for="new-shop-title" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">New Shop Name</label>
                    <input type="text" id="new-shop-title" class="form-control" placeholder="e.g. City Mart">
                  </div>
                  <div class="mb-3">
                    <label for="new-shop-category" class="form-label small fw-bold text-secondary text-uppercase" style="font-size: 11px;">Category</label>
                    <input type="text" id="new-shop-category" class="form-control" placeholder="e.g. Retail, Electronics">
                  </div>
                </div>
              </div>
              <div class="modal-footer border-top-0 pt-0">
                <button type="button" class="btn btn-outline-secondary rounded-pill px-3" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" id="btn-submit-create-admin" class="sl-btn sl-btn-primary sl-btn-sm rounded-pill px-4">
                  <span>Save Admin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

    </div>
  `;
}

export function bindAdminEvents(router) {
  // Toggle new shop fields in modal based on select
  const shopSelect = document.getElementById('admin-shop-select');
  const newShopFields = document.getElementById('new-shop-fields');
  if (shopSelect && newShopFields) {
    shopSelect.addEventListener('change', () => {
      newShopFields.style.display = shopSelect.value === '__NEW__' ? 'block' : 'none';
    });
  }

  // Toggle Admin status
  document.querySelectorAll('.btn-toggle-admin').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const isCurrentlyActive = btn.dataset.active === 'true';
      const newStatus = !isCurrentlyActive;

      try {
        await authService.toggleUserStatus(uid, newStatus);
        showToast(newStatus ? 'Admin account activated.' : 'Admin account deactivated.', 'info');
        router.refresh();
      } catch (err) {
        showToast(err.message || 'Error updating admin status', 'error');
      }
    });
  });

  // Toggle Shop status
  document.querySelectorAll('.btn-toggle-shop').forEach(btn => {
    btn.addEventListener('click', async () => {
      const shopId = btn.dataset.shopId;
      const isCurrentlyActive = btn.dataset.active === 'true';
      const newStatus = !isCurrentlyActive;

      try {
        await shopService.toggleShopStatus(shopId, newStatus);
        showToast(newStatus ? 'Shop activated.' : 'Shop suspended.', 'info');
        router.refresh();
      } catch (err) {
        showToast(err.message || 'Error updating shop status', 'error');
      }
    });
  });

  // Create Admin form submit
  const form = document.getElementById('create-admin-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('admin-name').value.trim();
      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value;
      const selectedShop = document.getElementById('admin-shop-select').value;
      const submitBtn = document.getElementById('btn-submit-create-admin');

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

      try {
        if (selectedShop === '__NEW__') {
          const shopName = document.getElementById('new-shop-title').value.trim() || `${name}'s Shop`;
          const category = document.getElementById('new-shop-category').value.trim() || 'Retail';
          await shopService.createShopWithAdmin(
            { name: shopName, category },
            { name, email, password }
          );
        } else {
          await authService.createAdminUser(selectedShop, { name, email, password });
        }

        // Hide modal
        const modalEl = document.getElementById('createAdminModal');
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
          const modalInstance = window.bootstrap.Modal.getInstance(modalEl);
          if (modalInstance) modalInstance.hide();
        }

        showToast(`Admin account for ${name} created successfully!`, 'success');
        router.refresh();
      } catch (err) {
        showToast(err.message || 'Error creating admin account', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Save Admin</span>';
      }
    });
  }
}

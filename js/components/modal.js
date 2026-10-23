/**
 * ShopLedger - Accessible Modal Dialog Helper
 */

let activeModalInstance = null;

export function showConfirmModal({
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmClass = 'btn-primary',
  onConfirm = () => {}
}) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal fade" id="sl-generic-modal" tabindex="-1" aria-labelledby="slGenericModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg" style="border-radius: 16px;">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold" id="slGenericModalLabel">${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body py-3 text-secondary">
            ${message}
          </div>
          <div class="modal-footer border-top-0 pt-0">
            <button type="button" class="btn btn-outline-secondary rounded-pill px-3" data-bs-dismiss="modal">${cancelText}</button>
            <button type="button" class="btn ${confirmClass} rounded-pill px-4" id="sl-modal-confirm-btn">${confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const modalEl = document.getElementById('sl-generic-modal');
  if (window.bootstrap && window.bootstrap.Modal) {
    activeModalInstance = new window.bootstrap.Modal(modalEl);
    activeModalInstance.show();
  }

  const confirmBtn = document.getElementById('sl-modal-confirm-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (activeModalInstance) activeModalInstance.hide();
      await onConfirm();
    });
  }
}

export function closeModal() {
  if (activeModalInstance) {
    activeModalInstance.hide();
    activeModalInstance = null;
  }
}

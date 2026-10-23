/**
 * ShopLedger - Toast Notification Component
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `sl-toast toast-${type}`;

  let icon = 'bi-info-circle-fill text-primary';
  if (type === 'success') icon = 'bi-check-circle-fill text-success';
  if (type === 'error') icon = 'bi-exclamation-octagon-fill text-danger';
  if (type === 'warning') icon = 'bi-exclamation-triangle-fill text-warning';

  toast.innerHTML = `
    <i class="bi ${icon} fs-5"></i>
    <div class="flex-grow-1">${message}</div>
    <button type="button" class="btn-close btn-close-sm ms-2" aria-label="Close"></button>
  `;

  // Optional haptic vibration for mobile users
  if (navigator.vibrate) {
    if (type === 'success') navigator.vibrate(25);
    else if (type === 'error') navigator.vibrate([40, 40, 40]);
  }

  const closeBtn = toast.querySelector('.btn-close');
  closeBtn.addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

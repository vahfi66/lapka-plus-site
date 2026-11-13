const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('#mobile-nav');
toggle?.addEventListener('click', () => {
  const expanded = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!expanded));
  menu.hidden = expanded;
});
menu?.addEventListener('click', event => {
  if (event.target.closest('a')) { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
});
const form = document.querySelector('#booking-form');
const status = document.querySelector('.form-status');
const fields = form?.querySelector('fieldset');
const button = form?.querySelector('button[type=submit]');
let requestId = null;
const api = 'https://lapka-plus-booking.netlify.app/api';
const dateInput = form?.elements.date;
const timeInput = form?.elements.time;
let availabilityVersion = 0;
async function checkAvailability() {
  if (!dateInput?.value || !timeInput?.value || fields.disabled) return;
  const version = ++availabilityVersion;
  try {
    const response = await fetch(`${api}/availability?date=${encodeURIComponent(dateInput.value)}`, {cache:'no-store'});
    const result = await response.json();
    if (version !== availabilityVersion) return;
    if (!response.ok) throw new Error();
    const slot = Date.parse(`${dateInput.value}T${timeInput.value}:00Z`);
    timeInput.setCustomValidity(result.busy.some(value => Math.abs(Date.parse(`${value}:00Z`) - slot) <= 600000) ? 'Это время занято. Выберите другое.' : '');
    if (timeInput.validationMessage) status.textContent = timeInput.validationMessage;
  } catch { if (version === availabilityVersion) timeInput.setCustomValidity('Не удалось проверить время. Попробуйте ещё раз.'); }
}
dateInput?.addEventListener('change', checkAvailability);
timeInput?.addEventListener('change', checkAvailability);
if (form) {
  fetch(`${api}/status`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(result => {
    if (!result?.ready) return;
    fields.disabled = false;
    status.textContent = 'Заявка будет отправлена администратору. Это ещё не подтверждённая запись.';
  }).catch(() => {});
  form.addEventListener('submit', async event => {
    event.preventDefault();
    timeInput.setCustomValidity('');
    await checkAvailability();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    values.consent = values.consent === 'on';
    values.id = requestId ||= crypto.randomUUID();
    values.note ||= '';
    button.disabled = true;
    button.textContent = 'Отправляем…';
    status.textContent = 'Отправляем заявку…';
    try {
      const response = await fetch(`${api}/appointment`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(values) });
      const result = await response.json();
      if (response.ok && result.ok) {
        form.reset(); requestId = null;
        status.textContent = 'Заявка доставлена администратору. Это ещё не подтверждённая запись.';
      } else {
        status.textContent = result.error || 'Не удалось отправить заявку. Попробуйте позже.';
        if ((response.status === 409 && !result.conflict) || (response.status >= 500 && !result.retry)) { fields.disabled = true; return; }
        requestId = null;
      }
    } catch {
      status.textContent = 'Не удалось подтвердить доставку. Не отправляйте заявку повторно; обратитесь в клинику другим способом.';
      fields.disabled = true;
      return;
    } finally { button.disabled = false; button.textContent = 'Записаться'; }
  });
}

// Android delegates geo links to the user's installed map application.
if (/Android/i.test(navigator.userAgent)) {
  document.querySelectorAll('.open-maps').forEach(link => { link.href = link.dataset.androidHref; });
}

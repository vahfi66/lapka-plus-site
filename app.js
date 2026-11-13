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
const storageKey = 'lapka-booking-v1';
let saved;
try {
  saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (!saved?.visitor) saved = {visitor: crypto.randomUUID(), id: null};
  localStorage.setItem(storageKey, JSON.stringify(saved));
} catch { saved = null; }
const persist = () => localStorage.setItem(storageKey, JSON.stringify(saved));
const cancelButton = document.createElement('button');
cancelButton.type = 'button';
cancelButton.className = 'button button-secondary';
cancelButton.textContent = 'Отозвать заявку';
cancelButton.hidden = true;
form?.after(cancelButton);
async function syncApplication() {
  if (!saved?.id) return false;
  const response = await fetch(`${api}/mine`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(saved)});
  if (!response.ok) throw new Error();
  const {state} = await response.json();
  if (['pending','sent','approved'].includes(state)) {
    fields.disabled = true;
    cancelButton.hidden = state === 'pending';
    status.textContent = state === 'pending' ? 'Статус заявки уточняется. Обратитесь в клинику, если он долго не меняется.' : state === 'approved' ? 'Заявка принята администратором.' : 'Заявка доставлена администратору. Ожидайте подтверждения.';
    return true;
  }
  saved.id = null; persist();
  if (state === 'rejected') status.textContent = 'Заявка отклонена. Вы можете выбрать другое время.';
  return false;
}
cancelButton.addEventListener('click', async () => {
  cancelButton.disabled = true;
  try {
    const response = await fetch(`${api}/cancel`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(saved)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    saved.id = null; persist(); cancelButton.hidden = true; fields.disabled = false;
    status.textContent = result.notified ? 'Заявка отозвана, время снова свободно. Администратор уведомлён.' : 'Заявка отозвана, время свободно. Не удалось уведомить администратора.';
  } catch (error) { status.textContent = error.message || 'Не удалось отозвать заявку. Попробуйте ещё раз.'; }
  finally { cancelButton.disabled = false; }
});
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
  fetch(`${api}/status`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(async result => {
    if (!result?.ready) return;
    if (!saved) { status.textContent = 'Для записи разрешите сохранение данных сайта в браузере.'; return; }
    if (await syncApplication()) return;
    fields.disabled = false;
    status.textContent = 'Заявка будет отправлена администратору. Это ещё не подтверждённая запись.';
  }).catch(() => { status.textContent = 'Не удалось проверить состояние заявки. Попробуйте обновить страницу.'; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    timeInput.setCustomValidity('');
    await checkAvailability();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    values.consent = values.consent === 'on';
    values.id = requestId ||= crypto.randomUUID();
    values.visitor = saved.visitor;
    values.note ||= '';
    saved.id = values.id;
    try { persist(); } catch { status.textContent = 'Не удалось сохранить состояние заявки в браузере.'; return; }
    button.disabled = true;
    button.textContent = 'Отправляем…';
    status.textContent = 'Отправляем заявку…';
    try {
      const response = await fetch(`${api}/appointment`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(values) });
      const result = await response.json();
      if (response.ok && result.ok) {
        form.reset(); requestId = null; fields.disabled = true; cancelButton.hidden = false;
        status.textContent = 'Заявка доставлена администратору. Это ещё не подтверждённая запись.';
      } else {
        status.textContent = result.error || 'Не удалось отправить заявку. Попробуйте позже.';
        if (result.active && result.id) { saved.id = result.id; persist(); await syncApplication(); return; }
        if ((response.status === 409 && !result.conflict) || (response.status >= 500 && !result.retry)) { fields.disabled = true; return; }
        saved.id = null; persist();
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

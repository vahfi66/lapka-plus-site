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
let credential = null;
let activeId = null;
const signIn = document.createElement('div');
signIn.className = 'google-signin';
form?.before(signIn);
const authHeaders = () => ({'content-type':'application/json', authorization:`Bearer ${credential}`});
const cancelButton = document.createElement('button');
cancelButton.type = 'button';
cancelButton.className = 'button button-secondary';
cancelButton.textContent = 'Отозвать заявку';
cancelButton.hidden = true;
form?.after(cancelButton);
async function syncApplication() {
  const response = await fetch(`${api}/mine`, {method:'POST',headers:authHeaders(),body:'{}'});
  if (!response.ok) throw new Error();
  const {state,id} = await response.json();
  activeId = id;
  if (['pending','sent','approved'].includes(state)) {
    fields.disabled = true;
    cancelButton.hidden = state === 'pending';
    status.textContent = state === 'pending' ? 'Статус заявки уточняется. Обратитесь в клинику, если он долго не меняется.' : state === 'approved' ? 'Заявка принята администратором.' : 'Заявка доставлена администратору. Ожидайте подтверждения.';
    return true;
  }
  return false;
}
cancelButton.addEventListener('click', async () => {
  cancelButton.disabled = true;
  try {
    const response = await fetch(`${api}/cancel`, {method:'POST',headers:authHeaders(),body:JSON.stringify({id:activeId})});
    const result = await response.json();
    if (response.status === 401) { credential=null; signIn.hidden=false; cancelButton.hidden=true; status.textContent='Войдите в Google ещё раз, чтобы отозвать заявку.'; return; }
    if (!response.ok) throw new Error(result.error);
    activeId = null; cancelButton.hidden = true; fields.disabled = false;
    status.textContent = result.notified ? 'Заявка отозвана, время снова свободно. Администратор уведомлён.' : 'Заявка отозвана, время свободно. Уведомление администратору будет отправлено повторно.';
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
    status.textContent = 'Войдите через Google, чтобы записаться и управлять заявкой.';
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onerror = () => { status.textContent = 'Не удалось загрузить вход через Google. Попробуйте позже.'; };
    script.onload = () => {
      google.accounts.id.initialize({client_id:result.googleClientId, callback:async response => {
        credential = response.credential; signIn.hidden = true;
        try {
          if (await syncApplication()) return;
          fields.disabled = false;
          status.textContent = 'Заявка будет отправлена администратору. Это ещё не подтверждённая запись.';
        } catch { credential=null; signIn.hidden=false; status.textContent='Не удалось проверить заявку. Войдите ещё раз.'; }
      }});
      google.accounts.id.renderButton(signIn,{theme:'outline',size:'large',text:'signin_with',locale:'ru'});
    };
    document.head.append(script);
  }).catch(() => { status.textContent = 'Не удалось проверить состояние заявки. Попробуйте обновить страницу.'; });
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
      const response = await fetch(`${api}/appointment`, { method:'POST', headers:authHeaders(), body:JSON.stringify(values) });
      const result = await response.json();
      if (response.ok && result.ok) {
        activeId = values.id; form.reset(); requestId = null; fields.disabled = true; cancelButton.hidden = false;
        status.textContent = 'Заявка доставлена администратору. Это ещё не подтверждённая запись.';
      } else {
        status.textContent = result.error || 'Не удалось отправить заявку. Попробуйте позже.';
        if (result.active && result.id) { activeId = result.id; await syncApplication(); return; }
        if (response.status === 401) { credential=null; signIn.hidden=false; fields.disabled=true; return; }
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

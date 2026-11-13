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
const storageKey = 'lapka-demo-appointment';
let saved = null;
try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}
if (form && fields && status) {
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.className = 'button button-secondary';
  cancel.textContent = 'Отозвать запись'; form.after(cancel);
  function show() {
    fields.disabled = !!saved;
    cancel.hidden = !saved;
    status.textContent = saved ? 'Демонстрационная запись прошла успешно. Время сохранено в этом браузере.' : 'Демонстрационная запись сохраняется только в вашем браузере.';
  }
  cancel.addEventListener('click', () => {
    try { localStorage.removeItem(storageKey); saved = null; show(); status.textContent = 'Демонстрационная запись отозвана. Время снова доступно.'; }
    catch { status.textContent = 'Не удалось отозвать запись. Проверьте настройки браузера.'; }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (saved || !form.reportValidity()) return;
    const data = new FormData(form);
    const entry = {date:data.get('date'),time:data.get('time')};
    try { localStorage.setItem(storageKey,JSON.stringify(entry)); saved=entry; form.reset(); show(); }
    catch { status.textContent = 'Не удалось сохранить запись. Разрешите сохранение данных сайта в браузере.'; }
  });
  show();
}

// Android delegates geo links to the user's installed map application.
if (/Android/i.test(navigator.userAgent)) {
  document.querySelectorAll('.open-maps').forEach(link => { link.href = link.dataset.androidHref; });
}

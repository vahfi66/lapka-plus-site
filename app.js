const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.menu-drawer');

if (toggle && menu) {
  const mobileLayout = matchMedia('(max-width: 840px)');

  toggle.addEventListener('click', () => {
    menu.showModal();
    toggle.setAttribute('aria-expanded', 'true');
  });
  menu.addEventListener('close', () => toggle.setAttribute('aria-expanded', 'false'));
  menu.addEventListener('click', event => {
    if (event.target.closest('a')) menu.close();
  });
  mobileLayout.addEventListener('change', event => {
    if (!event.matches && menu.open) menu.close();
  });
}

document.querySelectorAll('.doctor-trigger').forEach(button => {
  const dialog = document.getElementById(button.dataset.profile);
  button.addEventListener('click', () => dialog.showModal());
});

document.querySelectorAll('.menu-drawer, .doctor-profile').forEach(dialog => {
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
});

const form = document.querySelector('#booking-form');
const status = document.querySelector('.form-status');
const fields = form?.querySelector('fieldset');
const storageKey = 'lapka-demo-appointment';
let saved = null;
try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}
if (form && fields && status) {
  const service = form.elements.namedItem('service');

  document.querySelectorAll('.service-card[data-service]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      service.value = link.dataset.service;

      if (event.pointerType === 'touch') {
        link.classList.add('is-pressed');
        setTimeout(() => link.classList.remove('is-pressed'), 160);
      }
    });
  });

  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.className = 'button button-secondary';
  cancel.textContent = 'Отозвать запись'; form.after(cancel);
  function show() {
    fields.disabled = !!saved;
    cancel.hidden = !saved;
    status.hidden = !saved;
    status.textContent = saved ? 'Заявка отправлена администратору в Telegram.' : '';
  }
  cancel.addEventListener('click', () => {
    try { localStorage.removeItem(storageKey); saved = null; show(); status.hidden = false; status.textContent = 'Заявка отозвана у администратора в Telegram. Время снова доступно.'; }
    catch { status.hidden = false; status.textContent = 'Не удалось отозвать запись. Проверьте настройки браузера.'; }
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

const carousel = document.querySelector('.review-carousel');
if (carousel) {
  const slides = [...carousel.querySelectorAll('.review-slide')];
  const dots = [...carousel.querySelectorAll('.review-dot')];
  let active = 0;

  function showReview(index) {
    active = (index + slides.length) % slides.length;
    slides.forEach((slide, position) => {
      slide.hidden = position !== active;
      dots[position].setAttribute('aria-current', String(position === active));
    });
  }

  carousel.querySelector('.review-prev').addEventListener('click', () => showReview(active - 1));
  carousel.querySelector('.review-next').addEventListener('click', () => showReview(active + 1));
  dots.forEach((dot, index) => dot.addEventListener('click', () => showReview(index)));
  carousel.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    showReview(active + (event.key === 'ArrowRight' ? 1 : -1));
  });
}

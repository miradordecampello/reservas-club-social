import emailjs from 'emailjs';

const CLIENT_ID        = "197533726270-t6o7bn7g2kpfgq1aehmbie4dt8nu0q6k.apps.googleusercontent.com";
const API_KEY          = "AIzaSyBCuaHjRs6FhlHGsE1VMRLVsgYgOtCnt68";
const SCOPES           = 'https://www.googleapis.com/auth/calendar';
const CALENDAR_ID      = 'csmiradordecampello@gmail.com';
const EMAILJS_USER_ID  = 'TU_EMAILJS_USER_ID';
const EMAILJS_SERVICE  = 'TU_SERVICE_ID';
const EMAILJS_TEMPLATE = 'TU_TEMPLATE_ID';
const ADMIN_EMAIL      = CALENDAR_ID;

let userEmail = '';
let userName  = '';

const signInBtn     = document.getElementById('sign-in-button');
const signOutBtn    = document.getElementById('sign-out-button');
const calendarEl    = document.getElementById('calendar-container');
const modal         = document.getElementById('modal');
const closeModal    = modal.querySelector('.close');
const form          = document.getElementById('reservation-form');
const deleteBtn     = document.getElementById('delete-button');
const loader        = document.getElementById('loader');

function showLoader() { loader.classList.remove('hidden'); }
function hideLoader() { loader.classList.add('hidden'); }

function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
    scope: SCOPES
  }).then(() => {
    emailjs.init(EMAILJS_USER_ID);
    const auth = gapi.auth2.getAuthInstance();
    auth.isSignedIn.listen(onSignInChanged);
    onSignInChanged(auth.isSignedIn.get());
    signInBtn.onclick  = () => auth.signIn();
    signOutBtn.onclick = () => auth.signOut();
  });
}

function onSignInChanged(signedIn) {
  if (signedIn) {
    const profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
    userEmail = profile.getEmail();
    userName  = profile.getName();
    signInBtn.classList.add('hidden');
    signOutBtn.classList.remove('hidden');
    loadEvents();
  } else {
    signInBtn.classList.remove('hidden');
    signOutBtn.classList.add('hidden');
    calendarEl.innerHTML = '<p class="info">Inicie sesión para ver y gestionar reservas.</p>';
  }
}

function loadEvents() {
  showLoader();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end   = new Date(now.getFullYear(), now.getMonth()+1, 0,23,59,59).toISOString();
  gapi.client.calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: start,
    timeMax: end,
    singleEvents: true,
    orderBy: 'startTime'
  }).then(res => {
    renderCalendar(res.result.items, now);
    hideLoader();
  }).catch(e => { console.error(e); hideLoader(); });
}

function renderCalendar(events, date) {
  calendarEl.innerHTML = '';
  const year = date.getFullYear(), month = date.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const weekDays = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  // Headers
  weekDays.forEach(d => {
    const c = document.createElement('div');
    c.className = 'day-cell header';
    c.textContent = d;
    calendarEl.appendChild(c);
  });
  // Empty slots
  for (let i=0; i<firstWeekday; i++){
    const c = document.createElement('div');
    c.className = 'day-cell empty';
    calendarEl.appendChild(c);
  }
  // Days
  for (let day=1; day<=daysInMonth; day++){
    const dObj = new Date(year, month, day);
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.dataset.date = dObj.toISOString();
    const num = document.createElement('span');
    num.className = 'date-number';
    num.textContent = day;
    cell.appendChild(num);

    const ev = events.find(e => {
      const evd = new Date(e.start.date || e.start.dateTime);
      return evd.getDate()===day && evd.getMonth()===month && evd.getFullYear()===year;
    });
    if (ev) {
      cell.classList.add('reserved');
      const title = document.createElement('div');
      title.className = 'event-title';
      title.textContent = ev.summary;
      cell.appendChild(title);
    }
    cell.addEventListener('click', ()=> openModal(dObj, ev));
    calendarEl.appendChild(cell);
  }
}

function openModal(dObj, ev){
  // si ya hay reserva y no eres creador ni admin, bloquear edición
  if (ev) {
    const isOwner = ev.creator && ev.creator.email === userEmail;
    const isAdmin = userEmail === CALENDAR_ID;
    if (!isOwner && !isAdmin) {
      alert('Solo el creador o el administrador puede modificar o eliminar esta reserva.');
      return;
    }
  }
  document.getElementById('modal-title').textContent = ev ? 'Editar reserva' : 'Crear reserva';
  form.reset();
  document.getElementById('event-id').value = ev ? ev.id : '';
  document.getElementById('date').value = dObj.toISOString().slice(0,10);
  if (ev){
    const ext = (ev.extendedProperties && ev.extendedProperties.private) || {};
    document.getElementById('name').value       = ext.name || '';
    document.getElementById('floor-door').value= ext.floorDoor || '';
    document.getElementById('phone').value      = ext.phone || '';
    document.getElementById('email').value      = ext.email || '';
    deleteBtn.classList.remove('hidden');
  } else {
    document.getElementById('name').value  = userName;
    document.getElementById('email').value = userEmail;
    deleteBtn.classList.add('hidden');
  }
  modal.classList.remove('hidden');
}

closeModal.onclick = () => modal.classList.add('hidden');
window.addEventListener('click', e => { if (e.target===modal) modal.classList.add('hidden'); });

form.addEventListener('submit', e => {
  e.preventDefault();
  const id         = document.getElementById('event-id').value;
  const name       = document.getElementById('name').value.trim();
  const floorDoor  = document.getElementById('floor-door').value.trim();
  const phone      = document.getElementById('phone').value.trim();
  const email      = document.getElementById('email').value.trim();
  const dateStr    = document.getElementById('date').value;
  const isoDate    = new Date(dateStr).toISOString().slice(0,10);
  const eventData = {
    summary: `${name} - ${floorDoor}`,
    description: `Teléfono: ${phone}`,
    start: { date: isoDate },
    end: { date: isoDate },
    extendedProperties: { private: { name, floorDoor, phone, email } },
    reminders: { useDefault: false, overrides: [{ method:'email', minutes:1440 }] }
  };
  showLoader();
  const req = id
    ? gapi.client.calendar.events.patch({ calendarId: CALENDAR_ID, eventId: id, resource: eventData })
    : gapi.client.calendar.events.insert({ calendarId: CALENDAR_ID, resource: eventData });
  req.then(() => {
    sendEmails(email, name, floorDoor, dateStr);
    modal.classList.add('hidden');
    loadEvents();
  }).catch(err => { console.error(err); hideLoader(); });
});

deleteBtn.addEventListener('click', ()=>{
  if (!confirm('¿Eliminar reserva?')) return;
  const id = document.getElementById('event-id').value;
  showLoader();
  gapi.client.calendar.events.delete({ calendarId: CALENDAR_ID, eventId: id })
    .then(()=>{ modal.classList.add('hidden'); loadEvents(); })
    .catch(err=>{ console.error(err); hideLoader(); });
});

function sendEmails(userTo, nombre, piso, fecha) {
  const baseParams = {
    user_name: nombre,
    floor_door: piso,
    date: fecha
  };
  // envío de confirmación al usuario
  emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, { ...baseParams, user_email: userTo })
    .then(() => {
      // notificación al administrador
      return emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, { ...baseParams, user_email: ADMIN_EMAIL });
    })
    .catch(err => console.error('EmailJS error', err))
    .finally(() => hideLoader());
}

// Espera a que gapi esté listo
(function waitGapi(){
  if (window.gapi && gapi.load) {
    gapi.load('client:auth2', initClient);
  } else {
    setTimeout(waitGapi, 100);
function handleCredentialResponse(response) {
  const token = response.credential;

  // Decodificamos el token para obtener los datos del usuario
  const data = parseJwt(token);

  console.log("Usuario autenticado:");
  console.log("Nombre: " + data.name);
  console.log("Correo: " + data.email);
  console.log("Imagen: " + data.picture);

  // Aquí podrías mostrar un mensaje de bienvenida, guardar datos, etc.
}

// Función para decodificar el token JWT
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
  }
})();

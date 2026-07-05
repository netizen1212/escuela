// app.js
// Lógica extraída de index.html y reorganizada.
// Requiere firebase-config.js en la raíz (definiendo `const firebaseConfig = { ... }`) o fallará a modo local.

(function(){
  // ======== Utilidades DOM ========
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const formSection = $('#form-section');
  const studentForm = $('#student-form');
  const studentsGrid = $('#students-grid');
  const emptyState = $('#empty-state');
  const searchInput = $('#search-input');
  const toggleFormBtn = $('#toggle-form-btn');
  const closeFormBtn = $('#close-form-btn');
  const cancelBtn = $('#cancel-btn');
  const addFirstBtn = $('#add-first-btn');
  const submitBtn = $('#submit-btn');
  const submitText = $('#submit-text');
  const formTitle = $('#form-title');
  const toast = $('#toast');
  const toastMessage = $('#toast-message');
  const deleteModal = $('#delete-modal');
  const deleteStudentName = $('#delete-student-name');
  const cancelDeleteBtn = $('#cancel-delete-btn');
  const confirmDeleteBtn = $('#confirm-delete-btn');
  const detailModal = $('#detail-modal');
  const closeDetailBtn = $('#close-detail-btn');
  const limitWarning = $('#limit-warning');
  const countText = $('#count-text');
  const syncStatus = $('#sync-status');
  const syncText = $('#sync-text');

  // Auth UI placeholder container in header
  const header = document.querySelector('header .max-w-7xl');
  const authContainer = document.createElement('div');
  authContainer.className = 'ml-4';
  // append to header controls area if possible
  const headerRight = header.querySelector('.flex.items-center.gap-3') || header.querySelector(':scope > div:last-child');
  if (headerRight) headerRight.appendChild(authContainer);

  // ======== Estado ========
  let students = [];
  let editingStudent = null;
  let deletingStudent = null;
  let currentRecordCount = 0;

  let db = null;
  let auth = null;
  let isFirebaseInitialized = false;
  let isOnline = navigator.onLine;

  // Pending queue for sync
  const PENDING_KEY = 'estudiantes_pending_queue';

  function enqueuePending(action, payload){
    const queue = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    queue.push({action, payload, ts: Date.now()});
    localStorage.setItem(PENDING_KEY, JSON.stringify(queue));
  }

  async function flushPendingQueue(){
    if (!isFirebaseInitialized || !auth || !auth.currentUser || !isOnline) return;
    const queue = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    if (queue.length === 0) return;
    updateSyncStatus('syncing','Sincronizando pendientes...');
    while(queue.length){
      const item = queue.shift();
      try{
        if (item.action === 'create'){
          await db.collection('estudiantes').add({ ...item.payload, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp(), synced: true });
        } else if (item.action === 'update'){
          await db.collection('estudiantes').doc(item.payload.id).update({ ...item.payload.data, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), synced: true });
        } else if (item.action === 'delete'){
          await db.collection('estudiantes').doc(item.payload.id).delete();
        }
      } catch (err){
        console.error('Error procesando pendiente', err);
        // Put back remaining items and stop
        queue.unshift(item);
        break;
      }
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(queue));
    if (queue.length === 0) updateSyncStatus('online','Sincronizado');
  }

  // ======== Toast ========
  function showToast(message, isSuccess = true){
    const toastIcon = document.getElementById('toast-icon');
    toastMessage.textContent = message;
    toastIcon.style.color = isSuccess ? '#4ecdc4' : '#ff6b6b';
    toast.classList.remove('translate-y-full','opacity-0');
    setTimeout(()=>{toast.classList.add('translate-y-full','opacity-0');},3000);
  }

  // ======== Sync status ========
  function updateSyncStatus(status, message){
    syncStatus.className = `sync-status ${status}`;
    syncText.textContent = message;
  }

  window.addEventListener('online', ()=>{ isOnline = true; updateSyncStatus('online','En línea'); showToast('Conexión restaurada'); flushPendingQueue(); loadStudentsFromCloud(); });
  window.addEventListener('offline', ()=>{ isOnline = false; updateSyncStatus('offline','Sin conexión'); showToast('Modo offline - Los datos se guardarán localmente', false); });

  // ======== Firebase init ========
  function initFirebase(){
    if (!window.firebaseConfig) return false;
    try{
      firebase.initializeApp(window.firebaseConfig);
      db = firebase.firestore();
      auth = firebase.auth();
      isFirebaseInitialized = true;
      console.log('Firebase inicializado');
      return true;
    } catch (err){
      console.error('No se pudo inicializar Firebase', err);
      return false;
    }
  }

  // ======== Auth UI & flows ========
  function renderAuthUI(user){
    authContainer.innerHTML = '';
    const btn = document.createElement('div');
    if (user){
      const name = user.displayName || user.email || (user.isAnonymous ? 'Anónimo' : 'Usuario');
      const avatar = user.photoURL ? `<img src="${user.photoURL}" alt="avatar" class="rounded-full w-6 h-6"/>` : '';
      btn.innerHTML = `<div class="flex items-center gap-2"><span class="text-sm text-gray-200">${avatar}<span style="margin-left:6px">${name}</span></span><button id="sign-out" class="px-3 py-1 rounded-lg text-sm text-white" style="background: #ef4444;">Cerrar</button></div>`;
      authContainer.appendChild(btn);
      authContainer.querySelector('#sign-out').addEventListener('click', ()=>auth.signOut());
    } else {
      btn.innerHTML = `<button id="sign-in" class="px-3 py-1 rounded-lg text-sm text-white" style="background: linear-gradient(135deg,#4ecdc4,#44a08d);">Iniciar sesión</button>`;
      authContainer.appendChild(btn);
      authContainer.querySelector('#sign-in').addEventListener('click', showAuthModal);
    }
  }

  function showAuthModal(){
    // Simple modal with email/password, anonymous and Google sign-in
    const modal = document.createElement('div');
    modal.style.position='fixed'; modal.style.inset=0; modal.style.background='rgba(0,0,0,0.6)'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.zIndex=9999;
    modal.innerHTML = `
      <div style="background:#0d1724;padding:20px;border-radius:12px;max-width:480px;width:100%;color:#fff;">
        <h3 style="margin:0 0 12px 0;font-weight:700;">Iniciar sesión</h3>
        <input id="auth-email" placeholder="Correo electrónico" style="width:100%;padding:10px;margin-bottom:8px;border-radius:8px;background:#071122;border:1px solid rgba(255,255,255,0.06);" />
        <input id="auth-pass" placeholder="Contraseña" type="password" style="width:100%;padding:10px;margin-bottom:8px;border-radius:8px;background:#071122;border:1px solid rgba(255,255,255,0.06);" />
        <div style="display:flex;gap:8px;justify-content:space-between;margin-top:8px;flex-wrap:wrap;">
          <div style="display:flex;gap:8px;">
            <button id="auth-anon" style="padding:8px 12px;border-radius:8px;background:#f59e0b;color:#072;">Anónimo</button>
            <button id="auth-signup" style="padding:8px 12px;border-radius:8px;background:#06b;color:#fff;">Crear cuenta</button>
            <button id="auth-signin" style="padding:8px 12px;border-radius:8px;background:#4ecdc4;color:#012;">Entrar</button>
          </div>
          <button id="auth-google" style="padding:8px 12px;border-radius:8px;background:#4285F4;color:#fff;">Entrar con Google</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#auth-signin').addEventListener('click', async ()=>{
      const email = modal.querySelector('#auth-email').value;
      const pass = modal.querySelector('#auth-pass').value;
      try{ await auth.signInWithEmailAndPassword(email, pass); document.body.removeChild(modal); showToast('Sesión iniciada'); }
      catch(err){ showToast('Error: '+err.message,false); }
    });

    modal.querySelector('#auth-signup').addEventListener('click', async ()=>{
      const email = modal.querySelector('#auth-email').value;
      const pass = modal.querySelector('#auth-pass').value;
      try{ await auth.createUserWithEmailAndPassword(email, pass); document.body.removeChild(modal); showToast('Cuenta creada'); }
      catch(err){ showToast('Error: '+err.message,false); }
    });

    modal.querySelector('#auth-anon').addEventListener('click', async ()=>{
      try{ await auth.signInAnonymously(); document.body.removeChild(modal); showToast('Sesión anónima'); }
      catch(err){ showToast('Error: '+err.message,false); }
    });

    modal.querySelector('#auth-google').addEventListener('click', async ()=>{
      try{
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
        document.body.removeChild(modal);
        showToast('Sesión iniciada con Google');
      } catch(err){ console.error('Google sign-in error', err); showToast('Error: '+err.message, false); }
    });

    modal.addEventListener('click', (e)=>{ if (e.target===modal) document.body.removeChild(modal); });
  }

  // ======== CRUD operations (cloud) ========
  async function createStudentInCloud(studentData){
    if (!isFirebaseInitialized) throw new Error('Firebase no inicializado');
    if (!auth.currentUser) throw new Error('Autenticación requerida');
    const docRef = await db.collection('estudiantes').add({ ...studentData, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp(), synced: true });
    return { id: docRef.id, ...studentData };
  }
  async function updateStudentInCloud(id, studentData){
    if (!isFirebaseInitialized) throw new Error('Firebase no inicializado');
    if (!auth.currentUser) throw new Error('Autenticación requerida');
    await db.collection('estudiantes').doc(id).update({ ...studentData, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), synced: true });
    return { id, ...studentData };
  }
  async function deleteStudentFromCloud(id){
    if (!isFirebaseInitialized) throw new Error('Firebase no inicializado');
    if (!auth.currentUser) throw new Error('Autenticación requerida');
    await db.collection('estudiantes').doc(id).delete();
    return true;
  }

  // ======== Load / realtime ========
  async function loadStudentsFromCloud(){
    if (!isFirebaseInitialized) return;
    updateSyncStatus('syncing','Cargando...');
    try{
      const snapshot = await db.collection('estudiantes').orderBy('createdAt','desc').get();
      students = snapshot.docs.map(doc=>({ __backendId: doc.id, ...doc.data(), created_at: doc.data().createdAt?.toDate?.().toISOString() || new Date().toISOString() }));
      renderStudents(students);
      updateSyncStatus('online','Sincronizado');
      localStorage.setItem('estudiantes_backup', JSON.stringify(students));
    } catch(err){ console.error(err); updateSyncStatus('offline','Error de carga'); const backup = localStorage.getItem('estudiantes_backup'); if (backup){ students = JSON.parse(backup); renderStudents(students); } }
  }

  function setupRealtimeListener(){
    if (!isFirebaseInitialized) return;
    db.collection('estudiantes').orderBy('createdAt','desc').onSnapshot(snapshot=>{
      students = snapshot.docs.map(doc=>({ __backendId: doc.id, ...doc.data(), created_at: doc.data().createdAt?.toDate?.().toISOString() || new Date().toISOString() }));
      renderStudents(students);
      updateSyncStatus('online','En tiempo real');
      localStorage.setItem('estudiantes_backup', JSON.stringify(students));
    }, err=>{ console.error('Realtime error',err); updateSyncStatus('offline','Error de sincronización'); });
  }

  // ======== UI functions (reuse simplified) ========
  function setButtonLoading(loading, success=null){
    if (loading){ submitBtn.classList.add('loading'); submitText.textContent='Guardando...'; submitBtn.disabled=true; }
    else { submitBtn.classList.remove('loading'); submitBtn.disabled=false; if (success===true){ submitText.textContent='¡Guardado!'; setTimeout(()=> submitText.textContent = editingStudent ? 'Actualizar en la Nube' : 'Guardar en la Nube', 1500); } else if (success===false){ submitText.textContent='Error'; setTimeout(()=> submitText.textContent = editingStudent ? 'Actualizar en la Nube' : 'Guardar en la Nube', 1500); } else { submitText.textContent = editingStudent ? 'Actualizar en la Nube' : 'Guardar en la Nube'; } }
  }

  function toggleForm(show, isEdit=false){ if (show){ formSection.classList.remove('hidden'); formTitle.textContent = isEdit ? 'Editar Estudiante' : 'Registrar Nuevo Estudiante'; submitText.textContent = isEdit ? 'Actualizar en la Nube' : 'Guardar en la Nube'; } else { formSection.classList.add('hidden'); studentForm.reset(); editingStudent=null; submitBtn.classList.remove('success','error'); } }

  function populateForm(student){ if (!student) return; ['nombre','apellido','fecha_nacimiento','genero','email','telefono','direccion','tipo_sangre','alergias','condiciones_medicas','medicamentos','contacto_emergencia','telefono_emergencia'].forEach(k=>{ const el = document.getElementById(k); if (el) el.value = student[k] || ''; }); }

  function createStudentCard(student){
    const initials = `${(student.nombre||'')[0] || ''}${(student.apellido||'')[0] || ''}`.toUpperCase();
    const card = document.createElement('div'); card.className='card-hover rounded-2xl p-5 cursor-pointer'; card.style.cssText='background: rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06);'; card.dataset.id = student.__backendId || '';
    const syncIndicator = student.synced ? '<span style="color:#4ecdc4">●</span>' : '<span style="color:#f59e0b">●</span>';
    card.innerHTML = `<div class="flex items-start justify-between mb-4"><div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white" style="background:linear-gradient(135deg,#4ecdc4,#44a08d);">${initials}</div><div><h3 class="font-semibold text-white">${student.nombre||''} ${student.apellido||''} ${syncIndicator}</h3><p class="text-sm text-gray-400">${student.email || 'Sin correo'}</p></div></div><div class="flex gap-1"><button class="edit-btn p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all" data-id="${student.__backendId||''}">✎</button><button class="delete-btn p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all" data-id="${student.__backendId||''}">🗑</button></div></div>`;
    card.addEventListener('click', (e)=>{ if (!e.target.closest('.edit-btn') && !e.target.closest('.delete-btn')) showStudentDetail(student); });
    return card;
  }

  function renderStudents(data){ const searchTerm = (searchInput.value||'').toLowerCase(); const filtered = data.filter(s => `${s.nombre||''} ${s.apellido||''}`.toLowerCase().includes(searchTerm) || (s.email && s.email.toLowerCase().includes(searchTerm))); if (filtered.length===0){ studentsGrid.classList.add('hidden'); emptyState.classList.remove('hidden'); } else { emptyState.classList.add('hidden'); studentsGrid.classList.remove('hidden'); studentsGrid.innerHTML=''; filtered.forEach((s,i)=>{ const c = createStudentCard(s); c.classList.add('animate-slide-in'); c.style.animationDelay = `${i*0.05}s`; studentsGrid.appendChild(c); }); attachCardListeners(); } currentRecordCount = data.length; countText.textContent = `${currentRecordCount} estudiante${currentRecordCount!==1 ? 's' : ''}`; document.getElementById('student-count').classList.remove('hidden'); if (currentRecordCount>=999) limitWarning.classList.remove('hidden'); else limitWarning.classList.add('hidden'); }

  function attachCardListeners(){ $$('.edit-btn').forEach(btn=>{ btn.onclick = (e)=>{ e.stopPropagation(); const id = btn.dataset.id; const student = students.find(s=>s.__backendId===id); if (student){ editingStudent = student; populateForm(student); toggleForm(true,true); window.scrollTo({top:0,behavior:'smooth'}); } }; }); $$('.delete-btn').forEach(btn=>{ btn.onclick = (e)=>{ e.stopPropagation(); const id = btn.dataset.id; const student = students.find(s=>s.__backendId===id); if (student){ deletingStudent = student; deleteStudentName.textContent = `${student.nombre} ${student.apellido}`; deleteModal.classList.remove('hidden'); deleteModal.classList.add('flex'); } }; }); }

  function showStudentDetail(student){ const initials = `${(student.nombre||'')[0]||''}${(student.apellido||'')[0]||''}`.toUpperCase(); document.getElementById('detail-avatar').textContent = initials; document.getElementById('detail-name').textContent = `${student.nombre||''} ${student.apellido||''}`; document.getElementById('detail-email').textContent = student.email || 'Sin correo electrónico'; const formatDate = (d)=>{ if (!d) return 'No especificada'; const date = new Date(d); return date.toLocaleDateString('es-ES',{year:'numeric',month:'long',day:'numeric'}); }; const detailContent = document.getElementById('detail-content'); detailContent.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4"><div class="p-4 rounded-xl" style="background: rgba(255,255,255,0.03);"><h4 style="color:#4ecdc4;">Información Personal</h4><div class="space-y-2 text-sm"><div class="flex justify-between"><span class="text-gray-400">Fecha de Nacimiento</span><span class="text-white">${formatDate(student.fecha_nacimiento)}</span></div><div class="flex justify-between"><span class="text-gray-400">Género</span><span class="text-white capitalize">${student.genero||'No especificado'}</span></div><div class="flex justify-between"><span class="text-gray-400">Teléfono</span><span class="text-white">${student.telefono||'No especificado'}</span></div></div></div><div class="p-4 rounded-xl" style="background: rgba(255,255,255,0.03);"><h4 style="color:#ff6b6b;">Información Médica</h4><div class="space-y-2 text-sm"><div class="flex justify-between"><span class="text-gray-400">Tipo de Sangre</span><span class="text-white font-semibold">${student.tipo_sangre||'No especificado'}</span></div><div><span class="text-gray-400 block mb-1">Alergias</span><span class="text-white">${student.alergias||'Ninguna reportada'}</span></div></div></div></div>`; detailModal.classList.remove('hidden'); detailModal.classList.add('flex'); }

  // ======== Event listeners ========
  studentForm.addEventListener('submit', async (e)=>{
    e.preventDefault(); if (!editingStudent && currentRecordCount>=999){ showToast('Has alcanzado el límite máximo de estudiantes', false); return; }
    setButtonLoading(true);
    const formData = new FormData(studentForm);
    const studentData = { nombre: formData.get('nombre'), apellido: formData.get('apellido'), fecha_nacimiento: formData.get('fecha_nacimiento'), genero: formData.get('genero'), email: formData.get('email'), telefono: formData.get('telefono'), direccion: formData.get('direccion'), tipo_sangre: formData.get('tipo_sangre'), alergias: formData.get('alergias'), condiciones_medicas: formData.get('condiciones_medicas'), medicamentos: formData.get('medicamentos'), contacto_emergencia: formData.get('contacto_emergencia'), telefono_emergencia: formData.get('telefono_emergencia'), created_at: editingStudent ? editingStudent.created_at : new Date().toISOString() };
    try{
      if (editingStudent){
        if (isFirebaseInitialized && isOnline && auth && auth.currentUser){
          await updateStudentInCloud(editingStudent.__backendId, studentData);
          showToast('Estudiante actualizado en la nube');
        } else {
          const updated = {...editingStudent, ...studentData, synced:false}; const idx = students.findIndex(s=>s.__backendId===editingStudent.__backendId); if (idx!==-1){ students[idx]=updated; renderStudents(students); localStorage.setItem('estudiantes_backup', JSON.stringify(students)); }
          enqueuePending('update',{ id: editingStudent.__backendId, data: studentData });
          showToast('Guardado localmente - Se sincronizará al reconectar', false);
        }
      } else {
        if (isFirebaseInitialized && isOnline && auth && auth.currentUser){
          await createStudentInCloud(studentData);
          showToast('Estudiante guardado en la nube exitosamente');
        } else {
          const tempId = 'temp_' + Date.now(); const newStudent = { __backendId: tempId, ...studentData, synced:false, pendingSync:true }; students.unshift(newStudent); renderStudents(students); localStorage.setItem('estudiantes_backup', JSON.stringify(students)); enqueuePending('create', studentData); showToast('Guardado localmente - Se sincronizará al reconectar', false);
        }
      }
      setButtonLoading(false, true); setTimeout(()=>toggleForm(false), 900);
    } catch(err){ console.error(err); setButtonLoading(false,false); showToast('Error al guardar: '+err.message, false); }
  });

  confirmDeleteBtn.addEventListener('click', async ()=>{
    if (!deletingStudent) return; confirmDeleteBtn.disabled = true; confirmDeleteBtn.textContent = 'Eliminando...';
    try{
      if (isFirebaseInitialized && isOnline && auth && auth.currentUser){ await deleteStudentFromCloud(deletingStudent.__backendId); }
      else { enqueuePending('delete', { id: deletingStudent.__backendId }); }
      students = students.filter(s=>s.__backendId !== deletingStudent.__backendId); renderStudents(students); localStorage.setItem('estudiantes_backup', JSON.stringify(students)); showToast('Estudiante eliminado correctamente');
    } catch(err){ console.error(err); showToast('Error al eliminar', false); }
    confirmDeleteBtn.disabled = false; confirmDeleteBtn.textContent = 'Eliminar'; deleteModal.classList.add('hidden'); deleteModal.classList.remove('flex'); deletingStudent = null;
  });

  toggleFormBtn.addEventListener('click', ()=> toggleForm(true)); closeFormBtn.addEventListener('click', ()=> toggleForm(false)); cancelBtn.addEventListener('click', ()=> toggleForm(false)); addFirstBtn.addEventListener('click', ()=> toggleForm(true)); cancelDeleteBtn.addEventListener('click', ()=>{ deleteModal.classList.add('hidden'); deleteModal.classList.remove('flex'); deletingStudent = null; }); closeDetailBtn.addEventListener('click', ()=>{ detailModal.classList.add('hidden'); detailModal.classList.remove('flex'); }); detailModal.addEventListener('click', (e)=>{ if (e.target===detailModal) { detailModal.classList.add('hidden'); detailModal.classList.remove('flex'); } }); deleteModal.addEventListener('click', (e)=>{ if (e.target===deleteModal){ deleteModal.classList.add('hidden'); deleteModal.classList.remove('flex'); deletingStudent = null; } }); searchInput.addEventListener('input', ()=> renderStudents(students));

  // ======== Initialization ========
  function initApp(){
    // load backup
    const backup = localStorage.getItem('estudiantes_backup'); if (backup){ students = JSON.parse(backup); renderStudents(students); }
    // init firebase if config exists
    const ok = initFirebase();
    if (!ok){ updateSyncStatus('offline','Firebase no configurado'); showToast('Configure Firebase para sincronización en la nube', false); renderAuthUI(null); return; }
    // auth ready
    auth.onAuthStateChanged(user=>{ renderAuthUI(user); if (user){ flushPendingQueue(); loadStudentsFromCloud(); setupRealtimeListener(); } else { updateSyncStatus('online','No autenticado'); loadStudentsFromCloud().catch(()=>{}); } });
  }

  // Start
  initApp();
})();

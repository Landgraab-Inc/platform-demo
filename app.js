import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const SUPABASE_URL = 'https://jiczytytsapzfljkbhne.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_j__PxwdyHlNQ4xAnKLnEvQ_DU5U-RvO'
const MODULE_ID = 'A2.1-M01'
const ACTIVITY_ID = 'A2.1-M01:ex01'

const app = document.querySelector('#app')

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  app.innerHTML = '<main class="shell"><section class="card"><h1>Нужно подключить Supabase</h1><p>Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в локальный .env. Секретный service-role key в браузер добавлять нельзя.</p></section></main>'
  throw new Error('Missing Supabase public configuration')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
let currentUser = null
let profile = null
let moduleData = null
let answer = ''
let saveTimer = null

const esc = (value='') => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))

async function boot() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error && error.name !== 'AuthSessionMissingError') throw error
  currentUser = user || null
  if (!currentUser) return renderAuth()
  await ensureProfile()
  await loadModule()
  await loadAnswer()
  renderModule()
}

async function ensureProfile() {
  const { data, error } = await supabase
    .from('app_users')
    .select('id,email,display_name,role')
    .eq('auth_subject', currentUser.id)
    .maybeSingle()

  if (error) throw error
  if (data) {
    profile = data
    return
  }

  const { data: created, error: insertError } = await supabase
    .from('app_users')
    .insert({
      auth_subject: currentUser.id,
      email: currentUser.email,
      display_name: currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'Ученик',
      role: 'student'
    })
    .select('id,email,display_name,role')
    .single()

  if (insertError) throw insertError
  profile = created
}

async function loadModule() {
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id,status,course_id')
    .eq('student_id', profile.id)
    .eq('course_id', 'A2.1')
    .eq('status', 'active')
    .maybeSingle()

  if (enrollmentError) throw enrollmentError
  if (!enrollment && profile.role === 'student') {
    moduleData = { locked: true }
    return
  }

  const [{ data: module, error: moduleError }, { data: sections, error: sectionsError }, { data: activities, error: activitiesError }] = await Promise.all([
    supabase.from('course_modules').select('id,title,learning_outcome,course_id').eq('id', MODULE_ID).single(),
    supabase.from('module_sections').select('id,legacy_key,ordinal,title,duration_label').eq('module_id', MODULE_ID).order('ordinal'),
    supabase.from('activities').select('id,section_id,legacy_key,ordinal,type,title,skill,payload,grading').like('id', MODULE_ID + ':%').order('ordinal')
  ])

  if (moduleError) throw moduleError
  if (sectionsError) throw sectionsError
  if (activitiesError) throw activitiesError

  moduleData = { module, sections, activities }
}

async function loadAnswer() {
  if (!profile || moduleData?.locked) return
  const { data, error } = await supabase
    .from('activity_attempts')
    .select('id,attempt_no,status,answer,started_at')
    .eq('student_id', profile.id)
    .eq('activity_id', ACTIVITY_ID)
    .order('attempt_no', { ascending: false })
    .limit(1)

  if (error) throw error
  answer = data?.[0]?.answer?.text || ''
}

function renderAuth(message='') {
  app.innerHTML = `
    <main class="shell">
      <section class="auth card">
        <span class="badge">MVP · A2.1-M01</span>
        <h1 style="margin-top:16px">Войти в учебную платформу</h1>
        <p class="muted">Первый серверный вертикальный срез CENTRUM DEUTSCH.</p>
        ${message ? '<div class="notice error">'+esc(message)+'</div>' : ''}
        <form id="login-form">
          <label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" required></label>
          <label class="field"><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required></label>
          <button class="btn" type="submit">Войти</button>
        </form>
      </section>
    </main>`
  document.querySelector('#login-form').addEventListener('submit', login)
}

async function login(event) {
  event.preventDefault()
  const fd = new FormData(event.currentTarget)
  const { error } = await supabase.auth.signInWithPassword({
    email: fd.get('email'),
    password: fd.get('password')
  })
  if (error) return renderAuth(error.message)
  await boot()
}

async function logout() {
  await supabase.auth.signOut()
  currentUser = null
  profile = null
  moduleData = null
  answer = ''
  renderAuth()
}

function renderModule() {
  if (moduleData?.locked) {
    app.innerHTML = `
      <main class="shell">
        <header class="topbar"><div class="brand">CENTRUM DEUTSCH</div><button id="logout" class="btn secondary">Выйти</button></header>
        <section class="card"><span class="badge">A2.1</span><h1 style="margin-top:16px">Доступ к курсу пока не назначен</h1><p>Аккаунт работает, но сервер не нашёл активный enrollment A2.1. Это ожидаемое защищённое состояние MVP.</p></section>
      </main>`
    document.querySelector('#logout').addEventListener('click', logout)
    return
  }

  const activity = moduleData.activities.find(x => x.id === ACTIVITY_ID)
  const source = activity?.payload?.source || []

  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div><div class="brand">CENTRUM DEUTSCH</div><div class="muted">Серверный MVP · ${esc(profile.display_name || profile.email)}</div></div>
        <button id="logout" class="btn secondary">Выйти</button>
      </header>
      <div class="grid">
        <section>
          <span class="badge">A2.1 · Модуль 01</span>
          <h1 style="margin-top:16px">${esc(moduleData.module.title)}</h1>
          <p class="muted">${esc(moduleData.module.learning_outcome || '')}</p>
          <section class="card">
            <h2>${esc(activity?.title || 'Что изменилось?')}</h2>
            <p>${esc(activity?.payload?.instruction || '')}</p>
            <div class="chat">
              ${source.map(item => '<div class="bubble"><strong>'+esc(item.speaker)+'</strong><br><span lang="de">'+esc(item.text)+'</span></div>').join('')}
            </div>
            <label class="field">
              <span>Мой ответ</span>
              <textarea id="answer" placeholder="${esc(activity?.payload?.placeholder || '')}">${esc(answer)}</textarea>
            </label>
            <div class="savebar">
              <button id="save" class="btn">Сохранить ответ</button>
              <span id="save-status" class="status">Ответ загружен с сервера.</span>
            </div>
          </section>
        </section>
        <aside class="card">
          <h3>Структура модуля</h3>
          <div class="sections">
            ${moduleData.sections.map(section => '<div class="section"><span>'+section.ordinal+'. '+esc(section.title)+'</span><span class="muted">'+esc(section.duration_label || '')+'</span></div>').join('')}
          </div>
          <div class="notice">Сейчас серверно подключён первый контрольный ответ ex01. Остальные разделы уже загружаются из PostgreSQL как структура модуля.</div>
        </aside>
      </div>
    </main>`

  document.querySelector('#logout').addEventListener('click', logout)
  document.querySelector('#save').addEventListener('click', () => saveAnswer(true))
  document.querySelector('#answer').addEventListener('input', event => {
    answer = event.target.value
    const status = document.querySelector('#save-status')
    status.textContent = 'Есть несохранённые изменения…'
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveAnswer(false), 900)
  })
}

async function saveAnswer(explicit) {
  if (!profile) return
  const status = document.querySelector('#save-status')
  if (status) status.textContent = 'Сохраняем…'

  const { error } = await supabase
    .from('activity_attempts')
    .upsert({
      student_id: profile.id,
      activity_id: ACTIVITY_ID,
      attempt_no: 1,
      status: 'draft',
      answer: { text: answer }
    }, { onConflict: 'student_id,activity_id,attempt_no' })

  if (error) {
    if (status) status.textContent = 'Не удалось сохранить: ' + error.message
    return
  }

  if (status) status.textContent = explicit ? 'Сохранено на сервере.' : 'Автосохранение выполнено.'
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    currentUser = null
    renderAuth()
  } else if (session?.user) {
    currentUser = session.user
  }
})

boot().catch(error => {
  console.error(error)
  app.innerHTML = '<main class="shell"><section class="card"><h1>Ошибка запуска MVP</h1><div class="notice error">'+esc(error.message)+'</div><p>Проверьте миграции, RLS и публичные параметры Supabase.</p></section></main>'
})

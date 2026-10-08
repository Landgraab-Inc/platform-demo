import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const SUPABASE_URL = 'https://jiczytytsapzfljkbhne.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_j__PxwdyHlNQ4xAnKLnEvQ_DU5U-RvO'
const MODULE_ID = 'A2.1-M01'
const COURSE_ID = 'A2.1'

const app = document.querySelector('#app')

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  app.innerHTML = '<main class="shell"><section class="card"><h1>Нужно подключить Supabase</h1><p>Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в локальный .env. Секретный service-role key в браузер добавлять нельзя.</p></section></main>'
  throw new Error('Missing Supabase public configuration')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

const state = {
  user: null,
  profile: null,
  data: null,
  saveTimers: new Map(),
  savePromises: new Map(),
  saveStates: new Map(),
  pendingDrafts: new Map(),
  recording: null
}

const SECTION_COPY = {
  start: ['Разогрев и повторение', 'Актуализируй знакомые модели A1 и проверь, что готов двигаться дальше.'],
  grammar: ['Новая грамматика', 'Сравни weil и denn и отработай позицию личного глагола.'],
  vocab: ['Лексика и произношение', 'Собери устойчивые сочетания для встречи, времени и переноса планов.'],
  reading: ['Чтение', 'Пойми, как участники меняют договорённость и какие ограничения влияют на решение.'],
  practice: ['Закрепление', 'Перейди от модели к собственным формулировкам и выбору общего времени.'],
  listening: ['Аудирование', 'Услышь новое время, место и причину переноса в голосовом сообщении.'],
  speaking: ['Речь и взаимодействие', 'Сначала отрепетируй реплику, затем отреагируй на изменение условия.'],
  project: ['Творческая задача', 'Собери итоговую договорённость и отправь письменную часть преподавателю.'],
  feedback: ['Обратная связь', 'Сопоставь результат с целью и подготовь улучшенную версию.'],
  review: ['Повторение и перенос', 'Используй те же средства в новой ситуации без старого образца.']
}

const TEACHER_SESSIONS = [
  {
    ordinal: 1,
    title: 'Занятие 1 · 90 минут',
    items: ['Актуализация времени и модальных глаголов', 'weil / denn в устном взаимодействии', 'Перенос встречи: причины и альтернативы', 'Парные мини-диалоги с изменением условия']
  },
  {
    ordinal: 2,
    title: 'Занятие 2 · 90 минут',
    items: ['Разбор самостоятельной практики', 'Переговоры о новом времени и месте', 'Итоговый диалог модуля', 'Подготовка письменного подтверждения и обратной связи']
  }
]

const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
const lines = (value = '') => esc(value).replace(/\n/g, '<br>')
const roleLabel = role => ({ student: 'Ученик', teacher: 'Преподаватель', admin: 'Администратор' }[role] || role)
const submissionLabel = status => ({ draft: 'Черновик', submitted: 'Отправлено', in_review: 'На проверке', returned: 'Нужна доработка', accepted: 'Принято' }[status] || status)
const AUTO_CHECK_TYPES = new Set(['single_choice', 'word_order', 'gap_fill'])
const formatDate = value => value ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'

const SAVE_LABELS = {
  pending: 'Есть несохранённые изменения…',
  saving: 'Сохраняем…',
  saved: 'Сохранено.',
  error: 'Ошибка сохранения'
}

function draftStorageKey(activityId) {
  return `centrum-deutsch:mvp:draft:${state.profile?.id || 'anonymous'}:${activityId}`
}

function stashDraft(activityId, value) {
  state.pendingDrafts.set(activityId, value)
  try { localStorage.setItem(draftStorageKey(activityId), value) } catch {}
}

function clearDraft(activityId) {
  state.pendingDrafts.delete(activityId)
  try { localStorage.removeItem(draftStorageKey(activityId)) } catch {}
}

function recoverLocalDrafts() {
  if (state.profile?.role !== 'student' || !state.data) return
  state.data.activities.forEach(activity => {
    if (activity.type === 'single_choice' || activity.type === 'word_order' || activity.type === 'model') return
    let value = null
    try { value = localStorage.getItem(draftStorageKey(activity.id)) } catch {}
    if (value === null) return
    const serverValue = String(attemptFor(activity.id)?.answer?.text || '')
    if (value !== serverValue) state.pendingDrafts.set(activity.id, value)
    else clearDraft(activity.id)
  })
}

function setActivitySaveState(activityId, status, detail = '') {
  state.saveStates.set(activityId, { status, detail })
  const text = status === 'error' && detail ? `${SAVE_LABELS.error}: ${detail}` : SAVE_LABELS[status]
  setSaveStatus(activityId, text || detail)
  const node = document.querySelector(`[data-save-status="${cssEscape(activityId)}"]`)
  if (node) node.dataset.saveState = status
}

function hasUnsavedWork() {
  if (state.pendingDrafts.size) return true
  return [...state.saveStates.values()].some(item => ['pending', 'saving', 'error'].includes(item.status))
}

async function flushPendingSaves() {
  if (state.profile?.role !== 'student') return true
  for (const timer of state.saveTimers.values()) clearTimeout(timer)
  state.saveTimers.clear()
  const ids = [...state.pendingDrafts.keys()]
  const queued = ids.map(id => saveActivity(id, false))
  const inFlight = [...state.savePromises.values()]
  if (!queued.length && !inFlight.length) return ![...state.saveStates.values()].some(item => item.status === 'error')
  const results = await Promise.all([...queued, ...inFlight])
  return results.every(Boolean) && ![...state.saveStates.values()].some(item => item.status === 'error')
}

function showFatal(error) {
  console.error(error)
  app.innerHTML = `<main class="shell"><section class="card"><h1>Ошибка запуска MVP</h1><div class="notice error">${esc(error?.message || error)}</div><p>Проверьте авторизацию, RLS и данные Supabase.</p></section></main>`
}

async function boot() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error && error.name !== 'AuthSessionMissingError') throw error
  state.user = user || null
  state.profile = null
  state.data = null

  if (!state.user) {
    renderAuth()
    return
  }

  const { data: profile, error: profileError } = await supabase
    .from('app_users')
    .select('id,auth_subject,email,display_name,role,status')
    .eq('auth_subject', state.user.id)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile) {
    renderUnprovisioned()
    return
  }
  if (profile.status !== 'active') {
    renderBlocked(profile.status)
    return
  }

  state.profile = profile
  if (profile.role === 'student') state.data = await loadStudentData()
  if (profile.role === 'teacher') state.data = await loadTeacherData()
  if (profile.role === 'admin') state.data = await loadAdminData()

  if (profile.role === 'student') recoverLocalDrafts()
  ensureRoleRoute()
  renderRoute()
  if (profile.role === 'student' && state.pendingDrafts.size) {
    queueMicrotask(() => flushPendingSaves().catch(console.error))
  }
}

async function loadStudentData() {
  const { data: enrollments, error: e1 } = await supabase.from('enrollments').select('id,student_id,course_id,cohort_id,status,starts_at,ends_at').eq('student_id', state.profile.id)
  if (e1) throw e1
  const activeEnrollments = (enrollments || []).filter(x => x.status === 'active')
  const courseIds = [...new Set(activeEnrollments.map(x => x.course_id))]

  const courses = courseIds.length ? await selectIn('courses', 'id,title,level_code,status', 'id', courseIds) : []
  const modules = courseIds.length ? await selectIn('course_modules', 'id,course_id,ordinal,title,learning_outcome,status', 'course_id', courseIds, 'ordinal') : []
  const moduleIds = modules.map(x => x.id)
  const sections = moduleIds.length ? await selectIn('module_sections', 'id,module_id,legacy_key,ordinal,title,duration_label,status', 'module_id', moduleIds, 'ordinal') : []
  const sectionIds = sections.map(x => x.id)
  const activities = sectionIds.length ? await selectIn('activities', 'id,section_id,legacy_key,ordinal,type,title,skill,payload,grading,teacher_review_required,status', 'section_id', sectionIds, 'ordinal') : []
  const activityIds = activities.map(x => x.id)

  const attempts = activityIds.length ? await selectIn('activity_attempts', 'id,student_id,activity_id,attempt_no,status,answer,result,started_at,submitted_at,checked_at', 'activity_id', activityIds) : []
  const progress = moduleIds.length ? await selectIn('learner_module_progress', 'student_id,module_id,current_section_id,section_states,completion_percent,updated_at', 'module_id', moduleIds) : []
  const submissions = activityIds.length ? await selectIn('submissions', 'id,student_id,activity_id,parent_submission_id,status,text_body,submitted_at,created_at', 'activity_id', activityIds) : []
  const submissionIds = submissions.map(x => x.id)
  const reviews = submissionIds.length ? await selectIn('submission_reviews', 'id,submission_id,teacher_id,status,rubric,strengths,meaning_issue,language_goal,comment,created_at,published_at', 'submission_id', submissionIds) : []
  const cohorts = await selectAll('cohorts', 'id,course_id,title,status,created_at')

  return { enrollments, activeEnrollments, courses, modules, sections, activities, attempts, progress, submissions, reviews, cohorts }
}

async function loadTeacherData() {
  const courses = await selectAll('courses', 'id,title,level_code,status')
  const modules = await selectAll('course_modules', 'id,course_id,ordinal,title,learning_outcome,status', 'ordinal')
  const sections = await selectAll('module_sections', 'id,module_id,legacy_key,ordinal,title,duration_label,status', 'ordinal')
  const activities = await selectAll('activities', 'id,section_id,legacy_key,ordinal,type,title,skill,payload,grading,teacher_review_required,status', 'ordinal')
  const cohorts = await selectAll('cohorts', 'id,course_id,title,status,created_at')
  const cohortStudents = await selectAll('cohort_students', 'cohort_id,student_id,joined_at')
  const studentIds = [...new Set(cohortStudents.map(x => x.student_id))]
  const students = studentIds.length ? await selectIn('app_users', 'id,email,display_name,role,status', 'id', studentIds) : []
  const enrollments = studentIds.length ? await selectIn('enrollments', 'id,student_id,course_id,cohort_id,status,starts_at,ends_at', 'student_id', studentIds) : []
  const progress = studentIds.length ? await selectIn('learner_module_progress', 'student_id,module_id,current_section_id,section_states,completion_percent,updated_at', 'student_id', studentIds) : []
  const submissions = studentIds.length ? await selectIn('submissions', 'id,student_id,activity_id,status,text_body,submitted_at,created_at,parent_submission_id', 'student_id', studentIds) : []
  const submissionIds = submissions.map(x => x.id)
  const reviews = submissionIds.length ? await selectIn('submission_reviews', 'id,submission_id,teacher_id,status,rubric,strengths,meaning_issue,language_goal,comment,created_at,published_at', 'submission_id', submissionIds) : []
  const attempts = studentIds.length ? await selectIn('activity_attempts', 'id,student_id,activity_id,status,answer,result,started_at,submitted_at,checked_at', 'student_id', studentIds) : []

  return { courses, modules, sections, activities, cohorts, cohortStudents, students, enrollments, progress, submissions, reviews, attempts }
}

async function loadAdminData() {
  const users = await selectAll('app_users', 'id,email,display_name,role,status,created_at,updated_at')
  const enrollments = await selectAll('enrollments', 'id,student_id,course_id,cohort_id,status,source,starts_at,ends_at,created_at,updated_at')
  const cohorts = await selectAll('cohorts', 'id,course_id,title,status,created_at')
  const courses = await selectAll('courses', 'id,title,level_code,status,created_at,updated_at')
  const modules = await selectAll('course_modules', 'id,course_id,ordinal,title,status')
  const audit = await selectAll('audit_log', 'id,actor_user_id,actor_kind,action,object_type,object_id,reason,created_at', 'created_at', false, 20)
  return { users, enrollments, cohorts, courses, modules, audit }
}

async function selectAll(table, columns, orderColumn = null, ascending = true, limit = null) {
  let q = supabase.from(table).select(columns)
  if (orderColumn) q = q.order(orderColumn, { ascending })
  if (limit) q = q.limit(limit)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

async function selectIn(table, columns, column, values, orderColumn = null) {
  let q = supabase.from(table).select(columns).in(column, values)
  if (orderColumn) q = q.order(orderColumn)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

function ensureRoleRoute() {
  const role = state.profile.role
  const parts = routeParts()
  if (parts[0] !== role) location.hash = `#/${role}/home`
}

function routeParts() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

async function navigate(hash) {
  if (state.profile?.role === 'student' && location.hash !== hash) {
    const saved = await flushPendingSaves()
    if (!saved) return false
  }
  if (location.hash === hash) renderRoute()
  else location.hash = hash
  return true
}

function renderRoute() {
  if (!state.profile || !state.data) return
  const parts = routeParts()
  const role = state.profile.role
  if (parts[0] !== role) {
    navigate(`#/${role}/home`)
    return
  }

  if (role === 'student') renderStudentRoute(parts)
  if (role === 'teacher') renderTeacherRoute(parts)
  if (role === 'admin') renderAdminRoute(parts)
}

function roleWorkspaceLabel(role) {
  return role === 'student' ? 'Кабинет ученика' : role === 'teacher' ? 'Кабинет преподавателя' : 'Кабинет администратора'
}

function commonHeader(extra = '') {
  const name = state.profile.display_name || state.profile.email || ''
  const initial = String(name || roleLabel(state.profile.role)).trim().charAt(0).toUpperCase()
  return `<header class="topbar">
    <div>
      <div class="breadcrumb">${roleWorkspaceLabel(state.profile.role)}</div>
      <div class="saveflag">${state.profile.role === 'student' ? 'Прогресс и ответы сохраняются на сервере' : 'Рабочее пространство · MVP'}</div>
    </div>
    <div class="topright">
      ${extra}
      <span class="badge gray">${esc(roleLabel(state.profile.role))}</span>
      <span class="avatar" aria-hidden="true">${esc(initial)}</span>
      <span class="profile-name">${esc(name)}</span>
      <button class="btn text" data-logout>Выйти</button>
    </div>
  </header>`
}

function primaryNav(role, current) {
  const studentCourseActive = current.startsWith('#/student/courses') || current.startsWith('#/student/course') || current.startsWith('#/student/module') || current.startsWith('#/student/section')
  const items = role === 'student'
    ? [
        ['Личный кабинет', '#/student/home', true, current === '#/student/home'],
        ['Мои курсы', '#/student/courses', true, studentCourseActive],
        ['Чтение', '', false, false],
        ['Словарь', '', false, false],
        ['Повторение', '', false, false],
        ['Встречи', '', false, false],
        ['Мой профиль', '', false, false]
      ]
    : role === 'teacher'
      ? [
          ['Обзор', '#/teacher/home', true, current === '#/teacher/home'],
          ['Материалы A2.1', '#/teacher/module/A2.1-M01', true, current.startsWith('#/teacher/module')],
          ['Мои ученики', '#/teacher/students', true, current.startsWith('#/teacher/cohort') || current.startsWith('#/teacher/students')],
          ['Расписание', '', false, false]
        ]
      : [
          ['Обзор', '#/admin/home', true, true],
          ['Ученики и доступ', '', false, false],
          ['Расписание групп', '', false, false],
          ['Каталог материалов', '', false, false],
          ['Журнал изменений', '', false, false]
        ]

  return items.map(([label, href, enabled, active]) => enabled
    ? `<button class="navlink ${active ? 'active' : ''}" data-nav="${href}" ${active ? 'aria-current="page"' : ''}><span>${esc(label)}</span></button>`
    : `<button class="navlink disabled" type="button" disabled aria-disabled="true"><span>${esc(label)}</span><small>позже</small></button>`
  ).join('')
}

function lessonSidebar(current) {
  const parts = routeParts()
  if (state.profile.role !== 'student' || parts[1] !== 'section') return ''
  const sectionId = parts.slice(2).join('/')
  const sections = moduleSections()
  return `<div class="navtitle">A2.1 · Модуль 01</div>
    <div class="lesson-side-nav">${sections.map(section => {
      const activities = sectionActivities(section.id)
      const done = activities.filter(activityComplete).length
      const enabled = activities.length > 0
      if (!enabled) {
        return `<button class="lessonnavitem disabled" disabled><span class="lesson-number">${String(section.ordinal).padStart(2, '0')}</span><span>${esc(section.title)}</span></button>`
      }
      return `<button class="lessonnavitem ${section.id === sectionId ? 'active' : ''} ${done === activities.length ? 'done' : ''}" data-nav="#/student/section/${esc(section.id)}" ${section.id === sectionId ? 'aria-current="step"' : ''}><span class="lesson-number">${String(section.ordinal).padStart(2, '0')}</span><span>${esc(section.title)}</span></button>`
    }).join('')}</div>`
}

function shell(role, content, aside = '', options = {}) {
  const current = location.hash || `#/${role}/home`
  return `<main class="app-shell"><a class="skip-link" href="#main-content">Перейти к содержанию</a>
    <aside class="sidebar">
      <button class="brand" data-nav="#/${role}/home" aria-label="На главную">
        <span class="brandmark">Z</span>
        <span>ZENTRUM<br>FÜR DEUTSCH<small>ЦЕНТР НЕМЕЦКОГО ЯЗЫКА</small></span>
      </button>
      <div class="role-label">${roleWorkspaceLabel(role)}</div>
      <div class="navscroll">
        ${primaryNav(role, current)}
        ${lessonSidebar(current)}
      </div>
      <div class="sidebar-bottom">
        <div class="small muted">${role === 'student' ? 'Свой ритм. Свои результаты.' : 'Рабочее пространство'}<br>MVP · A2.1-M01</div>
      </div>
    </aside>
    <div class="mainwrap">
      ${commonHeader(options.headerExtra || '')}
      <section class="main-view" id="main-content" tabindex="-1">
        ${aside ? `<div class="twocol"><div class="content-column">${content}</div><aside class="rail">${aside}</aside></div>` : content}
      </section>
    </div>
  </main>`
}

function renderAuth(message = '') {
  app.innerHTML = `<main class="auth-shell">
    <section class="auth-intro">
      <div class="eyebrow">УЧЕБНАЯ ПЛАТФОРМА</div>
      <h1>Продолжай с того места, где остановился.</h1>
      <p>Курсы, модули, задания, занятия и обратная связь — в одном маршруте.</p>
    </section>
    <section class="auth-panel card">
      <span class="badge">MVP · A2.1</span>
      <h2>Войти</h2>
      ${message ? `<div class="notice error">${esc(message)}</div>` : ''}
      <form id="login-form">
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" required></label>
        <label class="field"><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn" type="submit">Войти в платформу</button>
      </form>
    </section>
  </main>`
}

function renderUnprovisioned() {
  app.innerHTML = '<main class="shell"><section class="card narrow"><span class="badge">Аккаунт создан</span><h1>Доступ ещё не назначен</h1><p>Авторизация работает, но для этого аккаунта пока нет профиля платформы. Роль и доступ назначаются на сервере.</p><button class="btn secondary" data-logout>Выйти</button></section></main>'
}

function renderBlocked(status) {
  app.innerHTML = `<main class="shell"><section class="card narrow"><h1>Доступ к платформе ограничен</h1><p>Статус аккаунта: ${esc(status)}.</p><button class="btn secondary" data-logout>Выйти</button></section></main>`
}

function renderStudentRoute(parts) {
  const page = parts[1] || 'home'
  if (page === 'home') return renderStudentHome()
  if (page === 'courses') return renderStudentCourses()
  if (page === 'course') return renderStudentCourse(parts[2] || COURSE_ID)
  if (page === 'module') return renderStudentModule(parts[2] || MODULE_ID)
  if (page === 'section') return renderStudentSection(parts.slice(2).join('/') || firstModuleSection()?.id)
  navigate('#/student/home')
}

function activeStudentModule() {
  return state.data.modules.find(x => x.id === MODULE_ID) || state.data.modules[0]
}

function moduleSections(moduleId = MODULE_ID) {
  return state.data.sections.filter(x => x.module_id === moduleId).sort((a, b) => a.ordinal - b.ordinal)
}

function sectionActivities(sectionId) {
  return state.data.activities.filter(x => x.section_id === sectionId).sort((a, b) => a.ordinal - b.ordinal)
}

function attemptFor(activityId) {
  return [...state.data.attempts].filter(x => x.activity_id === activityId).sort((a, b) => b.attempt_no - a.attempt_no)[0] || null
}

function latestSubmission(activityId) {
  return [...state.data.submissions].filter(x => x.activity_id === activityId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null
}

function reviewForSubmission(submissionId) {
  return state.data.reviews.find(x => x.submission_id === submissionId && x.status === 'published') || null
}

function activityStarted(activity) {
  const attempt = attemptFor(activity.id)
  if (attempt) return true
  return activity.teacher_review_required && Boolean(latestSubmission(activity.id))
}

function activityComplete(activity) {
  if (activity.teacher_review_required) {
    return state.data.submissions.some(x => x.activity_id === activity.id && x.status === 'accepted')
  }
  const attempt = attemptFor(activity.id)
  if (!attempt) return false
  if (activity.type === 'model' || AUTO_CHECK_TYPES.has(activity.type)) return attempt.result?.correct === true
  // Independent practice is saved, not assessed. Never equate a blank draft with completion.
  return Boolean(String(attempt.answer?.text || '').trim())
}

function activityStateLabel(activity) {
  if (activity.teacher_review_required) {
    const submission = latestSubmission(activity.id)
    if (submission) return submissionLabel(submission.status)
  }
  if (activityComplete(activity)) return 'Готово'
  return activityStarted(activity) ? 'Черновик' : 'Не начато'
}

function studentProgress(moduleId = MODULE_ID) {
  const sections = moduleSections(moduleId)
  const activities = sections.flatMap(x => sectionActivities(x.id))
  const done = activities.filter(activityComplete).length
  return { done, total: activities.length, percent: activities.length ? Math.round(done / activities.length * 100) : 0 }
}

function firstModuleSection() {
  return moduleSections()[0] || null
}

function resumeSection() {
  const sections = moduleSections()
  const progress = state.data.progress.find(x => x.module_id === MODULE_ID)
  const current = progress?.current_section_id ? sections.find(x => x.id === progress.current_section_id) : null
  if (current && sectionActivities(current.id).some(a => !activityComplete(a))) return current
  return sections.find(section => sectionActivities(section.id).some(a => !activityComplete(a))) || current || firstModuleSection()
}

function renderStudentHome() {
  const module = activeStudentModule()
  const progress = studentProgress(module?.id)
  const resume = resumeSection()
  const course = state.data.courses.find(x => x.id === module?.course_id) || state.data.courses[0]
  const firstName = String(state.profile.display_name || 'ученик').trim().split(/\s+/)[0]

  const content = `<div class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</div>
    <h1>Привет, ${esc(firstName)}.</h1>
    <section class="hero">
      <div>
        <div class="eyebrow">A2.1 · МОДУЛЬ 01</div>
        <h2>${esc(module?.title || 'Договориться о встрече и изменить планы')}</h2>
        <p class="hero-desc">${esc(module?.learning_outcome || '')}</p>
        <div class="actions">
          <button class="btn" data-nav="#/student/section/${esc(resume?.id || firstModuleSection()?.id || '')}">${progress.done ? 'Продолжить модуль' : 'Начать модуль'} →</button>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-art-top">A2.1</div>
        <div class="hero-art-number">01</div>
        <div class="hero-art-label">модуль</div>
      </div>
    </section>

    <div class="stats">
      <div class="stat">
        <b>${progress.percent}%</b>
        <span>текущий модуль</span>
        <p class="small">Продолжить: <button class="inline-link" data-nav="#/student/section/${esc(resume?.id || '')}">${esc(resume?.title || 'модуль')}</button></p>
      </div>
      <div class="stat muted-stat">
        <b>Повторение</b>
        <span>Будет подключено на следующем этапе.</span>
        <span class="unavailable-label">пока недоступно</span>
      </div>
    </div>

    <div class="section-head"><h2>Мои курсы</h2><button class="inline-link" data-nav="#/student/courses">Вся программа →</button></div>
    <div class="course-grid">${course ? studentCourseCard(course) : emptyState('Курсы пока не назначены', 'После выдачи enrollment курс появится здесь.')}</div>

    <section class="card unavailable-card">
      <span class="badge gray">Позже</span>
      <h3>Слова, которые нужны тебе</h3>
      <p>Словарь уже предусмотрен в архитектуре платформы, но в этот MVP пока не подключён.</p>
    </section>`

  const aside = `<section class="rail-card">
      <span class="rail-label">МОЯ СТУПЕНЬ</span>
      <div class="level-value">${esc(course?.level_code || course?.id || 'A2.1')}</div>
    </section>
    <section class="rail-card">
      <span class="rail-label">СЛЕДУЮЩИЙ ШАГ</span>
      <h3>${esc(resume?.title || 'Модуль')}</h3>
      <p class="muted">${resume ? `${resume.ordinal} из ${moduleSections().length} разделов` : ''}</p>
      <button class="btn secondary full" data-nav="#/student/module/${esc(module?.id || MODULE_ID)}">Структура модуля</button>
    </section>
    <section class="rail-card unavailable-card">
      <span class="rail-label">ВСТРЕЧИ</span>
      <p><strong>2 занятия по 90 минут</strong> входят в модуль.</p>
      <span class="unavailable-label">расписание пока не подключено</span>
    </section>`

  app.innerHTML = shell('student', content, aside)
}

function studentCourseCard(course) {
  const modules = state.data.modules.filter(x => x.course_id === course.id)
  return `<button class="course-card" data-nav="#/student/course/${esc(course.id)}">
    <span class="badge">${esc(course.level_code || course.id)}</span>
    <h3>${esc(course.title)}</h3>
    <p class="muted">${modules.length} модуль${modules.length === 1 ? '' : 'я'}</p>
    <span class="card-link">Открыть курс →</span>
  </button>`
}

function renderStudentCourses() {
  const cards = state.data.courses.length ? state.data.courses.map(studentCourseCard).join('') : emptyState('Курсов пока нет', 'Активные курсы появятся после назначения доступа.')
  const content = `<div class="eyebrow">МОИ КУРСЫ</div><h1>Курсы</h1><p class="lead muted">Текущие и завершённые программы обучения.</p><div class="course-grid">${cards}</div>`
  app.innerHTML = shell('student', content)
}

function renderStudentCourse(courseId) {
  const course = state.data.courses.find(x => x.id === courseId)
  if (!course) return navigate('#/student/courses')
  const modules = state.data.modules.filter(x => x.course_id === course.id).sort((a, b) => a.ordinal - b.ordinal)
  const content = `<div class="breadcrumbs"><button data-nav="#/student/courses">Курсы</button><span>›</span><span>${esc(course.title)}</span></div>
    <div class="eyebrow">КУРС ${esc(course.level_code || course.id)}</div><h1>${esc(course.title)}</h1>
    <p class="lead muted">Тематический план курса и вход в текущий модуль.</p>
    <div class="module-list">${modules.map(module => {
      const p = studentProgress(module.id)
      return `<button class="module-card" data-nav="#/student/module/${esc(module.id)}"><span class="module-number">${String(module.ordinal).padStart(2, '0')}</span><div><h3>${esc(module.title)}</h3><p>${esc(module.learning_outcome || '')}</p><div class="progress-row compact"><div class="progress-track"><span style="width:${p.percent}%"></span></div><span>${p.percent}%</span></div></div><span class="arrow">→</span></button>`
    }).join('')}</div>`
  app.innerHTML = shell('student', content)
}

function renderStudentModule(moduleId) {
  const module = state.data.modules.find(x => x.id === moduleId)
  if (!module) return navigate('#/student/home')
  const sections = moduleSections(module.id)
  const progress = studentProgress(module.id)
  const resume = resumeSection()
  const content = `<div class="breadcrumbs"><button data-nav="#/student/course/${esc(module.course_id)}">${esc(module.course_id)}</button><span>›</span><span>Модуль ${module.ordinal}</span></div>
    <div class="module-hero"><div><span class="badge">${esc(module.course_id)} · Модуль ${String(module.ordinal).padStart(2, '0')}</span><h1>${esc(module.title)}</h1><p class="lead">${esc(module.learning_outcome || '')}</p></div><div class="module-progress"><strong>${progress.percent}%</strong><span>${progress.done} из ${progress.total} заданий завершено</span></div></div>
    <div class="section-heading"><h2>Структура модуля</h2><button class="btn" data-nav="#/student/section/${esc(resume?.id || sections[0]?.id || '')}">Продолжить</button></div>
    <div class="section-list">${sections.map(section => sectionRow(section)).join('')}</div>
    <div class="section-heading spaced"><h2>Занятия в структуре модуля</h2><span class="muted">2 × 90 минут · даты в личном расписании</span></div>
    <div class="session-grid">${TEACHER_SESSIONS.map(s => `<article class="session-card"><span class="badge">Занятие ${s.ordinal}</span><h3>${esc(s.title)}</h3><p class="muted">Связано с самостоятельной работой модуля.</p></article>`).join('')}</div>`
  app.innerHTML = shell('student', content)
}

function sectionRow(section) {
  const activities = sectionActivities(section.id)
  const done = activities.filter(activityComplete).length
  const started = activities.filter(activityStarted).length
  const current = resumeSection()?.id === section.id
  const complete = activities.length > 0 && done === activities.length
  const stateClass = complete ? 'done' : current ? 'current' : started ? 'started' : 'next'
  const stateLabel = complete ? 'Готово' : started ? 'Черновик' : 'Не начато'
  return `<button class="section-row ${stateClass}" data-nav="#/student/section/${esc(section.id)}"><span class="section-index">${section.ordinal}</span><span class="section-main"><strong>${esc(section.title)}</strong><span class="muted">${esc(section.duration_label || '')}</span></span><span class="section-state">${stateLabel} · ${done}/${activities.length}</span><span class="arrow">→</span></button>`
}

function renderStudentSection(sectionId) {
  const section = state.data.sections.find(x => x.id === sectionId) || firstModuleSection()
  if (!section) return navigate('#/student/module/' + MODULE_ID)
  const module = state.data.modules.find(x => x.id === section.module_id)
  const sections = moduleSections(section.module_id)
  const activities = sectionActivities(section.id)
  const idx = sections.findIndex(x => x.id === section.id)
  const copy = SECTION_COPY[section.legacy_key] || [section.title, '']
  const content = `<div class="breadcrumbs"><button data-nav="#/student/course/${esc(module.course_id)}">${esc(module.course_id)}</button><span>›</span><button data-nav="#/student/module/${esc(module.id)}">${esc(module.title)}</button><span>›</span><span>${esc(section.title)}</span></div>
    <div class="lessonhead">
      <div class="inline"><span class="badge green">${esc(module.course_id)} · Модуль ${String(module.ordinal).padStart(2, '0')}</span><span class="small muted">${esc(module.title)}</span></div>
      <h1>${esc(copy[0])}</h1>
      <div class="keyinfo"><span>Шаг ${idx + 1} из ${sections.length}</span><span>${esc(section.duration_label || '')}</span><span>${activities.length} задан${activities.length === 1 ? 'ие' : 'ия'}</span></div>
      ${copy[1] ? `<p class="lead muted">${esc(copy[1])}</p>` : ''}
    </div>
    <div class="lessonbody">
      <details class="mobile-section-nav"><summary>Раздел ${idx + 1} из ${sections.length} · ${esc(section.title)}</summary><div class="mobile-section-links">${sections.map(s => `<button class="navlink ${s.id === section.id ? 'active' : ''}" data-nav="#/student/section/${esc(s.id)}" ${s.id === section.id ? 'aria-current="step"' : ''}>${s.ordinal}. ${esc(s.title)}</button>`).join('')}</div></details>
      <div class="activity-stack">${activities.length ? activities.map(renderStudentActivity).join('') : emptyState('В этом разделе пока нет серверного задания', 'Раздел показан в структуре, но недоступен для прохождения.')}</div>
      <div class="footeractions">
        ${idx > 0 ? `<button class="btn secondary" data-nav="#/student/section/${esc(sections[idx - 1].id)}">← ${esc(sections[idx - 1].title)}</button>` : `<button class="btn secondary" data-nav="#/student/module/${esc(module.id)}">К плану модуля</button>`}
        ${idx < sections.length - 1 ? `<button class="btn" data-nav="#/student/section/${esc(sections[idx + 1].id)}">${esc(sections[idx + 1].title)} →</button>` : `<button class="btn" data-nav="#/student/module/${esc(module.id)}">К структуре модуля</button>`}
      </div>
      <p class="small muted">Ответы и прогресс сохраняются отдельно. Переход между разделами не означает автоматического освоения навыка.</p>
    </div>`
  app.innerHTML = shell('student', content)
  saveStudentProgress(section.id).catch(console.error)
}

function renderStudentActivity(activity) {
  const p = activity.payload || {}
  const attempt = attemptFor(activity.id)
  const status = activityStateLabel(activity)
  const header = `<div class="activity-head"><div><span class="activity-kicker">${esc(activity.skill || 'задание')}</span><h2>${esc(activity.title)}</h2></div><span class="activity-status ${activityComplete(activity) ? 'done' : ''}">${esc(status)}</span></div>`
  const instruction = p.instruction ? `<p>${esc(p.instruction)}</p>` : ''
  const prompt = p.prompt ? `<div class="prompt-box">${lines(p.prompt)}</div>` : ''
  const source = Array.isArray(p.source) ? `<div class="chat">${p.source.map(item => `<div class="bubble"><strong>${esc(item.speaker)}</strong><br><span lang="de">${esc(item.text)}</span></div>`).join('')}</div>` : ''
  const items = Array.isArray(p.items) ? `<div class="lex-list">${p.items.map(item => `<span>${esc(item)}</span>`).join('')}</div>` : ''
  const support = p.support ? `<details class="support"><summary>Опора / проверить себя</summary><div>${lines(p.support)}</div></details>` : ''
  const explanation = p.explanation ? `<div class="notice">${esc(p.explanation)}</div>` : ''

  if (activity.type === 'model') {
    const examples = Array.isArray(p.examples) ? `<div class="model-examples">${p.examples.map(example => `<div class="prompt-box" lang="de">${esc(example)}</div>`).join('')}</div>` : ''
    return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}${explanation}${examples}<div class="activity-actions"><button class="btn" data-save-activity="${esc(activity.id)}">${activityComplete(activity) ? 'Просмотрено' : 'Понятно'}</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${support}</article>`
  }

  if (activity.type === 'single_choice') {
    const selected = attempt?.answer?.choice
    const checked = attempt?.result?.correct
    const options = (p.options || []).map((option, i) => `<label class="choice-option ${selected === i ? 'selected' : ''}"><input type="radio" name="activity-${esc(activity.id)}" value="${i}" ${selected === i ? 'checked' : ''}><span>${esc(option)}</span></label>`).join('')
    const feedback = checked === true ? `<div class="notice success">${esc(p.feedback_correct || 'Верно.')}</div>` : checked === false ? `<div class="notice error">${esc(p.feedback_incorrect || 'Попробуй ещё раз.')}</div>` : ''
    return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}${prompt}<div class="choice-list">${options}</div>${feedback}<div class="activity-actions"><button class="btn" data-save-activity="${esc(activity.id)}">Проверить</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${support}</article>`
  }

  if (activity.type === 'word_order') {
    const savedOrder = Array.isArray(attempt?.answer?.order) ? attempt.answer.order : []
    const tokens = Array.isArray(p.tokens) ? p.tokens : []
    const selected = savedOrder.map(index => tokens[index]).filter(Boolean)
    const buttons = tokens.map((token, index) => `<button class="order-token" type="button" data-order-token="${index}" data-activity-id="${esc(activity.id)}">${esc(token)}</button>`).join('')
    const built = selected.map((token, position) => `<button class="order-built-token" type="button" data-order-remove="${position}" data-activity-id="${esc(activity.id)}">${esc(token)}</button>`).join('')
    const feedback = attempt?.result?.correct === true ? `<div class="notice success">${esc(p.feedback_correct || 'Верно.')}</div>` : attempt?.result?.correct === false && savedOrder.length ? `<div class="notice error">${esc(p.feedback_incorrect || 'Проверь порядок слов.')}</div>` : ''
    return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}${prompt}<div class="word-order-bank">${buttons}</div><div class="word-order-answer" data-order-answer="${esc(activity.id)}">${built || '<span class="muted">Нажимай слова по порядку.</span>'}</div><input type="hidden" data-order-input="${esc(activity.id)}" value="${esc(JSON.stringify(savedOrder))}">${feedback}<div class="activity-actions"><button class="btn secondary" type="button" data-order-reset="${esc(activity.id)}">Сбросить</button><button class="btn" data-save-activity="${esc(activity.id)}">Проверить</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${support}</article>`
  }

  if (activity.type === 'gap_fill') {
    const value = state.pendingDrafts.has(activity.id) ? state.pendingDrafts.get(activity.id) : (attempt?.answer?.text || '')
    const feedback = attempt?.result?.correct === true ? `<div class="notice success">${esc(p.feedback_correct || 'Верно.')}</div>` : attempt?.result?.correct === false && String(attempt?.answer?.text || '').trim() ? `<div class="notice error">${esc(p.feedback_incorrect || 'Проверь форму и позицию глагола.')}</div>` : ''
    return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}${prompt}<label class="field"><span>${esc(p.input_label || 'Вставь слово')}</span><input data-activity-input="${esc(activity.id)}" value="${esc(value)}" autocomplete="off"></label>${feedback}<div class="activity-actions"><button class="btn" data-save-activity="${esc(activity.id)}">Проверить</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${support}</article>`
  }

  const value = state.pendingDrafts.has(activity.id) ? state.pendingDrafts.get(activity.id) : (attempt?.answer?.text || '')
  const listening = activity.type === 'listening_text' ? `<div class="audio-panel"><div><span class="badge">AUD01 · MVP</span><h3>Голосовое сообщение</h3></div><div class="activity-actions"><button class="btn secondary" data-play-speech="${esc(activity.id)}">▶ Прослушать</button><button class="btn text" data-stop-speech>Остановить</button></div><details class="support"><summary>Показать транскрипт</summary><p lang="de">${esc(p.transcript || p.speech_text || '')}</p></details></div>` : ''
  const speaking = activity.type === 'speaking_reflection' ? `<div class="record-panel"><div class="activity-actions"><button class="btn secondary" data-start-record="${esc(activity.id)}">● Записать голос</button><button class="btn text" data-stop-record="${esc(activity.id)}" disabled>Остановить</button></div><p class="small muted" data-record-status="${esc(activity.id)}">Запись остаётся только в браузере этого MVP; серверная загрузка аудио будет отдельным инкрементом.</p><div data-record-result="${esc(activity.id)}"></div></div>` : ''
  const project = activity.id.endsWith(':project') ? projectSubmissionBlock(activity) : ''
  if (activity.id.endsWith(':revision')) return renderRevisionActivity(activity)

  return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}${explanation}${prompt}${source}${items}${listening}${speaking}<label class="field"><span>Мой ответ</span><textarea data-activity-input="${esc(activity.id)}" placeholder="${esc(p.placeholder || '')}">${esc(value)}</textarea></label><div class="activity-actions"><button class="btn" data-save-activity="${esc(activity.id)}">Сохранить</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}">${attempt ? 'Ответ загружен с сервера.' : ''}</span></div>${project}${support}</article>`
}

function projectSubmissionBlock(activity) {
  const submission = latestSubmission(activity.id)
  if (!submission) return `<div class="submit-box"><div><strong>Проверка преподавателем</strong><p class="small muted">Сначала сохрани письменную часть, затем отправь её преподавателю.</p></div><button class="btn secondary" data-submit-project="${esc(activity.id)}">Отправить преподавателю</button></div>`
  const review = reviewForSubmission(submission.id)
  const returnedAction = submission.status === 'returned'
    ? '<button class="btn secondary" data-nav="#/student/section/A2.1-M01:feedback">Посмотреть обратную связь</button>'
    : ''
  return `<div class="submit-box"><div><strong>${esc(submissionLabel(submission.status))}</strong><p class="small muted">${submission.submitted_at ? `Отправлено ${formatDate(submission.submitted_at)}` : ''}${review ? ' · обратная связь опубликована' : ''}</p></div>${returnedAction}</div>`
}

function latestPublishedProjectReview() {
  const projectSubmissions = [...state.data.submissions]
    .filter(item => item.activity_id === 'A2.1-M01:project')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  for (const submission of projectSubmissions) {
    const review = reviewForSubmission(submission.id)
    if (review) return { submission, review }
  }
  return null
}

function rubricRows(review) {
  const rubric = review?.rubric || {}
  const items = [
    ['task', 'Задача выполнена'],
    ['agreement', 'Договорённость понятна'],
    ['weil', 'weil'],
    ['vocabulary', 'Подходящая лексика']
  ]
  return items.map(([key, label]) => `<li class="${rubric[key] ? 'ok' : 'needs-work'}"><span aria-hidden="true">${rubric[key] ? '✓' : '○'}</span><span>${esc(label)}</span></li>`).join('')
}

function renderRevisionActivity(activity) {
  const context = latestPublishedProjectReview()
  if (!context) {
    return '<article class="activity-card"><div class="activity-head"><div><span class="activity-kicker">feedback</span><h2>Обратная связь</h2></div><span class="activity-status">Не начато</span></div><div class="notice">Доработка появится после опубликованной обратной связи преподавателя.</div></article>'
  }
  const { submission, review } = context
  if (submission.status === 'accepted') {
    return `<article class="activity-card"><div class="activity-head"><div><span class="activity-kicker">feedback</span><h2>Обратная связь</h2></div><span class="activity-status done">Готово</span></div><div class="teacher-feedback"><span class="badge green">Работа принята</span><ul class="rubric-list">${rubricRows(review)}</ul>${review.comment ? `<p><strong>Комментарий:</strong> ${esc(review.comment)}</p>` : ''}</div></article>`
  }

  const attempt = attemptFor(activity.id)
  const value = state.pendingDrafts.has(activity.id) ? state.pendingDrafts.get(activity.id) : (attempt?.answer?.text || '')
  const latestProject = latestSubmission('A2.1-M01:project')
  const alreadyResubmitted = latestProject && latestProject.parent_submission_id === submission.id && ['submitted','in_review','accepted'].includes(latestProject.status)
  return `<article class="activity-card" data-activity="${esc(activity.id)}">
    <div class="activity-head"><div><span class="activity-kicker">feedback → revision</span><h2>Доработка после обратной связи</h2></div><span class="activity-status">${attempt ? 'Черновик' : 'Не начато'}</span></div>
    <div class="teacher-feedback">
      <span class="badge">Что проверить</span>
      <ul class="rubric-list">${rubricRows(review)}</ul>
      ${review.comment ? `<div class="notice"><strong>Преподаватель просит улучшить:</strong><br>${lines(review.comment)}</div>` : ''}
    </div>
    <fieldset class="revision-checklist">
      <legend>Перед доработкой</legend>
      <label><input type="checkbox"> Я понял(а), что нужно изменить.</label>
      <label><input type="checkbox"> Я проверил(а) порядок слов после weil.</label>
      <label><input type="checkbox"> Я проверил(а) время, место и понятность договорённости.</label>
    </fieldset>
    <label class="field"><span>Доработанная версия</span><textarea data-activity-input="${esc(activity.id)}" placeholder="Перепиши сообщение с учётом обратной связи.">${esc(value)}</textarea></label>
    <div class="activity-actions"><button class="btn secondary" data-save-activity="${esc(activity.id)}">Сохранить черновик</button>${alreadyResubmitted ? `<span class="status-pill">${esc(submissionLabel(latestProject.status))}</span>` : `<button class="btn" data-submit-revision="${esc(activity.id)}" data-parent-submission="${esc(submission.id)}">Отправить доработанную версию</button>`}<span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}">${attempt ? 'Черновик загружен с сервера.' : ''}</span></div>
  </article>`
}

async function saveActivity(activityId, explicit = true) {
  const previous = state.savePromises.get(activityId) || Promise.resolve(true)
  const current = previous.catch(() => false).then(() => persistActivity(activityId, explicit))
  state.savePromises.set(activityId, current)
  try {
    return await current
  } finally {
    if (state.savePromises.get(activityId) === current) state.savePromises.delete(activityId)
  }
}

async function persistActivity(activityId, explicit = true) {
  if (state.profile.role !== 'student') return true
  const activity = state.data.activities.find(x => x.id === activityId)
  if (!activity) return
  setActivitySaveState(activityId, 'saving')

  let answer
  let result = null
  if (activity.type === 'model') {
    answer = { acknowledged: true }
    result = { correct: true }
  } else if (activity.type === 'single_choice') {
    const checked = document.querySelector(`input[name="activity-${cssEscape(activityId)}"]:checked`)
    if (!checked) {
      setSaveStatus(activityId, 'Сначала выбери ответ.')
      return false
    }
    const choice = Number(checked.value)
    answer = { choice }
    result = { correct: choice === Number(activity.grading?.correct_index) }
  } else if (activity.type === 'word_order') {
    const input = document.querySelector(`[data-order-input="${cssEscape(activityId)}"]`)
    let order = []
    try { order = JSON.parse(input?.value || '[]') } catch {}
    answer = { order }
    result = { correct: JSON.stringify(order) === JSON.stringify(activity.grading?.expected_order || []) }
  } else {
    const input = document.querySelector(`[data-activity-input="${cssEscape(activityId)}"]`)
    const text = state.pendingDrafts.has(activityId)
      ? state.pendingDrafts.get(activityId)
      : (input?.value ?? attemptFor(activityId)?.answer?.text ?? '')
    answer = { text }
    if (activity.type === 'gap_fill') {
      const normalized = String(text).trim().toLocaleLowerCase('de-DE')
      const answers = Array.isArray(activity.grading?.answers) ? activity.grading.answers : []
      result = { correct: answers.some(value => String(value).trim().toLocaleLowerCase('de-DE') === normalized) }
    }
  }

  const savedDraftSnapshot = ['single_choice', 'word_order', 'model'].includes(activity.type) ? null : String(answer.text || '')
  const { data, error } = await supabase
    .from('activity_attempts')
    .upsert({
      student_id: state.profile.id,
      activity_id: activity.id,
      attempt_no: 1,
      status: activity.type === 'model' || AUTO_CHECK_TYPES.has(activity.type) ? 'checked' : 'draft',
      answer,
      result,
      checked_at: activity.type === 'model' || AUTO_CHECK_TYPES.has(activity.type) ? new Date().toISOString() : null
    }, { onConflict: 'student_id,activity_id,attempt_no' })
    .select('id,student_id,activity_id,attempt_no,status,answer,result,started_at,submitted_at,checked_at')
    .single()

  if (error) {
    setActivitySaveState(activityId, 'error', error.message)
    return false
  }

  state.data.attempts = state.data.attempts.filter(x => !(x.activity_id === activity.id && x.attempt_no === 1))
  state.data.attempts.push(data)
  await saveStudentProgress(currentStudentSectionId())

  if (!['single_choice', 'word_order', 'model'].includes(activity.type)) {
    const pending = state.pendingDrafts.get(activityId)
    if (pending === undefined || pending === savedDraftSnapshot) clearDraft(activityId)
  }
  setActivitySaveState(activityId, state.pendingDrafts.has(activityId) ? 'pending' : 'saved')
  if (explicit && (activity.type === 'model' || AUTO_CHECK_TYPES.has(activity.type))) renderRoute()
  return true
}

async function submitProject(activityId) {
  const input = document.querySelector(`[data-activity-input="${cssEscape(activityId)}"]`)
  const text = (input?.value || '').trim()
  if (!text) {
    setSaveStatus(activityId, 'Сначала напиши и сохрани письменную часть.')
    return
  }
  const saved = await saveActivity(activityId, true)
  if (!saved) return
  const previous = latestSubmission(activityId)
  if (previous && ['submitted', 'in_review', 'accepted'].includes(previous.status)) {
    setSaveStatus(activityId, 'Эта версия уже отправлена преподавателю.')
    return
  }
  if (previous?.status === 'returned') {
    setSaveStatus(activityId, 'Открой раздел «Обратная связь» и доработай ответ там.')
    return
  }

  const payload = {
    student_id: state.profile.id,
    activity_id: activityId,
    parent_submission_id: null,
    status: 'submitted',
    text_body: text,
    submitted_at: new Date().toISOString()
  }
  const { data, error } = await supabase.from('submissions').insert(payload).select('id,student_id,activity_id,parent_submission_id,status,text_body,submitted_at,created_at').single()
  if (error) {
    setSaveStatus(activityId, 'Не удалось отправить: ' + error.message)
    return
  }
  state.data.submissions.push(data)
  renderRoute()
}

async function submitRevision(activityId, parentSubmissionId) {
  if (state.profile.role !== 'student') return
  const input = document.querySelector(`[data-activity-input="${cssEscape(activityId)}"]`)
  const text = String(input?.value || state.pendingDrafts.get(activityId) || attemptFor(activityId)?.answer?.text || '').trim()
  if (!text) {
    setSaveStatus(activityId, 'Сначала напиши доработанную версию.')
    return
  }
  const parent = state.data.submissions.find(item => item.id === parentSubmissionId)
  if (!parent || parent.status !== 'returned') {
    setSaveStatus(activityId, 'Эта работа больше не ожидает доработки.')
    return
  }
  const saved = await saveActivity(activityId, true)
  if (!saved) return

  const latest = latestSubmission('A2.1-M01:project')
  if (latest && latest.parent_submission_id === parent.id && ['submitted','in_review','accepted'].includes(latest.status)) {
    setSaveStatus(activityId, 'Доработанная версия уже отправлена.')
    return
  }

  const { data, error } = await supabase.from('submissions').insert({
    student_id: state.profile.id,
    activity_id: 'A2.1-M01:project',
    parent_submission_id: parent.id,
    status: 'submitted',
    text_body: text,
    submitted_at: new Date().toISOString()
  }).select('id,student_id,activity_id,parent_submission_id,status,text_body,submitted_at,created_at').single()
  if (error) {
    setActivitySaveState(activityId, 'error', error.message)
    return
  }
  state.data.submissions.push(data)
  await saveStudentProgress('A2.1-M01:feedback')
  renderRoute()
}

async function saveStudentProgress(sectionId) {
  if (state.profile.role !== 'student' || !sectionId) return
  const sections = moduleSections(MODULE_ID)
  const sectionStates = Object.fromEntries(sections.map(section => {
    const acts = sectionActivities(section.id)
    const done = acts.filter(activityComplete).length
    const started = acts.filter(activityStarted).length
    const status = acts.length && done === acts.length ? 'completed' : started ? 'in_progress' : 'not_started'
    return [section.id, { status, done, total: acts.length }]
  }))
  const p = studentProgress(MODULE_ID)
  const row = {
    student_id: state.profile.id,
    module_id: MODULE_ID,
    current_section_id: sectionId,
    section_states: sectionStates,
    completion_percent: p.percent,
    updated_at: new Date().toISOString()
  }
  const { data, error } = await supabase.from('learner_module_progress').upsert(row, { onConflict: 'student_id,module_id' }).select('student_id,module_id,current_section_id,section_states,completion_percent,updated_at').single()
  if (error) throw error
  state.data.progress = state.data.progress.filter(x => x.module_id !== MODULE_ID)
  state.data.progress.push(data)
}

function currentStudentSectionId() {
  const parts = routeParts()
  return parts[1] === 'section' ? parts.slice(2).join('/') : resumeSection()?.id
}

function setSaveStatus(activityId, text) {
  const node = document.querySelector(`[data-save-status="${cssEscape(activityId)}"]`)
  if (node) node.textContent = text
}

function cssEscape(value) {
  return String(value).replace(/(["\\])/g, '\\$1')
}

function renderTeacherRoute(parts) {
  const page = parts[1] || 'home'
  if (page === 'home') return renderTeacherHome()
  if (page === 'students') return renderTeacherStudents()
  if (page === 'cohort') return renderTeacherCohort(parts[2])
  if (page === 'submission') return renderTeacherSubmission(parts[2])
  if (page === 'module') return renderTeacherModule(parts[2] || MODULE_ID)
  navigate('#/teacher/home')
}

function renderTeacherHome() {
  const pending = state.data.submissions.filter(x => ['submitted', 'in_review'].includes(x.status))
  const content = `<div class="eyebrow">РАБОЧИЙ КАБИНЕТ</div><h1>Преподаватель</h1><p class="lead muted">Группы, необходимый результат, открытые работы и материалы модуля.</p>
    <div class="metric-grid"><div class="metric-card"><strong>${state.data.cohorts.length}</strong><span>групп</span></div><div class="metric-card"><strong>${state.data.students.length}</strong><span>учеников</span></div><div class="metric-card"><strong>${pending.length}</strong><span>работ ждут проверки</span></div></div>
    <div class="section-heading"><h2>Группы</h2></div>
    <div class="course-grid">${state.data.cohorts.length ? state.data.cohorts.map(c => teacherCohortCard(c)).join('') : emptyState('Группы не назначены', 'После назначения преподавателя группе она появится здесь.')}</div>
    <div class="section-heading spaced"><h2>Ждут проверки</h2></div>
    ${pending.length ? `<div class="review-queue">${pending.map(teacherSubmissionRow).join('')}</div>` : emptyState('Очередь пуста', 'Новые открытые работы появятся после отправки учениками.')}`
  const aside = '<section class="rail-card"><span class="rail-label">A2.1 · M01</span><h3>Договориться о встрече и изменить планы</h3><button class="btn secondary full" data-nav="#/teacher/module/A2.1-M01">План модуля и занятий</button></section>'
  app.innerHTML = shell('teacher', content, aside)
}

function renderTeacherStudents() {
  const content = `<div class="eyebrow">МОИ УЧЕНИКИ</div><h1>Группы и ученики</h1><p class="lead muted">Выбери группу, чтобы посмотреть прогресс и работы.</p><div class="course-grid">${state.data.cohorts.length ? state.data.cohorts.map(teacherCohortCard).join('') : emptyState('Группы не назначены', 'После назначения они появятся здесь.')}</div>`
  app.innerHTML = shell('teacher', content)
}

function teacherCohortCard(cohort) {
  const students = state.data.cohortStudents.filter(x => x.cohort_id === cohort.id)
  return `<button class="course-card" data-nav="#/teacher/cohort/${esc(cohort.id)}"><span class="badge">${esc(cohort.course_id)}</span><h3>${esc(cohort.title)}</h3><p class="muted">${students.length} ученик${students.length === 1 ? '' : 'а'}</p><span class="card-link">Открыть группу →</span></button>`
}

function teacherSubmissionRow(submission) {
  const student = state.data.students.find(x => x.id === submission.student_id)
  const activity = state.data.activities.find(x => x.id === submission.activity_id)
  return `<button class="queue-row" data-nav="#/teacher/submission/${esc(submission.id)}"><div><strong>${esc(student?.display_name || student?.email || 'Ученик')}</strong><span>${esc(activity?.title || submission.activity_id)}</span></div><div><span class="status-pill">${esc(submissionLabel(submission.status))}</span><small>${formatDate(submission.submitted_at || submission.created_at)}</small></div><span class="arrow">→</span></button>`
}

function renderTeacherCohort(cohortId) {
  const cohort = state.data.cohorts.find(x => x.id === cohortId)
  if (!cohort) return navigate('#/teacher/home')
  const links = state.data.cohortStudents.filter(x => x.cohort_id === cohort.id)
  const rows = links.map(link => {
    const student = state.data.students.find(x => x.id === link.student_id)
    const progress = state.data.progress.find(x => x.student_id === link.student_id && x.module_id === MODULE_ID)
    const pending = state.data.submissions.filter(x => x.student_id === link.student_id && ['submitted', 'in_review'].includes(x.status)).length
    return `<article class="student-row"><div><strong>${esc(student?.display_name || student?.email || 'Ученик')}</strong><span class="muted">${esc(student?.email || '')}</span></div><div class="student-progress"><div class="progress-track"><span style="width:${Number(progress?.completion_percent || 0)}%"></span></div><span>${Math.round(Number(progress?.completion_percent || 0))}%</span></div><div>${pending ? `<span class="status-pill warn">${pending} на проверке</span>` : '<span class="muted">Нет новых работ</span>'}</div></article>`
  }).join('')
  const content = `<div class="breadcrumbs"><button data-nav="#/teacher/home">Группы</button><span>›</span><span>${esc(cohort.title)}</span></div><div class="eyebrow">${esc(cohort.course_id)}</div><h1>${esc(cohort.title)}</h1><p class="lead muted">Ученики, прогресс и работы, требующие проверки.</p><div class="student-list">${rows || emptyState('В группе нет учеников', 'Назначение учеников выполняется через серверные операции.')}</div>`
  app.innerHTML = shell('teacher', content)
}

function renderTeacherSubmission(submissionId) {
  const submission = state.data.submissions.find(x => x.id === submissionId)
  if (!submission) return navigate('#/teacher/home')
  const student = state.data.students.find(x => x.id === submission.student_id)
  const activity = state.data.activities.find(x => x.id === submission.activity_id)
  const existing = state.data.reviews.find(x => x.submission_id === submission.id && x.status === 'published')
  const requirement = activity?.payload?.word_target ? `${esc(activity.payload.word_target)} Wörter` : '40–60 Wörter'
  const task = activity?.payload?.instruction || 'Подтверди договорённость: причина изменения, новое время, место и просьба ответить.'
  const rubricFields = [
    ['task', 'Задача выполнена'],
    ['agreement', 'Договорённость понятна'],
    ['weil', 'weil'],
    ['vocabulary', 'Подходящая лексика']
  ]
  const rubric = existing
    ? `<ul class="rubric-list">${rubricRows(existing)}</ul>`
    : `<div class="teacher-rubric">${rubricFields.map(([key,label]) => `<label><input type="checkbox" name="rubric_${key}"> ${esc(label)}</label>`).join('')}</div>`
  const review = existing
    ? `<div class="teacher-feedback"><span class="badge">Опубликовано</span>${rubric}${existing.comment ? `<p><strong>Комментарий ученику:</strong> ${esc(existing.comment)}</p>` : ''}</div>`
    : `<form id="teacher-review-form" data-submission-id="${esc(submission.id)}">${rubric}<label class="field"><span>Что нужно улучшить / комментарий ученику</span><textarea name="comment" placeholder="Конкретно укажи, что изменить. Для принятой работы комментарий можно оставить коротким."></textarea></label><div class="activity-actions"><button class="btn secondary" type="button" data-review-decision="returned" data-submission-id="${esc(submission.id)}">Вернуть на доработку</button><button class="btn" type="button" data-review-decision="accepted" data-submission-id="${esc(submission.id)}">Принять работу</button></div><span class="save-status" role="status" aria-live="polite" data-review-status="${esc(submission.id)}"></span></form>`

  const content = `<div class="breadcrumbs"><button data-nav="#/teacher/home">Очередь</button><span>›</span><span>${esc(student?.display_name || 'Ученик')}</span></div>
    <span class="badge">${esc(submissionLabel(submission.status))}</span>
    <h1>Проверка итоговой работы</h1>
    <section class="review-context">
      <div><span class="rail-label">УЧЕНИК</span><strong>${esc(student?.display_name || student?.email || 'Ученик')}</strong></div>
      <div><span class="rail-label">ИСХОДНОЕ ЗАДАНИЕ</span><p>${esc(task)}</p></div>
      <div><span class="rail-label">ТРЕБОВАНИЯ</span><strong>${requirement}</strong></div>
      <div><span class="rail-label">ОТВЕТ УЧЕНИКА</span><div class="submission-text" lang="de">${lines(submission.text_body || '')}</div></div>
    </section>
    <section class="card review-card"><h2>Проверка</h2>${review}</section>`
  app.innerHTML = shell('teacher', content)
  if (submission.status === 'submitted' && !existing) markSubmissionInReview(submission.id).catch(console.error)
}

function renderTeacherModule(moduleId) {
  const module = state.data.modules.find(x => x.id === moduleId)
  if (!module) return navigate('#/teacher/home')
  const sections = state.data.sections.filter(x => x.module_id === module.id).sort((a, b) => a.ordinal - b.ordinal)
  const content = `<div class="eyebrow">МЕТОДИЧЕСКИЙ МАРШРУТ</div><h1>${esc(module.title)}</h1><p class="lead">${esc(module.learning_outcome || '')}</p>
    <details class="card disclosure"><summary>Разделы модуля · ${sections.length}</summary><div class="section-list">${sections.map(section => `<article class="section-row static"><span class="section-index">${section.ordinal}</span><span class="section-main"><strong>${esc(section.title)}</strong><span class="muted">${esc(section.duration_label || '')} · ${state.data.activities.filter(a => a.section_id === section.id).length} заданий</span></span></article>`).join('')}</div></details>
    <div class="section-heading spaced"><h2>Планы занятий</h2><span class="muted">2 × 90 минут · не личное расписание</span></div><div class="session-grid">${TEACHER_SESSIONS.map(s => `<details class="session-card disclosure"><summary>${esc(s.title)}</summary><ul>${s.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}</div>`
  app.innerHTML = shell('teacher', content)
}

async function markSubmissionInReview(submissionId) {
  const submission = state.data.submissions.find(item => item.id === submissionId)
  if (!submission || submission.status !== 'submitted') return
  const { data, error } = await supabase.from('submissions').update({ status: 'in_review' }).eq('id', submissionId).select('id,student_id,activity_id,status,text_body,submitted_at,created_at,parent_submission_id').single()
  if (error) throw error
  state.data.submissions = state.data.submissions.map(item => item.id === data.id ? data : item)
  const badge = document.querySelector('.review-context')?.previousElementSibling
  if (badge?.classList.contains('badge')) badge.textContent = submissionLabel('in_review')
}

async function publishTeacherReview(submissionId, decision) {
  const form = document.querySelector(`#teacher-review-form[data-submission-id="${cssEscape(submissionId)}"]`)
  const status = document.querySelector(`[data-review-status="${cssEscape(submissionId)}"]`)
  if (!form) return
  const fd = new FormData(form)
  const comment = String(fd.get('comment') || '').trim()
  if (decision === 'returned' && !comment) {
    if (status) status.textContent = 'Укажи, что именно ученику нужно улучшить.'
    return
  }
  if (status) status.textContent = 'Публикуем…'
  const rubric = {
    decision,
    task: fd.get('rubric_task') === 'on',
    agreement: fd.get('rubric_agreement') === 'on',
    weil: fd.get('rubric_weil') === 'on',
    vocabulary: fd.get('rubric_vocabulary') === 'on'
  }
  const { data: review, error: reviewError } = await supabase.from('submission_reviews').insert({
    submission_id: submissionId,
    teacher_id: state.profile.id,
    status: 'published',
    rubric,
    comment,
    published_at: new Date().toISOString()
  }).select('id,submission_id,teacher_id,status,rubric,strengths,meaning_issue,language_goal,comment,created_at,published_at').single()
  if (reviewError) {
    if (status) status.textContent = 'Не удалось сохранить обратную связь: ' + reviewError.message
    return
  }
  const { data: updated, error: updateError } = await supabase.from('submissions').update({ status: decision }).eq('id', submissionId).select('id,student_id,activity_id,status,text_body,submitted_at,created_at,parent_submission_id').single()
  if (updateError) {
    if (status) status.textContent = 'Комментарий сохранён, но статус работы не обновился: ' + updateError.message
    return
  }
  state.data.reviews.push(review)
  state.data.submissions = state.data.submissions.map(x => x.id === updated.id ? updated : x)
  renderRoute()
}

function renderAdminRoute() {
  renderAdminHome()
}

function renderAdminHome() {
  const activeStudents = state.data.users.filter(x => x.role === 'student' && x.status === 'active').length
  const activeEnrollments = state.data.enrollments.filter(x => x.status === 'active').length
  const content = `<div class="eyebrow">СЛУЖЕБНАЯ ПАНЕЛЬ</div><h1>Состояние платформы</h1><p class="lead muted">Только контроль и обзор. Операционные изменения должны выполняться через ограниченный API и подтверждаемые действия.</p>
    <div class="metric-grid"><div class="metric-card"><strong>${activeStudents}</strong><span>активных учеников</span></div><div class="metric-card"><strong>${activeEnrollments}</strong><span>активных доступов</span></div><div class="metric-card"><strong>${state.data.cohorts.length}</strong><span>групп</span></div><div class="metric-card"><strong>${state.data.modules.length}</strong><span>модулей</span></div></div>
    <div class="section-heading spaced"><h2>Пользователи и роли</h2></div><div class="admin-table">${state.data.users.map(user => `<div class="admin-row"><div><strong>${esc(user.display_name || user.email || 'Пользователь')}</strong><span class="muted">${esc(user.email || '')}</span></div><span class="status-pill">${esc(roleLabel(user.role))}</span><span>${esc(user.status)}</span></div>`).join('')}</div>
    <div class="section-heading spaced"><h2>Последние события аудита</h2></div>${state.data.audit.length ? `<div class="admin-table">${state.data.audit.map(item => `<div class="admin-row"><div><strong>${esc(item.action)}</strong><span class="muted">${esc(item.object_type)} · ${esc(item.object_id)}</span></div><span>${formatDate(item.created_at)}</span></div>`).join('')}</div>` : emptyState('Аудит пока пуст', 'Служебные операции будут записываться здесь по мере подключения API/агентов.')}`
  const aside = '<section class="rail-card"><span class="rail-label">ПРИНЦИП</span><h3>Не большой админ-кабинет</h3><p>Человеку показываем только контроль, подтверждение и исключения. Массовые операции — через API и агентов.</p></section>'
  app.innerHTML = shell('admin', content, aside)
}

function emptyState(title, text) {
  return `<div class="empty-state"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`
}

async function login(form) {
  const fd = new FormData(form)
  const button = form.querySelector('button[type="submit"]')
  if (button) {
    button.disabled = true
    button.textContent = 'Входим…'
  }
  const { error } = await supabase.auth.signInWithPassword({ email: fd.get('email'), password: fd.get('password') })
  if (error) {
    renderAuth(error.message)
    return
  }
  await boot()
}

async function logout() {
  await supabase.auth.signOut()
  state.user = null
  state.profile = null
  state.data = null
  location.hash = ''
  renderAuth()
}

function playSpeech(activityId) {
  const activity = state.data.activities.find(x => x.id === activityId)
  const text = activity?.payload?.speech_text
  if (!text || !('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'de-DE'
  const voice = speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith('de'))
  if (voice) utterance.voice = voice
  speechSynthesis.speak(utterance)
}

async function startRecording(activityId) {
  const status = document.querySelector(`[data-record-status="${cssEscape(activityId)}"]`)
  const stop = document.querySelector(`[data-stop-record="${cssEscape(activityId)}"]`)
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Запись звука не поддерживается этим браузером.')
    if (state.recording) stopRecording(state.recording.activityId)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    const chunks = []
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      const url = URL.createObjectURL(blob)
      const result = document.querySelector(`[data-record-result="${cssEscape(activityId)}"]`)
      if (result) result.innerHTML = `<audio controls src="${url}"></audio>`
      stream.getTracks().forEach(track => track.stop())
      if (status) status.textContent = 'Запись готова. Прослушай её и сохрани короткую заметку ниже.'
      if (stop) stop.disabled = true
      state.recording = null
    }
    recorder.start()
    state.recording = { activityId, recorder, stream }
    if (status) status.textContent = 'Идёт запись…'
    if (stop) stop.disabled = false
  } catch (error) {
    if (status) status.textContent = error.message
  }
}

function stopRecording(activityId) {
  if (!state.recording || state.recording.activityId !== activityId) return
  if (state.recording.recorder.state !== 'inactive') state.recording.recorder.stop()
}

app.addEventListener('pointerdown', event => {
  const control = event.target.closest('button:not(:disabled), [data-nav]:not([aria-disabled="true"])')
  if (!control) return
  control.classList.add('is-pressed')
  window.setTimeout(() => control.classList.remove('is-pressed'), 180)
})

app.addEventListener('click', event => {
  const nav = event.target.closest('[data-nav]')
  if (nav) {
    event.preventDefault()
    if (nav.disabled || nav.getAttribute('aria-disabled') === 'true') return
    navigate(nav.dataset.nav).catch(showFatal)
    return
  }
  if (event.target.closest('[data-logout]')) {
    logout().catch(showFatal)
    return
  }
  const orderToken = event.target.closest('[data-order-token]')
  if (orderToken && state.profile?.role === 'student') {
    const activityId = orderToken.dataset.activityId
    const hidden = document.querySelector(`[data-order-input="${cssEscape(activityId)}"]`)
    const answer = document.querySelector(`[data-order-answer="${cssEscape(activityId)}"]`)
    let order = []
    try { order = JSON.parse(hidden?.value || '[]') } catch {}
    const index = Number(orderToken.dataset.orderToken)
    if (!order.includes(index)) order.push(index)
    if (hidden) hidden.value = JSON.stringify(order)
    const activity = state.data.activities.find(item => item.id === activityId)
    const tokens = activity?.payload?.tokens || []
    if (answer) answer.innerHTML = order.map((tokenIndex, position) => `<button class="order-built-token" type="button" data-order-remove="${position}" data-activity-id="${esc(activityId)}">${esc(tokens[tokenIndex] || '')}</button>`).join('')
    setActivitySaveState(activityId, 'pending')
    saveActivity(activityId, false).catch(showFatal)
    return
  }
  const orderRemove = event.target.closest('[data-order-remove]')
  if (orderRemove && state.profile?.role === 'student') {
    const activityId = orderRemove.dataset.activityId
    const hidden = document.querySelector(`[data-order-input="${cssEscape(activityId)}"]`)
    let order = []
    try { order = JSON.parse(hidden?.value || '[]') } catch {}
    order.splice(Number(orderRemove.dataset.orderRemove), 1)
    if (hidden) hidden.value = JSON.stringify(order)
    const activity = state.data.activities.find(item => item.id === activityId)
    const tokens = activity?.payload?.tokens || []
    const answer = document.querySelector(`[data-order-answer="${cssEscape(activityId)}"]`)
    if (answer) answer.innerHTML = order.length ? order.map((tokenIndex, position) => `<button class="order-built-token" type="button" data-order-remove="${position}" data-activity-id="${esc(activityId)}">${esc(tokens[tokenIndex] || '')}</button>`).join('') : '<span class="muted">Нажимай слова по порядку.</span>'
    setActivitySaveState(activityId, 'pending')
    saveActivity(activityId, false).catch(showFatal)
    return
  }
  const orderReset = event.target.closest('[data-order-reset]')
  if (orderReset && state.profile?.role === 'student') {
    const activityId = orderReset.dataset.orderReset
    const hidden = document.querySelector(`[data-order-input="${cssEscape(activityId)}"]`)
    const answer = document.querySelector(`[data-order-answer="${cssEscape(activityId)}"]`)
    if (hidden) hidden.value = '[]'
    if (answer) answer.innerHTML = '<span class="muted">Нажимай слова по порядку.</span>'
    setActivitySaveState(activityId, 'pending')
    saveActivity(activityId, false).catch(showFatal)
    return
  }

  const save = event.target.closest('[data-save-activity]')
  if (save) {
    saveActivity(save.dataset.saveActivity, true).catch(showFatal)
    return
  }
  const submit = event.target.closest('[data-submit-project]')
  if (submit) {
    submitProject(submit.dataset.submitProject).catch(showFatal)
    return
  }
  const revision = event.target.closest('[data-submit-revision]')
  if (revision) {
    submitRevision(revision.dataset.submitRevision, revision.dataset.parentSubmission).catch(showFatal)
    return
  }
  const play = event.target.closest('[data-play-speech]')
  if (play) {
    playSpeech(play.dataset.playSpeech)
    return
  }
  if (event.target.closest('[data-stop-speech]')) {
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    return
  }
  const start = event.target.closest('[data-start-record]')
  if (start) {
    startRecording(start.dataset.startRecord).catch(showFatal)
    return
  }
  const stop = event.target.closest('[data-stop-record]')
  if (stop) {
    stopRecording(stop.dataset.stopRecord)
    return
  }
  const review = event.target.closest('[data-review-decision]')
  if (review) {
    const form = review.closest('form')
    if (form?.dataset.busy === 'true') return
    if (form) {
      form.dataset.busy = 'true'
      form.querySelectorAll('[data-review-decision]').forEach(button => button.disabled = true)
    }
    publishTeacherReview(review.dataset.submissionId, review.dataset.reviewDecision).catch(showFatal).finally(() => {
      if (form?.isConnected) {
        form.dataset.busy = 'false'
        form.querySelectorAll('[data-review-decision]').forEach(button => button.disabled = false)
      }
    })
  }
})

app.addEventListener('input', event => {
  const input = event.target.closest('[data-activity-input]')
  if (!input || state.profile?.role !== 'student') return
  const activityId = input.dataset.activityInput
  stashDraft(activityId, input.value)
  setActivitySaveState(activityId, 'pending')
  clearTimeout(state.saveTimers.get(activityId))
  state.saveTimers.set(activityId, setTimeout(() => {
    state.saveTimers.delete(activityId)
    saveActivity(activityId, false).catch(showFatal)
  }, 650))
})

app.addEventListener('submit', event => {
  event.preventDefault()
  const form = event.target
  if (form instanceof HTMLFormElement && form.id === 'login-form') {
    login(form).catch(showFatal)
  }
})

window.addEventListener('hashchange', () => {
  if (!state.profile || !state.data) return
  if (state.profile.role !== 'student') {
    renderRoute()
    return
  }
  flushPendingSaves().then(saved => {
    if (saved) renderRoute()
  }).catch(showFatal)
})

window.addEventListener('beforeunload', event => {
  if (!hasUnsavedWork()) return
  event.preventDefault()
  event.returnValue = ''
})

window.addEventListener('pagehide', () => {
  if (state.profile?.role === 'student' && state.pendingDrafts.size) flushPendingSaves().catch(() => {})
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state.profile?.role === 'student' && state.pendingDrafts.size) {
    flushPendingSaves().catch(() => {})
  }
})

supabase.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') {
    state.user = null
    state.profile = null
    state.data = null
    renderAuth()
  }
})

boot().catch(showFatal)

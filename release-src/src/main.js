import { createClient } from '@supabase/supabase-js'
import './styles.css'
import { mountReader } from './reader.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
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
  recording: null,
  speechActivityId: null
}

const SECTION_COPY = {
  start: ['Разогрев и повторение', 'Актуализируй знакомые модели A1 и проверь, что готов двигаться дальше.'],
  grammar: ['Новая грамматика', 'Сравни weil и denn и отработай позицию личного глагола.'],
  vocab: ['Wortschatz und Aussprache', ''],
  reading: ['Чтение', 'Пойми, как участники меняют договорённость и какие ограничения влияют на решение.'],
  practice: ['Закрепление', 'Перейди от модели к собственным формулировкам и выбору общего времени.'],
  listening: ['Hören', ''],
  speaking: ['Sprechen und Interaktion', ''],
  project: ['Abschlussaufgabe', ''],
  feedback: ['Обратная связь', ''],
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
const AUTO_CHECK_TYPES = new Set(['single_choice', 'word_order', 'gap_fill', 'true_false', 'multiple_choice', 'matching', 'classification', 'dropdown', 'sequencing'])
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
    if (activity.type === 'model' || AUTO_CHECK_TYPES.has(activity.type)) return
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
  app.innerHTML = `<main class="shell"><section class="card"><h1>Не удалось загрузить данные</h1><div class="notice error">${esc(error?.message || error)}</div><p>Можно повторить загрузку. Если ошибка сохранится, проверьте авторизацию, RLS и доступность Supabase.</p><button class="btn" data-retry-boot>Повторить</button></section></main>`
}

async function boot(knownUser) {
  let user = knownUser
  if (typeof knownUser === 'undefined') {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.warn('Session restore failed', error)
      user = null
    } else {
      user = session?.user || null
    }
  }

  state.user = user || null
  state.profile = null
  state.data = null

  if (!state.user) {
    renderAuth()
    return
  }

  app.innerHTML = '<main class="auth-shell auth-state-shell"><section class="auth-panel card loading-card" role="status" aria-live="polite"><div class="auth-brand"><img class="lernstep-logo" src="./assets/lernstep-logo.svg" alt="Lernstep"></div><h2>Загружаем кабинет…</h2></section></main>'

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
  const startedAt = performance.now()
  if (profile.role === 'student') state.data = await loadStudentData()
  if (profile.role === 'teacher') state.data = await loadTeacherData()
  if (profile.role === 'admin') state.data = await loadAdminData()
  console.info(`Lernstep workspace loaded in ${Math.round(performance.now() - startedAt)} ms`)

  if (profile.role === 'student') recoverLocalDrafts()
  ensureRoleRoute()
  renderRoute()
  if (profile.role === 'student' && state.pendingDrafts.size) {
    queueMicrotask(() => flushPendingSaves().catch(console.error))
  }
}

async function loadStudentData() {
  const [enrollments, visibleCourses, modules, sections, activities, attempts, progress, submissions, reviews, cohorts] = await Promise.all([
    selectAll('enrollments', 'id,student_id,course_id,cohort_id,status,starts_at,ends_at'),
    selectAll('courses', 'id,title,level_code,status'),
    selectAll('course_modules', 'id,course_id,ordinal,title,learning_outcome,status', 'ordinal'),
    selectAll('module_sections', 'id,module_id,legacy_key,ordinal,title,duration_label,status', 'ordinal'),
    selectAll('activities', 'id,section_id,legacy_key,ordinal,type,title,skill,payload,grading,teacher_review_required,status', 'ordinal'),
    selectAll('activity_attempts', 'id,student_id,activity_id,attempt_no,status,answer,result,started_at,submitted_at,checked_at'),
    selectAll('learner_module_progress', 'student_id,module_id,current_section_id,section_states,completion_percent,updated_at'),
    selectAll('submissions', 'id,student_id,activity_id,parent_submission_id,status,text_body,submitted_at,created_at'),
    selectAll('submission_reviews', 'id,submission_id,teacher_id,status,rubric,strengths,meaning_issue,language_goal,comment,created_at,published_at'),
    selectAll('cohorts', 'id,course_id,title,status,created_at'),
  ])
  const activeEnrollments = enrollments.filter(x => x.status === 'active')
  const courseIds = new Set(activeEnrollments.map(x => x.course_id))
  const courses = visibleCourses.filter(x => courseIds.has(x.id))
  return { enrollments, activeEnrollments, courses, modules, sections, activities, attempts, progress, submissions, reviews, cohorts }
}

async function loadTeacherData() {
  const [courses, modules, sections, activities, cohorts, cohortStudents, visibleUsers, enrollments, progress, submissions, reviews, attempts] = await Promise.all([
    selectAll('courses', 'id,title,level_code,status'),
    selectAll('course_modules', 'id,course_id,ordinal,title,learning_outcome,status', 'ordinal'),
    selectAll('module_sections', 'id,module_id,legacy_key,ordinal,title,duration_label,status', 'ordinal'),
    selectAll('activities', 'id,section_id,legacy_key,ordinal,type,title,skill,payload,grading,teacher_review_required,status', 'ordinal'),
    selectAll('cohorts', 'id,course_id,title,status,created_at'),
    selectAll('cohort_students', 'cohort_id,student_id,joined_at'),
    selectAll('app_users', 'id,email,display_name,role,status'),
    selectAll('enrollments', 'id,student_id,course_id,cohort_id,status,starts_at,ends_at'),
    selectAll('learner_module_progress', 'student_id,module_id,current_section_id,section_states,completion_percent,updated_at'),
    selectAll('submissions', 'id,student_id,activity_id,status,text_body,submitted_at,created_at,parent_submission_id'),
    selectAll('submission_reviews', 'id,submission_id,teacher_id,status,rubric,strengths,meaning_issue,language_goal,comment,created_at,published_at'),
    selectAll('activity_attempts', 'id,student_id,activity_id,status,answer,result,started_at,submitted_at,checked_at'),
  ])
  const students = visibleUsers.filter(x => x.role === 'student')
  return { courses, modules, sections, activities, cohorts, cohortStudents, students, enrollments, progress, submissions, reviews, attempts }
}

async function loadAdminData() {
  const [users, enrollments, cohorts, cohortStudents, cohortTeachers, courses, modules, sections, activities, audit] = await Promise.all([
    selectAll('app_users', 'id,email,display_name,role,status,created_at,updated_at'),
    selectAll('enrollments', 'id,student_id,course_id,cohort_id,status,source,starts_at,ends_at,created_at,updated_at'),
    selectAll('cohorts', 'id,course_id,title,status,created_at'),
    selectAll('cohort_students', 'cohort_id,student_id,joined_at'),
    selectAll('cohort_teachers', 'cohort_id,teacher_id,assigned_at'),
    selectAll('courses', 'id,title,level_code,status,created_at,updated_at'),
    selectAll('course_modules', 'id,course_id,ordinal,title,learning_outcome,status', 'ordinal'),
    selectAll('module_sections', 'id,module_id,legacy_key,ordinal,title,duration_label,status', 'ordinal'),
    selectAll('activities', 'id,section_id,legacy_key,ordinal,type,title,skill,payload,grading,teacher_review_required,status', 'ordinal'),
    selectAll('audit_log', 'id,actor_user_id,actor_kind,action,object_type,object_id,reason,created_at', 'created_at', false, 30),
  ])
  return { users, enrollments, cohorts, cohortStudents, cohortTeachers, courses, modules, sections, activities, audit, attempts: [], submissions: [], reviews: [] }
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
  stopActiveMedia()
  if (state.profile?.role === 'student' && location.hash !== hash) {
    const saved = await flushPendingSaves()
    if (!saved) return false
  }
  if (location.hash === hash) renderRoute()
  else location.hash = hash
  return true
}

function renderRoute() {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
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
      <div class="saveflag">${state.profile.role === 'student' ? 'Прогресс и ответы сохраняются на сервере' : ''}</div>
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
        ['Расписание', '', false, false],
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
  const currentSection = state.data.sections.find(item => item.id === sectionId)
  const module = state.data.modules.find(item => item.id === currentSection?.module_id) || activeStudentModule()
  const course = state.data.courses.find(item => item.id === module?.course_id)
  const sections = moduleSections(module?.id)
  return `<div class="navtitle">${esc(course?.level_code || course?.id || '')} · Модуль ${String(module?.ordinal || 1).padStart(2, '0')}</div>
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
      <button class="brand" data-nav="#/${role}/home" aria-label="Lernstep · На главную">
        <img class="lernstep-logo lernstep-logo-sidebar" src="./assets/lernstep-logo.svg" alt="">
      </button>
      <div class="role-label">${roleWorkspaceLabel(role)}</div>
      <div class="navscroll">
        ${primaryNav(role, current)}
        ${lessonSidebar(current)}
      </div>
      <div class="sidebar-bottom">
        <div class="small muted">${role === 'student' ? 'Учебное пространство' : 'Рабочее пространство'}</div>
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
  app.innerHTML = `<main class="auth-shell auth-login-shell">
    <section class="auth-login-brand-pane" aria-label="Lernstep">
      <img class="lernstep-logo auth-login-logo" src="./assets/lernstep-logo.svg" alt="Lernstep">
    </section>
    <section class="auth-panel card auth-login-panel">
      <h1>Войти</h1>
      ${message ? `<div class="notice error">${esc(message)}</div>` : ''}
      <form id="login-form">
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" required></label>
        <label class="field"><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn" type="submit">Войти</button>
      </form>
    </section>
  </main>`
}

function renderUnprovisioned() {
  app.innerHTML = '<main class="auth-shell auth-state-shell"><section class="auth-panel card narrow"><div class="auth-brand"><img class="lernstep-logo" src="./assets/lernstep-logo.svg" alt="Lernstep"></div><span class="badge">Аккаунт создан</span><h1>Доступ ещё не назначен</h1><p>Для этого аккаунта пока не назначены роль и доступ к учебному пространству.</p><button class="btn secondary" data-logout>Выйти</button></section></main>'
}

function renderBlocked(status) {
  app.innerHTML = `<main class="auth-shell auth-state-shell"><section class="auth-panel card narrow"><div class="auth-brand"><img class="lernstep-logo" src="./assets/lernstep-logo.svg" alt="Lernstep"></div><h1>Доступ к платформе ограничен</h1><p>Статус аккаунта: ${esc(status)}.</p><button class="btn secondary" data-logout>Выйти</button></section></main>`
}

function renderStudentRoute(parts) {
  const page = parts[1] || 'home'
  if (page === 'home') return renderStudentHome()
  if (page === 'reader') return renderStudentReader()
  if (page === 'courses') return renderStudentCourses()
  if (page === 'course') return renderStudentCourse(parts[2] || COURSE_ID)
  if (page === 'module') return renderStudentModule(parts[2] || MODULE_ID)
  if (page === 'section') return renderStudentSection(parts.slice(2).join('/') || firstModuleSection()?.id)
  navigate('#/student/home')
}

function renderStudentReader() {
  app.innerHTML = shell('student', '<div class="reader-page-host" data-reader-root></div>')
  mountReader(document.querySelector('[data-reader-root]'), state.profile.id)
}

function activeStudentModule() {
  const modules = [...(state.data?.modules || [])].sort((a, b) =>
    String(a.course_id).localeCompare(String(b.course_id)) || Number(a.ordinal) - Number(b.ordinal)
  )
  const latestProgress = [...(state.data?.progress || [])]
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    .find(item => modules.some(module => module.id === item.module_id))
  return modules.find(module => module.id === latestProgress?.module_id) || modules[0] || null
}

function moduleSections(moduleId = activeStudentModule()?.id || MODULE_ID) {
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

function studentProgress(moduleId = activeStudentModule()?.id || MODULE_ID) {
  const sections = moduleSections(moduleId)
  const activities = sections.flatMap(x => sectionActivities(x.id))
  const done = activities.filter(activityComplete).length
  return { done, total: activities.length, percent: activities.length ? Math.round(done / activities.length * 100) : 0 }
}

function firstModuleSection(moduleId = activeStudentModule()?.id || MODULE_ID) {
  return moduleSections(moduleId)[0] || null
}

function resumeSection(moduleId = activeStudentModule()?.id || MODULE_ID) {
  const sections = moduleSections(moduleId)
  const progress = state.data.progress.find(x => x.module_id === moduleId)
  const current = progress?.current_section_id ? sections.find(x => x.id === progress.current_section_id) : null
  if (current && sectionActivities(current.id).some(a => !activityComplete(a))) return current
  return sections.find(section => sectionActivities(section.id).some(a => !activityComplete(a))) || current || firstModuleSection(moduleId)
}

function renderStudentHome() {
  const module = activeStudentModule()
  const progress = studentProgress(module?.id)
  const resume = resumeSection(module?.id)
  const course = state.data.courses.find(x => x.id === module?.course_id) || state.data.courses[0]
  const firstName = String(state.profile.display_name || 'ученик').trim().split(/\s+/)[0]

  const content = `<div class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</div>
    <h1>Привет, ${esc(firstName)}.</h1>
    <section class="hero">
      <div>
        <div class="eyebrow">${esc(course?.level_code || course?.id || '')} · МОДУЛЬ ${String(module?.ordinal || 1).padStart(2, '0')}</div>
        <h2>${esc(module?.title || 'Договориться о встрече и изменить планы')}</h2>
        <p class="hero-desc">${esc(module?.learning_outcome || '')}</p>
        <div class="actions">
          <button class="btn" data-nav="#/student/section/${esc(resume?.id || firstModuleSection(module?.id)?.id || '')}">${progress.done ? 'Продолжить модуль' : 'Начать модуль'} →</button>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-art-top">${esc(course?.level_code || course?.id || '')}</div>
        <div class="hero-art-number">${String(module?.ordinal || 1).padStart(2, '0')}</div>
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
      <p class="muted">${resume ? `${resume.ordinal} из ${moduleSections(module?.id).length} разделов` : ''}</p>
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
  const resume = resumeSection(module.id)
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
  const current = resumeSection(section.module_id)?.id === section.id
  const deferredReview = section.id === 'A2.1-M01:review' && typeof p1ReviewItem === 'function' && p1ReviewItem() && !p1ReviewAvailable()
  const complete = activities.length > 0 && done === activities.length && !deferredReview
  const stateClass = complete ? 'done' : current ? 'current' : started || deferredReview ? 'started' : 'next'
  const dueLabel = deferredReview ? new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short'}).format(new Date(p1ReviewItem().due_at)) : ''
  const stateLabel = deferredReview ? `Повторение ${dueLabel}` : complete ? 'Готово' : started ? 'Черновик' : 'Не начато'
  const total = activities.length + (deferredReview ? 1 : 0)
  return `<button class="section-row ${stateClass}" data-nav="#/student/section/${esc(section.id)}"><span class="section-index">${section.ordinal}</span><span class="section-main"><strong>${esc(section.title)}</strong><span class="muted">${esc(section.duration_label || '')}</span></span><span class="section-state">${stateLabel} · ${done}/${total}</span><span class="arrow">→</span></button>`
}

function renderStudentSection(sectionId) {
  const section = state.data.sections.find(x => x.id === sectionId) || firstModuleSection()
  if (!section) return navigate('#/student/module/' + (activeStudentModule()?.id || MODULE_ID))
  const module = state.data.modules.find(x => x.id === section.module_id)
  const sections = moduleSections(section.module_id)
  const activities = sectionActivities(section.id)
  const idx = sections.findIndex(x => x.id === section.id)
  const copy = module?.id === MODULE_ID ? (SECTION_COPY[section.legacy_key] || [section.title, '']) : [section.title, '']
  const content = `<div class="lessonhead">
      <div class="inline"><span class="badge green">${esc(module.course_id)} · Модуль ${String(module.ordinal).padStart(2, '0')}</span></div>
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

    </div>`
  app.innerHTML = shell('student', content)
  saveStudentProgress(section.id).catch(console.error)
}

function activityReviewLabel(activity) {
  const mode = activity?.grading?.mode
  if (activity?.teacher_review_required || mode === 'teacher_review') return 'Проверит преподаватель'
  if (mode === 'auto') return 'Проверяется автоматически'
  if (mode === 'model_answer' || mode === 'acknowledge') return 'Сверь с образцом'
  return 'Самопроверка'
}

function activitySaveLabel(activity) {
  return activity?.teacher_review_required || activity?.grading?.mode === 'teacher_review'
    ? 'Сохранить черновик'
    : 'Сохранить'
}

function renderStudentActivity(activity) {
  const p = activity.payload || {}
  const attempt = attemptFor(activity.id)
  const status = activityStateLabel(activity)
  const header = `<div class="activity-head"><div>${!p.instruction ? `<h2 class="activity-title">${esc(activity.title)}</h2>` : ''}</div><span class="activity-status ${activityComplete(activity) ? 'done' : ''}">${esc(status)}</span></div>`
  const instruction = `${p.instruction ? `<p class="task-instruction" lang="de">${esc(p.instruction)}</p>` : ''}<div class="review-mode">${esc(activityReviewLabel(activity))}</div>${p.system_note && activity.type !== 'speaking_reflection' && !activity.id.endsWith(':project') ? `<p class="system-note">${esc(p.system_note)}</p>` : ''}`
  const prompt = p.prompt ? `<div class="prompt-box">${lines(p.prompt)}</div>` : ''
  const source = Array.isArray(p.source)
    ? `<div class="chat">${p.source.map(item => `<div class="bubble"><strong>${esc(item.speaker)}</strong><br><span lang="de">${esc(item.text)}</span></div>`).join('')}</div>`
    : typeof p.source === 'string' && p.source ? `<div class="prompt-box" lang="de">${esc(p.source)}</div>` : ''
  const items = Array.isArray(p.items) ? `<div class="lex-list">${p.items.map(item => `<span>${esc(item)}</span>`).join('')}</div>` : ''
  const supportLabel = activity.grading?.mode === 'model_answer' ? 'Сверить с образцом' : activity.grading?.mode === 'self_review' ? 'Самопроверка' : 'Опора / проверить себя'
  const support = p.support ? `<details class="support"><summary>${esc(supportLabel)}</summary><div>${lines(p.support)}</div></details>` : ''
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
    const expected = Array.isArray(activity.grading?.answers) ? activity.grading.answers : []
    const multiple = expected.length > 1
    const savedValues = Array.isArray(attempt?.answer?.values) ? attempt.answer.values : []
    if (activity.type === 'true_false') {
    const values = Array.isArray(attempt?.answer?.values) ? attempt.answer.values : []
    const statements = Array.isArray(p.statements) ? p.statements : []
    const rows = statements.map((item, index) => `<fieldset class="structured-row"><legend>${index + 1}. ${esc(item.text)}</legend><label class="choice-option inline-choice"><input type="radio" name="tf-${esc(activity.id)}-${index}" value="true" ${values[index] === true ? 'checked' : ''}> Richtig</label><label class="choice-option inline-choice"><input type="radio" name="tf-${esc(activity.id)}-${index}" value="false" ${values[index] === false ? 'checked' : ''}> Falsch</label></fieldset>`).join('')
    const feedback = attempt?.result?.correct === true ? '<div class="notice success">Richtig.</div>' : attempt?.result?.correct === false ? '<div class="notice error">Noch nicht. Versuch es noch einmal.</div>' : ''
    return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}${source}<div class="structured-list">${rows}</div>${feedback}<div class="activity-actions"><button class="btn" data-save-activity="${esc(activity.id)}">Проверить</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${support}</article>`
  }

  if (activity.type === 'multiple_choice') {
    const choices = Array.isArray(attempt?.answer?.choices) ? attempt.answer.choices : []
    const options = (p.options || []).map((option, index) => `<label class="choice-option ${choices.includes(index) ? 'selected' : ''}"><input type="checkbox" data-multi-choice="${esc(activity.id)}" value="${index}" ${choices.includes(index) ? 'checked' : ''}><span>${esc(option)}</span></label>`).join('')
    const speech = p.speech_text ? `<div class="audio-panel"><div><h3>Аудирование</h3></div><div class="activity-actions"><button class="btn secondary" data-play-inline-speech="${esc(activity.id)}" data-speech-text="${esc(p.speech_text)}">▶ Прослушать</button></div></div>` : ''
    const feedback = attempt?.result?.correct === true ? '<div class="notice success">Richtig.</div>' : attempt?.result?.correct === false ? '<div class="notice error">Noch nicht. Versuch es noch einmal.</div>' : ''
    return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}${speech}${prompt}<div class="choice-list">${options}</div>${feedback}<div class="activity-actions"><button class="btn" data-save-activity="${esc(activity.id)}">Проверить</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${support}</article>`
  }

  if (activity.type === 'classification') {
    const values = Array.isArray(attempt?.answer?.values) ? attempt.answer.values : []
    const categories = Array.isArray(p.categories) ? p.categories : []
    const rows = (p.items || []).map((item, index) => `<label class="structured-row"><span>${esc(item.text)}</span><select data-structured-select="${esc(activity.id)}" data-structured-index="${index}"><option value="">—</option>${categories.map(category => `<option value="${esc(category)}" ${values[index] === category ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select></label>`).join('')
    const feedback = attempt?.result?.correct === true ? '<div class="notice success">Richtig.</div>' : attempt?.result?.correct === false ? '<div class="notice error">Noch nicht. Versuch es noch einmal.</div>' : ''
    return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}<div class="structured-list">${rows}</div>${feedback}<div class="activity-actions"><button class="btn" data-save-activity="${esc(activity.id)}">Проверить</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${support}</article>`
  }

  if (activity.type === 'matching') {
    const values = Array.isArray(attempt?.answer?.values) ? attempt.answer.values : []
    const pairs = Array.isArray(p.pairs) ? p.pairs : []
    const choices = pairs.map(pair => pair[1])
    const rows = pairs.map((pair, index) => `<label class="structured-row"><span lang="de">${esc(pair[0])}</span><select data-structured-select="${esc(activity.id)}" data-structured-index="${index}"><option value="">—</option>${choices.map(choice => `<option value="${esc(choice)}" ${values[index] === choice ? 'selected' : ''}>${esc(choice)}</option>`).join('')}</select></label>`).join('')
    const feedback = attempt?.result?.correct === true ? '<div class="notice success">Richtig.</div>' : attempt?.result?.correct === false ? '<div class="notice error">Noch nicht. Versuch es noch einmal.</div>' : ''
    return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}<div class="structured-list">${rows}</div>${feedback}<div class="activity-actions"><button class="btn" data-save-activity="${esc(activity.id)}">Проверить</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${support}</article>`
  }

  if (activity.type === 'dropdown') {
    const values = Array.isArray(attempt?.answer?.values) ? attempt.answer.values : []
    const choices = [...new Set((p.items || []).map(item => item.answer).filter(Boolean))]
    const rows = (p.items || []).map((item, index) => `<label class="structured-row"><span lang="de">${esc(item.text)}</span><select data-structured-select="${esc(activity.id)}" data-structured-index="${index}"><option value="">—</option>${choices.map(choice => `<option value="${esc(choice)}" ${values[index] === choice ? 'selected' : ''}>${esc(choice)}</option>`).join('')}</select></label>`).join('')
    const feedback = attempt?.result?.correct === true ? '<div class="notice success">Richtig.</div>' : attempt?.result?.correct === false ? '<div class="notice error">Noch nicht. Versuch es noch einmal.</div>' : ''
    return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}<div class="structured-list">${rows}</div>${feedback}<div class="activity-actions"><button class="btn" data-save-activity="${esc(activity.id)}">Проверить</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${support}</article>`
  }

  if (activity.type === 'sequencing') {
    const savedOrder = Array.isArray(attempt?.answer?.order) ? attempt.answer.order : []
    const tokens = Array.isArray(p.items) ? p.items : []
    const selected = savedOrder.map(index => tokens[index]).filter(Boolean)
    const buttons = tokens.map((token, index) => `<button class="order-token" type="button" data-order-token="${index}" data-activity-id="${esc(activity.id)}">${esc(token)}</button>`).join('')
    const built = selected.map((token, position) => `<button class="order-built-token" type="button" data-order-remove="${position}" data-activity-id="${esc(activity.id)}">${esc(token)}</button>`).join('')
    const feedback = attempt?.result?.correct === true ? '<div class="notice success">Richtig.</div>' : attempt?.result?.correct === false && savedOrder.length ? '<div class="notice error">Noch nicht. Prüfe die Reihenfolge.</div>' : ''
    return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}<div class="word-order-bank">${buttons}</div><div class="word-order-answer" data-order-answer="${esc(activity.id)}">${built || '<span class="muted">Нажимай реплики по порядку.</span>'}</div><input type="hidden" data-order-input="${esc(activity.id)}" value="${esc(JSON.stringify(savedOrder))}">${feedback}<div class="activity-actions"><button class="btn secondary" type="button" data-order-reset="${esc(activity.id)}">Сбросить</button><button class="btn" data-save-activity="${esc(activity.id)}">Проверить</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${support}</article>`
  }

  const value = state.pendingDrafts.has(activity.id) ? state.pendingDrafts.get(activity.id) : (attempt?.answer?.text || '')
    const fields = multiple
      ? expected.map((_, index) => `<label class="field compact-field"><span>Lücke ${index + 1}</span><input data-gap-input="${esc(activity.id)}" data-gap-index="${index}" value="${esc(savedValues[index] || '')}" autocomplete="off"></label>`).join('')
      : `<label class="field"><span>${esc(p.input_label || 'Вставь слово')}</span><input data-activity-input="${esc(activity.id)}" value="${esc(value)}" autocomplete="off"></label>`
    const hasAnswer = multiple ? savedValues.some(Boolean) : String(attempt?.answer?.text || '').trim()
    const feedback = attempt?.result?.correct === true ? `<div class="notice success">${esc(p.feedback_correct || 'Верно.')}</div>` : attempt?.result?.correct === false && hasAnswer ? `<div class="notice error">${esc(p.feedback_incorrect || 'Проверь ответы.')}</div>` : ''
    return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}${prompt}<div class="structured-fields">${fields}</div>${feedback}<div class="activity-actions"><button class="btn" data-save-activity="${esc(activity.id)}">Проверить</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${support}</article>`
  }

  const value = state.pendingDrafts.has(activity.id) ? state.pendingDrafts.get(activity.id) : (attempt?.answer?.text || '')
  const reconstruction = activity.type === 'reconstruction' && Array.isArray(p.blocks) ? `<div class="reconstruction-blocks">${p.blocks.map(block => `<div class="prompt-box" lang="de">${esc(block)}</div>`).join('')}</div>` : ''
  const listening = activity.type === 'listening_text' ? `<div class="audio-panel"><div><h3>Голосовое сообщение</h3></div><div class="activity-actions"><button class="btn secondary" data-play-speech="${esc(activity.id)}">▶ Прослушать</button></div><details class="support"><summary>Показать транскрипт</summary><p lang="de">${esc(p.transcript || p.speech_text || '')}</p></details></div>` : ''
  const speaking = activity.type === 'speaking_reflection' ? `<div class="record-panel"><div class="activity-actions"><button class="btn secondary" data-record-toggle="${esc(activity.id)}" aria-pressed="false"><span aria-hidden="true">🎙</span> Записать</button><span class="small muted" role="status" aria-live="polite" data-record-live="${esc(activity.id)}"></span></div><p class="small muted">Запись остаётся только на этой странице и преподавателю не отправляется.</p><div data-record-result="${esc(activity.id)}"></div></div>` : ''
  const project = activity.id.endsWith(':project') ? projectSubmissionBlock(activity) : ''
  if (activity.id.endsWith(':revision')) return renderRevisionActivity(activity)

  return `<article class="activity-card" data-activity="${esc(activity.id)}">${header}${instruction}${explanation}${prompt}${source}${items}${reconstruction}${listening}${speaking}<label class="field"><span>Мой ответ</span><textarea data-activity-input="${esc(activity.id)}" placeholder="${esc(p.placeholder || '')}">${esc(value)}</textarea></label><div class="activity-actions"><button class="btn" data-save-activity="${esc(activity.id)}">${esc(activitySaveLabel(activity))}</button><span class="save-status" role="status" aria-live="polite" data-save-status="${esc(activity.id)}"></span></div>${project}${support}</article>`
}

function moduleForActivity(activity) {
  const section = state.data.sections.find(item => item.id === activity?.section_id)
  return state.data.modules.find(item => item.id === section?.module_id) || null
}

function projectActivityForModule(moduleId) {
  return state.data.activities.find(item => item.id === `${moduleId}:project`)
    || state.data.activities.find(item => {
      const section = state.data.sections.find(sectionItem => sectionItem.id === item.section_id)
      return section?.module_id === moduleId && item.teacher_review_required
    })
    || null
}

function projectSubmissionBlock(activity) {
  const submission = latestSubmission(activity.id)
  if (!submission) return `<div class="submit-box"><div></div><button class="btn secondary" data-submit-project="${esc(activity.id)}">Отправить преподавателю</button></div>`
  const review = reviewForSubmission(submission.id)
  const module = moduleForActivity(activity)
  const feedbackSection = state.data.sections.find(section => section.module_id === module?.id && section.legacy_key === 'feedback')
  const returnedAction = submission.status === 'returned' && feedbackSection
    ? `<button class="btn secondary" data-nav="#/student/section/${esc(feedbackSection.id)}">Посмотреть обратную связь</button>`
    : ''
  return `<div class="submit-box"><div><strong>${esc(submissionLabel(submission.status))}</strong><p class="small muted">${submission.submitted_at ? `Отправлено ${formatDate(submission.submitted_at)}` : ''}${review ? ' · обратная связь опубликована' : ''}</p></div>${returnedAction}</div>`
}

function latestPublishedProjectReview(moduleId) {
  const project = projectActivityForModule(moduleId)
  if (!project) return null
  const projectSubmissions = [...state.data.submissions]
    .filter(item => item.activity_id === project.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  for (const submission of projectSubmissions) {
    const review = reviewForSubmission(submission.id)
    if (review) return { submission, review, project }
  }
  return null
}

function rubricRows(review, moduleId = MODULE_ID) {
  const rubric = review?.rubric || {}
  const a21 = moduleId === MODULE_ID
  const items = a21
    ? [
        ['task', 'Задача выполнена'],
        ['agreement', 'Договорённость понятна'],
        ['weil', 'weil'],
        ['vocabulary', 'Подходящая лексика']
      ]
    : [
        ['task', 'Задача выполнена'],
        ['agreement', 'Структура и понятность'],
        ['weil', 'Языковая точность'],
        ['vocabulary', 'Подходящая лексика']
      ]
  return items.map(([key, label]) => `<li class="${rubric[key] ? 'ok' : 'needs-work'}"><span aria-hidden="true">${rubric[key] ? '✓' : '○'}</span><span>${esc(label)}</span></li>`).join('')
}

function renderRevisionActivity(activity) {
  const module = moduleForActivity(activity)
  const moduleId = module?.id
  const context = moduleId ? latestPublishedProjectReview(moduleId) : null
  if (!context) {
    return '<article class="activity-card"><div class="activity-head"><div><h2>Обратная связь</h2></div><span class="activity-status">Не начато</span></div><div class="notice">Доработка появится после опубликованной обратной связи преподавателя.</div></article>'
  }
  const { submission, review, project } = context
  if (submission.status === 'accepted') {
    return `<article class="activity-card"><div class="activity-head"><div><h2>Обратная связь</h2></div><span class="activity-status done">Готово</span></div><div class="teacher-feedback"><span class="badge green">Работа принята</span><ul class="rubric-list">${rubricRows(review, moduleId)}</ul>${review.comment ? `<p><strong>Комментарий:</strong> ${esc(review.comment)}</p>` : ''}</div></article>`
  }

  const attempt = attemptFor(activity.id)
  const value = state.pendingDrafts.has(activity.id) ? state.pendingDrafts.get(activity.id) : (attempt?.answer?.text || '')
  const latestProject = latestSubmission(project.id)
  const alreadyResubmitted = latestProject && latestProject.parent_submission_id === submission.id && ['submitted','in_review','accepted'].includes(latestProject.status)
  const checklist = moduleId === MODULE_ID
    ? '<label><input type="checkbox"> Я понял(а), что нужно изменить.</label><label><input type="checkbox"> Я проверил(а) порядок слов после weil.</label><label><input type="checkbox"> Я проверил(а) время, место и понятность договорённости.</label>'
    : '<label><input type="checkbox"> Я понял(а), что нужно изменить.</label><label><input type="checkbox"> Я проверил(а) структуру и понятность.</label><label><input type="checkbox"> Я проверил(а) язык и лексику.</label>'
  return `<article class="activity-card" data-activity="${esc(activity.id)}">
    <div class="activity-head"><div><h2>Доработка после обратной связи</h2></div><span class="activity-status">${attempt ? 'Черновик' : 'Не начато'}</span></div>
    <div class="teacher-feedback">
      <span class="badge">Что проверить</span>
      <ul class="rubric-list">${rubricRows(review, moduleId)}</ul>
      ${review.comment ? `<div class="notice"><strong>Преподаватель просит улучшить:</strong><br>${lines(review.comment)}</div>` : ''}
    </div>
    <fieldset class="revision-checklist"><legend>Перед доработкой</legend>${checklist}</fieldset>
    <label class="field"><span>Доработанная версия</span><textarea data-activity-input="${esc(activity.id)}" placeholder="Перепиши ответ с учётом обратной связи.">${esc(value)}</textarea></label>
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
  } else if (activity.type === 'word_order' || activity.type === 'sequencing') {
    const input = document.querySelector(`[data-order-input="${cssEscape(activityId)}"]`)
    let order = []
    try { order = JSON.parse(input?.value || '[]') } catch {}
    answer = { order }
    result = { correct: JSON.stringify(order) === JSON.stringify(activity.grading?.expected_order || []) }
  } else if (activity.type === 'true_false') {
    const statements = Array.isArray(activity.payload?.statements) ? activity.payload.statements : []
    const values = statements.map((_, index) => {
      const checked = document.querySelector(`input[name="tf-${cssEscape(activityId)}-${index}"]:checked`)
      return checked ? checked.value === 'true' : null
    })
    if (values.some(value => value === null)) {
      setSaveStatus(activityId, 'Ответь на все пункты.')
      return false
    }
    answer = { values }
    result = { correct: values.every((value,index) => value === Boolean(statements[index]?.answer)) }
  } else if (activity.type === 'multiple_choice') {
    const choices = [...document.querySelectorAll(`[data-multi-choice="${cssEscape(activityId)}"]:checked`)].map(input => Number(input.value)).sort((a,b)=>a-b)
    const expected = [...(activity.grading?.correct_indices || activity.payload?.correct_indices || [])].map(Number).sort((a,b)=>a-b)
    answer = { choices }
    result = { correct: JSON.stringify(choices) === JSON.stringify(expected) }
  } else if (['classification','matching','dropdown'].includes(activity.type)) {
    const selects = [...document.querySelectorAll(`[data-structured-select="${cssEscape(activityId)}"]`)]
      .sort((a,b)=>Number(a.dataset.structuredIndex)-Number(b.dataset.structuredIndex))
    const values = selects.map(select => select.value)
    if (values.some(value => !value)) {
      setSaveStatus(activityId, 'Заполни все пункты.')
      return false
    }
    let expected = []
    if (activity.type === 'classification' || activity.type === 'dropdown') expected = (activity.payload?.items || []).map(item => String(item.answer || ''))
    if (activity.type === 'matching') expected = (activity.payload?.pairs || []).map(pair => String(pair?.[1] || ''))
    answer = { values }
    result = { correct: JSON.stringify(values) === JSON.stringify(expected) }
  } else {
    const input = document.querySelector(`[data-activity-input="${cssEscape(activityId)}"]`)
    const text = state.pendingDrafts.has(activityId)
      ? state.pendingDrafts.get(activityId)
      : (input?.value ?? attemptFor(activityId)?.answer?.text ?? '')
    answer = { text }
    if (activity.type === 'gap_fill') {
      const answers = Array.isArray(activity.grading?.answers) ? activity.grading.answers : []
      if (answers.length > 1) {
        const fields = [...document.querySelectorAll(`[data-gap-input="${cssEscape(activityId)}"]`)]
          .sort((a,b)=>Number(a.dataset.gapIndex)-Number(b.dataset.gapIndex))
        const values = fields.map(input => String(input.value || '').trim())
        if (values.some(value => !value)) {
          setSaveStatus(activityId, 'Заполни все пропуски.')
          return false
        }
        answer = { values }
        result = { correct: values.every((value,index) => value.toLocaleLowerCase('de-DE') === String(answers[index] || '').trim().toLocaleLowerCase('de-DE')) }
      } else {
        const normalized = String(text).trim().toLocaleLowerCase('de-DE')
        result = { correct: answers.some(value => String(value).trim().toLocaleLowerCase('de-DE') === normalized) }
      }
    }
  }

  const savedDraftSnapshot = activity.type === 'model' || AUTO_CHECK_TYPES.has(activity.type) ? null : String(answer.text || '')
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

  if (!(activity.type === 'model' || AUTO_CHECK_TYPES.has(activity.type))) {
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

  setActivitySaveState(activityId, 'saving')
  setSaveStatus(activityId, 'Отправляем преподавателю…')
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
  const revisionActivity = state.data.activities.find(item => item.id === activityId)
  const module = moduleForActivity(revisionActivity)
  const project = projectActivityForModule(module?.id)
  const feedbackSection = state.data.sections.find(section => section.module_id === module?.id && section.legacy_key === 'feedback')
  if (!module || !project) return

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

  const latest = latestSubmission(project.id)
  if (latest && latest.parent_submission_id === parent.id && ['submitted','in_review','accepted'].includes(latest.status)) {
    setSaveStatus(activityId, 'Доработанная версия уже отправлена.')
    return
  }

  setActivitySaveState(activityId, 'saving')
  setSaveStatus(activityId, 'Отправляем доработанную версию…')
  const { data, error } = await supabase.from('submissions').insert({
    student_id: state.profile.id,
    activity_id: project.id,
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
  if (feedbackSection) await saveStudentProgress(feedbackSection.id)
  renderRoute()
}

async function saveStudentProgress(sectionId) {
  if (state.profile.role !== 'student' || !sectionId) return
  const currentSection = state.data.sections.find(item => item.id === sectionId)
  const moduleId = currentSection?.module_id || activeStudentModule()?.id
  if (!moduleId) return
  const sections = moduleSections(moduleId)
  const sectionStates = Object.fromEntries(sections.map(section => {
    const acts = sectionActivities(section.id)
    const done = acts.filter(activityComplete).length
    const started = acts.filter(activityStarted).length
    const deferredReview = moduleId === MODULE_ID && section.id === 'A2.1-M01:review' && typeof p1ReviewItem === 'function' && p1ReviewItem() && !p1ReviewAvailable()
    const status = deferredReview ? 'waiting' : acts.length && done === acts.length ? 'completed' : started ? 'in_progress' : 'not_started'
    return [section.id, { status, done, total: acts.length + (deferredReview ? 1 : 0), ...(deferredReview ? { available_at: p1ReviewItem().due_at } : {}) }]
  }))
  const p = studentProgress(moduleId)
  const row = {
    student_id: state.profile.id,
    module_id: moduleId,
    current_section_id: sectionId,
    section_states: sectionStates,
    completion_percent: p.percent,
    updated_at: new Date().toISOString()
  }
  const { data, error } = await supabase.from('learner_module_progress').upsert(row, { onConflict: 'student_id,module_id' }).select('student_id,module_id,current_section_id,section_states,completion_percent,updated_at').single()
  if (error) throw error
  state.data.progress = state.data.progress.filter(x => x.module_id !== moduleId)
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
  if (page === 'courses') return renderTeacherCourses()
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
  const aside = '<section class="rail-card"><span class="rail-label">МАТЕРИАЛЫ</span><h3>Все курсы</h3><p class="muted">Преподаватель видит опубликованные материалы всех курсов.</p><button class="btn secondary full" data-nav="#/teacher/courses">Открыть каталог</button></section>'
  app.innerHTML = shell('teacher', content, aside)
}

function renderTeacherCourses() {
  const courses = [...state.data.courses].sort((a,b)=>String(a.level_code||a.id).localeCompare(String(b.level_code||b.id), 'de', { numeric: true }))
  const content = `<div class="eyebrow">ВСЕ МАТЕРИАЛЫ</div><h1>Курсы</h1><p class="lead muted">Содержательный каталог опубликованных курсов. Группы и ученики при этом остаются только назначенными преподавателю.</p>
    <div class="course-grid">${courses.map(course => {
      const modules = state.data.modules.filter(module => module.course_id === course.id).sort((a,b)=>a.ordinal-b.ordinal)
      return `<article class="course-card static-card"><span class="badge">${esc(course.level_code || course.id)}</span><h3>${esc(course.title)}</h3><p class="muted">${ruCount(modules.length,['модуль','модуля','модулей'])}</p><div class="compact-link-list">${modules.map(module => `<button class="inline-link" data-nav="#/teacher/module/${esc(module.id)}">Модуль ${String(module.ordinal).padStart(2,'0')} · ${esc(module.title)}</button>`).join('')}</div></article>`
    }).join('')}</div>`
  app.innerHTML = shell('teacher', content)
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
  const module = moduleForActivity(activity)
  const existing = state.data.reviews.find(x => x.submission_id === submission.id && x.status === 'published')
  const requirement = activity?.payload?.word_target ? `${esc(activity.payload.word_target)} Wörter` : 'Краткий связный ответ'
  const task = activity?.payload?.instruction || activity?.title || 'Итоговая работа модуля'
  const a21 = module?.id === MODULE_ID
  const rubricFields = a21
    ? [['task','Задача выполнена'],['agreement','Договорённость понятна'],['weil','weil'],['vocabulary','Подходящая лексика']]
    : [['task','Задача выполнена'],['agreement','Структура и понятность'],['weil','Языковая точность'],['vocabulary','Подходящая лексика']]
  const rubric = existing
    ? `<ul class="rubric-list">${rubricRows(existing, module?.id)}</ul>`
    : `<div class="teacher-rubric">${rubricFields.map(([key,label]) => `<label><input type="checkbox" name="rubric_${key}"> ${esc(label)}</label>`).join('')}</div>`
  const review = existing
    ? `<div class="teacher-feedback"><span class="badge">Опубликовано</span>${rubric}${existing.comment ? `<p><strong>Комментарий ученику:</strong> ${esc(existing.comment)}</p>` : ''}</div>`
    : `<form id="teacher-review-form" data-submission-id="${esc(submission.id)}">${rubric}<label class="field"><span>Что нужно улучшить / комментарий ученику</span><textarea name="comment" placeholder="Конкретно укажи, что изменить. Для принятой работы комментарий можно оставить коротким."></textarea></label><div class="activity-actions"><button class="btn secondary" type="button" data-review-decision="returned" data-submission-id="${esc(submission.id)}">Вернуть на доработку</button><button class="btn" type="button" data-review-decision="accepted" data-submission-id="${esc(submission.id)}">Принять работу</button></div><span class="save-status" role="status" aria-live="polite" data-review-status="${esc(submission.id)}"></span></form>`

  const content = `<div class="breadcrumbs"><button data-nav="#/teacher/home">Очередь</button><span>›</span><span>${esc(student?.display_name || 'Ученик')}</span></div>
    <span class="badge">${esc(submissionLabel(submission.status))}</span>
    <h1>Проверка итоговой работы</h1>
    <section class="review-context">
      <div><span class="rail-label">УЧЕНИК</span> <strong>${esc(student?.display_name || student?.email || 'Ученик')}</strong></div>
      <div><span class="rail-label">ИСХОДНОЕ ЗАДАНИЕ</span><p>${esc(task)}</p></div>
      <div><span class="rail-label">ТРЕБОВАНИЯ</span> <strong>${requirement}</strong></div>
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

function adminStatusLabel(status) {
  return ({ active: 'Активен', blocked: 'Заблокирован', invited: 'Приглашён' }[status] || status)
}

function adminAuditActionLabel(action) {
  return ({
    invite_user: 'Приглашение пользователя',
    update_user: 'Изменение доступа',
    create_activity: 'Создание задания',
    edit_activity: 'Редактирование задания',
    publish_activity: 'Публикация задания',
    archive_activity: 'Архивация задания',
    reorder_activity: 'Изменение порядка заданий'
  }[action] || 'Изменение')
}

function adminAuditObjectLabel(type) {
  return ({
    app_user: 'Пользователь',
    user: 'Пользователь',
    activity: 'Задание',
    enrollment: 'Доступ к курсу'
  }[type] || 'Объект')
}

function activityStatusLabel(status) {
  return ({ draft: 'Черновик', published: 'Опубликовано', archived: 'В архиве' }[status] || status)
}

function activityTypeLabel(type) {
  return ({
    single_choice: 'Один вариант ответа',
    open_text: 'Открытый ответ',
    word_order: 'Порядок слов',
    gap_fill: 'Заполнить пропуски',
    model: 'Образец / самопроверка',
    listening_text: 'Аудирование',
    speaking_reflection: 'Устная практика',
    true_false: 'Верно / неверно',
    multiple_choice: 'Несколько вариантов',
    matching: 'Соответствия',
    classification: 'Классификация',
    dropdown: 'Выбор из списка',
    sequencing: 'Последовательность',
    reconstruction: 'Реконструкция'
  }[type] || type)
}

function gradingModeLabel(mode) {
  return ({
    auto: 'Проверяется автоматически',
    self_review: 'Самопроверка',
    model_answer: 'Сверка с образцом',
    teacher_review: 'Проверяет преподаватель',
    acknowledge: 'Самопроверка'
  }[mode] || mode)
}

function adminPromptLabel(type) {
  if (type === 'single_choice') return 'Вопрос'
  if (type === 'gap_fill') return 'Текст задания'
  return 'Задание'
}

function ruCount(value, forms) {
  const n = Math.abs(Number(value) || 0)
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return `${n} ${forms[0]}`
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return `${n} ${forms[1]}`
  return `${n} ${forms[2]}`
}

async function adminApi(body) {
  const { data, error } = await supabase.functions.invoke('admin-control', { body })
  if (error) {
    let message = error.message || 'Операция не выполнена.'
    try {
      const payload = await error.context?.json?.()
      if (payload?.error) message = payload.error
    } catch {}
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

async function refreshAdminData() {
  state.data = await loadAdminData()
  renderRoute()
}

function renderStudentActivityPreview(activity) {
  const original = state.data
  state.data = { ...original, attempts: [], submissions: [], reviews: [] }
  try {
    return renderStudentActivity(activity)
      .replace(/<button /g, '<button disabled ')
      .replace(/<input /g, '<input disabled ')
      .replace(/<textarea /g, '<textarea disabled ')
      .replace(/ data-(save-activity|submit-project|submit-revision|play-speech|record-toggle)="[^"]*"/g, '')
  } finally {
    state.data = original
  }
}

function adminPreviewCard(activity) {
  return `<section class="admin-preview"><div class="section-heading"><h2>Предпросмотр</h2><span class="muted">Так задание увидит ученик; действия отключены</span></div><div data-admin-preview>${renderStudentActivityPreview(activity)}</div></section>`
}

function renderAdminRoute(parts) {
  const view = parts[1] || 'home'
  if (view === 'users') return renderAdminUsers()
  if (view === 'content') {
    if (parts[2] === 'module' && parts[3]) return renderAdminModule(parts.slice(3).join('/'))
    if (parts[2] === 'activity' && parts[3]) return renderAdminActivity(parts.slice(3).join('/'))
    if (parts[2] === 'new' && parts[3]) return renderAdminNewActivity(parts.slice(3).join('/'))
    return renderAdminCatalog()
  }
  renderAdminHome()
}

function renderAdminHome() {
  const activeStudents = state.data.users.filter(x => x.role === 'student' && x.status === 'active').length
  const activeEnrollments = state.data.enrollments.filter(x => x.status === 'active').length
  const draftCount = state.data.activities.filter(x => x.status === 'draft').length
  const content = `<div class="eyebrow">СЛУЖЕБНАЯ ПАНЕЛЬ</div><h1>Состояние платформы</h1><p class="lead muted">Минимальный набор операций: доступы и учебный контент. Остальные действия пока остаются вне интерфейса.</p>
    <div class="metric-grid"><div class="metric-card"><strong>${activeStudents}</strong><span>активных учеников</span></div><div class="metric-card"><strong>${activeEnrollments}</strong><span>активных доступов</span></div><div class="metric-card"><strong>${state.data.modules.length}</strong><span>модулей</span></div><div class="metric-card"><strong>${draftCount}</strong><span>черновиков заданий</span></div></div>
    <div class="admin-action-grid">
      <button class="card admin-action-card" data-nav="#/admin/users"><span class="eyebrow">ДОСТУП</span><h2>Ученики и доступ</h2><p>Создание пользователя, роль и статус.</p><span class="card-link">Открыть →</span></button>
      <button class="card admin-action-card" data-nav="#/admin/content"><span class="eyebrow">КОНТЕНТ</span><h2>Каталог материалов</h2><p>Курс → модуль → раздел → задание.</p><span class="card-link">Открыть →</span></button>
    </div>
    <div class="section-heading spaced"><h2>Последние изменения</h2></div>${state.data.audit.length ? `<div class="admin-table">${state.data.audit.slice(0,10).map(item => `<div class="admin-row"><div><strong>${esc(adminAuditActionLabel(item.action))}</strong><span class="muted">${esc(adminAuditObjectLabel(item.object_type))}</span></div><span>${esc(item.reason || '')}</span><span>${formatDate(item.created_at)}</span></div>`).join('')}</div>` : emptyState('Изменений пока нет', 'Операционные действия появятся здесь после изменений.')}`
  const aside = '<section class="rail-card"><span class="rail-label">ПРИНЦИП</span><h3>Минимальный контроль</h3><p>Без большого административного кабинета: только операции, где человеку действительно нужны выбор и подтверждение.</p></section>'
  app.innerHTML = shell('admin', content, aside)
}

function renderAdminUsers() {
  const students = state.data.users.filter(user => user.role === 'student')
  const teachers = state.data.users.filter(user => user.role === 'teacher')
  const courses = [...state.data.courses].sort((a,b)=>String(a.level_code||a.id).localeCompare(String(b.level_code||b.id), 'de', { numeric: true }))
  const cohorts = [...state.data.cohorts].sort((a,b)=>String(a.course_id).localeCompare(String(b.course_id)) || String(a.title).localeCompare(String(b.title)))

  const rows = state.data.users.map(user => `<form class="admin-user-row" data-admin-user-form="${esc(user.id)}">
      <div class="admin-user-main"><strong>${esc(user.display_name || user.email || 'Пользователь')}</strong><span class="muted">${esc(user.email || '')}</span><span class="small muted">Создан: ${formatDate(user.created_at)}</span></div>
      <label class="compact-field"><span>Роль</span><select name="role">
        ${['student','teacher','admin'].map(role => `<option value="${role}" ${role === user.role ? 'selected' : ''}>${esc(roleLabel(role))}</option>`).join('')}
      </select></label>
      <label class="compact-field"><span>Статус</span><select name="status" ${user.status === 'invited' ? 'disabled' : ''}>
        ${user.status === 'invited' ? '<option selected>Ожидает приглашения</option>' : `<option value="active" ${user.status === 'active' ? 'selected' : ''}>Активен</option><option value="blocked" ${user.status === 'blocked' ? 'selected' : ''}>Заблокирован</option>`}
      </select></label>
      ${user.status === 'invited' && user.email ? `<button class="btn secondary compact" type="button" data-admin-invite-existing="${esc(user.id)}">Пригласить</button>` : '<button class="btn secondary compact" type="submit">Сохранить</button>'}
      <span class="small muted" data-admin-user-status="${esc(user.id)}"></span>
    </form>`).join('')

  const cohortCards = cohorts.map(cohort => {
    const course = state.data.courses.find(item => item.id === cohort.course_id)
    const studentLinks = state.data.cohortStudents.filter(item => item.cohort_id === cohort.id)
    const teacherLinks = state.data.cohortTeachers.filter(item => item.cohort_id === cohort.id)
    const names = studentLinks.map(link => state.data.users.find(user => user.id === link.student_id)?.display_name || 'Ученик')
    const teacherRows = teacherLinks.map(link => {
      const teacher = state.data.users.find(user => user.id === link.teacher_id)
      return `<span class="assignment-chip">${esc(teacher?.display_name || teacher?.email || 'Преподаватель')}<button type="button" aria-label="Снять преподавателя" data-admin-unassign-teacher="${esc(link.teacher_id)}" data-cohort-id="${esc(cohort.id)}">×</button></span>`
    }).join('')
    return `<article class="admin-cohort-card"><div><span class="badge">${esc(course?.level_code || cohort.course_id)}</span><h3>${esc(cohort.title)}</h3></div><div><span class="row-label">Преподаватель</span><div class="assignment-chips">${teacherRows || '<span class="muted">Не назначен</span>'}</div></div><div><span class="row-label">Ученики</span><p class="small">${names.length ? esc(names.join(', ')) : '<span class="muted">Пока нет</span>'}</p></div></article>`
  }).join('')

  const studentOptions = students.map(user => `<option value="${esc(user.id)}">${esc(user.display_name || user.email || 'Ученик')}</option>`).join('')
  const teacherOptions = teachers.map(user => `<option value="${esc(user.id)}">${esc(user.display_name || user.email || 'Преподаватель')}</option>`).join('')
  const courseOptions = courses.map(course => `<option value="${esc(course.id)}">${esc(course.level_code || course.id)} · ${esc(course.title)}</option>`).join('')
  const cohortOptions = cohorts.map(cohort => `<option value="${esc(cohort.id)}" data-course-id="${esc(cohort.course_id)}">${esc(cohort.course_id)} · ${esc(cohort.title)}</option>`).join('')

  const content = `<div class="breadcrumbs"><button data-nav="#/admin/home">Обзор</button><span>›</span><span>Ученики и доступ</span></div>
    <div class="section-heading"><div><div class="eyebrow">ПОЛЬЗОВАТЕЛИ И ДОСТУП</div><h1>Ученики и доступ</h1></div></div>

    <div class="admin-access-grid">
      <details class="card disclosure admin-create"><summary>Создать / пригласить пользователя</summary>
        <form id="admin-invite-form" class="admin-form-grid">
          <label class="field"><span>Email</span><input name="email" type="email" required autocomplete="off"></label>
          <label class="field"><span>Имя</span><input name="display_name" required autocomplete="off"></label>
          <label class="field"><span>Роль</span><select name="role"><option value="student">Ученик</option><option value="teacher">Преподаватель</option><option value="admin">Администратор</option></select></label>
          <div class="admin-form-actions"><button class="btn" type="submit">Отправить приглашение</button><span class="small muted" data-admin-form-status></span></div>
        </form>
      </details>

      <details class="card disclosure"><summary>Создать группу</summary>
        <form id="admin-cohort-form" class="admin-form-grid">
          <label class="field"><span>Курс</span><select name="course_id" required><option value="">Выберите курс</option>${courseOptions}</select></label>
          <label class="field"><span>Название группы</span><input name="title" required placeholder="Например, B2.1 · вечерняя группа"></label>
          <div class="admin-form-actions"><button class="btn" type="submit">Создать группу</button><span class="small muted" data-admin-form-status></span></div>
        </form>
      </details>

      <details class="card disclosure"><summary>Назначить ученику курс</summary>
        <form id="admin-enrollment-form" class="admin-form-grid">
          <label class="field"><span>Ученик</span><select name="student_id" required><option value="">Выберите ученика</option>${studentOptions}</select></label>
          <label class="field"><span>Курс</span><select name="course_id" required><option value="">Выберите курс</option>${courseOptions}</select></label>
          <label class="field"><span>Группа</span><select name="cohort_id"><option value="">Без группы</option>${cohortOptions}</select></label>
          <div class="admin-form-actions"><button class="btn" type="submit">Назначить</button><span class="small muted" data-admin-form-status></span></div>
        </form>
      </details>

      <details class="card disclosure"><summary>Назначить преподавателя группе</summary>
        <form id="admin-teacher-cohort-form" class="admin-form-grid">
          <label class="field"><span>Преподаватель</span><select name="teacher_id" required><option value="">Выберите преподавателя</option>${teacherOptions}</select></label>
          <label class="field"><span>Группа</span><select name="cohort_id" required><option value="">Выберите группу</option>${cohortOptions}</select></label>
          <div class="admin-form-actions"><button class="btn" type="submit">Назначить</button><span class="small muted" data-admin-form-status></span></div>
        </form>
      </details>
    </div>

    <section class="card"><div class="section-heading"><h2>Группы и назначения</h2><span class="muted">${cohorts.length}</span></div><div class="admin-cohort-list">${cohortCards || emptyState('Групп пока нет', 'Создайте группу и назначьте курс.')}</div></section>
    <section class="card"><div class="section-heading"><h2>Пользователи</h2><span class="muted">${state.data.users.length}</span></div><div class="admin-user-list">${rows || emptyState('Пользователей пока нет', '')}</div></section>`
  app.innerHTML = shell('admin', content)
}

function renderAdminCatalog() {
  const cards = state.data.courses.map(course => {
    const modules = state.data.modules.filter(module => module.course_id === course.id)
    return `<section class="card admin-course-card"><div><span class="badge">${esc(course.level_code || course.id)}</span><h2>${esc(course.title)}</h2><p class="muted">Статус: ${esc(activityStatusLabel(course.status))}</p></div><div class="admin-module-links">${modules.map(module => `<button class="module-card" data-nav="#/admin/content/module/${esc(module.id)}"><span class="module-number">${String(module.ordinal).padStart(2,'0')}</span><div><strong>${esc(module.title)}</strong><span class="muted">${state.data.sections.filter(section => section.module_id === module.id).length} разделов</span></div><span class="arrow">→</span></button>`).join('')}</div></section>`
  }).join('')
  const content = `<div class="breadcrumbs"><button data-nav="#/admin/home">Обзор</button><span>›</span><span>Каталог материалов</span></div><div class="eyebrow">МАТЕРИАЛЫ</div><h1>Каталог материалов</h1><p class="lead muted">Выберите модуль. Контент не раскрывается одной длинной страницей.</p>${cards || emptyState('Каталог пуст', 'Курсы появятся после добавления в модель данных.')}`
  app.innerHTML = shell('admin', content)
}

function renderAdminModule(moduleId) {
  const module = state.data.modules.find(item => item.id === moduleId)
  if (!module) return navigate('#/admin/content')
  const course = state.data.courses.find(item => item.id === module.course_id)
  const sections = state.data.sections.filter(item => item.module_id === module.id).sort((a,b) => a.ordinal - b.ordinal)
  const sectionBlocks = sections.map(section => {
    const activities = state.data.activities.filter(item => item.section_id === section.id).sort((a,b) => a.ordinal - b.ordinal)
    return `<details class="card disclosure admin-section"><summary><span><strong>${section.ordinal}. ${esc(section.title)}</strong><small>${activities.length} заданий</small></span></summary>
      <div class="admin-activity-list">${activities.map((activity, index) => `<div class="admin-activity-row">
        <span class="activity-order">${activity.ordinal}</span>
        <div><strong>${esc(activity.title)}</strong><span class="muted">${esc(activityTypeLabel(activity.type))}</span></div>
        <span class="status-pill ${activity.status === 'archived' ? 'muted-status' : ''}">${esc(activityStatusLabel(activity.status))}</span>
        <div class="admin-order-actions"><button class="btn text compact" type="button" data-admin-activity-action="reorder_activity" data-direction="up" data-activity-id="${esc(activity.id)}" ${index === 0 || activity.status === 'archived' ? 'disabled' : ''}>↑</button><button class="btn text compact" type="button" data-admin-activity-action="reorder_activity" data-direction="down" data-activity-id="${esc(activity.id)}" ${index === activities.length - 1 || activity.status === 'archived' ? 'disabled' : ''}>↓</button></div>
        <button class="btn secondary compact" data-nav="#/admin/content/activity/${esc(activity.id)}">Открыть</button>
      </div>`).join('') || '<p class="muted">В разделе пока нет заданий.</p>'}</div>
      <button class="inline-link admin-add-link" data-nav="#/admin/content/new/${esc(section.id)}">+ Добавить задание</button>
    </details>`
  }).join('')
  const content = `<div class="breadcrumbs"><button data-nav="#/admin/content">Каталог</button><span>›</span><span>${esc(course?.title || module.course_id)}</span><span>›</span><span>${esc(module.title)}</span></div>
    <div class="eyebrow">${esc(module.course_id)} · МОДУЛЬ ${String(module.ordinal).padStart(2,'0')}</div><h1>${esc(module.title)}</h1><p class="lead muted">${esc(module.learning_outcome || '')}</p>
    <div class="admin-section-stack">${sectionBlocks}</div>`
  app.innerHTML = shell('admin', content)
}

function adminEditableFields(activity) {
  const p = activity.payload || {}
  const common = ['instruction','prompt','support','placeholder']
  const optional = ['explanation','system_note','input_label','feedback_correct','feedback_incorrect'].filter(key => Object.hasOwn(p, key))
  const labels = {
    instruction: 'Инструкция',
    prompt: adminPromptLabel(activity.type),
    support: 'Подсказка',
    placeholder: 'Подсказка в поле ответа',
    explanation: 'Объяснение ответа',
    system_note: 'Системное пояснение',
    input_label: 'Подпись поля ответа',
    feedback_correct: 'Обратная связь при верном ответе',
    feedback_incorrect: 'Обратная связь при неверном ответе'
  }
  return [...common, ...optional].map(key => `<label class="field"><span>${labels[key]}</span><textarea name="${key}" rows="2">${esc(p[key] || '')}</textarea></label>`).join('')
}

function renderAdminActivity(activityId) {
  const activity = state.data.activities.find(item => item.id === activityId)
  if (!activity) return navigate('#/admin/content')
  const section = state.data.sections.find(item => item.id === activity.section_id)
  const module = state.data.modules.find(item => item.id === section?.module_id)
  const locked = activity.status !== 'draft'
  const editor = locked
    ? `<div class="notice"><strong>${activity.status === 'published' ? 'Опубликованное задание защищено от прямого редактирования.' : 'Задание находится в архиве.'}</strong><br>${activity.status === 'published' ? 'Чтобы не менять задание у текущих учеников, редактировать можно только черновик.' : 'История попыток и отправленных работ сохраняется.'}</div>`
    : `<form id="admin-activity-edit-form" data-admin-editor data-activity-id="${esc(activity.id)}">
        <label class="field"><span>Название</span><input name="title" value="${esc(activity.title)}" required></label>
        <div class="admin-meta-line"><span><strong>Тип задания:</strong> ${esc(activityTypeLabel(activity.type))}</span><span><strong>Проверка:</strong> ${esc(gradingModeLabel(activity.grading?.mode || ''))}</span></div>
        ${adminEditableFields(activity)}
        <div class="admin-form-actions"><button class="btn" type="submit">Сохранить черновик</button><span class="small muted" data-admin-form-status></span></div>
      </form>`
  const lifecycle = `<div class="admin-lifecycle">
      ${activity.status === 'draft' ? `<button class="btn" type="button" data-admin-activity-action="publish_activity" data-activity-id="${esc(activity.id)}">Опубликовать</button>` : ''}
      ${activity.status !== 'archived' ? `<button class="btn secondary" type="button" data-admin-activity-action="archive_activity" data-activity-id="${esc(activity.id)}">Архивировать</button>` : ''}
    </div>`
  const content = `<div class="breadcrumbs"><button data-nav="#/admin/content">Каталог</button><span>›</span><button data-nav="#/admin/content/module/${esc(module?.id || '')}">${esc(module?.title || 'Модуль')}</button><span>›</span><span>${esc(activity.title)}</span></div>
    <div class="section-heading"><div><div class="eyebrow">${esc(activityTypeLabel(activity.type))}</div><h1>${esc(activity.title)}</h1></div><span class="status-pill">${esc(activityStatusLabel(activity.status))}</span></div>
    <section class="card admin-editor-card">${editor}${lifecycle}</section>
    ${adminPreviewCard(activity)}`
  app.innerHTML = shell('admin', content)
}

function adminNewTypeFields(type) {
  if (type === 'single_choice') return `<label class="field"><span>Варианты — по одному на строку</span><textarea name="options" required></textarea></label><label class="field"><span>Номер правильного варианта (с 1)</span><input name="correct_index_ui" type="number" min="1" value="1" required></label>`
  if (type === 'word_order') return `<label class="field"><span>Слова / части фразы — по одному на строку</span><textarea name="tokens" required></textarea></label><label class="field"><span>Правильный порядок (например 1,2,3)</span><input name="expected_order_ui" value="1,2,3" required></label>`
  if (type === 'gap_fill') return `<label class="field"><span>Допустимые ответы — по одному на строку</span><textarea name="answers" required></textarea></label>`
  if (type === 'model') return `<label class="field"><span>Примеры — по одному на строку</span><textarea name="examples" required></textarea></label>`
  return `<label class="field"><span>Проверка</span><select name="grading_mode"><option value="self_review">Самопроверка</option><option value="model_answer">Сверка с образцом</option><option value="teacher_review">Проверяет преподаватель</option></select></label>`
}

function nextActivityOrdinal(sectionId) {
  const values = state.data.activities.filter(item => item.section_id === sectionId).map(item => Number(item.ordinal) || 0)
  return (values.length ? Math.max(...values) : 0) + 1
}

function renderAdminNewActivity(sectionId) {
  const section = state.data.sections.find(item => item.id === sectionId)
  if (!section) return navigate('#/admin/content')
  const module = state.data.modules.find(item => item.id === section.module_id)
  const content = `<div class="breadcrumbs"><button data-nav="#/admin/content">Каталог</button><span>›</span><button data-nav="#/admin/content/module/${esc(module?.id || '')}">${esc(module?.title || 'Модуль')}</button><span>›</span><span>Новое задание</span></div>
    <div class="eyebrow">ЧЕРНОВИК</div><h1>Новое задание</h1><p class="lead muted">${esc(section.title)} · новое задание создаётся как черновик.</p>
    <section class="card admin-editor-card"><form id="admin-activity-create-form" data-admin-new-editor data-section-id="${esc(section.id)}">
      <div class="admin-form-grid two">
        <label class="field"><span>Тип задания</span><select name="type" data-admin-type><option value="open_text">Открытый ответ</option><option value="single_choice">Один вариант ответа</option><option value="word_order">Порядок слов</option><option value="gap_fill">Заполнить пропуски</option><option value="model">Образец / самопроверка</option></select></label>
        <label class="field"><span>Порядок в разделе</span><input name="ordinal" type="number" min="1" value="${nextActivityOrdinal(section.id)}" required></label>
      </div>
      <label class="field"><span>Название</span><input name="title" required></label>
      <label class="field"><span>Инструкция</span><textarea name="instruction" required></textarea></label>
      <label class="field"><span>Задание</span><textarea name="prompt"></textarea></label>
      <label class="field"><span>Подсказка</span><textarea name="support"></textarea></label>
      <label class="field"><span>Подсказка в поле ответа</span><textarea name="placeholder" rows="2"></textarea></label>
      <div data-admin-type-fields>${adminNewTypeFields('open_text')}</div>
      <div class="admin-form-actions"><button class="btn" type="submit">Создать черновик</button><span class="small muted" data-admin-form-status></span></div>
    </form></section>
    <section class="admin-preview"><div class="section-heading"><h2>Предпросмотр</h2><span class="muted">Обновляется по мере заполнения</span></div><div data-admin-preview>${renderStudentActivityPreview({ id: 'preview:new', section_id: section.id, ordinal: nextActivityOrdinal(section.id), type: 'open_text', title: 'Новое задание', payload: { instruction: 'Инструкция' }, grading: { mode: 'self_review' }, teacher_review_required: false, status: 'draft' })}</div></section>`
  app.innerHTML = shell('admin', content)
}

function adminActivityFromForm(form) {
  const fd = new FormData(form)
  const type = String(fd.get('type') || 'open_text')
  const payload = {
    instruction: String(fd.get('instruction') || ''),
    prompt: String(fd.get('prompt') || ''),
    support: String(fd.get('support') || ''),
    placeholder: String(fd.get('placeholder') || '')
  }
  let grading = { mode: String(fd.get('grading_mode') || 'self_review') }
  if (type === 'single_choice') {
    payload.options = String(fd.get('options') || '').split(/\n/).map(x => x.trim()).filter(Boolean)
    grading = { mode: 'auto', correct_index: Math.max(0, Number(fd.get('correct_index_ui') || 1) - 1) }
  } else if (type === 'word_order') {
    payload.tokens = String(fd.get('tokens') || '').split(/\n/).map(x => x.trim()).filter(Boolean)
    grading = { mode: 'auto', expected_order: String(fd.get('expected_order_ui') || '').split(',').map(x => Number(x.trim()) - 1).filter(Number.isInteger) }
  } else if (type === 'gap_fill') {
    grading = { mode: 'auto', answers: String(fd.get('answers') || '').split(/\n/).map(x => x.trim()).filter(Boolean) }
  } else if (type === 'model') {
    payload.examples = String(fd.get('examples') || '').split(/\n/).map(x => x.trim()).filter(Boolean)
    grading = { mode: 'acknowledge' }
  }
  return {
    id: 'preview:new',
    section_id: form.dataset.sectionId || '',
    ordinal: Number(fd.get('ordinal') || 1),
    type,
    title: String(fd.get('title') || 'Новое задание'),
    payload,
    grading,
    teacher_review_required: grading.mode === 'teacher_review',
    status: 'draft'
  }
}

function updateAdminPreview(form) {
  const preview = document.querySelector('[data-admin-preview]')
  if (!preview) return
  let activity
  if (form.dataset.adminEditor !== undefined) {
    const base = state.data.activities.find(item => item.id === form.dataset.activityId)
    if (!base) return
    const fd = new FormData(form)
    const payload = { ...base.payload }
    for (const key of ['instruction','prompt','support','placeholder','explanation','system_note','input_label','feedback_correct','feedback_incorrect']) {
      if (fd.has(key)) payload[key] = String(fd.get(key) || '')
    }
    activity = { ...base, title: String(fd.get('title') || base.title), payload }
  } else {
    activity = adminActivityFromForm(form)
  }
  preview.innerHTML = renderStudentActivityPreview(activity)
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
  const { data, error } = await supabase.auth.signInWithPassword({ email: fd.get('email'), password: fd.get('password') })
  if (error) {
    renderAuth(error.message)
    return
  }
  await boot(data.user)
}

async function logout() {
  await supabase.auth.signOut()
  state.user = null
  state.profile = null
  state.data = null
  location.hash = ''
  renderAuth()
}

function resetSpeechControl(activityId = state.speechActivityId) {
  if (!activityId) return
  const button = document.querySelector(`[data-play-speech="${cssEscape(activityId)}"]`)
  if (button?.isConnected) button.textContent = '▶ Прослушать'
}

function playSpeech(activityId) {
  const activity = state.data.activities.find(x => x.id === activityId)
  const text = activity?.payload?.speech_text
  if (!text || !('speechSynthesis' in window)) return
  const button = document.querySelector(`[data-play-speech="${cssEscape(activityId)}"]`)

  if (state.speechActivityId === activityId && speechSynthesis.speaking && !speechSynthesis.paused) {
    speechSynthesis.pause()
    if (button) button.textContent = '▶ Прослушать'
    return
  }
  if (state.speechActivityId === activityId && speechSynthesis.paused) {
    speechSynthesis.resume()
    if (button) button.textContent = '❚❚ Пауза'
    return
  }

  resetSpeechControl()
  speechSynthesis.cancel()
  state.speechActivityId = activityId
  const utterance = new SpeechSynthesisUtterance(text)
  if (button) button.textContent = '❚❚ Пауза'
  utterance.onend = utterance.onerror = () => {
    resetSpeechControl(activityId)
    if (state.speechActivityId === activityId) state.speechActivityId = null
  }
  utterance.lang = 'de-DE'
  const voice = speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith('de'))
  if (voice) utterance.voice = voice
  speechSynthesis.speak(utterance)
}

function setRecordControl(activityId, recording) {
  const button = document.querySelector(`[data-record-toggle="${cssEscape(activityId)}"]`)
  if (!button) return
  button.setAttribute('aria-pressed', recording ? 'true' : 'false')
  button.innerHTML = recording ? '<span aria-hidden="true">■</span> Завершить запись' : '<span aria-hidden="true">🎙</span> Записать'
}

async function startRecording(activityId) {
  const live = document.querySelector(`[data-record-live="${cssEscape(activityId)}"]`)
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
      if (live?.isConnected) live.textContent = 'Запись готова.'
      setRecordControl(activityId, false)
      if (state.recording?.activityId === activityId) state.recording = null
    }
    recorder.start()
    state.recording = { activityId, recorder, stream }
    if (live) live.textContent = 'Идёт запись…'
    setRecordControl(activityId, true)
  } catch (error) {
    if (live) live.textContent = error.message
    setRecordControl(activityId, false)
  }
}

function stopRecording(activityId) {
  if (!state.recording || state.recording.activityId !== activityId) return
  if (state.recording.recorder.state !== 'inactive') state.recording.recorder.stop()
}

function stopActiveMedia() {
  if ('speechSynthesis' in window) {
    resetSpeechControl()
    speechSynthesis.cancel()
  }
  state.speechActivityId = null
  if (state.recording) stopRecording(state.recording.activityId)
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
  if (event.target.closest('[data-retry-boot]')) {
    app.innerHTML = '<main class="auth-shell auth-state-shell"><section class="auth-panel card loading-card" role="status" aria-live="polite"><div class="auth-brand"><img class="lernstep-logo" src="./assets/lernstep-logo.svg" alt="Lernstep"></div><h2>Повторяем загрузку…</h2></section></main>'
    boot().catch(showFatal)
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
    const tokens = activity?.payload?.tokens || activity?.payload?.items || []
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
    const tokens = activity?.payload?.tokens || activity?.payload?.items || []
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
  const inlineSpeech = event.target.closest('[data-play-inline-speech]')
  if (inlineSpeech) {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(inlineSpeech.dataset.speechText || '')
      utterance.lang = 'de-DE'
      speechSynthesis.speak(utterance)
    }
    return
  }
  const play = event.target.closest('[data-play-speech]')
  if (play) {
    playSpeech(play.dataset.playSpeech)
    return
  }
  const recordToggle = event.target.closest('[data-record-toggle]')
  if (recordToggle) {
    const activityId = recordToggle.dataset.recordToggle
    if (state.recording?.activityId === activityId) stopRecording(activityId)
    else startRecording(activityId).catch(showFatal)
    return
  }
  const inviteExisting = event.target.closest('[data-admin-invite-existing]')
  if (inviteExisting && state.profile?.role === 'admin') {
    const user = state.data.users.find(item => item.id === inviteExisting.dataset.adminInviteExisting)
    const status = document.querySelector(`[data-admin-user-status="${cssEscape(user?.id || '')}"]`)
    if (!user?.email) return
    if (status) status.textContent = 'Отправляем приглашение…'
    adminApi({ action: 'invite_user', email: user.email, display_name: user.display_name || user.email, role: user.role })
      .then(refreshAdminData)
      .catch(error => { if (status) status.textContent = error.message || String(error) })
    return
  }

  const unassignTeacher = event.target.closest('[data-admin-unassign-teacher]')
  if (unassignTeacher && state.profile?.role === 'admin') {
    if (!window.confirm('Снять преподавателя с этой группы?')) return
    adminApi({ action: 'unassign_teacher_cohort', teacher_id: unassignTeacher.dataset.adminUnassignTeacher, cohort_id: unassignTeacher.dataset.cohortId })
      .then(refreshAdminData)
      .catch(error => window.alert(error.message || String(error)))
    return
  }

  const adminAction = event.target.closest('[data-admin-activity-action]')
  if (adminAction && state.profile?.role === 'admin') {
    const action = adminAction.dataset.adminActivityAction
    const activityId = adminAction.dataset.activityId
    if (action === 'archive_activity' && !window.confirm('Архивировать задание? Оно исчезнет из текущего маршрута ученика.')) return
    if (action === 'publish_activity' && !window.confirm('Опубликовать задание для учеников? После публикации текст будет защищён от изменений.')) return
    adminAction.disabled = true
    adminApi({ action, activity_id: activityId, direction: adminAction.dataset.direction })
      .then(refreshAdminData)
      .catch(error => {
        adminAction.disabled = false
        window.alert(error.message || String(error))
      })
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
  const adminForm = event.target.closest('[data-admin-editor], [data-admin-new-editor]')
  if (adminForm && state.profile?.role === 'admin') {
    updateAdminPreview(adminForm)
    return
  }
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

app.addEventListener('change', event => {
  const typeSelect = event.target.closest('[data-admin-type]')
  if (typeSelect && state.profile?.role === 'admin') {
    const fields = document.querySelector('[data-admin-type-fields]')
    if (fields) fields.innerHTML = adminNewTypeFields(typeSelect.value)
    const form = typeSelect.closest('[data-admin-new-editor]')
    if (form) updateAdminPreview(form)
  }
})

app.addEventListener('submit', event => {
  event.preventDefault()
  const form = event.target
  if (!(form instanceof HTMLFormElement)) return
  if (form.id === 'login-form') {
    login(form).catch(showFatal)
    return
  }
  if (state.profile?.role !== 'admin') return

  const status = form.querySelector('[data-admin-form-status]')
  const setStatus = text => { if (status) status.textContent = text }

  if (form.id === 'admin-invite-form') {
    const fd = new FormData(form)
    setStatus('Отправляем приглашение…')
    adminApi({ action: 'invite_user', email: fd.get('email'), display_name: fd.get('display_name'), role: fd.get('role') })
      .then(refreshAdminData)
      .catch(error => setStatus(error.message || String(error)))
    return
  }

  if (form.id === 'admin-cohort-form') {
    const fd = new FormData(form)
    setStatus('Создаём группу…')
    adminApi({ action: 'create_cohort', course_id: fd.get('course_id'), title: fd.get('title') })
      .then(refreshAdminData)
      .catch(error => setStatus(error.message || String(error)))
    return
  }

  if (form.id === 'admin-enrollment-form') {
    const fd = new FormData(form)
    setStatus('Назначаем курс…')
    adminApi({ action: 'assign_student_course', student_id: fd.get('student_id'), course_id: fd.get('course_id'), cohort_id: fd.get('cohort_id') })
      .then(refreshAdminData)
      .catch(error => setStatus(error.message || String(error)))
    return
  }

  if (form.id === 'admin-teacher-cohort-form') {
    const fd = new FormData(form)
    setStatus('Назначаем преподавателя…')
    adminApi({ action: 'assign_teacher_cohort', teacher_id: fd.get('teacher_id'), cohort_id: fd.get('cohort_id') })
      .then(refreshAdminData)
      .catch(error => setStatus(error.message || String(error)))
    return
  }

  if (form.dataset.adminUserForm) {
    const fd = new FormData(form)
    const inline = form.querySelector('[data-admin-user-status]')
    if (inline) inline.textContent = 'Сохраняем…'
    adminApi({ action: 'update_user', user_id: form.dataset.adminUserForm, role: fd.get('role'), status: fd.get('status') })
      .then(refreshAdminData)
      .catch(error => { if (inline) inline.textContent = error.message || String(error) })
    return
  }

  if (form.id === 'admin-activity-edit-form') {
    const fd = new FormData(form)
    const payload = {}
    for (const key of ['instruction','prompt','support','placeholder','explanation','system_note','input_label','feedback_correct','feedback_incorrect']) {
      if (fd.has(key)) payload[key] = fd.get(key)
    }
    setStatus('Сохраняем черновик…')
    adminApi({ action: 'edit_activity', activity_id: form.dataset.activityId, title: fd.get('title'), payload })
      .then(refreshAdminData)
      .catch(error => setStatus(error.message || String(error)))
    return
  }

  if (form.id === 'admin-activity-create-form') {
    const activity = adminActivityFromForm(form)
    const fd = new FormData(form)
    const body = {
      action: 'create_activity',
      section_id: form.dataset.sectionId,
      type: activity.type,
      title: activity.title,
      ordinal: activity.ordinal,
      payload: activity.payload,
      grading_mode: activity.grading.mode
    }
    if (activity.type === 'single_choice') body.correct_index = activity.grading.correct_index
    if (activity.type === 'word_order') body.expected_order = activity.grading.expected_order
    if (activity.type === 'gap_fill') body.answers = activity.grading.answers
    setStatus('Создаём черновик…')
    adminApi(body)
      .then(async data => {
        state.data = await loadAdminData()
        await navigate(`#/admin/content/activity/${data.activity.id}`)
      })
      .catch(error => setStatus(error.message || String(error)))
  }
})

window.addEventListener('hashchange', () => {
  stopActiveMedia()
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

/* P1 hardening: trajectory, schedules, actionable teacher views, deferred review. */
const p1LoadStudentDataBase = loadStudentData
loadStudentData = async function () {
  const [data, liveSessions, moduleSessionTemplates, reviewItems, cohortTeachers, visibleProfiles] = await Promise.all([
    p1LoadStudentDataBase(),
    selectAll('live_sessions', 'id,module_id,module_session_id,cohort_id,teacher_id,ordinal,starts_at,duration_minutes,meeting_url,status,rescheduled_from_session_id,cancelled_at,cancellation_reason', 'starts_at'),
    selectAll('module_session_templates', 'id,module_id,ordinal,title,duration_minutes,teacher_plan,status', 'ordinal'),
    selectAll('review_items', 'id,student_id,module_id,source_activity_id,skill,due_at,interval_days,status,created_at', 'due_at'),
    selectAll('cohort_teachers', 'cohort_id,teacher_id,assigned_at'),
    selectAll('app_users', 'id,display_name,email,role,status')
  ])
  const teacherProfiles = visibleProfiles.filter(x => x.role === 'teacher')
  return { ...data, liveSessions, moduleSessionTemplates, reviewItems, cohortTeachers, teacherProfiles }
}

const p1LoadTeacherDataBase = loadTeacherData
loadTeacherData = async function () {
  const data = await p1LoadTeacherDataBase()
  const cohortIds = data.cohorts.map(x => x.id)
  const moduleIds = data.modules.map(x => x.id)
  const [liveSessions, moduleSessionTemplates] = await Promise.all([
    cohortIds.length ? selectIn('live_sessions', 'id,module_id,module_session_id,cohort_id,teacher_id,ordinal,starts_at,duration_minutes,meeting_url,status,rescheduled_from_session_id,cancelled_at,cancellation_reason', 'cohort_id', cohortIds, 'starts_at') : [],
    moduleIds.length ? selectIn('module_session_templates', 'id,module_id,ordinal,title,duration_minutes,teacher_plan,status', 'module_id', moduleIds, 'ordinal') : []
  ])
  return { ...data, liveSessions, moduleSessionTemplates }
}

function p1ReviewItem() {
  return state.data?.reviewItems?.find(x => x.module_id === MODULE_ID && x.source_activity_id === 'A2.1-M01:spaced-review' && x.status !== 'skipped') || null
}
function p1ReviewAvailable() {
  const item = p1ReviewItem()
  return Boolean(item && new Date(item.due_at).getTime() <= Date.now())
}
const p1StudentProgressBase = studentProgress
studentProgress = function (moduleId = activeStudentModule()?.id || MODULE_ID) {
  const progress = p1StudentProgressBase(moduleId)
  const item = moduleId === MODULE_ID ? p1ReviewItem() : null
  if (!item || p1ReviewAvailable()) return progress
  const total = progress.total + 1
  return { done: progress.done, total, percent: total ? Math.round(progress.done / total * 100) : 0 }
}
const p1SectionActivitiesBase = sectionActivities
sectionActivities = function (sectionId) {
  return p1SectionActivitiesBase(sectionId).filter(x => x.id !== 'A2.1-M01:spaced-review' || p1ReviewAvailable())
}
function p1Template(session) {
  return state.data?.moduleSessionTemplates?.find(x => x.id === session.module_session_id) || state.data?.moduleSessionTemplates?.find(x => x.module_id === session.module_id && x.ordinal === session.ordinal)
}
function p1TeacherName(id) {
  const t = state.data?.teacherProfiles?.find(x => x.id === id)
  return t?.display_name || t?.email || 'Преподаватель'
}
function p1SessionStatus(status) { return ({planned:'Запланировано',completed:'Завершено',cancelled:'Отменено',rescheduled:'Перенесено'}[status] || status) }
function p1SessionCard(session, role='student') {
  const template = p1Template(session)
  const cohort = state.data?.cohorts?.find(x => x.id === session.cohort_id)
  const starts = session.starts_at ? new Date(session.starts_at) : null
  const date = starts ? new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'2-digit',month:'short'}).format(starts) : 'Дата не назначена'
  const time = starts ? new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(starts) : ''
  const teacher = role === 'student' ? ` · ${esc(p1TeacherName(session.teacher_id))}` : ''
  const link = session.meeting_url && session.status === 'planned' ? `<a class="btn secondary compact" href="${esc(session.meeting_url)}" target="_blank" rel="noreferrer">Видеозвонок</a>` : ''
  return `<article class="scheduled-session"><div class="scheduled-session-date"><strong>${esc(date)}</strong><span>${esc(time)}</span></div><div class="scheduled-session-main"><span class="badge ${session.status === 'cancelled' ? 'gray' : ''}">${esc(p1SessionStatus(session.status))}</span><h3>${esc(template?.title || `Занятие ${session.ordinal}`)}</h3><p class="muted">${esc(cohort?.title || '')}${teacher} · ${Number(session.duration_minutes || template?.duration_minutes || 90)} минут</p></div><div class="scheduled-session-action">${link}</div></article>`
}
function renderStudentSchedule() {
  const sessions = (state.data.liveSessions || []).slice().sort((a,b)=>String(a.starts_at||'').localeCompare(String(b.starts_at||'')))
  const content = `<h1>Расписание</h1><p class="lead muted">Здесь появятся даты занятий вашей группы.</p><section class="card schedule-card">${sessions.length ? `<div class="schedule-list">${sessions.map(x=>p1SessionCard(x,'student')).join('')}</div>` : emptyState('Пока нет запланированных занятий','Когда появится дата, она будет показана здесь.')}</section>`
  app.innerHTML = shell('student', content)
}
function renderTeacherSchedule() {
  const sessions = (state.data.liveSessions || []).slice().sort((a,b)=>String(a.starts_at||'').localeCompare(String(b.starts_at||'')))
  const content = `<div class="eyebrow">РАСПИСАНИЕ</div><h1>Ближайшие занятия</h1><p class="lead muted">Конкретные даты групп. Методические планы двух занятий находятся внутри модуля.</p><section class="card">${sessions.length ? `<div class="schedule-list">${sessions.map(x=>p1SessionCard(x,'teacher')).join('')}</div>` : emptyState('Занятий пока нет','Запланированные занятия появятся здесь после назначения дат.')}</section>`
  app.innerHTML = shell('teacher', content)
}
const p1StudentRouteBase = renderStudentRoute
renderStudentRoute = function (parts) { if ((parts[1] || 'home') === 'schedule') return renderStudentSchedule(); return p1StudentRouteBase(parts) }
const p1TeacherRouteBase = renderTeacherRoute
renderTeacherRoute = function (parts) { if ((parts[1] || 'home') === 'schedule') return renderTeacherSchedule(); return p1TeacherRouteBase(parts) }

primaryNav = function (role, current) {
  const courseActive = current.startsWith('#/student/courses') || current.startsWith('#/student/course') || current.startsWith('#/student/module') || current.startsWith('#/student/section')
  const items = role === 'student' ? [['Личный кабинет','#/student/home',true,current==='#/student/home'],['Мои курсы','#/student/courses',true,courseActive],['Чтение','#/student/reader',true,current==='#/student/reader'],['Словарь','',false,false],['Повторение','',false,false],['Расписание','#/student/schedule',true,current==='#/student/schedule'],['Мой профиль','',false,false]] : role === 'teacher' ? [['Обзор','#/teacher/home',true,current==='#/teacher/home'],['Все материалы','#/teacher/courses',true,current.startsWith('#/teacher/courses')||current.startsWith('#/teacher/module')],['Мои ученики','#/teacher/students',true,current.startsWith('#/teacher/cohort')||current.startsWith('#/teacher/students')],['Расписание','#/teacher/schedule',true,current==='#/teacher/schedule']] : [['Обзор','#/admin/home',true,current==='#/admin/home'],['Ученики и доступ','#/admin/users',true,current.startsWith('#/admin/users')],['Расписание групп','',false,false],['Каталог материалов','#/admin/content',true,current.startsWith('#/admin/content')],['Журнал изменений','',false,false]]
  return items.map(([label,href,enabled,active]) => enabled ? `<button class="navlink ${active?'active':''}" data-nav="${href}" ${active?'aria-current="page"':''}><span>${esc(label)}</span></button>` : `<button class="navlink disabled" type="button" disabled aria-disabled="true"><span>${esc(label)}</span><small>позже</small></button>`).join('')
}

const p1StudentHomeBase = renderStudentHome
renderStudentHome = function () {
  p1StudentHomeBase()
  const sessions = (state.data.liveSessions || []).filter(x=>x.status==='planned'&&x.starts_at&&new Date(x.starts_at).getTime()>=Date.now()).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))
  const meeting = [...document.querySelectorAll('.rail .rail-card')].find(x=>x.textContent.includes('ВСТРЕЧИ'))
  if (meeting) {
    meeting.classList.remove('unavailable-card')
    meeting.innerHTML = sessions[0] ? `<span class="rail-label">БЛИЖАЙШЕЕ ЗАНЯТИЕ</span>${p1SessionCard(sessions[0],'student')}<button class="inline-link" data-nav="#/student/schedule">Все занятия →</button>` : `<span class="rail-label">БЛИЖАЙШЕЕ ЗАНЯТИЕ</span><h3>Пока не назначено</h3><p class="muted">Когда для группы появится дата, она будет показана здесь.</p>`
  }
  const stat = document.querySelector('.stats .stat.muted-stat')
  const item = p1ReviewItem()
  if (stat && item) {
    stat.classList.remove('muted-stat')
    stat.innerHTML = p1ReviewAvailable() ? `<b>Повторение</b><span>Доступно сейчас.</span><button class="inline-link" data-nav="#/student/section/A2.1-M01:review">Перейти →</button>` : `<b>Повторение</b><span>Будет доступно ${esc(new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short'}).format(new Date(item.due_at)))}.</span><span class="unavailable-label">интервальное повторение</span>`
  }
}
function p1TrajectorySession(moduleId, n) {
  const t = state.data.moduleSessionTemplates?.find(x=>x.module_id===moduleId&&x.ordinal===n)
  const session = (state.data.liveSessions || []).filter(x => x.module_id === moduleId && x.ordinal === n && x.status === 'planned' && x.starts_at).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))[0]
  const duration = Number(t?.duration_minutes || session?.duration_minutes || 90)
  const action = session
    ? `${esc(new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(session.starts_at)))} →`
    : 'Расписание →'
  return `<article class="trajectory-session"><div class="trajectory-session-main"><h3>Занятие ${n} · ${duration} минут</h3><p class="muted">Занятие с преподавателем</p></div><button class="inline-link trajectory-session-action" data-nav="#/student/schedule">${action}</button></article>`
}
const p1StudentModuleBase = renderStudentModule
renderStudentModule = function (moduleId) {
  p1StudentModuleBase(moduleId)
  const module = state.data.modules.find(x=>x.id===moduleId); if (!module) return
  const sections = moduleSections(module.id), list = document.querySelector('.section-list')
  if (list) {
    list.classList.add('module-trajectory')
    const rows = xs => xs.map(x=>`<div class="trajectory-step">${sectionRow(x)}</div>`).join('')
    list.innerHTML = `${rows(sections.filter(x=>x.ordinal<=4))}${p1TrajectorySession(module.id, 1)}${rows(sections.filter(x=>x.ordinal>=5&&x.ordinal<=7))}${p1TrajectorySession(module.id, 2)}${rows(sections.filter(x=>x.ordinal>=8))}`
  }
  const h=[...document.querySelectorAll('.section-heading.spaced')].find(x=>x.textContent.includes('Занятия в структуре модуля')); if(h){h.nextElementSibling?.remove();h.remove()}
}
function p1LatestActivity(studentId) {
  return [...state.data.attempts.filter(x=>x.student_id===studentId).map(x=>x.checked_at||x.submitted_at||x.started_at),...state.data.submissions.filter(x=>x.student_id===studentId).map(x=>x.submitted_at||x.created_at)].filter(Boolean).sort((a,b)=>new Date(b)-new Date(a))[0] || null
}
function p1Signals() {
  const out=[]
  for(const student of state.data.students){
    const old = state.data.submissions.some(x=>x.student_id===student.id&&['submitted','in_review'].includes(x.status)&&new Date(x.submitted_at||x.created_at).getTime()<Date.now()-48*60*60*1000)
    const latestProgress = [...state.data.progress.filter(x=>x.student_id===student.id)].sort((a,b)=>new Date(b.updated_at||0)-new Date(a.updated_at||0))[0]
    if(old) out.push({student,text:'Работа ждёт проверки больше 48 часов'})
    if(latestProgress?.updated_at&&new Date(latestProgress.updated_at).getTime()<Date.now()-7*24*60*60*1000) out.push({student,text:'Нет значимой активности больше 7 дней'})
  }
  return out
}
const p1TeacherHomeBase = renderTeacherHome
renderTeacherHome = function () {
  p1TeacherHomeBase()
  const content=document.querySelector('.content-column')||document.querySelector('.main-view'); if(!content)return
  const sessions=(state.data.liveSessions||[]).filter(x=>x.status==='planned'&&x.starts_at&&new Date(x.starts_at)>=new Date()).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at))
  const signals=p1Signals(), before=content.querySelector('.section-heading')
  if(before) before.insertAdjacentHTML('beforebegin',`<section class="teacher-action-grid"><div class="card"><div class="section-heading"><h2>Ближайшие занятия</h2><button class="inline-link" data-nav="#/teacher/schedule">Расписание →</button></div>${sessions.length?`<div class="schedule-list">${sessions.slice(0,3).map(x=>p1SessionCard(x,'teacher')).join('')}</div>`:emptyState('Занятий пока нет','Даты появятся после назначения расписания.')}</div><div class="card"><div class="section-heading"><h2>Требуют внимания</h2></div>${signals.length?`<div class="signal-list">${signals.slice(0,5).map(x=>`<div class="signal-row"><strong>${esc(x.student.display_name||x.student.email||'Ученик')}</strong><span>${esc(x.text)}</span></div>`).join('')}</div>`:'<p class="muted">Критичных сигналов сейчас нет.</p>'}</div></section>`)
}
function teacherSectionProgress(progress, moduleId) {
  const states = progress?.section_states || {}
  return state.data.sections.filter(x=>x.module_id===moduleId).sort((a,b)=>a.ordinal-b.ordinal).map(section => {
    const item = states[section.id] || states[section.legacy_key] || {}
    const done = Number(item.done || 0)
    const total = Number(item.total || state.data.activities.filter(activity => activity.section_id === section.id && activity.status !== 'archived').length)
    const label = ({
      completed: 'завершено',
      in_progress: 'в работе',
      waiting: 'ожидает открытия',
      not_started: 'не начато'
    }[item.status] || (total > 0 && done >= total ? 'завершено' : progress?.current_section_id === section.id ? 'в работе' : done > 0 ? 'начато' : 'не начато'))
    return { title: section.title, label }
  })
}

const p1TeacherCohortBase = renderTeacherCohort
renderTeacherCohort = function (cohortId) {
  p1TeacherCohortBase(cohortId)
  const cohort=state.data.cohorts.find(x=>x.id===cohortId), list=document.querySelector('.student-list'); if(!cohort||!list)return
  const courseModules=state.data.modules.filter(x=>x.course_id===cohort.course_id).sort((a,b)=>a.ordinal-b.ordinal)
  const links=state.data.cohortStudents.filter(x=>x.cohort_id===cohort.id)
  list.innerHTML=links.map(link=>{
    const student=state.data.students.find(x=>x.id===link.student_id)
    const progressRows=state.data.progress.filter(x=>x.student_id===link.student_id&&courseModules.some(module=>module.id===x.module_id)).sort((a,b)=>new Date(b.updated_at||0)-new Date(a.updated_at||0))
    const p=progressRows[0] || null
    const module=courseModules.find(x=>x.id===p?.module_id) || courseModules[0]
    const section=state.data.sections.find(x=>x.id===p?.current_section_id)
    const courseActivityIds=new Set(state.data.sections.filter(x=>x.module_id===module?.id).flatMap(sectionItem=>state.data.activities.filter(a=>a.section_id===sectionItem.id).map(a=>a.id)))
    const pending=state.data.submissions.filter(x=>x.student_id===link.student_id&&courseActivityIds.has(x.activity_id)&&['submitted','in_review'].includes(x.status))
    const last=p1LatestActivity(link.student_id)
    const attempts = state.data.attempts.filter(x=>x.student_id===link.student_id&&courseActivityIds.has(x.activity_id)).length
    const submitted = state.data.submissions.filter(x=>x.student_id===link.student_id&&courseActivityIds.has(x.activity_id)&&x.status!=='draft').length
    const progressItems = module ? teacherSectionProgress(p,module.id) : []
    const metrics = `Прогресс ${Math.round(Number(p?.completion_percent||0))}% · ${ruCount(attempts,['попытка','попытки','попыток'])} · ${ruCount(submitted,['отправленная работа','отправленные работы','отправленных работ'])}`
    return `<article class="student-action-row"><div class="student-action-main"><strong>${esc(student?.display_name||student?.email||'Ученик')}</strong><span class="muted">${esc(student?.email||'')}</span></div><div><span class="row-label">Текущий раздел</span><strong>${esc(section?.title||module?.title||'Курс не начат')}</strong></div><div><span class="row-label">Реакция</span>${pending.length?`<span class="status-pill warn">${pending.length} ждёт проверки</span>`:'<span class="muted">Не требуется</span>'}</div><div><span class="row-label">Последняя активность</span><span>${last?esc(formatDate(last)):'—'}</span></div><details class="student-detail"><summary>Подробнее</summary><div class="student-detail-block"><strong>${esc(module?.title||'Прогресс по модулю')}</strong><div class="student-section-progress">${progressItems.map(item=>`<div><span>${esc(item.title)}</span><span class="muted">${esc(item.label)}</span></div>`).join('')}</div><p class="small muted student-detail-metrics">${esc(metrics)}</p></div></details></article>`
  }).join('')||emptyState('В группе нет учеников','Назначение учеников выполняется через серверные операции.')
}

const p1TeacherModuleBase = renderTeacherModule
renderTeacherModule = function (moduleId) {
  p1TeacherModuleBase(moduleId)
  const h=[...document.querySelectorAll('.section-heading.spaced')].find(x=>x.textContent.includes('Планы занятий'))
  if(h) h.innerHTML='<h2>Планы двух занятий модуля</h2><span class="muted">Методические планы · даты конкретных групп — в расписании</span>'
  const grid = document.querySelector('.session-grid')
  const templates = (state.data.moduleSessionTemplates || []).filter(x=>x.module_id===moduleId).sort((a,b)=>a.ordinal-b.ordinal)
  if(grid && templates.length) {
    grid.innerHTML = templates.map(t=>`<details class="session-card disclosure"><summary>${esc(t.title)}</summary><p class="muted">Часть модуля · ${Number(t.duration_minutes || 90)} минут</p><ul>${(t.teacher_plan?.items || []).map(item=>`<li>${esc(item)}</li>`).join('')}</ul></details>`).join('')
  }
}
const p1StudentSectionBase = renderStudentSection
renderStudentSection = function (sectionId) {
  p1StudentSectionBase(sectionId)
  const item = p1ReviewItem()
  if (sectionId !== 'A2.1-M01:review' || !item || p1ReviewAvailable()) return
  const stack = document.querySelector('.activity-stack')
  if (!stack) return
  const due = new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'long'}).format(new Date(item.due_at))
  stack.insertAdjacentHTML('beforeend', `<div class="notice deferred-review"><strong>Интервальное повторение откроется ${esc(due)}.</strong><br>Оно не показывается как обычное следующее задание до нужного интервала.</div>`)
}
const p1StudentActivityBase = renderStudentActivity
renderStudentActivity = function (activity) {
  let html=p1StudentActivityBase(activity)

  return html
}

boot().catch(showFatal)

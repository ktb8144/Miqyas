import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  readFileSync(path, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      if (!key || process.env[key]) return;

      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    });
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  RLS_TEST_ADMIN_EMAIL,
  RLS_TEST_ADMIN_PASSWORD,
  RLS_TEST_PRINCIPAL_A_EMAIL,
  RLS_TEST_PRINCIPAL_A_PASSWORD,
  RLS_TEST_PRINCIPAL_B_EMAIL,
  RLS_TEST_PRINCIPAL_B_PASSWORD,
  RLS_TEST_TEACHER_A_EMAIL,
  RLS_TEST_TEACHER_A_PASSWORD,
  RLS_TEST_TEACHER_B_EMAIL,
  RLS_TEST_TEACHER_B_PASSWORD,
  RLS_TEST_SCHOOL_A_ID,
  RLS_TEST_SCHOOL_B_ID,
} = process.env;

const required = {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  RLS_TEST_ADMIN_EMAIL,
  RLS_TEST_ADMIN_PASSWORD,
  RLS_TEST_PRINCIPAL_A_EMAIL,
  RLS_TEST_PRINCIPAL_A_PASSWORD,
  RLS_TEST_PRINCIPAL_B_EMAIL,
  RLS_TEST_PRINCIPAL_B_PASSWORD,
  RLS_TEST_TEACHER_A_EMAIL,
  RLS_TEST_TEACHER_A_PASSWORD,
  RLS_TEST_TEACHER_B_EMAIL,
  RLS_TEST_TEACHER_B_PASSWORD,
  RLS_TEST_SCHOOL_A_ID,
  RLS_TEST_SCHOOL_B_ID,
};

const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

function createClientForTest(service = false) {
  return createClient(
    NEXT_PUBLIC_SUPABASE_URL,
    service ? SUPABASE_SERVICE_ROLE_KEY : NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function maybeSkip(error) {
  return ["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error?.code);
}

async function signIn(label, email, password) {
  const client = createClientForTest();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${label} sign-in failed: ${error.message}`);
  return client;
}

async function profile(client, label) {
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw new Error(`${label} auth lookup failed`);

  const { data, error } = await client
    .from("users")
    .select("id, role, school_id")
    .eq("auth_id", user.id)
    .single();

  if (error) throw new Error(`${label} profile lookup failed: ${error.message}`);
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertCanRead(client, label, table) {
  const { error } = await client.from(table).select("id").limit(1);
  if (error && !maybeSkip(error)) throw new Error(`${label} cannot read ${table}: ${error.message}`);
  console.log(`PASS ${label} can read ${table}`);
}

async function assertCannotReadSchool(client, label, table, schoolId) {
  const { data, error } = await client.from(table).select("id, school_id").eq("school_id", schoolId).limit(1);
  if (error) {
    if (maybeSkip(error)) {
      console.warn(`SKIP ${label} ${table}: ${error.message}`);
      return;
    }
    throw new Error(`${label} ${table} query failed: ${error.message}`);
  }
  assert((data ?? []).length === 0, `${label} can read ${table} rows from another school`);
  console.log(`PASS ${label} cannot read ${table} from other school`);
}

async function assertCannotReadWeeklySets(client, label) {
  const { data, error } = await client.from("weekly_sets").select("id, answer_key").limit(1);
  if (error) {
    console.log(`PASS ${label} cannot read weekly_sets: ${error.message}`);
    return;
  }
  assert((data ?? []).length === 0, `${label} can read weekly_sets or answer_key`);
  console.log(`PASS ${label} cannot read weekly_sets/answer_key`);
}

async function assertAnonymousBlocked() {
  const anon = createClientForTest();
  for (const table of ["students", "results"]) {
    const { data, error } = await anon.from(table).select("id").limit(1);
    if (error) {
      console.log(`PASS anonymous cannot read ${table}: ${error.message}`);
      continue;
    }
    assert((data ?? []).length === 0, `anonymous can read ${table}`);
    console.log(`PASS anonymous cannot read ${table}`);
  }
  await assertCannotReadWeeklySets(anon, "anonymous");
}

async function cleanup(ids) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("SKIP cleanup: SUPABASE_SERVICE_ROLE_KEY is not set");
    return;
  }
  const admin = createClientForTest(true);
  if (ids.studentId) await admin.from("students").delete().eq("id", ids.studentId);
  if (ids.badStudentId) await admin.from("students").delete().eq("id", ids.badStudentId);
  if (ids.classId) await admin.from("classes").delete().eq("id", ids.classId);
}

async function assertTeacherMutations(teacherClient, teacherProfile, label, ownSchoolId, otherSchoolId) {
  const ids = {};
  try {
    const { data: insertedClass, error: classError } = await teacherClient
      .from("classes")
      .insert({
        school_id: ownSchoolId,
        teacher_id: teacherProfile.id,
        name: `RLS ${label} ${Date.now()}`,
        grade: 3,
        subject: "اختبار RLS",
      })
      .select("id")
      .single();

    if (classError) throw new Error(`${label} cannot insert own class: ${classError.message}`);
    ids.classId = insertedClass.id;
    console.log(`PASS ${label} can insert own class`);

    const { data: student, error: studentError } = await teacherClient
      .from("students")
      .insert({
        school_id: ownSchoolId,
        class_id: ids.classId,
        name: `طالب RLS ${Date.now()}`,
      })
      .select("id")
      .single();

    if (studentError) throw new Error(`${label} cannot insert student into own class: ${studentError.message}`);
    ids.studentId = student.id;
    console.log(`PASS ${label} can insert student into own class`);

    const { error: badClassError } = await teacherClient
      .from("classes")
      .insert({
        school_id: otherSchoolId,
        teacher_id: teacherProfile.id,
        name: "RLS forbidden class",
        grade: 3,
        subject: "اختبار RLS",
      });
    assert(!!badClassError, `${label} inserted class in another school`);
    console.log(`PASS ${label} cannot insert class in another school`);

    const { error: schoolChangeError } = await teacherClient
      .from("classes")
      .update({ school_id: otherSchoolId })
      .eq("id", ids.classId);
    assert(!!schoolChangeError, `${label} changed class school_id`);
    console.log(`PASS ${label} cannot change class school_id`);
  } finally {
    await cleanup(ids);
  }
}

const admin = await signIn("admin", RLS_TEST_ADMIN_EMAIL, RLS_TEST_ADMIN_PASSWORD);
const principalA = await signIn("principal A", RLS_TEST_PRINCIPAL_A_EMAIL, RLS_TEST_PRINCIPAL_A_PASSWORD);
const principalB = await signIn("principal B", RLS_TEST_PRINCIPAL_B_EMAIL, RLS_TEST_PRINCIPAL_B_PASSWORD);
const teacherA = await signIn("teacher A", RLS_TEST_TEACHER_A_EMAIL, RLS_TEST_TEACHER_A_PASSWORD);
const teacherB = await signIn("teacher B", RLS_TEST_TEACHER_B_EMAIL, RLS_TEST_TEACHER_B_PASSWORD);

const adminProfile = await profile(admin, "admin");
const principalAProfile = await profile(principalA, "principal A");
const principalBProfile = await profile(principalB, "principal B");
const teacherAProfile = await profile(teacherA, "teacher A");
const teacherBProfile = await profile(teacherB, "teacher B");

assert(adminProfile.role === "admin", "admin account must have role admin");
assert(principalAProfile.role === "principal" && principalAProfile.school_id === RLS_TEST_SCHOOL_A_ID, "principal A must belong to school A");
assert(principalBProfile.role === "principal" && principalBProfile.school_id === RLS_TEST_SCHOOL_B_ID, "principal B must belong to school B");
assert(teacherAProfile.role === "teacher" && teacherAProfile.school_id === RLS_TEST_SCHOOL_A_ID, "teacher A must belong to school A");
assert(teacherBProfile.role === "teacher" && teacherBProfile.school_id === RLS_TEST_SCHOOL_B_ID, "teacher B must belong to school B");

for (const table of ["schools", "users", "classes", "students"]) {
  await assertCanRead(admin, "admin", table);
}

for (const table of ["users", "classes", "students"]) {
  await assertCannotReadSchool(principalA, "principal A", table, RLS_TEST_SCHOOL_B_ID);
  await assertCannotReadSchool(principalB, "principal B", table, RLS_TEST_SCHOOL_A_ID);
  await assertCannotReadSchool(teacherA, "teacher A", table, RLS_TEST_SCHOOL_B_ID);
  await assertCannotReadSchool(teacherB, "teacher B", table, RLS_TEST_SCHOOL_A_ID);
}

await assertTeacherMutations(teacherA, teacherAProfile, "teacher A", RLS_TEST_SCHOOL_A_ID, RLS_TEST_SCHOOL_B_ID);
await assertTeacherMutations(teacherB, teacherBProfile, "teacher B", RLS_TEST_SCHOOL_B_ID, RLS_TEST_SCHOOL_A_ID);

await assertCannotReadWeeklySets(teacherA, "teacher A");
await assertCannotReadWeeklySets(teacherB, "teacher B");
await assertCannotReadWeeklySets(principalA, "principal A");
await assertCannotReadWeeklySets(principalB, "principal B");
await assertAnonymousBlocked();

console.log("RLS isolation checks completed.");

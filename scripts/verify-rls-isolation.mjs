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
  RLS_TEST_USER_A_EMAIL,
  RLS_TEST_USER_A_PASSWORD,
  RLS_TEST_USER_B_EMAIL,
  RLS_TEST_USER_B_PASSWORD,
  RLS_TEST_SCHOOL_A_ID,
  RLS_TEST_SCHOOL_B_ID,
  RLS_TEST_PRINCIPAL_A_EMAIL,
  RLS_TEST_PRINCIPAL_A_PASSWORD,
} = process.env;

const required = {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  RLS_TEST_USER_A_EMAIL,
  RLS_TEST_USER_A_PASSWORD,
  RLS_TEST_USER_B_EMAIL,
  RLS_TEST_USER_B_PASSWORD,
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

const coreTables = [
  "schools",
  "users",
  "students",
  "classes",
  "assessments",
  "results",
  "reports",
  "subscriptions",
];

function createTestClient() {
  return createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function signIn(email, password) {
  const supabase = createTestClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`Failed to sign in ${email}: ${error.message}`);
  }

  return supabase;
}

async function getProfile(client, label) {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    throw new Error(`${label} auth user lookup failed: ${userError?.message ?? "missing user"}`);
  }

  const { data, error } = await client
    .from("users")
    .select("id, role, school_id")
    .eq("auth_id", user.id)
    .single();

  if (error) {
    throw new Error(`${label} profile query failed: ${error.message}`);
  }

  if (!data?.role || !data?.school_id) {
    throw new Error(`${label} profile is missing role or school_id`);
  }

  return data;
}

async function assertRole(profile, label, expectedRole) {
  if (profile.role !== expectedRole) {
    throw new Error(`${label} must be ${expectedRole}; got ${profile.role}`);
  }
  console.log(`PASS ${label} is ${expectedRole}`);
}

async function assertCannotReadOtherSchool(client, label, table, otherSchoolId) {
  const { data, error } = await client
    .from(table)
    .select("id, school_id")
    .eq("school_id", otherSchoolId)
    .limit(1);

  if (error) {
    if (["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error.code)) {
      console.warn(`SKIP ${label} ${table}: ${error.message}`);
      return;
    }
    throw new Error(`${label} ${table} query failed: ${error.message}`);
  }

  if ((data ?? []).length > 0) {
    throw new Error(`${label} can read ${table} rows from another school`);
  }

  console.log(`PASS ${label} cannot read other-school ${table}`);
}

async function assertUnauthenticatedCannotRead(table, columns = "id") {
  const client = createTestClient();
  const { data, error } = await client
    .from(table)
    .select(columns)
    .limit(1);

  if (error) {
    console.log(`PASS anonymous cannot read ${table}: ${error.message}`);
    return;
  }

  if ((data ?? []).length > 0) {
    throw new Error(`anonymous can read ${table}`);
  }

  console.log(`PASS anonymous cannot read ${table}`);
}

async function assertCannotReadAnswerKey(client, label) {
  const { data, error } = await client
    .from("weekly_sets")
    .select("id, answer_key")
    .limit(1);

  if (error) {
    console.log(`PASS ${label} cannot read weekly_sets answer_key: ${error.message}`);
    return;
  }

  if ((data ?? []).some((row) => row.answer_key != null)) {
    throw new Error(`${label} can read weekly_sets.answer_key`);
  }

  if ((data ?? []).length > 0) {
    throw new Error(`${label} can read weekly_sets rows`);
  }

  console.log(`PASS ${label} cannot read weekly_sets answer_key`);
}

async function assertSchoolVisibility(client, label, ownSchoolId, otherSchoolId) {
  const { data: ownRows, error: ownError } = await client
    .from("schools")
    .select("id")
    .eq("id", ownSchoolId);

  if (ownError) throw new Error(`${label} own school query failed: ${ownError.message}`);
  if ((ownRows ?? []).length !== 1) throw new Error(`${label} cannot read own school`);

  const { data: otherRows, error: otherError } = await client
    .from("schools")
    .select("id")
    .eq("id", otherSchoolId);

  if (otherError) throw new Error(`${label} other school query failed: ${otherError.message}`);
  if ((otherRows ?? []).length > 0) throw new Error(`${label} can read another school`);

  console.log(`PASS ${label} can only read own school`);
}

async function assertTeacherClassIsolation(client, label, otherSchoolId) {
  const { data, error } = await client
    .from("classes")
    .select("id, school_id, teacher_id")
    .eq("school_id", otherSchoolId)
    .limit(1);

  if (error) {
    if (["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error.code)) {
      console.warn(`SKIP ${label} classes: ${error.message}`);
      return;
    }
    throw new Error(`${label} classes query failed: ${error.message}`);
  }

  if ((data ?? []).length > 0) {
    throw new Error(`${label} can read classes from another school`);
  }

  console.log(`PASS ${label} cannot read other-school classes`);
}

const userA = await signIn(RLS_TEST_USER_A_EMAIL, RLS_TEST_USER_A_PASSWORD);
const userB = await signIn(RLS_TEST_USER_B_EMAIL, RLS_TEST_USER_B_PASSWORD);
const principalA = RLS_TEST_PRINCIPAL_A_EMAIL && RLS_TEST_PRINCIPAL_A_PASSWORD
  ? await signIn(RLS_TEST_PRINCIPAL_A_EMAIL, RLS_TEST_PRINCIPAL_A_PASSWORD)
  : null;

const userAProfile = await getProfile(userA, "user A");
const userBProfile = await getProfile(userB, "user B");

await assertRole(userAProfile, "user A", "teacher");
if (userAProfile.school_id !== RLS_TEST_SCHOOL_A_ID) {
  throw new Error("user A must belong to RLS_TEST_SCHOOL_A_ID");
}
if (userBProfile.school_id !== RLS_TEST_SCHOOL_B_ID) {
  throw new Error("user B must belong to RLS_TEST_SCHOOL_B_ID");
}
if (principalA) {
  const principalAProfile = await getProfile(principalA, "principal A");
  await assertRole(principalAProfile, "principal A", "principal");
  if (principalAProfile.school_id !== RLS_TEST_SCHOOL_A_ID) {
    throw new Error("principal A must belong to RLS_TEST_SCHOOL_A_ID");
  }
} else if (userBProfile.role !== "principal") {
  throw new Error(
    "Set RLS_TEST_USER_B_* to a principal account, or provide RLS_TEST_PRINCIPAL_A_EMAIL/PASSWORD for principal checks"
  );
}

await assertSchoolVisibility(userA, "user A", RLS_TEST_SCHOOL_A_ID, RLS_TEST_SCHOOL_B_ID);
await assertSchoolVisibility(userB, "user B", RLS_TEST_SCHOOL_B_ID, RLS_TEST_SCHOOL_A_ID);
if (principalA) {
  await assertSchoolVisibility(principalA, "principal A", RLS_TEST_SCHOOL_A_ID, RLS_TEST_SCHOOL_B_ID);
} else {
  await assertSchoolVisibility(userB, "principal/user B", RLS_TEST_SCHOOL_B_ID, RLS_TEST_SCHOOL_A_ID);
}

for (const table of coreTables.filter((tableName) => tableName !== "schools")) {
  await assertCannotReadOtherSchool(userA, "user A", table, RLS_TEST_SCHOOL_B_ID);
  await assertCannotReadOtherSchool(userB, "user B", table, RLS_TEST_SCHOOL_A_ID);
  if (principalA) {
    await assertCannotReadOtherSchool(principalA, "principal A", table, RLS_TEST_SCHOOL_B_ID);
  }
}

await assertTeacherClassIsolation(userA, "user A", RLS_TEST_SCHOOL_B_ID);
await assertTeacherClassIsolation(userB, "user B", RLS_TEST_SCHOOL_A_ID);
if (principalA) {
  await assertTeacherClassIsolation(principalA, "principal A", RLS_TEST_SCHOOL_B_ID);
}

await assertUnauthenticatedCannotRead("students", "id, school_id");
await assertUnauthenticatedCannotRead("results", "id, assessment_id");

await assertCannotReadAnswerKey(userA, "teacher/user A");
await assertCannotReadAnswerKey(userB, "user B");
if (principalA) {
  await assertCannotReadAnswerKey(principalA, "principal A");
}
await assertCannotReadAnswerKey(createTestClient(), "anonymous");

console.log("RLS isolation checks completed.");

import { createClient } from "@supabase/supabase-js";

const {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  RLS_TEST_USER_A_EMAIL,
  RLS_TEST_USER_A_PASSWORD,
  RLS_TEST_USER_B_EMAIL,
  RLS_TEST_USER_B_PASSWORD,
  RLS_TEST_SCHOOL_A_ID,
  RLS_TEST_SCHOOL_B_ID,
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

await assertSchoolVisibility(userA, "user A", RLS_TEST_SCHOOL_A_ID, RLS_TEST_SCHOOL_B_ID);
await assertSchoolVisibility(userB, "user B", RLS_TEST_SCHOOL_B_ID, RLS_TEST_SCHOOL_A_ID);

for (const table of coreTables.filter((tableName) => tableName !== "schools")) {
  await assertCannotReadOtherSchool(userA, "user A", table, RLS_TEST_SCHOOL_B_ID);
  await assertCannotReadOtherSchool(userB, "user B", table, RLS_TEST_SCHOOL_A_ID);
}

await assertTeacherClassIsolation(userA, "user A", RLS_TEST_SCHOOL_B_ID);
await assertTeacherClassIsolation(userB, "user B", RLS_TEST_SCHOOL_A_ID);

console.log("RLS isolation checks completed.");

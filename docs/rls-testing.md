# اختبار RLS في مشروع دالة

هذا الدليل يشرح تجهيز اختبار عملي لعزل بيانات المدارس في Supabase. لا تضع أي كلمات مرور أو إيميلات حقيقية داخل الكود أو داخل هذا الملف.

## الهدف

يتحقق سكربت `npm run test:rls` من أن:

- معلم مدرسة A لا يرى فصول أو طلاب أو نتائج مدرسة B.
- قائد المدرسة لا يرى بيانات مدرسة أخرى.
- المستخدم غير المسجل لا يستطيع قراءة الطلاب أو النتائج.
- `weekly_sets.answer_key` لا يظهر للمعلم أو قائد المدرسة أو المستخدم غير المسجل.

## الحسابات المطلوبة

جهز في Supabase خمسة حسابات اختبار:

1. Admin:
   - `role = admin`
   - لا يحتاج `school_id`

2. Principal A:
   - `role = principal`
   - مرتبط بمدرسة A عبر `users.school_id`
   - `users.auth_id` يطابق Auth user id

3. Principal B:
   - `role = principal`
   - مرتبط بمدرسة B عبر `users.school_id`
   - `users.auth_id` يطابق Auth user id

4. Teacher A:
   - `role = teacher`
   - مرتبط بمدرسة A عبر `users.school_id`
   - `users.auth_id` يطابق Auth user id

5. Teacher B:
   - `role = teacher`
   - مرتبط بمدرسة B عبر `users.school_id`
   - `users.auth_id` يطابق Auth user id

## بيانات اختبار في الجداول

تأكد أن لديك بيانات في المدرستين:

- `schools`: مدرسة A ومدرسة B.
- `classes`: فصل واحد على الأقل في كل مدرسة.
- `students`: طالب واحد على الأقل في كل مدرسة.
- `assessments` و `results`: صفوف مرتبطة بكل مدرسة إن كانت موجودة في بيئة الاختبار.
- `weekly_sets`: صف يحتوي `answer_key` للتأكد أنه لا يظهر لغير admin/service.

## المتغيرات المطلوبة

ضع المتغيرات في `.env.local` أو صدّرها في الطرفية قبل تشغيل الاختبار:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

RLS_TEST_USER_A_EMAIL=
RLS_TEST_USER_A_PASSWORD=
RLS_TEST_USER_B_EMAIL=
RLS_TEST_USER_B_PASSWORD=
RLS_TEST_SCHOOL_A_ID=
RLS_TEST_SCHOOL_B_ID=

RLS_TEST_ADMIN_EMAIL=
RLS_TEST_ADMIN_PASSWORD=
RLS_TEST_PRINCIPAL_A_EMAIL=
RLS_TEST_PRINCIPAL_A_PASSWORD=
RLS_TEST_PRINCIPAL_B_EMAIL=
RLS_TEST_PRINCIPAL_B_PASSWORD=
RLS_TEST_TEACHER_A_EMAIL=
RLS_TEST_TEACHER_A_PASSWORD=
RLS_TEST_TEACHER_B_EMAIL=
RLS_TEST_TEACHER_B_PASSWORD=
```

لا تضع قيمًا حقيقية في `.env.example` أو في Git.

## التشغيل

```bash
npm run test:rls
```

إذا كانت المتغيرات ناقصة، سيطبع السكربت أسماء المتغيرات المطلوبة فقط بدون عرض أي قيم سرية.

## ملاحظات مهمة

- الاختبار يستخدم `NEXT_PUBLIC_SUPABASE_ANON_KEY` فقط، ولا يستخدم `SUPABASE_SERVICE_ROLE_KEY`.
- إذا توفر `SUPABASE_SERVICE_ROLE_KEY` محليًا فسيستخدمه السكربت فقط لتنظيف بيانات اختبار mutation التي أنشأها، وليس لاختبار صلاحيات القراءة.
- يجب تطبيق migrations الخاصة بـ RLS و indexes قبل الاختبار.
- نجاح الاختبار لا يعني أن كل مسار API آمن تلقائيًا، لكنه يؤكد عزل RLS الأساسي على الجداول المهمة.

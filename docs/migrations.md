# ترحيلات قاعدة البيانات: الوضع الحالي وخطة التنظيف

> **لا تحذف أو تعدّل ملفات `supabase/migrations/` الموجودة.** قاعدة البيانات الحية سجّلت أنها طُبّقت، وتعديلها يجعل السجل لا يطابق الواقع.

## المشكلة

1. **تعريفات مكررة تكتب فوق بعضها.** نفس الدوال والسياسات أُعيد تعريفها في أكثر من ملف، وآخر ملف هو الذي يحدد السلوك الفعلي:

| الكائن | عدد التعريفات | الملفات |
|---|---|---|
| `app_role` `app_school_id` `app_user_id` `is_admin_or_service` `prevent_school_id_change` | 3 لكل دالة | `20260506010000_enable_core_rls` ← `20260511010000_create_v02_package_foundation` ← `20260513020000_security_advisor_warnings_cleanup` |
| `validate_package_question_mapping` `validate_package_publish_ready` | 2 | `20260511010000` ← `20260520010000_checkpoint_package_architecture` |
| `set_weekly_plans_updated_at` | 2 | `20260509030000` ← `20260513020000` |
| سياستا `classes_teacher_read_own` و `students_teacher_read_own_classes` | 2 | `20260506010000` ← `20260507010000` |

   (نمط `drop policy if exists` ثم `create policy` داخل نفس الملف طبيعي ولا مشكلة فيه؛ المشكلة فقط في إعادة التعريف عبر ملفات مختلفة.)

2. **جداول أساسية بلا ترحيل.** `users` و `schools` و `weekly_questions` و `question_options` و `weekly_sets` أُنشئت يدوياً من لوحة Supabase. لا يمكن بناء قاعدة بيانات جديدة (للتطوير أو الاختبار) من الملفات وحدها.

3. **جداول بقايا من الجيل الأول**، لا يستخدمها الكود بعد التنظيف: `weekly_questions`، `question_options`، `weekly_sets`، `assessments`، `assessment_results`، `improvement_plans`، `teacher_training_tracking`.

## الحل: ترحيل أساسي واحد (baseline)

يحتاج صلاحية على مشروع Supabase، ويُنفَّذ مرة واحدة:

```bash
# 1. نسخة احتياطية كاملة أولاً
npx supabase db dump --linked -f backup-$(date +%F).sql

# 2. سحب المخطط الحالي كما هو فعلياً في قاعدة البيانات
npx supabase db pull --linked        # ينشئ supabase/migrations/<timestamp>_remote_schema.sql

# 3. نقل الملفات القديمة إلى أرشيف (لا تُحذف من git history)
mkdir -p supabase/migrations_archive
git mv supabase/migrations/2026050* supabase/migrations/2026051* supabase/migrations/2026052* supabase/migrations/2026060* supabase/migrations_archive/

# 4. إخبار Supabase أن الترحيل الأساسي مطبّق مسبقاً (لا يُعاد تشغيله على الإنتاج)
npx supabase migration repair --status applied <timestamp>

# 5. التحقق: قاعدة محلية نظيفة تُبنى من الملف الجديد
npx supabase db reset
npm run test:rls
```

بعدها كل تغيير جديد يكون ترحيلاً صغيراً فوق الأساس.

## حذف جداول الجيل الأول

بعد التأكد أنه لا يوجد فيها بيانات تحتاجونها، يُضاف ترحيل جديد:

```sql
-- تحقق أولاً: select count(*) from public.weekly_questions; ... إلخ
drop table if exists public.question_options;
drop table if exists public.weekly_questions;
drop table if exists public.assessment_results;
drop table if exists public.assessments;
drop table if exists public.improvement_plans;
drop table if exists public.teacher_training_tracking;
-- weekly_sets: حدّث scripts/verify-rls-isolation.mjs أولاً (يختبر عزل answer_key فيه)
```

هذه خطوة لا رجعة فيها، لذلك لم تُضف تلقائياً.

## سجل التطبيق على قاعدة البيانات الحية

| التاريخ | الترحيل | ملاحظة |
|---|---|---|
| 2026-10-03 | `add_package_question_misconceptions` | ملف `20260601010000` كان في المستودع ولم يُطبَّق، فكان تشخيص المهارات يفشل |
| 2026-10-03 | `revoke_public_execute_on_package_validation_functions` | إغلاق تحذير أمني من Supabase |

## فروق مكتشفة بين المستودع وقاعدة البيانات الحية

- **مشغّلا التحقق عند النشر غير موجودين في القاعدة:** `validate_assessment_package_publish` و `validate_package_question_mapping` مُعرّفان في `20260511010000` لكن لا يوجد أي trigger مرتبط بالدالتين حاليًا. التحقق يتم في كود مسار النشر فقط. إعادتهما قرار يحتاج اختبارًا لأنه قد يمنع حفظ أسئلة حالية.
- **جداول غير مستخدمة في الكود:** `nafis_plans`، `notifications`، `otp_sessions`، `prizes`، `questions`، `users_password_backup_20260526` (فارغ).


## 2026-10-04 — self_signup_and_trial_quota (مطبّق)

`supabase/migrations/20261004050000_self_signup_and_trial_quota.sql` — إضافي فقط:
- `schools`: `kind` (school/individual)، `ministry_number` (فريد — حُذف لاحقًا، انظر 29 أكتوبر)، `gender`، `join_code` (فريد، أُضيف للمدارس الحالية)، `scan_quota`.
- جدول `scan_usage`: سطر لكل ورقة تُرسل للقراءة الآلية مع عدد التوكنات (حد التجربة + التكلفة الفعلية). RLS مفعّل بدون سياسات (الخادم فقط).
- trigger `classes_individual_limit`: المعلم المستقل حتى 4 فصول.
- تحديث بيانات: المدارس التجريبية النشطة التي انتهى تاريخها أو بلا تاريخ بدأت تجربة جديدة من 2026-10-04 إلى 2026-11-03.

## 2026-10-29 — ثلاثة ترحيلات جديدة (طُبِّقت على القاعدة الحية يوم 29 أكتوبر)

| الملف | ماذا يفعل | لماذا |
|---|---|---|
| `20261029010000_add_missing_assignment_foreign_keys.sql` | يضيف المفاتيح الأجنبية الناقصة في `class_package_assignments` و `student_package_results` و `student_question_results` و `school_package_assignments` | الملف `20260511010000` يعرّفها لكن القاعدة الحية بلا مفاتيح، فيفشل `classes(name)` في مسار نتائج المعلم وملف الشواهد. تحققنا يوم 29 أكتوبر: لا صفوف يتيمة. |
| `20261029020000_tighten_user_and_parent_token_access.sql` | يحذف سياسة تعديل المدير لجدول `users`، ويجعل `auth_id` فريدًا، ويقصر قراءة رموز أولياء الأمور على معلم الفصل والمدير، ويسحب تنفيذ `prevent_school_id_change` | كانت السياسة تسمح للمدير بتغيير `auth_id` لأي زميل، ولا يوجد كود يعدّل `users` بجلسة المدير. |
| `20261029030000_create_nafs_baselines.sql` | جدول نتائج نافس السابقة لكل مدرسة (سنة × صف × مادة) | تبويب «نافس السابق» وتقرير «الوضع وخطة التحسين». |

طُبِّقت بأسمائها (`add_missing_assignment_foreign_keys` ثم `tighten_user_and_parent_token_access` ثم `create_nafs_baselines`) بعد التحقق مرة ثانية من عدم وجود صفوف يتيمة أو تكرار. وتحقق بعدها: 8 مفاتيح أجنبية، وسياسة تعديل المدير محذوفة، وفهرس `auth_id` الفريد موجود، وجدول نافس بـ RLS.

اختُبرت الثلاثة قبل التطبيق على نسخة مصغّرة من المخطط في PGlite: المدير لم يعد يستطيع تغيير `auth_id`، والمعلم يرى رموز فصله فقط والمدير يراها كلها، والتكرار في `auth_id` يُرفض، والصف اليتيم يُرفض، وقيود نافس تعمل.

## 2026-10-29 — `drop_school_ministry_number`

`supabase/migrations/20261029040000_drop_school_ministry_number.sql` — حذف عمود `schools.ministry_number` وفهرسه. المنصة لم تعد تطلب الرقم الوزاري. لا توجد قيم محفوظة فيه (تحققنا يوم 29 أكتوبر). يُطبَّق بعد نشر الكود الذي توقف عن الكتابة فيه.

## 2026-10-31 — `add_class_sheet_codes` (لم يُطبَّق بعد)

`supabase/migrations/20261031010000_add_class_sheet_codes.sql`:

- **العمود والقيود**: عمود `sheet_code` في `class_package_assignments`، فريد (unique index)، وصيغته 7 خانات من `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (check).
- **إصدار الرمز**: trigger قبل الإدراج يُصدر الرمز تلقائيًا، فكل اختبار يُسند لفصل يأخذ رمز QR دون أي عمل يدوي.
- **الصفوف الحالية**: تأخذ رموزها في الترحيل نفسه.
- **الدوال** (`dala_new_sheet_code` و`set_class_sheet_code`): `security definer`، لأنها تحتاج رؤية رموز كل المدارس لتبقى فريدة. سُحب تنفيذها من `anon` و`authenticated`.

اختُبر على PGlite:
- 500 صف قائم أخذت رموزها.
- 50,000 إدراج جديد أخذ رموزًا فريدة كلها في 2.6 ثانية.
- الرمز المكرر رُفض، وكذلك الرمز بصيغة خاطئة.
- إدراج بدور `authenticated` يأخذ رمزه، لكن الدور لا يستطيع استدعاء الدالتين مباشرة.

السعة: 31⁷ ≈ 27.5 مليار رمز.

**ترتيب النشر**: الكود آمن قبل الترحيل وبعده. مسار ورقة الإجابة يقرأ `sheet_code` باستعلام مستقل، فيُرجع `null` إن لم يوجد العمود.


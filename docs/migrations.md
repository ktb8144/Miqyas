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
- `schools`: `kind` (school/individual)، `ministry_number` (فريد)، `gender`، `join_code` (فريد، أُضيف للمدارس الحالية)، `scan_quota`.
- جدول `scan_usage`: سطر لكل ورقة تُرسل للقراءة الآلية مع عدد التوكنات (حد التجربة + التكلفة الفعلية). RLS مفعّل بدون سياسات (الخادم فقط).
- trigger `classes_individual_limit`: المعلم المستقل حتى 4 فصول.
- تحديث بيانات: المدارس التجريبية النشطة التي انتهى تاريخها أو بلا تاريخ بدأت تجربة جديدة من 2026-10-04 إلى 2026-11-03.

# Miqyas Security Checklist

## Supabase Security Advisor Cleanup

تمت إضافة migration لمعالجة التحذيرات التالية:

- تثبيت `search_path` في دالة `public.set_weekly_plans_updated_at`.
- إعادة إنشاء دوال RLS المساعدة مع `set search_path = public`:
  - `public.app_role()`
  - `public.app_school_id()`
  - `public.app_user_id()`
  - `public.is_admin_or_service()`
  - `public.prevent_school_id_change()`
- سحب صلاحية `EXECUTE` العامة من الدوال السابقة، وسحبها من `anon`.
- إبقاء `EXECUTE` لـ `authenticated` لأن RLS policies الحالية تعتمد على هذه الدوال.
- إبقاء `EXECUTE` لـ `service_role` للعمليات السيرفرية والإدارية.
- حذف سياسة القراءة العامة الواسعة `assessment_files_public_read` من `storage.objects`.
- إضافة سياسة قراءة أضيق للملفات المنشورة للمعلمين/القادة المسجلين داخل مسار:
  `packages/*/questions.pdf`.

## ما بقي ولماذا

- لم يتم سحب `EXECUTE` من `authenticated` للدوال المساعدة لأن سياسات RLS الحالية تستدعيها مباشرة.
  سحبها الآن قد يكسر وصول المعلم والقائد لبيانات المدرسة والفصول والطلاب.
- bucket `assessment-files` قد يحتاج لاحقًا إلى تحويل كامل إلى signed URLs من API server-side.
  السياسة الحالية تقلل الاستعراض العام، لكنها لا تستبدل كل روابط الملفات الحالية بآلية signed URL.
- تحذير `auth_leaked_password_protection` لا يمكن إصلاحه من migration.
  يجب تفعيله يدويًا من Supabase Dashboard:
  `Authentication > Settings > Password Protection > Leaked Password Protection`.

## اختبار ما بعد التطبيق

بعد تطبيق migration في Supabase SQL Editor أو CLI:

1. تسجيل الدخول كـ admin.
2. فتح `/admin` والتأكد من ظهور المدارس والمستخدمين والحزم.
3. تسجيل الدخول كـ principal والتأكد أنه يرى مدرسته فقط.
4. تسجيل الدخول كـ teacher والتأكد أنه يرى فصوله وطلابه فقط.
5. فتح رابط تقرير ولي أمر صالح والتأكد أنه يعمل.
6. فتح تدريب الطالب من التقرير والتأكد أنه يعمل.
7. تجربة تحميل ملف أسئلة package منشور من حساب teacher.
8. التأكد أن ملفات مفاتيح الإجابة أو ملفات mapping لا تظهر للمعلم أو القائد.
9. تشغيل `npm run build`.
10. تشغيل `npm run test:rls` عند توفر متغيرات اختبار RLS.

## ملاحظات تشغيلية

- إذا توقف تحميل ملفات الاختبار بعد تضييق سياسة Storage، فالخطوة التالية هي إنشاء API server-side لإصدار signed URLs حسب صلاحية المستخدم والحزمة.
- لا يجب جعل ملفات مفاتيح الإجابة أو mapping عامة.

# دالة (Dala)

منصة تقييم أسبوعي لمدارس المرحلة الابتدائية السعودية، متوافقة مع إطار نافس: حزم اختبارات مركزية، تصحيح أوراق الإجابة بالكاميرا (Gemini)، تشخيص المهارات، ولوحات للمعلم وقائد المدرسة وولي الأمر.

**التقنيات:** Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) · Gemini · Vercel

## التشغيل محلياً

```bash
npm ci
cp .env.example .env.local   # ثم عبّئ القيم
npm run dev
```

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | خادم التطوير |
| `npm run build` | بناء نسخة الإنتاج |
| `npm run lint` | فحص الكود (يجب أن يمر بلا أخطاء ولا تحذيرات) |
| `npm run test:rls` | اختبار عزل بيانات المدارس — انظر `docs/rls-testing.md` |

## هيكل المشروع

```
app/
  admin/                  لوحة مدير النظام
    _components/          تبويب لكل قسم + نوافذ الحزم + عناصر الواجهة
    _lib/                 الأنواع، التنقل، التحقق من مفتاح الإجابة
  dashboard/teacher/      لوحة المعلم
    _lib/use-teacher-dashboard.ts   كل الحالة والتحميل والإجراءات
    _components/          عرض لكل شاشة (الفصول، الحزم، الخطة، الطلاب) والنوافذ
  dashboard/principal/    لوحة قائد المدرسة (نفس النمط)
  parent/ student/        صفحات ولي الأمر والطالب (رابط برمز)
  api/                    مسارات الـ API (كل مسار يبدأ بـ requireUserRole)
components/               مكونات مشتركة (الماسح، استيراد الطلاب، الشعار)
lib/
  auth.ts                 requireUserRole / requireAdmin / authErrorResponse
  supabase.ts             عميل المتصفح
  supabase-admin.ts       عميل الخادم (service role) — لا يُستخدم إلا بعد التحقق من الصلاحية
  api.ts                  تسجيل الأخطاء وردود JSON الموحدة
  invite.ts               دعوة المستخدمين وإنشاء حساباتهم
  db/rows.ts              أنواع صفوف الجداول الرئيسية
  packages.ts             عدّ الأسئلة ومطابقة الفصل بالحزمة
  levels.ts               مستويات الأداء وعتباتها (المصدر الوحيد)
  theme.ts                ألوان الهوية (المصدر الوحيد)
  brand.ts                اسم المنتج والشعار
  labels.ts format.ts math.ts subjects.ts   دوال عرض وتنسيق مشتركة
  gemini.ts               استدعاءات Gemini
  reports/ assessment/    التقارير الدورية وتشخيص المهارات
supabase/migrations/      ترحيلات قاعدة البيانات — انظر docs/migrations.md
```

## قواعد الكود

- **الألوان:** استخدم أصناف Tailwind `brand`، `brand-navy`، `success`، `warning`، `danger`، `level-*`، أو `COLORS` من `lib/theme.ts` في الأنماط المضمنة. لا تكتب أكواد hex مباشرة، ولا تضف مفاتيح باسم ألوان Tailwind الأصلية (`amber`، `purple`…) في `tailwind.config.ts` لأنها تمسح درجاتها كلها.
- **المستويات:** أي حكم على درجة (متقدم/متمكن/أساسي/دون الأساسي، الإتقان، الطلاب المعرضون للخطر) يمر عبر `lib/levels.ts`.
- **الصلاحيات:** كل مسار API يبدأ بـ `requireUserRole(req, [...])` ثم `if (!auth.ok) return authErrorResponse(auth);`.
- **التكرار:** قبل كتابة دالة مساعدة، ابحث في `lib/`. إن احتجتها في ملفين فمكانها `lib/`.
- **اسم المنتج والشعار:** من `lib/brand.ts` فقط.

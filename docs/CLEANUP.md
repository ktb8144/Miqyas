# تنظيف الكود — أكتوبر 2026

فرع `cleanup/code-hygiene`. الهدف: نفس السلوك بكود أقل تكراراً وأسهل تعديلاً. كل مرحلة في commit مستقل.

## ما تغيّر

### حذف الكود الميت (الجيل الأول)
- مسارات API لا تستدعيها أي صفحة: `generate-questions`، `generate-worksheet`، `nafs/*`، `packages/*`، `parent-report-tokens`، `register-school`، `teacher/parent-report-stats`، `admin/assessment-packages/[id]/questions/import`.
- مسار التصحيح القديم `scan-omr` ووضع `weekly` في الماسح (كانت الصفحة تمرر `mode="package"` دائماً).
- بنك "الأسئلة الأسبوعية" في لوحة الإدارة ومساراته (`/api/admin/questions*`) — لم يكن أي جزء آخر يقرأ منه. **الجداول لم تُحذف**؛ انظر `docs/migrations.md`.
- مكونات غير مستخدمة: `class-skill-heatmap`، `student-skill-map`، `worksheet-modal`، `demo-banner`، ومجلد `components/ui` كاملاً.
- `lib/demo-data.ts` (بيانات وهمية)، `test-gemini.js`، خطوط Geist غير المحمّلة، دوال `saveResults` و `getSchoolData`.
- حزم npm: `@supabase/auth-helpers-nextjs` (مهجورة)، `shadcn`، `tw-animate-css`، `@base-ui/react`، `class-variance-authority`، `clsx`، `tailwind-merge`، `tailwindcss-animate`.

### إصلاحات كانت تكتب فوق بعضها
- **ألوان Tailwind:** مفاتيح `amber` و `purple` في الإعدادات كانت تمسح درجات Tailwind الأصلية، فأصناف مثل `bg-amber-50` و `text-amber-700` و `bg-purple-100` (نحو 44 استخداماً) لم يكن يتولد لها CSS. الألوان الآن بأسماء خاصة (`brand`، `warning`، `level-*`) في `lib/theme.ts`.
- **لونان للهوية:** الواجهة الحديثة تستخدم `#159f91` والماسح واستيراد الطلاب يستخدمان `#1D9E75`. توحّدت كلها على `brand` (`#159f91`)، وبقي الأخضر القديم للون "متمكن" فقط.
- **عتبات المستويات:** كانت مكتوبة في 5 أماكن بقيم مختلفة (90/70/50، 85/70/50، 80/60، 85/70). الآن `lib/levels.ts` هو المصدر الوحيد. **أثر ظاهر:** في التقرير الدوري صار توزيع "مرتفع" ≥ 90 (كان 85)، و"الاحتياج" ≥ 70/50 (كان 80/60)، وبطاقة المعلم عند القائد "ممتاز" ≥ 90 (كان 85).
- **CSS:** حُذف `* { max-width: 100% }` العام (يقتصر الآن على الصور والفيديو)، وتعارض خلفية `body`، ومتغيرات shadcn غير المستخدمة، والخطوط المذكورة غير المحمّلة.
- `normalizeAnswer` و `normalizeStudentCode` وتحويل الأرقام العربية: كانت نسخاً متباعدة، صارت نسخة واحدة.
- `focusRingColor` في استيراد الطلاب لم تكن خاصية CSS حقيقية؛ استُبدلت بـ `focus:ring-brand`.

### توحيد المكرر في `lib/`
`auth.ts` (حارس صلاحيات واحد)، `api.ts`، `invite.ts`، `admin/normalize.ts`، `admin/overview.ts`، `packages.ts`، `math.ts`، `labels.ts`، `format.ts`، `db/rows.ts`، `brand.ts`، `theme.ts`، `levels.ts`.
- عدّ أسئلة الحزم صار استعلاماً واحداً بدل استعلام لكل حزمة.
- كلمة المرور المؤقتة للحسابات لم تعد تبدأ بنص ثابت (`Miqyas@`).
- أخطاء جدول `schools` لم تعد ترسل `details` و `hint` من قاعدة البيانات إلى المتصفح (تُسجَّل في الخادم فقط).

### تقسيم الصفحات
| الصفحة | قبل | بعد |
|---|---|---|
| `app/admin/page.tsx` | 2,539 سطراً | ~790 + ملف لكل تبويب |
| `app/dashboard/teacher/page.tsx` | 1,955 | ~113 + `use-teacher-dashboard` + ملف لكل شاشة |
| `app/dashboard/principal/page.tsx` | 1,066 | ~102 + `use-principal-dashboard` + ملف لكل تبويب |

### الهوية والإعدادات
- الاسم في الواجهة صار "دالة" من `lib/brand.ts`. **ملف الشعار لم يتغير** (`public/miqyas-logo.png`) — ضع الشعار الجديد وحدّث `logoSrc` و `logoAspect`.
- نموذج Gemini مثبّت (`gemini-2.5-flash` افتراضياً، أو `GEMINI_MODEL`) بدل `gemini-flash-latest`. **تحقق أنه نفس النموذج الذي كان يعمل عندكم** قبل النشر.
- `.env.example` يذكر كل المتغيرات، و `README.md` حقيقي.

## مشاكل اكتُشفت ولم تُصلح (تحتاج قراراً أو وصولاً لقاعدة البيانات)

1. ~~مؤشرات لوحة القائد من مصدر قديم~~ — **أُصلحت:** `school-report` يحسب الآن من `student_package_results`، والمهارات الأضعف من إجابات الطلاب الفعلية في آخر 60 يومًا.
2. **تحميل نتائج المعلم طلباً لكل حزمة.** لوحة المعلم تطلب `/results` لكل حزمة مطبقة على حدة من المتصفح. مع زيادة الحزم يبطأ التحميل؛ الأفضل مسار واحد يعيد درجات كل الحزم.
3. **ترحيلات قاعدة البيانات** — انظر `docs/migrations.md`.

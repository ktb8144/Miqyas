-- Miqyas V0.2 NAFS grade 6 seed domains and sample skills.
-- These rows are starter/demo content and should remain editable from admin workflows.

with domain_rows(subject, grade, domain_code, domain_name, description) as (
  values
  ('رياضيات', 6, 'MATH-G6-NUM', 'الأعداد والعمليات عليها', 'مجال نافس في الرياضيات المرتبط بفهم الأعداد والعمليات والاستدلال العددي.'),
  ('رياضيات', 6, 'MATH-G6-ALG', 'الجبر', 'مجال نافس في الرياضيات المرتبط بالأنماط والعلاقات والعبارات والمعادلات البسيطة.'),
  ('رياضيات', 6, 'MATH-G6-GEO', 'الهندسة والقياس', 'مجال نافس في الرياضيات المرتبط بالأشكال والقياس والمساحة والحجم.'),
  ('رياضيات', 6, 'MATH-G6-DATA', 'البيانات والاحتمالات', 'مجال نافس في الرياضيات المرتبط بقراءة البيانات وتمثيلها وتفسيرها.'),
  ('علوم', 6, 'SCI-G6-LIFE', 'علوم الحياة', 'مجال نافس في العلوم المرتبط بالمخلوقات الحية والأنظمة الحيوية والصحة.'),
  ('علوم', 6, 'SCI-G6-PHYS', 'العلوم الفيزيائية والكيميائية', 'مجال نافس في العلوم المرتبط بالمادة والطاقة والقوة والحركة والتغيرات.'),
  ('علوم', 6, 'SCI-G6-EARTH', 'علم الأرض والفلك', 'مجال نافس في العلوم المرتبط بالأرض ومواردها والطقس والفضاء.'),
  ('لغة عربية', 6, 'READ-G6-VOCAB', 'دلالات الألفاظ', 'مجال نافس في القراءة المرتبط بمعاني المفردات والتراكيب من السياق.'),
  ('لغة عربية', 6, 'READ-G6-COMP', 'استيعاب المقروء', 'مجال نافس في القراءة المرتبط بفهم النص والاستنتاج وتحليل السؤال.')
)
insert into public.nafs_domains(subject, grade, domain_code, domain_name, description, status)
select subject, grade, domain_code, domain_name, description, 'active'
from domain_rows
on conflict (grade, subject, domain_code) do update set
  domain_name = excluded.domain_name,
  description = excluded.description,
  status = excluded.status;

with skill_rows(domain_code, subject, grade, skill_code, skill_name, skill_description, difficulty_level, nafs_weight, remediation_summary) as (
  values
  ('MATH-G6-NUM', 'رياضيات', 6, 'MATH-G6-NUM-01', 'اختيار العملية المناسبة', 'يحدد العملية أو العمليات اللازمة لحل مسألة عددية متعددة الخطوات.', 'medium', 'high', 'تدريب الطلاب على قراءة المعطيات وتحديد المطلوب قبل الحساب.'),
  ('MATH-G6-NUM', 'رياضيات', 6, 'MATH-G6-NUM-02', 'التحقق من معقولية الناتج', 'يقدر الناتج ويتحقق من ملاءمته للسياق.', 'medium', 'medium', 'استخدام التقريب والتقدير قبل وبعد الحل.'),
  ('MATH-G6-ALG', 'رياضيات', 6, 'MATH-G6-ALG-01', 'تمثيل العلاقات بعبارات', 'يمثل علاقة رياضية بعبارة أو معادلة بسيطة.', 'medium', 'medium', 'ربط الكلمات المفتاحية في المسألة بالرموز والعمليات.'),
  ('MATH-G6-GEO', 'رياضيات', 6, 'MATH-G6-GEO-01', 'حساب مساحة شكل مركب', 'يفكك الشكل المركب إلى أشكال مألوفة ويحسب المساحة.', 'hard', 'high', 'تدريب على تلوين الأجزاء وحساب كل جزء على حدة.'),
  ('MATH-G6-DATA', 'رياضيات', 6, 'MATH-G6-DATA-01', 'تفسير تمثيل بياني', 'يقرأ الرسم البياني ويستخلص نتيجة مدعومة بالبيانات.', 'medium', 'high', 'استخدام أسئلة: ماذا يظهر؟ ما الدليل؟ ما الاستنتاج؟'),
  ('SCI-G6-LIFE', 'علوم', 6, 'SCI-G6-LIFE-01', 'تفسير علاقة في نظام حيوي', 'يفسر علاقة بين مخلوقات حية أو أجزاء جهاز حيوي.', 'medium', 'high', 'بناء خرائط علاقات بين السبب والأثر في الأنظمة الحيوية.'),
  ('SCI-G6-PHYS', 'علوم', 6, 'SCI-G6-PHYS-01', 'تفسير تغيرات المادة والطاقة', 'يميز نوع التغير أو انتقال الطاقة من وصف تجربة.', 'medium', 'high', 'استخدام جداول مقارنة بين الخواص والتغيرات.'),
  ('SCI-G6-EARTH', 'علوم', 6, 'SCI-G6-EARTH-01', 'قراءة بيانات علم الأرض', 'يفسر رسمًا أو جدولًا عن الطقس أو الأرض أو الفضاء.', 'medium', 'medium', 'تدريب على استخراج المعلومة من الرسم قبل قراءة الخيارات.'),
  ('READ-G6-VOCAB', 'لغة عربية', 6, 'READ-G6-VOCAB-01', 'استنتاج معنى مفردة من السياق', 'يستنتج معنى كلمة أو تركيب اعتمادًا على القرائن النصية.', 'medium', 'high', 'تحديد الجملة السابقة واللاحقة للكلمة وبناء معنى قريب.'),
  ('READ-G6-COMP', 'لغة عربية', 6, 'READ-G6-COMP-01', 'تحديد الفكرة الرئيسة', 'يميز الفكرة الرئيسة عن التفاصيل الداعمة في النص.', 'medium', 'high', 'تلخيص كل فقرة بجملة ثم اختيار الفكرة الجامعة.'),
  ('READ-G6-COMP', 'لغة عربية', 6, 'READ-G6-COMP-02', 'الاستنتاج من أكثر من دليل', 'يربط بين أكثر من معلومة للوصول إلى إجابة ضمنية.', 'hard', 'high', 'تدريب الطلاب على وضع خط تحت الدليلين قبل اختيار الإجابة.'),
  ('READ-G6-COMP', 'لغة عربية', 6, 'READ-G6-COMP-03', 'اختيار الإجابة الأدق', 'يحلل صياغة السؤال ويستبعد المشتتات القريبة.', 'hard', 'high', 'مقارنة الخيارات بالنص مباشرة واستبعاد الإجابات الناقصة أو العامة.')
),
resolved as (
  select
    d.id as nafs_domain_id,
    s.subject,
    s.grade,
    s.skill_code,
    s.skill_name,
    s.skill_description,
    s.difficulty_level,
    s.nafs_weight,
    s.remediation_summary
  from skill_rows s
  join public.nafs_domains d
    on d.domain_code = s.domain_code
   and d.subject = s.subject
   and d.grade = s.grade
)
insert into public.learning_skills(
  nafs_domain_id,
  subject,
  grade,
  skill_code,
  skill_name,
  skill_description,
  difficulty_level,
  nafs_weight,
  remediation_summary,
  status
)
select
  nafs_domain_id,
  subject,
  grade,
  skill_code,
  skill_name,
  skill_description,
  difficulty_level,
  nafs_weight,
  remediation_summary,
  'active'
from resolved
on conflict (nafs_domain_id, skill_code) do update set
  subject = excluded.subject,
  grade = excluded.grade,
  skill_name = excluded.skill_name,
  skill_description = excluded.skill_description,
  difficulty_level = excluded.difficulty_level,
  nafs_weight = excluded.nafs_weight,
  remediation_summary = excluded.remediation_summary,
  status = excluded.status;

notify pgrst, 'reload schema';

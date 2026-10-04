# قوالب البريد في Supabase (دالة)

المكان: Supabase ← Authentication ← Emails ← Templates.
انسخ العنوان (Subject) والمحتوى (Message body) لكل قالب كما هو، واحفظ.

الروابط في القالبين تفتح صفحة `/auth/confirm` في دالة. الرابط لا يُستهلك بمجرد فتحه (مثلًا من فاحص الروابط في البريد
أو المعاينة)، بل عندما يضغط المستخدم زر «تفعيل الحساب»، ثم يعيّن كلمة المرور في نفس الصفحة.
`{{ .SiteURL }}` هو Site URL في Supabase (يجب أن يكون `https://www.dalaedu.com`).

---

## 1. Invite user — تفعيل الحساب (الدعوات والتسجيل الذاتي)

يُستخدم هذا القالب عندما يدعو قائد المدرسة معلمًا، وعندما يسجّل أي شخص بنفسه من صفحة التسجيل،
لذلك نصّه محايد ("فعّل حسابك") وليس "تمت دعوتك".

**Subject:**

```
فعّل حسابك في دالة
```

**Message body:**

```html
<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#f5f7fa; padding:24px; color:#0b2447;">
  <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; padding:32px; text-align:right;">
    <h1 style="margin:0 0 4px; font-size:24px; color:#159f91;">دالة</h1>
    <p style="margin:0 0 24px; font-size:13px; color:#6b7280;">دليلك إلى التميّز</p>

    <p style="font-size:16px; line-height:1.9; margin:0 0 16px;">مرحبًا،</p>
    <p style="font-size:16px; line-height:1.9; margin:0 0 24px;">
      أهلًا بك في دالة للاختبارات الأسبوعية المحاكية لنافس.
      اضغط الزر أدناه لتفعيل حسابك واختيار كلمة المرور.
    </p>

    <p style="text-align:center; margin:0 0 24px;">
      <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite"
         style="display:inline-block; background:#159f91; color:#ffffff; text-decoration:none; font-size:16px; font-weight:bold; padding:12px 32px; border-radius:8px;">
        تفعيل الحساب
      </a>
    </p>

    <p style="font-size:13px; line-height:1.8; color:#6b7280; margin:0;">
      إذا لم تطلب إنشاء حساب في دالة، تجاهل هذه الرسالة.
      إذا انتهت صلاحية الرابط، اطلب رابطًا جديدًا من «نسيت كلمة المرور» في صفحة الدخول.
    </p>
  </div>
</div>
```

---

## 2. Reset password — استعادة كلمة المرور

**Subject:**

```
إعادة تعيين كلمة المرور في دالة
```

**Message body:**

```html
<div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; background:#f5f7fa; padding:24px; color:#0b2447;">
  <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; padding:32px; text-align:right;">
    <h1 style="margin:0 0 4px; font-size:24px; color:#159f91;">دالة</h1>
    <p style="margin:0 0 24px; font-size:13px; color:#6b7280;">دليلك إلى التميّز</p>

    <p style="font-size:16px; line-height:1.9; margin:0 0 16px;">مرحبًا،</p>
    <p style="font-size:16px; line-height:1.9; margin:0 0 24px;">
      وصلنا طلب لإعادة تعيين كلمة المرور لحسابك في دالة.
      اضغط الزر أدناه لاختيار كلمة مرور جديدة.
    </p>

    <p style="text-align:center; margin:0 0 24px;">
      <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery"
         style="display:inline-block; background:#159f91; color:#ffffff; text-decoration:none; font-size:16px; font-weight:bold; padding:12px 32px; border-radius:8px;">
        تعيين كلمة مرور جديدة
      </a>
    </p>

    <p style="font-size:13px; line-height:1.8; color:#6b7280; margin:0;">
      إذا لم تطلب ذلك، تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي.
    </p>
  </div>
</div>
```

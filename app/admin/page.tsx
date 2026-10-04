"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenCheck, CheckCircle2, LogOut, ShieldCheck, UserRoundCog } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/lib/supabase";
import { toEnglishDigits } from "@/lib/format";
import { packageTypeLabel } from "@/lib/labels";
import type {
  AdminAssessmentPackage,
  AdminSchool,
  AdminTrialRequest,
  AdminUser,
  ApiState,
  ModalType,
  OverviewData,
  PackageSubmitData,
  SchoolFormData,
  Tab,
  UserFormData,
} from "./_lib/types";
import { AdminModal } from "./_components/admin-modal";
import { OverviewTab } from "./_components/overview-tab";
import {
  PackageModal,
  PublishPackageModal,
  QuestionImportModal,
} from "./_components/package-modals";
import { PackagesTab } from "./_components/packages-tab";
import { ReportsTab } from "./_components/reports-tab";
import { SchoolsTab, schoolStatusOf, type SchoolStatus } from "./_components/schools-tab";
import { TrialRequestsTab } from "./_components/trial-requests-tab";
import { UsersTab } from "./_components/users-tab";
import { emptyOverview, navItems } from "./_lib/navigation";
import { validateAnswerKeyJson } from "./_lib/answer-key";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [editingSchool, setEditingSchool] = useState<AdminSchool | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingPackage, setEditingPackage] = useState<AdminAssessmentPackage | null>(null);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [importingPackage, setImportingPackage] = useState<AdminAssessmentPackage | null>(null);
  const [publishingPackage, setPublishingPackage] = useState<AdminAssessmentPackage | null>(null);
  const [schoolRows, setSchoolRows] = useState<AdminSchool[]>([]);
  const [userRows, setUserRows] = useState<AdminUser[]>([]);
  const [packageRows, setPackageRows] = useState<AdminAssessmentPackage[]>([]);
  const [trialRequestRows, setTrialRequestRows] = useState<AdminTrialRequest[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [trialRequestsLoading, setTrialRequestsLoading] = useState(false);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [trialRequestsError, setTrialRequestsError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [packageSearch, setPackageSearch] = useState("");
  const [busySchoolId, setBusySchoolId] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
  const [busyTrialRequestId, setBusyTrialRequestId] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewData>(emptyOverview);
  const [apiState, setApiState] = useState<ApiState>("idle");
  const [loggingOut, setLoggingOut] = useState(false);

  const activeTitle = useMemo(() => navItems.find((item) => item.id === activeTab)?.label ?? "لوحة عامة", [activeTab]);

  const filteredSchools = useMemo(() => {
    const query = schoolSearch.trim().toLowerCase();
    if (!query) return schoolRows;
    return schoolRows.filter((school) =>
      [school.name, school.city, school.region ?? "", school.type ?? "", school.status]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [schoolRows, schoolSearch]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return userRows;
    return userRows.filter((user) =>
      [user.name, user.email, user.role, user.school, user.status]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [userRows, userSearch]);

  const filteredPackages = useMemo(() => {
    const query = packageSearch.trim().toLowerCase();
    if (!query) return packageRows;
    return packageRows.filter((item) =>
      [item.title, item.subject, item.status, packageTypeLabel(item.package_type), String(item.grade), String(item.week_number ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [packageRows, packageSearch]);

  const loadOverview = useCallback(async () => {
    setApiState("loading");
    setOverviewError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "فشل تحميل بيانات لوحة الإدارة");
      }
      setOverview(json.data);
      setApiState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل تحميل بيانات لوحة الإدارة";
      console.error("load admin overview failed", error);
      setOverview(emptyOverview);
      setOverviewError(message);
      setApiState("error");
    }
  }, [router]);

  const loadSchools = useCallback(async () => {
    setSchoolsLoading(true);
    setSchoolsError(null);
    try {
      const res = await fetch("/api/admin/schools", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل المدارس");
      setSchoolRows(json.data);
    } catch (error) {
      console.error("load admin schools failed", error);
      setSchoolRows([]);
      setSchoolsError(error instanceof Error ? error.message : "فشل تحميل المدارس");
    } finally {
      setSchoolsLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل المستخدمين");
      setUserRows(json.data);
    } catch (error) {
      console.error("load admin users failed", error);
      setUserRows([]);
      setUsersError(error instanceof Error ? error.message : "فشل تحميل المستخدمين");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadPackages = useCallback(async () => {
    setPackagesLoading(true);
    setPackagesError(null);
    try {
      const res = await fetch("/api/admin/assessment-packages", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل حزم الاختبارات");
      setPackageRows(json.data);
    } catch (error) {
      console.error("load admin assessment packages failed", error);
      setPackageRows([]);
      setPackagesError(error instanceof Error ? error.message : "فشل تحميل حزم الاختبارات");
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  const loadTrialRequests = useCallback(async () => {
    setTrialRequestsLoading(true);
    setTrialRequestsError(null);
    try {
      const res = await fetch("/api/admin/trial-requests", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحميل طلبات التجربة");
      setTrialRequestRows(json.data);
    } catch (error) {
      console.error("load admin trial requests failed", error);
      setTrialRequestRows([]);
      setTrialRequestsError(error instanceof Error ? error.message : "فشل تحميل طلبات التجربة");
    } finally {
      setTrialRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === "schools") {
      void loadSchools();
    }
    if (activeTab === "users") {
      void loadUsers();
      void loadSchools();
    }
    if (activeTab === "packages") {
      void loadPackages();
      void loadSchools();
    }
    if (activeTab === "trialRequests") {
      void loadTrialRequests();
    }
  }, [activeTab, loadPackages, loadSchools, loadTrialRequests, loadUsers]);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function openAddSchoolModal() {
    setEditingSchool(null);
    setModalType("school");
  }

  function openEditSchoolModal(school: AdminSchool) {
    setEditingSchool(school);
    setModalType("school");
  }

  function openAddUserModal() {
    setEditingUser(null);
    setModalType("user");
  }

  function openEditUserModal(user: AdminUser) {
    setEditingUser(user);
    setModalType("user");
  }

  function openCreatePackageModal() {
    setEditingPackage(null);
    setPackageModalOpen(true);
  }

  function openEditPackageModal(item: AdminAssessmentPackage) {
    setEditingPackage(item);
    setPackageModalOpen(true);
  }

  async function handleSchoolSubmit(payload: SchoolFormData | Record<string, string>) {
    const name = payload.name?.trim();
    const city = payload.city?.trim() ?? "";
    const type = payload.type?.trim() || "حكومية";
    if (!name) {
      throw new Error("اسم المدرسة مطلوب");
    }
    if (!city) {
      throw new Error("المدينة مطلوبة");
    }

    const endpoint = editingSchool ? `/api/admin/schools/${editingSchool.id}` : "/api/admin/schools";
    const method = editingSchool ? "PATCH" : "POST";
    setBusySchoolId(editingSchool?.id ?? "new");
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          city,
          region: null,
          type,
          ...(payload.subscription_end?.trim() ? { subscription_end: payload.subscription_end.trim() } : {}),
          // A new school starts as a trial; editing never changes the status (that is the status menu's job).
          ...(editingSchool ? {} : { active: true, trial: true }),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error("save school API failed", json);
        const details = [json.error, json.details, json.hint].filter(Boolean).join(" - ");
        throw new Error(details || "فشل حفظ المدرسة");
      }

      if (editingSchool) {
        await loadSchools();
        window.alert("تم التحديث");
      } else {
        await loadSchools();
        window.alert("تمت الإضافة");
      }
      setEditingSchool(null);
    } catch (error) {
      console.error("save school failed", error);
      throw error;
    } finally {
      setBusySchoolId(null);
    }
  }

  async function handleSchoolStatus(school: AdminSchool, status: SchoolStatus) {
    if (status === schoolStatusOf(school)) return;
    if (status === "suspended") {
      const confirmed = window.confirm(`سيتوقف دخول مدير ومعلمي «${school.name}» إلى دالة حتى تعيد تفعيلها. لن تُحذف أي بيانات. هل تريد المتابعة؟`);
      if (!confirmed) return;
    }
    const body = status === "suspended" ? { active: false } : { active: true, trial: status === "trial" };
    setBusySchoolId(school.id);
    try {
      const res = await fetch(`/api/admin/schools/${school.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "تعذر تغيير حالة المدرسة");
      setSchoolRows((prev) => prev.map((row) => (row.id === school.id ? { ...row, ...json.data, principal: row.principal, teachers: row.teachers, students: row.students, score: row.score } : row)));
    } catch (error) {
      console.error("change school status failed", error);
      window.alert(error instanceof Error ? error.message : "حدث خطأ");
    } finally {
      setBusySchoolId(null);
    }
  }

  async function handleUserSubmit(payload: UserFormData | Record<string, string>) {
    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    const role = payload.role?.trim();
    const school_id = payload.school_id?.trim() || null;

    if (!name || !email || !role) {
      throw new Error("الاسم والبريد الإلكتروني والدور مطلوبة");
    }

    if (role !== "admin" && !school_id) {
      throw new Error("يجب ربط المستخدم بمدرسة");
    }

    const endpoint = editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users";
    const method = editingUser ? "PATCH" : "POST";
    setBusyUserId(editingUser?.id ?? "new");
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, school_id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل حفظ المستخدم");

      if (editingUser) {
        setUserRows((prev) => prev.map((user) => (user.id === editingUser.id ? json.data : user)));
        window.alert("تم التحديث");
      } else {
        setUserRows((prev) => [json.data, ...prev]);
        window.alert("تمت الإضافة");
      }
      setEditingUser(null);
    } catch (error) {
      console.error("save user failed", error);
      throw error;
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleToggleUserStatus(user: AdminUser) {
    const nextStatus = user.status === "موقوف" ? "نشط" : "موقوف";
    setBusyUserId(user.id);
    setUserRows((prev) => prev.map((item) => (item.id === user.id ? { ...item, status: nextStatus } : item)));
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحديث حالة المستخدم");
      setUserRows((prev) => prev.map((item) => (item.id === user.id ? json.data : item)));
      window.alert(nextStatus === "موقوف" ? "تم التعطيل" : "تم التحديث");
    } catch (error) {
      console.error("toggle user status failed", error);
      setUserRows((prev) => prev.map((item) => (item.id === user.id ? user : item)));
      window.alert(error instanceof Error ? error.message : "فشل تحديث حالة المستخدم");
    } finally {
      setBusyUserId(null);
    }
  }


  async function uploadQuestionsPdf(packageId: string, file: File) {
    const path = `packages/${packageId}/questions.pdf`;
    const { error } = await supabase.storage
      .from("assessment-files")
      .upload(path, file, { upsert: true, contentType: "application/pdf" });

    if (error) throw new Error(error.message || "تعذر رفع ملف الأسئلة PDF");

    const { data } = supabase.storage.from("assessment-files").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handlePackageSubmit(payload: PackageSubmitData) {
    const title = payload.title?.trim();
    if (!title) throw new Error("عنوان الحزمة مطلوب");

    const body = {
      title,
      description: payload.description?.trim() || null,
      subject: payload.subject?.trim() || "رياضيات",
      grade: Number(payload.grade || 6),
      week_number: payload.week_number ? Number(payload.week_number) : null,
      assessment_code: payload.assessment_code?.trim() || null,
      package_type: payload.package_type?.trim() || "weekly",
      duration_minutes: payload.duration_minutes ? Number(payload.duration_minutes) : null,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      student_pdf_url: payload.questions_pdf_url?.trim() || null,
      questions_pdf_url: payload.questions_pdf_url?.trim() || null,
      answer_sheet_pdf_url: payload.answer_sheet_pdf_url?.trim() || null,
      answer_key_file_url: payload.answer_key_file_url?.trim() || null,
      answer_key_json: payload.answer_key_json?.trim() || undefined,
      status: editingPackage?.status ?? "draft",
    };

    const endpoint = editingPackage ? `/api/admin/assessment-packages/${editingPackage.id}` : "/api/admin/assessment-packages";
    const method = editingPackage ? "PATCH" : "POST";
    setBusyPackageId(editingPackage?.id ?? "new");
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل حفظ حزمة الاختبار");
      const packageId = json.data?.id as string | undefined;
      if (packageId && payload.questions_pdf_file) {
        const publicUrl = await uploadQuestionsPdf(packageId, payload.questions_pdf_file);
        const patchRes = await fetch(`/api/admin/assessment-packages/${packageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions_pdf_url: publicUrl, student_pdf_url: publicUrl }),
        });
        const patchJson = await patchRes.json().catch(() => ({}));
        if (!patchRes.ok || !patchJson.success) throw new Error(patchJson.error || "تم حفظ الحزمة لكن تعذر ربط ملف PDF");
      }
      await loadPackages();
      setEditingPackage(null);
      setPackageModalOpen(false);
      window.alert(editingPackage ? "تم تحديث الحزمة" : "تم إنشاء الحزمة");
    } finally {
      setBusyPackageId(null);
    }
  }

  async function handleImportPackageQuestions(jsonText: string) {
    if (!importingPackage) return;
    const validation = validateAnswerKeyJson(jsonText);

    setBusyPackageId(importingPackage.id);
    try {
      const res = await fetch(`/api/admin/assessment-packages/${importingPackage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_key_json: jsonText }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل استيراد الأسئلة");
      await loadPackages();
      window.alert(`تم استيراد ${toEnglishDigits(validation.count)} سؤال`);
    } finally {
      setBusyPackageId(null);
    }
  }

  async function handlePublishPackage(schoolIds: string[]) {
    if (!publishingPackage) return;
    setBusyPackageId(publishingPackage.id);
    try {
      const res = await fetch(`/api/admin/assessment-packages/${publishingPackage.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_ids: schoolIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل نشر الحزمة");
      await loadPackages();
      window.alert(`تم نشر الحزمة وربط ${toEnglishDigits(json.assignedClassCount ?? 0)} فصل مطابق`);
    } finally {
      setBusyPackageId(null);
    }
  }

  async function handleWithdrawPackage(item: AdminAssessmentPackage) {
    if (!window.confirm("سيتم سحب الحزمة من المدارس والفصول المطابقة. لن تُحذف النتائج السابقة. هل تريد المتابعة؟")) return;
    setBusyPackageId(item.id);
    try {
      const res = await fetch(`/api/admin/assessment-packages/${item.id}/withdraw`, { method: "PATCH" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل سحب الحزمة");
      await loadPackages();
      window.alert("تم سحب الحزمة من المدارس والفصول");
    } catch (error) {
      console.error("withdraw package failed", error);
      window.alert(error instanceof Error ? error.message : "فشل سحب الحزمة");
    } finally {
      setBusyPackageId(null);
    }
  }

  async function handleApplyPackageClasses(item: AdminAssessmentPackage) {
    setBusyPackageId(item.id);
    try {
      const res = await fetch(`/api/admin/assessment-packages/${item.id}/apply-classes`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تطبيق الحزمة على الفصول");
      await loadPackages();
      window.alert(`تم تطبيق الحزمة على ${toEnglishDigits(json.assignedClassCount ?? 0)} فصل مطابق`);
    } catch (error) {
      console.error("apply package classes failed", error);
      window.alert(error instanceof Error ? error.message : "فشل تطبيق الحزمة على الفصول");
    } finally {
      setBusyPackageId(null);
    }
  }

  async function handleArchivePackage(item: AdminAssessmentPackage) {
    if (!window.confirm("سيتم أرشفة الحزمة ولن تظهر كاختبار منشور جديد. هل تريد المتابعة؟")) return;
    setBusyPackageId(item.id);
    try {
      const res = await fetch(`/api/admin/assessment-packages/${item.id}/archive`, { method: "PATCH" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "فشل أرشفة الحزمة");
      await loadPackages();
      window.alert("تمت أرشفة الحزمة");
    } catch (error) {
      console.error("archive package failed", error);
      window.alert(error instanceof Error ? error.message : "فشل أرشفة الحزمة");
    } finally {
      setBusyPackageId(null);
    }
  }


  async function handleTrialRequestStatus(request: AdminTrialRequest, status: string) {
    setBusyTrialRequestId(request.id);
    setTrialRequestRows((prev) => prev.map((item) => (item.id === request.id ? { ...item, status } : item)));

    try {
      const res = await fetch(`/api/admin/trial-requests/${request.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "فشل تحديث حالة طلب التجربة");
      setTrialRequestRows((prev) => prev.map((item) => (item.id === request.id ? json.data : item)));
    } catch (error) {
      console.error("update trial request status failed", error);
      setTrialRequestRows((prev) => prev.map((item) => (item.id === request.id ? request : item)));
      window.alert(error instanceof Error ? error.message : "حدث خطأ");
    } finally {
      setBusyTrialRequestId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7fafc] text-brand-navy" dir="rtl">
      {modalType && (
        <AdminModal
          type={modalType}
          initialValues={
            modalType === "school" && editingSchool
              ? { name: editingSchool.name, city: editingSchool.city, type: editingSchool.type ?? "حكومية", subscription_end: editingSchool.subscriptionEnd ?? "" }
              : modalType === "user" && editingUser
                ? { name: editingUser.name, email: editingUser.email, role: editingUser.role, school_id: editingUser.school_id ?? "" }
                : undefined
          }
          schools={schoolRows}
          onSubmit={modalType === "school" ? handleSchoolSubmit : handleUserSubmit}
          onClose={() => { setModalType(null); setEditingSchool(null); setEditingUser(null); }}
        />
      )}

      {packageModalOpen && (
        <PackageModal
          initialValues={editingPackage}
          onSubmit={handlePackageSubmit}
          onClose={() => { setPackageModalOpen(false); setEditingPackage(null); }}
        />
      )}

      {importingPackage && (
        <QuestionImportModal
          assessmentPackage={importingPackage}
          onSubmit={handleImportPackageQuestions}
          onClose={() => setImportingPackage(null)}
        />
      )}

      {publishingPackage && (
        <PublishPackageModal
          assessmentPackage={publishingPackage}
          schools={schoolRows}
          onSubmit={handlePublishPackage}
          onClose={() => setPublishingPackage(null)}
        />
      )}

      <aside className="fixed right-0 top-0 z-40 hidden h-screen w-72 border-l border-slate-100 bg-white xl:flex xl:flex-col">
        <div className="border-b border-slate-100 px-6 py-6">
          <BrandLogo size="sm" contextTitle="لوحة الإدارة" contextSubtitle="مدير النظام" />
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                  isActive
                    ? "bg-brand text-white shadow-[0_10px_24px_rgba(21,159,145,0.12)]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-brand-navy"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <Link
            href="/admin/weekly-plans"
            className="mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-extrabold text-slate-500 transition hover:bg-slate-50 hover:text-brand-navy"
          >
            <BookOpenCheck className="h-5 w-5" />
            إدارة الخطة الأسبوعية
          </Link>
          <Link
            href="/admin/parent-interests"
            className="mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-extrabold text-slate-500 transition hover:bg-slate-50 hover:text-brand-navy"
          >
            <UserRoundCog className="h-5 w-5" />
            اهتمامات أولياء الأمور
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-extrabold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
          >
            <LogOut className="h-5 w-5" />
            {loggingOut ? "جارٍ الخروج..." : "تسجيل الخروج"}
          </button>
        </div>
      </aside>

      <div className="xl:pr-72">
        <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-5 py-4 lg:px-8">
            <div className="flex items-center gap-3 xl:hidden">
              <BrandLogo size="sm" contextTitle="الإدارة" />
            </div>
            <div className="hidden xl:block">
              <p className="text-sm font-bold text-slate-400">المسار الحالي</p>
              <p className="mt-1 font-black text-brand-navy">{activeTitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-700 md:flex">
                <CheckCircle2 className="h-4 w-4" />
                صلاحية مدير نظام
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-navy text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-5 py-3 xl:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold ${
                    isActive ? "bg-brand text-white" : "bg-slate-50 text-slate-500"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
            <Link
              href="/admin/parent-interests"
              className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-xs font-extrabold text-slate-500"
            >
              <UserRoundCog className="h-4 w-4" />
              اهتمامات أولياء الأمور
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
          {activeTab === "overview" && (
            <OverviewTab
              overview={overview}
              state={apiState}
              error={overviewError}
              onAddSchool={openAddSchoolModal}
              onRetry={loadOverview}
            />
          )}
          {activeTab === "schools" && (
            <SchoolsTab
              schools={filteredSchools}
              loading={schoolsLoading}
              error={schoolsError}
              search={schoolSearch}
              onSearchChange={setSchoolSearch}
              onRetry={loadSchools}
              onAddSchool={openAddSchoolModal}
              onEditSchool={openEditSchoolModal}
              onChangeStatus={handleSchoolStatus}
              busySchoolId={busySchoolId}
            />
          )}
          {activeTab === "users" && (
            <UsersTab
              users={filteredUsers}
              loading={usersLoading}
              error={usersError}
              search={userSearch}
              onSearchChange={setUserSearch}
              onRetry={loadUsers}
              busyUserId={busyUserId}
              onAddUser={openAddUserModal}
              onEditUser={openEditUserModal}
              onToggleUserStatus={handleToggleUserStatus}
            />
          )}
          {activeTab === "packages" && (
            <PackagesTab
              packages={filteredPackages}
              loading={packagesLoading}
              error={packagesError}
              search={packageSearch}
              onSearch={setPackageSearch}
              onRetry={loadPackages}
              onCreate={openCreatePackageModal}
              onEdit={openEditPackageModal}
              onImport={setImportingPackage}
              onPublish={setPublishingPackage}
              onApplyClasses={handleApplyPackageClasses}
              onWithdraw={handleWithdrawPackage}
              onArchive={handleArchivePackage}
              busyPackageId={busyPackageId}
            />
          )}
          {activeTab === "trialRequests" && (
            <TrialRequestsTab
              requests={trialRequestRows}
              loading={trialRequestsLoading}
              error={trialRequestsError}
              onRetry={loadTrialRequests}
              busyTrialRequestId={busyTrialRequestId}
              onUpdateStatus={handleTrialRequestStatus}
            />
          )}
          {activeTab === "reports" && <ReportsTab />}
        </main>
      </div>
    </div>
  );
}

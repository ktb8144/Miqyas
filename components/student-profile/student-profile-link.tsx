"use client";

import { useCallback, useState } from "react";
import { StudentProfilePanel } from "./student-profile-panel";

/** A student's name that opens their file in a side panel. */
export function StudentProfileLink({
  studentId,
  name,
  className = "",
}: {
  studentId: string;
  name: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-right underline decoration-brand/30 decoration-2 underline-offset-4 transition hover:text-brand hover:decoration-brand ${className}`}
        title="عرض ملف الطالب"
      >
        {name}
      </button>
      {open && <StudentProfilePanel studentId={studentId} onClose={close} />}
    </>
  );
}

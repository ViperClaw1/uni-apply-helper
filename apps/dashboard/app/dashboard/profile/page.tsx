"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getMyProfile,
  type FamilyRelativeInput,
  type MyEducationInput,
  type MyEmergencyContactInput,
  type MyFamilyInput,
  type MyGuarantorInput,
  type MyProfileInput,
} from "@/features/students/api/students.api";
import { StudentProfilePage } from "@/features/students/components/student-profile-page";
import type { StudentProfile } from "@/features/students/types/student.types";
import { EducationStep } from "@/features/students/components/profile-wizard/education-step";
import { EmergencyContactStep } from "@/features/students/components/profile-wizard/emergency-contact-step";
import { FamilyStep } from "@/features/students/components/profile-wizard/family-step";
import { GuarantorStep } from "@/features/students/components/profile-wizard/guarantor-step";
import { PersonalStep } from "@/features/students/components/profile-wizard/personal-step";

const STEP_LABELS = [
  "Personal",
  "Education",
  "Guarantor",
  "Emergency contact",
  "Family",
  "Universities & documents",
];

export default function ProfileWizardPage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getMyProfile()
      .then((data) => {
        if (isMounted) {
          setProfile(data);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function handleStepComplete(updated: StudentProfile) {
    setProfile(updated);
    setStep((current) => Math.min(current + 1, 6));
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-6">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  // Step 6 is the existing, self-contained student-card page (its own
  // layout/width/back-link) — rendered on its own rather than nested inside
  // the wizard's chrome, which would otherwise double up on padding/cards.
  if (step === 6 && profile) {
    return <StudentProfilePage studentId={profile.id} />;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Your profile
        </h1>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          ← Back to dashboard
        </Link>
      </header>

      <StepProgress
        current={step}
        labels={STEP_LABELS}
        onStepClick={(target) => {
          if (target < step) {
            setStep(target);
          }
        }}
      />

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_30px_rgba(15,23,42,0.04)] ring-1 ring-black/5">
        {step === 1 ? (
          <PersonalStep
            initial={toPersonalInput(profile)}
            onNext={handleStepComplete}
          />
        ) : step === 2 ? (
          <EducationStep
            initial={toEducationInput(profile)}
            onNext={handleStepComplete}
            onBack={() => setStep(1)}
          />
        ) : step === 3 ? (
          <GuarantorStep
            initial={toGuarantorInput(profile)}
            onNext={handleStepComplete}
            onBack={() => setStep(2)}
          />
        ) : step === 4 ? (
          <EmergencyContactStep
            initial={toEmergencyContactInput(profile)}
            onNext={handleStepComplete}
            onBack={() => setStep(3)}
          />
        ) : (
          <FamilyStep
            initial={toFamilyInput(profile)}
            onNext={handleStepComplete}
            onBack={() => setStep(4)}
          />
        )}
      </div>
    </div>
  );
}

function StepProgress({
  current,
  labels,
  onStepClick,
}: {
  current: number;
  labels: string[];
  onStepClick: (step: number) => void;
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {labels.map((label, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < current;
        const isCurrent = stepNumber === current;

        return (
          <li key={label}>
            <button
              type="button"
              disabled={!isCompleted}
              onClick={() => onStepClick(stepNumber)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                isCurrent
                  ? "bg-slate-950 text-white"
                  : isCompleted
                    ? "cursor-pointer bg-slate-100 text-slate-700 hover:bg-slate-200"
                    : "bg-slate-50 text-slate-400"
              }`}
            >
              {stepNumber}. {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function toPersonalInput(profile: StudentProfile | null): MyProfileInput {
  const personal = profile?.personal;
  return {
    surname: personal?.surname ?? "",
    givenName: personal?.givenName ?? "",
    email: personal?.email ?? "",
    phone: personal?.phone ?? "",
    nationality: personal?.nationality ?? "",
    dateOfBirth: personal?.dateOfBirth?.slice(0, 10) ?? "",
    passportNo: personal?.passportNo ?? "",
    sex: personal?.sex ?? "",
    cityOfBirth: personal?.cityOfBirth ?? "",
    chineseName: personal?.chineseName ?? "",
    religion: personal?.religion ?? "",
    passportExpiry: personal?.passportExpiry?.slice(0, 10) ?? "",
    consulate: personal?.consulate ?? "",
    maritalStatus: personal?.maritalStatus ?? "",
    hobby: personal?.hobby ?? "",
    permanentAddress: personal?.permanentAddress ?? "",
    postCode: personal?.postCode ?? "",
    currentInstitution: personal?.currentInstitution ?? "",
    beenToChina: personal?.beenToChina ?? false,
    studiedInChina: personal?.studiedInChina ?? false,
    desiredField: personal?.desiredField ?? "",
  };
}

function toEducationInput(profile: StudentProfile | null): MyEducationInput {
  const school = profile?.education.find((entry) => entry.level === "school");
  const higher = profile?.education.find((entry) => entry.level === "higher");
  const chinese = profile?.languages.find((entry) => entry.language === "chinese");
  const english = profile?.languages.find((entry) => entry.language === "english");

  return {
    school: school
      ? {
          degree: school.degree,
          institution: school.institution,
          major: school.major,
          periodStartYear: yearOf(school.periodStart),
          periodEndYear: yearOf(school.periodEnd),
        }
      : undefined,
    higher: higher
      ? {
          degree: higher.degree,
          institution: higher.institution,
          major: higher.major,
          periodStartYear: yearOf(higher.periodStart),
          periodEndYear: yearOf(higher.periodEnd),
        }
      : undefined,
    chineseLevel: chinese?.score,
    englishLevel: english?.score,
  };
}

function toGuarantorInput(profile: StudentProfile | null): MyGuarantorInput {
  const guarantor = profile?.guarantor;
  return {
    name: guarantor?.name ?? "",
    relationship: guarantor?.relationship ?? "",
    phone: guarantor?.phone ?? "",
    email: guarantor?.email ?? "",
    homeAddress: guarantor?.homeAddress ?? "",
  };
}

function toEmergencyContactInput(
  profile: StudentProfile | null,
): MyEmergencyContactInput {
  const emergencyContact = profile?.emergencyContact;
  return {
    name: emergencyContact?.name ?? "",
    relationship: emergencyContact?.relationship ?? "",
    phone: emergencyContact?.phone ?? "",
    email: emergencyContact?.email ?? "",
  };
}

function toFamilyInput(profile: StudentProfile | null): MyFamilyInput {
  const father = profile?.familyMembers.find(
    (member) => member.relationship === "father",
  );
  const mother = profile?.familyMembers.find(
    (member) => member.relationship === "mother",
  );

  return {
    father: father ? toFamilyRelativeInput(father) : undefined,
    mother: mother ? toFamilyRelativeInput(mother) : undefined,
  };
}

function toFamilyRelativeInput(member: {
  fullName: string;
  nationality?: string;
  phone?: string;
  email?: string;
  company?: string;
  position?: string;
}): FamilyRelativeInput {
  return {
    fullName: member.fullName,
    nationality: member.nationality,
    phone: member.phone,
    email: member.email,
    company: member.company,
    position: member.position,
  };
}

function yearOf(isoDate: string | undefined): number | undefined {
  return isoDate ? new Date(isoDate).getFullYear() : undefined;
}

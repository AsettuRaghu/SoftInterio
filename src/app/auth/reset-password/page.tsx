import { Suspense } from "react";
import ResetPasswordForm from "@/modules/auth/components/ResetPasswordForm";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function ResetPasswordContent() {
  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

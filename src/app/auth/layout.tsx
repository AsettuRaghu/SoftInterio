import { AuthLayout } from "@/modules/auth/components/AuthLayout";

export default function AuthPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthLayout>{children}</AuthLayout>;
}

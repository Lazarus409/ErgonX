import AuthenticationGate from "@/components/guards/AuthenticationGate";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticationGate>{children}</AuthenticationGate>;
}

import { LoginCard } from "../features/auth/components/LoginCard";
import { LoginShell } from "../features/auth/components/LoginShell";

export default function HomePage() {
  return <LoginShell><LoginCard /></LoginShell>;
}

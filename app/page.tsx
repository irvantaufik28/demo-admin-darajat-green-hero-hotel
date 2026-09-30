import { LoginCard } from "../components/auth/LoginCard";
import { LoginShell } from "../components/auth/LoginShell";

export default function HomePage() {
  return <LoginShell><LoginCard /></LoginShell>;
}

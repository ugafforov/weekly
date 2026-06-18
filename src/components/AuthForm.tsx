import { useState, type FormEvent } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

/** Maps Firebase auth error codes to short Uzbek messages. */
function authErrorMessage(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Email manzili noto'g'ri.";
    case "auth/missing-password":
      return "Parol kiriting.";
    case "auth/weak-password":
      return "Parol kamida 6 ta belgidan iborat bo'lsin.";
    case "auth/email-already-in-use":
      return "Bu email allaqachon ro'yxatdan o'tgan.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email yoki parol noto'g'ri.";
    case "auth/too-many-requests":
      return "Juda ko'p urinish. Birozdan so'ng qayta urining.";
    default:
      return "Kirishda xatolik yuz berdi. Qayta urinib ko'ring.";
  }
}

export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(authErrorMessage(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-lg font-bold text-foreground">
        {mode === "signin" ? "Tizimga kirish" : "Ro'yxatdan o'tish"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Email va parol orqali {mode === "signin" ? "kiring" : "hisob yarating"}.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ustoz@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Parol</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <LogIn />}
          {mode === "signin" ? "Kirish" : "Ro'yxatdan o'tish"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
        }}
        className="mt-4 w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {mode === "signin" ? "Hisobingiz yo'qmi? Ro'yxatdan o'ting" : "Hisobingiz bormi? Kiring"}
      </button>
    </div>
  );
}

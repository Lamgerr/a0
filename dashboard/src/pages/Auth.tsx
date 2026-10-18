import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader } from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Auth() {
  const { signIn, signUp, controlPlaneConfigured, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (mode === "signup") {
      toast.success("Account requested — check your inbox to confirm.");
      return;
    }
    navigate("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-mono text-lg font-bold text-primary-foreground">
            a0
          </span>
          <span className="font-semibold">a0 control</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "signin" ? "Sign in" : "Create an account"}
            </CardTitle>
            <CardDescription>
              {controlPlaneConfigured
                ? "Keys, quotas and nodes live here."
                : "Control plane offline → sign-in will stay local until VITE_SUPABASE_* are set."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dev@example.com"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy && (
                  <Loader size="sm" className="animate-spin text-primary-foreground" />
                )}
                {mode === "signin" ? "Sign in" : "Sign up"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "No account yet?" : "Already have one?"}{" "}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
            <p className="mt-2 text-center text-xs text-muted-foreground/60">
              <Link to="/" className="hover:underline">
                back to landing
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthMode = "signin" | "signup";

export function AuthCard() {
  const { signIn, signUp, configured } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signin") {
        await signIn(email, password);
        setMessage("Signed in successfully.");
      } else {
        await signUp(email, password, fullName);
        setMessage("Account created. Check your inbox if email confirmation is enabled.");
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border/70 bg-white">
      <CardHeader>
        <CardTitle>Supabase Auth</CardTitle>
        <CardDescription>Client-side email login and signup flow for the Knowlense website.</CardDescription>
      </CardHeader>
      <CardContent>
        {!configured ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Supabase chưa được cấu hình. Hãy tạo file `.env.local` với `NEXT_PUBLIC_SUPABASE_URL` và
            `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </div>
        ) : null}

        <Tabs defaultValue="signin" onValueChange={(value) => setMode(value as AuthMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Login</TabsTrigger>
            <TabsTrigger value="signup">Signup</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4">
            <Field label="Email">
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="founder@knowlense.com" />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
            </Field>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <Field label="Full name">
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Knowlense Founder" />
            </Field>
            <Field label="Email">
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="founder@knowlense.com" />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a secure password" />
            </Field>
          </TabsContent>
        </Tabs>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {message ? <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}

        <Button className="mt-5 w-full" onClick={() => void handleSubmit()} disabled={loading}>
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {mode === "signin" ? "Login with email" : "Create account"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

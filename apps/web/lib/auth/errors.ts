"use client";

type AuthMessage = {
  kind: "error" | "success" | "info";
  message: string;
};

export function validatePassword(password: string, confirmation?: string): AuthMessage | null {
  if (password.length < 8) {
    return {
      kind: "error",
      message: "Password must be at least 8 characters long."
    };
  }

  if (typeof confirmation === "string" && password !== confirmation) {
    return {
      kind: "error",
      message: "Password confirmation does not match."
    };
  }

  return null;
}

export function mapSignupResult(args: {
  email: string;
  errorMessage?: string;
  identitiesLength?: number;
}) {
  if (args.errorMessage) {
    return {
      kind: "error" as const,
      message: args.errorMessage
    };
  }

  if (args.identitiesLength === 0) {
    return {
      kind: "info" as const,
      message: `If ${args.email} already belongs to an account, sign in or resend a confirmation email.`
    };
  }

  return {
    kind: "success" as const,
    message: `We sent a verification email to ${args.email}.`
  };
}

export function mapSignInError(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "This email exists but has not been verified yet. Use the verify email flow to resend confirmation.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  return errorMessage;
}

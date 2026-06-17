"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useRegister } from "../hooks/useRegister";
import { FieldError } from "./FieldError";
import { ApiClientError } from "@/lib/query";

// ─── Validation schema ─────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    display_name: z
      .string()
      .min(1, "Name is required")
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name must be 80 characters or fewer"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be 128 characters or fewer")
      .regex(/[A-Z]/, "Must include at least one uppercase letter")
      .regex(/[0-9]/, "Must include at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

// ─── Component ─────────────────────────────────────────────────────────────────

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { mutate: register, isPending, error } = useRegister();

  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { display_name: "", email: "", password: "", confirmPassword: "" },
  });

  const serverError =
    error instanceof ApiClientError
      ? error.message
      : error
        ? "Something went wrong. Please try again."
        : null;

  const onSubmit = ({ display_name, email, password }: RegisterFormValues) => {
    register({ display_name, email, password });
  };

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-bold">Create account</CardTitle>
        <CardDescription>
          Start managing your life in minutes
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          {/* Server-level error banner */}
          {serverError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          {/* Full name */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-name">Full name</Label>
            <Input
              id="reg-name"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              aria-invalid={!!errors.display_name}
              {...field("display_name")}
            />
            <FieldError message={errors.display_name?.message} />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              {...field("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Password</Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Min. 8 chars, 1 uppercase, 1 number"
                className="pr-9"
                aria-invalid={!!errors.password}
                {...field("password")}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <FieldError message={errors.password?.message} />
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-confirm">Confirm password</Label>
            <div className="relative">
              <Input
                id="reg-confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Re-enter password"
                className="pr-9"
                aria-invalid={!!errors.confirmPassword}
                {...field("confirmPassword")}
              />
              <button
                type="button"
                aria-label={showConfirm ? "Hide password" : "Show password"}
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <FieldError message={errors.confirmPassword?.message} />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex justify-center pb-6 pt-0">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/auth?tab=login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

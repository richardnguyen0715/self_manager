"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteAccount } from "../hooks/useAccount";
import { useSettingsUIStore } from "../settings.store";

const CONFIRM_TEXT = "DELETE MY ACCOUNT";

export function DeleteAccountDialog() {
  const open = useSettingsUIStore((s) => s.deleteAccountOpen);
  const setOpen = useSettingsUIStore((s) => s.setDeleteAccountOpen);
  const deleteAccount = useDeleteAccount();

  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const resetForm = () => {
    setPassword("");
    setConfirmText("");
    deleteAccount.reset();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    setOpen(open);
  };

  const canSubmit =
    password.length > 0 &&
    confirmText === CONFIRM_TEXT &&
    !deleteAccount.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await deleteAccount.mutateAsync({ password });
    // Redirect happens inside useDeleteAccount on success
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete account
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone. All your tasks,
            habits, goals, time blocks, and data will be erased immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive space-y-1">
            <p className="font-medium">You will lose:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>All tasks, projects and goals</li>
              <li>All habits and streak history</li>
              <li>All time blocks and focus sessions</li>
              <li>All calendar events and analytics data</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="delete-password">Confirm your password</Label>
            <Input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Your current password"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-delete-text">
              Type{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
                {CONFIRM_TEXT}
              </code>{" "}
              to confirm
            </Label>
            <Input
              id="confirm-delete-text"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_TEXT}
              autoComplete="off"
            />
          </div>

          {deleteAccount.isError && (
            <p className="text-sm text-destructive">
              {deleteAccount.error.message}
            </p>
          )}

          <DialogFooter className="mt-4 flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={!canSubmit}
            >
              {deleteAccount.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Permanently delete account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

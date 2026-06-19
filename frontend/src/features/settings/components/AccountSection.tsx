"use client";

import { AlertTriangle, Key, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSettingsUIStore } from "../settings.store";
import { useLogoutAllSessions } from "../hooks/useAccount";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

export function AccountSection() {
  const setChangePasswordOpen = useSettingsUIStore(
    (s) => s.setChangePasswordOpen,
  );
  const setDeleteAccountOpen = useSettingsUIStore(
    (s) => s.setDeleteAccountOpen,
  );
  const logoutAll = useLogoutAllSessions();

  return (
    <div>
      <SettingsSectionHeader
        title="Account"
        description="Manage your password and account security."
      />

      <div className="space-y-6 max-w-lg w-full">
        {/* Password */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Key className="h-4 w-4" />
                Password
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Use a strong, unique password to protect your account.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setChangePasswordOpen(true)}
            >
              Change password
            </Button>
          </CardContent>
        </Card>

        {/* Active sessions */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Active sessions
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Sign out from all devices except the current one. Useful if you
                think your account may have been compromised.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => logoutAll.mutate()}
              disabled={logoutAll.isPending}
            >
              {logoutAll.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Sign out all other sessions
            </Button>
            {logoutAll.isError && (
              <p className="text-sm text-destructive">
                {logoutAll.error.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Danger zone */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">
              Danger zone
            </h3>
          </div>
          <Separator className="mb-4" />
          <Card className="border-destructive/40">
            <CardContent className="pt-6 space-y-4">
              <div>
                <h4 className="text-sm font-semibold">Delete account</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently delete your account and all associated data. This
                  action cannot be reversed.
                </p>
              </div>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setDeleteAccountOpen(true)}
              >
                Delete my account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ChangePasswordDialog />
      <DeleteAccountDialog />
    </div>
  );
}

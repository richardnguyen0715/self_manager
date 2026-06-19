"use client";

import Link from "next/link";
import { Pencil, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Space } from "@/features/docs";

interface SpaceCardProps {
  space: Space;
  onEdit: (space: Space) => void;
  onDelete: (space: Space) => void;
}

export function SpaceCard({ space, onEdit, onDelete }: SpaceCardProps) {
  const updatedAt = new Date(space.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card className="group relative flex flex-col transition-shadow hover:shadow-md">
      {/* Actions overlay */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.preventDefault();
            onEdit(space);
          }}
          aria-label="Edit space"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            onDelete(space);
          }}
          aria-label="Delete space"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Link href={`/docs/${space.id}`} className="flex flex-1 flex-col">
        <CardHeader className="pb-2">
          {/* Icon */}
          <div
            className={cn(
              "mb-2 flex h-10 w-10 items-center justify-center rounded-lg text-xl",
              space.icon ? "bg-muted" : "bg-primary/10 text-primary",
            )}
          >
            {space.icon ? (
              <span>{space.icon}</span>
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </div>
          <CardTitle className="text-base line-clamp-1 pr-14">
            {space.name}
          </CardTitle>
          {space.description && (
            <CardDescription className="line-clamp-2 text-xs">
              {space.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="flex-1" />

        <CardFooter className="pt-0">
          <p className="text-xs text-muted-foreground">Updated {updatedAt}</p>
        </CardFooter>
      </Link>
    </Card>
  );
}

"use client";

import { useMemo } from "react";
import {
  useCustomProperties,
  useWorkItemPropertyValues,
} from "../hooks";
import type { PropertyValue } from "../types";
import { PropertyValueEditor } from "./PropertyValueEditor";

interface PropertiesPanelProps {
  workItemId: string;
  /** The work item's project. Null (no project) renders nothing. */
  projectId: string | null;
}

/**
 * Editable custom property fields for one work item, shown in the detail
 * views. Renders nothing when there is no project or the project has no
 * properties.
 */
export function PropertiesPanel({ workItemId, projectId }: PropertiesPanelProps) {
  const { data: properties = [] } = useCustomProperties(projectId);
  const { data: values = [] } = useWorkItemPropertyValues(
    projectId ? workItemId : null,
  );

  const valueById = useMemo(() => {
    const map = new Map<string, PropertyValue>();
    for (const v of values) map.set(v.property_id, v.value);
    return map;
  }, [values]);

  if (!projectId || properties.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Properties</h2>
      <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2">
        {properties.map((p) => (
          <div key={p.id} className="contents">
            <span className="truncate pt-1.5 text-xs text-muted-foreground" title={p.name}>
              {p.name}
            </span>
            <PropertyValueEditor
              workItemId={workItemId}
              property={p}
              value={valueById.get(p.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

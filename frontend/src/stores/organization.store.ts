import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OrganizationState {
  currentOrganizationId: string | null;
  setCurrentOrganization: (id: string | null) => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      currentOrganizationId: null,
      setCurrentOrganization: (id) => set({ currentOrganizationId: id }),
    }),
    {
      name: "organization-scope",
    },
  ),
);

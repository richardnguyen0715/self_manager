import { redirect } from "next/navigation";

// "Life Calendar" was merged into the single Calendar page.
export default function LifeCalendarRedirect() {
  redirect("/calendar?view=life");
}

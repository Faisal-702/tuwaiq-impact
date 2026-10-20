import { redirect } from "next/navigation";

/**
 * Projects are created by students only, through the student project form
 * (/add-project). Administrators review submitted projects in Manage
 * Projects; this former "Add Project" address leads there.
 */
export default function NewProjectPage() {
  redirect("/admin/projects");
}

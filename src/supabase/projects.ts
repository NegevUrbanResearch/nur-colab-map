import supabase from "../supabase";

export type Project = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  project_meta: string | null; // JSON string for additional metadata
};

export async function loadProjects() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User not logged in");

  // Query project_members to get project_ids
  const { data: projectMembers, error: memberError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id);

  if (memberError) throw memberError;

  const projectIds = projectMembers.map((pm) => pm.project_id);

  if (projectIds.length === 0) {
    return [];
  }

  // Query projects by membership
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, created_at, project_meta")
    .in("id", projectIds);

  if (error) throw error;
  return data as Project[];
}

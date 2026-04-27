import supabase from "../supabase";

export type Project = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  project_meta: string | null; // JSON string for additional metadata
};

export async function ensureMemorialSitesProjectForUser(userId: string) {
  const memorialProjectId = "33333333-3333-3333-3333-333333333333";
  const { data: existing, error: selectError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("project_id", memorialProjectId)
    .eq("user_id", userId);

  if (selectError) {
    throw selectError;
  }

  if (existing && existing.length > 0) {
    return;
  }

  const { error: insertError } = await supabase.from("project_members").insert({
    project_id: memorialProjectId,
    user_id: userId,
    role: "editor",
  });

  if (insertError) {
    throw insertError;
  }
}

export async function ensureWorkshopPinkProjectForUser(userId: string) {
  const pinkLineProjectId = "22222222-2222-2222-2222-222222222222";

  const { data: existing, error: selectError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("project_id", pinkLineProjectId)
    .eq("user_id", userId);

  if (selectError) {
    throw selectError;
  }

  if (existing && existing.length > 0) {
    return;
  }

  const { error: insertError } = await supabase.from("project_members").insert({
    project_id: pinkLineProjectId,
    user_id: userId,
    role: "editor",
  });

  if (insertError) {
    throw insertError;
  }
}

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

export async function loadProjectById(projectId: string): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, created_at, project_meta")
    .eq("id", projectId)
    .single();

  if (error) throw error;
  return data as Project;
}

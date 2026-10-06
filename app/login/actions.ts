"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const secret = String(formData.get("password") ?? "");

  if (!email || !secret) redirect("/login?error=invalid");

  const supabase = await createClient();
  const result = await supabase.auth.signInWithPassword({
    email,
    password: secret,
  });

  if (result.error) redirect("/login?error=invalid");

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

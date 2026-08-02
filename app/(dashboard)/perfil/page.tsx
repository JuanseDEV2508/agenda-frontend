import type { Metadata } from "next";

import { ProfileView } from "@/components/layout/profile-view";

export const metadata: Metadata = {
  title: "Mi perfil",
};

export default function ProfilePage() {
  return <ProfileView />;
}

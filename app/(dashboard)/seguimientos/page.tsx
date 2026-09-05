import type { Metadata } from "next";

import { FollowUpView } from "@/components/follow-ups/follow-up-view";

export const metadata: Metadata = {
  title: "Seguimiento",
};

export default function FollowUpsPage() {
  return <FollowUpView />;
}

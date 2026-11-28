import type { Metadata } from "next";
import { OpenEditLink } from "@/components/open-edit-link";

export const metadata: Metadata = {
  title: "Opening Plot · Stage Plop",
  robots: { index: false, follow: false },
};

export default async function EditPage({ params }: PageProps<"/edit/[id]">) {
  const { id } = await params;
  return <OpenEditLink id={id} />;
}

import { redirect } from "next/navigation";
// Root redirects to dashboard; middleware will bounce to /login if not authed.
export default function Home() {
  redirect("/campaigns");
}

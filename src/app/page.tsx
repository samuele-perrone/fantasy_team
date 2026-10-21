import { redirect } from "next/navigation";

/** The app opens on the squad; there is no separate home page. */
export default function Home() {
  redirect("/squad");
}

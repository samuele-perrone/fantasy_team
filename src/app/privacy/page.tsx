import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, PRIVACY_UPDATED } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What FantasyTeamHub stores about you, and how to delete it.",
};

/**
 * The privacy policy App Store Connect links to. Public, outside the sign-in gate. Every claim
 * here is about what the code does — update it in the same change as anything it describes:
 * the tables in supabase/migrations, analytics in app/layout.tsx, or the hosting regions.
 */
export default function PrivacyPage() {
  return (
    <article className="max-w-2xl text-[14px] leading-relaxed text-slate-300">
      <h1 className="text-[22px] font-bold tracking-tight text-white md:text-[28px]">Privacy</h1>
      <p className="mt-1 text-[12.5px] text-slate-500">Last updated {PRIVACY_UPDATED}</p>

      <p className="mt-4">
        FantasyTeamHub helps you manage a Fantasy Premier League team, on this website and in the
        iPhone app. This page says what we keep about you, why, and how to delete it.
      </p>

      <Section title="What we store">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-white">Your sign-in.</strong> Your email address, and your name
            if Apple or Google share it, from Sign in with Apple or Google. If you choose Apple&apos;s
            Hide My Email, we only see the relay address.
          </li>
          <li>
            <strong className="text-white">Your FPL teams.</strong> The FPL team IDs you add, with the
            team and manager names FPL publishes for them, and which one you are viewing.
          </li>
          <li>
            <strong className="text-white">Your watchlist.</strong> The players you star.
          </li>
        </ul>
        <p className="mt-2">
          That is all. We do not ask for or store your FPL password, payment details, contacts or
          location.
        </p>
      </Section>

      <Section title="Why">
        Only to run the service: to sign you in, show your squad, and keep your teams and
        watchlist the same on every device. We do not sell your data, show ads, or use it to
        track you across other apps or websites.
      </Section>

      <Section title="Where it is kept">
        Your account and saved data are stored with Supabase, and the website and the app&apos;s
        server run on Vercel, both in the European Union (Ireland). Database rules allow each
        account to read only its own rows. Player and fixture data comes from the public Fantasy
        Premier League and ESPN services. To show your squad we ask FPL for the team IDs you add;
        nothing about you is sent to ESPN, and your email goes to neither.
      </Section>

      <Section title="Analytics">
        The website uses Google Analytics to count visits and pages viewed, which sets cookies in
        your browser. The iPhone app has no analytics and no tracking.
      </Section>

      <Section title="Deleting your data">
        Delete your account at any time from{" "}
        <Link href="/account" className="text-brand-400 hover:underline">
          Account
        </Link>{" "}
        on the website, or from the account menu on My Squad in the app. It removes your sign-in,
        teams and watchlist at once, permanently. Your team on the official FPL game is not
        affected.
      </Section>

      <Section title="Contact">
        Questions or requests: <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-400 hover:underline">{CONTACT_EMAIL}</a>.
      </Section>

      <p className="mt-8 text-[12px] text-slate-500">
        FantasyTeamHub is independent and not affiliated with the Premier League or Fantasy
        Premier League.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1.5 text-[15px] font-bold text-white">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

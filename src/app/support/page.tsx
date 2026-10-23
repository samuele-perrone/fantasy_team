import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Support",
  description: "Help with FantasyTeamHub, and how to get in touch.",
};

/** The support page App Store Connect links to. Public, outside the sign-in gate. */
export default function SupportPage() {
  return (
    <article className="max-w-2xl text-[14px] leading-relaxed text-slate-300">
      <h1 className="text-[22px] font-bold tracking-tight text-white md:text-[28px]">Support</h1>
      <p className="mt-4">
        Something not working, or a question about a verdict? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-400 hover:underline">
          {CONTACT_EMAIL}
        </a>{" "}
        and include your FPL team ID if it is about your squad.
      </p>

      <h2 className="mt-6 mb-1.5 text-[15px] font-bold text-white">Common questions</h2>
      <dl className="space-y-4">
        <div>
          <dt className="font-semibold text-white">Where do I find my FPL team ID?</dt>
          <dd>
            Sign in on the Fantasy Premier League website, open Pick Team, then Gameweek History.
            The number after <span className="font-mono">/entry/</span> in the address bar is
            your ID. The FPL app does not show it.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-white">Why does my squad not show this week&apos;s transfers?</dt>
          <dd>
            FPL only publishes a squad as it stood at the last deadline, so transfers made since
            appear after the next one.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-white">How accurate are the points estimates?</dt>
          <dd>
            Typically within about 1.6 points per player per gameweek. A player is only marked
            Sell when the gap to a replacement is clearly bigger than that.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-white">How do I delete my account?</dt>
          <dd>
            From <Link href="/account" className="text-brand-400 hover:underline">Account</Link> on
            the website, or the account menu on My Squad in the app. See the{" "}
            <Link href="/privacy" className="text-brand-400 hover:underline">privacy page</Link>{" "}
            for what is deleted.
          </dd>
        </div>
      </dl>
    </article>
  );
}

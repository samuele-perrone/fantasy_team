"use client";

/**
 * A <select> that submits its form as soon as it changes, so a filter applies on one tap.
 * Without JavaScript it is an ordinary select and the form's button submits it.
 */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

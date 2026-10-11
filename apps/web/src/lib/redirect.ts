/** Where to go after signing in: only paths inside this app, never another site. */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/(?![/\\])/.test(next) ? next : '/';
}

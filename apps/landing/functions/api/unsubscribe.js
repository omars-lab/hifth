// /api/unsubscribe?t=… — the leave link in our emails. Opening it shows a button (GET);
// pressing it, or the mail program's own one-click leave, takes the address off (POST).
// The work is in lib/notify.mjs.
import { handleUnsubscribe } from "../../lib/notify.mjs";

export const onRequestGet = ({ request, env }) => handleUnsubscribe(request, env);
export const onRequestPost = ({ request, env }) => handleUnsubscribe(request, env);

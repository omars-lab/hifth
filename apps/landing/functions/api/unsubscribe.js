// GET /api/unsubscribe?t=… — the leave link in the one email we send. The work is in lib/notify.mjs.
import { handleUnsubscribe } from "../../lib/notify.mjs";

export const onRequestGet = ({ request, env }) => handleUnsubscribe(request, env);

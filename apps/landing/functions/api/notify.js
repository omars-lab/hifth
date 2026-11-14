// POST /api/notify — the email form on the front page. The work is in lib/notify.mjs.
import { handleNotify } from "../../lib/notify.mjs";

export const onRequestPost = ({ request, env }) => handleNotify(request, env);

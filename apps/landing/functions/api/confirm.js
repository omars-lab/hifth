// /api/confirm?c=… — the link in the one email sent after a sign-up. Opening it shows a
// button (GET), so a mail program that opens links to scan them confirms nobody; pressing it
// confirms (POST). The work is in lib/notify.mjs.
import { handleConfirm } from "../../lib/notify.mjs";

export const onRequestGet = ({ request, env }) => handleConfirm(request, env);
export const onRequestPost = ({ request, env }) => handleConfirm(request, env);

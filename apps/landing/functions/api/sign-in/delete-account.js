// /api/sign-in/delete-account: the signed-in reader deletes their account: everything kept about
// them goes, and Apple is asked to drop its link with Hifth. The work is in lib/sign-in-api.mjs;
// closed (404) unless SIGN_IN is "on".
import { handleDeleteAccount } from "../../../lib/sign-in-api.mjs";

export const onRequestPost = ({ request, env }) => handleDeleteAccount(request, env);

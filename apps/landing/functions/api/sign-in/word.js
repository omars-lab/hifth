// /api/sign-in/word — hands the app a one-off word for one sign-in. The work is in
// lib/sign-in-api.mjs; closed (404) unless SIGN_IN is "on".
import { handleWord } from "../../../lib/sign-in-api.mjs";

export const onRequestPost = ({ request, env }) => handleWord(request, env);

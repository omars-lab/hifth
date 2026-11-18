// /api/sign-in/apple-notice — where Apple posts its signed notice that a reader has left from
// Apple's side (stopped using Apple sign-in with Hifth, or deleted their Apple account). The work
// is in lib/sign-in-api.mjs; closed (404) unless SIGN_IN is "on".
import { handleAppleNotice } from "../../../lib/sign-in-api.mjs";

export const onRequestPost = ({ request, env }) => handleAppleNotice(request, env);

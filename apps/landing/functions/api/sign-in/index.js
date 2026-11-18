// /api/sign-in — Apple's note and the one-off word in, a session out. The work is in
// lib/sign-in-api.mjs; closed (404) unless SIGN_IN is "on".
import { handleSignIn } from "../../../lib/sign-in-api.mjs";

export const onRequestPost = ({ request, env }) => handleSignIn(request, env);

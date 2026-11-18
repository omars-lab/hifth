// /api/sign-out — ends the session named in the Authorization line. The work is in
// lib/sign-in-api.mjs; closed (404) unless SIGN_IN is "on".
import { handleSignOut } from "../../lib/sign-in-api.mjs";

export const onRequestPost = ({ request, env }) => handleSignOut(request, env);

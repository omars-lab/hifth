// /api/marks: the signed-in reader's one copy of their marks (sign-in step 21). GET reads it, PUT
// replaces it whole, DELETE removes it. The work is in lib/sign-in-api.mjs and lib/marks-copy.mjs;
// closed (404) unless SIGN_IN is "on".
import { handleDropMarks, handleKeepMarks, handleReadMarks } from "../../lib/sign-in-api.mjs";

export const onRequestGet = ({ request, env }) => handleReadMarks(request, env);
export const onRequestPut = ({ request, env }) => handleKeepMarks(request, env);
export const onRequestDelete = ({ request, env }) => handleDropMarks(request, env);

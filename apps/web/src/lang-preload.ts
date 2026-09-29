/**
 * The small script index.html runs first, to start downloading the reader's
 * interface language alongside the app's own code.
 *
 * Why it exists: each language is its own file, and the app only learns which
 * one it needs once its main script has downloaded and started. Asking then
 * would add a whole extra round trip before the first paint (about 150 ms on
 * the slow phone the start-up check models), which costs more than the 5–7 KB
 * the split saves. So the page names the file up front, and by the time the
 * app asks for it, it is already here or on its way.
 *
 * It repeats `detectLang` (lang.ts) in plain browser JavaScript, because it
 * runs before any of the app's code exists. That copy is only a hint: if the
 * two ever disagreed, the app would still load the right language, just one
 * round trip later. `lang-preload.test.ts` holds them to the same answers.
 *
 * Built at build time by the `preloadReaderLanguage` plugin in vite.config.ts,
 * which knows each language file's hashed name.
 */
import { LANG_STORAGE_KEY } from "./lang";

/**
 * `files` maps each language to the files to ask for (its own, then any it
 * imports), as paths relative to index.html.
 */
export function preloadScript(files: Readonly<Record<string, readonly string[]>>): string {
  return `(function(){var f=${JSON.stringify(files)},l=null,i,t,k;
try{l=new URLSearchParams(location.search).get("lang")}catch(e){}
if(!f.hasOwnProperty(l)){l=null;try{l=localStorage.getItem(${JSON.stringify(LANG_STORAGE_KEY)})}catch(e){}}
if(!f.hasOwnProperty(l)){l=null;t=navigator.languages||[navigator.language];
for(i=0;i<t.length&&l===null;i++){k=String(t[i]==null?"":t[i]).toLowerCase().split("-")[0];if(f.hasOwnProperty(k))l=k}}
if(l===null)l="ar";
for(i=0;i<f[l].length;i++){k=document.createElement("link");k.rel="modulepreload";k.href=f[l][i];document.head.appendChild(k)}
})();`;
}

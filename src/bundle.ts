import { Decision, normalizeStoredDecisions, cleanUserText } from './intelligence';
export const BUNDLE_SCHEMA='vinculivo-context-v1';
/** No raw document excerpts or credentials are added to portable bundles. */
export function exportContextBundle(project:string,decisions:readonly Decision[],head?:string,generatedAt=new Date().toISOString()):string{
  return JSON.stringify({schema:BUNDLE_SCHEMA,project:cleanUserText(project,100),generatedAt,gitHead:head??null,
    disclaimer:'Imported decisions require new review; this file is not independent proof.',
    decisions:decisions.map(d=>({...d,reviewedFingerprints:{},reviewedAt:undefined,reviewedHead:undefined,status:'proposed'}))},null,2)+'\n';
}
/** Treat imported JSON as an untrusted proposal. Never import acceptance assertions. */
export function importContextBundle(payload:unknown):Decision[]{
  if(!payload||typeof payload!=='object'){throw new Error('Invalid Vinculivo context bundle.');}
  const object=payload as Record<string,unknown>;
  if(object.schema!==BUNDLE_SCHEMA||!Array.isArray(object.decisions)){throw new Error('Unsupported context bundle schema.');}
  if(object.decisions.length>150){throw new Error('Too many decisions in bundle (limit 150).');}
  return normalizeStoredDecisions(object.decisions).map(d=>({...d,status:'proposed' as const,reviewedAt:undefined,reviewedHead:undefined,reviewedFingerprints:{}}));
}

import {GraphNode, ImpactAnalysis,SourceEvidence} from '../types';
import {SAMPLE_EVIDENCE_MAP} from '../data/sampleProject';
const slots=[['sample-checkout',21,37,'Order processing'],['sample-session',51,52,'Session management'],['sample-auth',79,34,'Token validation'],['sample-logger',42,80,'Logging']];
type Props={nodes:GraphNode[]; selected:GraphNode|null; analysis:ImpactAnalysis|null; onPick:(n:GraphNode)=>void; onEvidence:(e:SourceEvidence)=>void};
export function SampleMap({nodes,selected,analysis,onPick,onEvidence}:Props){
return <section className="atlas" aria-label="Interactive dependency map">
<div className="atlas-heading"><small>ORDER SERVICE / JAVA</small><h1>Dependency atlas</h1><p>Select a class to explore its connections.</p></div>
<div className="terrain"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="tip" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8" fill="#69cfbe"/></marker></defs>{['M21 37 C34 37 36 52 51 52','M51 52 C65 52 65 34 79 34'].map(d=><path key={d} d={d} fill="none" stroke="#6fa4a7" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}</svg>
{slots.map(([id,x,y,detail])=>{const n=nodes.find(v=>v.id===id);if(!n)return null;const tag=selected?.id===id?'Selected':analysis?.directDependents.some(d=>d.node.id===id)?'Direct dependent':analysis?.indirectDependents.some(d=>d.node.id===id)?'Indirect dependent':detail;return <button key={id} className={'landmark '+(selected?.id===id?'current':'')} style={{left:x+'%',top:y+'%'}} onClick={()=>onPick(n)}><b>{n.name}</b><span>{tag}</span></button>})}
{Object.values(SAMPLE_EVIDENCE_MAP).map((e,i)=><button key={e.edgeId} className={'edgeproof edge'+i} onClick={()=>onEvidence(e)} aria-label={'Open source: '+e.callerPath}>↗ <span>source</span></button>)}</div>
<div className="map-foot">4 classes <i/> 2 dependencies <span>Caller → dependency</span></div></section>}

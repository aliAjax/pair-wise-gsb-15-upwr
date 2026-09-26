import type {FlowEdge,FlowNode,ValidationIssue,Workflow} from '../types';
import {roles,users} from '../../mock-data/catalog';

// 结构指纹：只关心节点内容与连线，忽略坐标和校验态，用于候选冻结与基线比对
export const snapshotHash=(nodes:FlowNode[],edges:FlowEdge[]):string=>{
 const canon=JSON.stringify({
  n:nodes.map(n=>({id:n.id,type:n.type,label:n.data.label,config:n.data.config})).sort((a,b)=>a.id.localeCompare(b.id)),
  e:edges.map(e=>({s:e.source,t:e.target,l:e.label||''})).sort((a,b)=>(a.s+'>'+a.t).localeCompare(b.s+'>'+b.t))
 });
 let h=5381;for(let i=0;i<canon.length;i++)h=((h<<5)+h+canon.charCodeAt(i))>>>0;
 return h.toString(16).padStart(8,'0');
};

export const validateWorkflow=(nodes:FlowNode[],edges:FlowEdge[]):ValidationIssue[]=>{
 const issues:ValidationIssue[]=[];
 if(!nodes.some(n=>n.type==='end')) issues.push({nodeId:nodes[0]?.id||'flow',level:'error',message:'流程缺少结束节点'});
 const linked=new Set(edges.flatMap(e=>[e.source,e.target]));
 nodes.filter(n=>n.type!=='start'&&n.type!=='end'&&!linked.has(n.id)).forEach(n=>issues.push({nodeId:n.id,level:'error',message:'必经节点不能孤立'}));
 nodes.forEach(n=>{
  if(n.type==='condition'&&!n.data.config.ruleType)issues.push({nodeId:n.id,level:'error',message:'条件分支规则未配置'});
  if(n.type==='approval'&&!n.data.config.approverSource)issues.push({nodeId:n.id,level:'error',message:'审批人不能为空'});
 });
 return issues;
};

export interface Placeholder {nodeId:string;nodeLabel:string;kind:'member'|'role';value:string}
// 占位审批人：指定成员/固定角色的值不在正式人员与角色目录中，晋升前必须映射
export const findPlaceholders=(nodes:FlowNode[]):Placeholder[]=>nodes.filter(n=>n.type==='approval').flatMap(n=>{
 const c=n.data.config,out:Placeholder[]=[];
 if(c.approverSource==='指定成员'&&typeof c.member==='string'&&c.member&&!users.includes(c.member)) out.push({nodeId:n.id,nodeLabel:n.data.label,kind:'member',value:c.member});
 if(c.approverSource==='固定角色'&&typeof c.role==='string'&&c.role&&!roles.includes(c.role)) out.push({nodeId:n.id,nodeLabel:n.data.label,kind:'role',value:c.role});
 return out;
});

export interface ExperimentalField {nodeId:string;nodeLabel:string;fieldLabel:string}
export const findExperimentalFields=(nodes:FlowNode[]):ExperimentalField[]=>nodes.filter(n=>n.type==='form').flatMap(n=>((n.data.config.fields||[]) as any[]).filter(f=>f.experimental).map(f=>({nodeId:n.id,nodeLabel:n.data.label,fieldLabel:f.label})));

export interface NodeDiff {added:string[];removed:string[];changed:string[]}
export const diffNodes=(base:FlowNode[],current:FlowNode[]):NodeDiff=>({
 added:current.filter(n=>!base.some(x=>x.id===n.id)).map(n=>n.data.label),
 removed:base.filter(n=>!current.some(x=>x.id===n.id)).map(n=>n.data.label),
 changed:current.filter(n=>{const old=base.find(x=>x.id===n.id);return old&&JSON.stringify({t:old.type,l:old.data.label,c:old.data.config})!==JSON.stringify({t:n.type,l:n.data.label,c:n.data.config})}).map(n=>n.data.label)
});

export interface GateIssue {nodeId:string;nodeLabel:string;message:string}
export interface BaselineResult {ok:boolean;conflicts:string[];diff:NodeDiff}
export interface PromotionGate {issues:GateIssue[];placeholders:Placeholder[];baseline:BaselineResult}

// 晋升门禁：校验候选快照、收集占位审批人、确认草稿与正式版本自候选冻结后未再变化
export const evaluatePromotion=(w:Workflow):PromotionGate|null=>{
 const c=w.candidate;
 if(!c) return null;
 const label=(id:string)=>c.nodes.find(n=>n.id===id)?.data.label||'流程';
 const issues:GateIssue[]=[
  ...validateWorkflow(c.nodes,c.edges).filter(i=>i.level==='error').map(i=>({nodeId:i.nodeId,nodeLabel:label(i.nodeId),message:i.message})),
  ...findExperimentalFields(c.nodes).map(f=>({nodeId:f.nodeId,nodeLabel:f.nodeLabel,message:`试验字段未清理：${f.fieldLabel}`}))
 ];
 const conflicts:string[]=[];const diff=diffNodes(c.nodes,w.nodes);
 if(snapshotHash(w.nodes,w.edges)!==c.hash) conflicts.push(`候选冻结后草稿发生变化（新增 ${diff.added.length} · 删除 ${diff.removed.length} · 变更 ${diff.changed.length}）`);
 const latest=[...w.versions].sort((a,b)=>b.version-a.version)[0];
 if(latest&&(latest.version!==c.baseVersion||snapshotHash(latest.nodes,latest.edges)!==c.baseHash)) conflicts.push(`正式版本在候选冻结后已变化（基线 v${c.baseVersion} → 当前 v${latest.version}）`);
 if(!latest&&(c.baseVersion!==0||c.baseHash!=='')) conflicts.push('正式版本在候选冻结后已被移除');
 return {issues,placeholders:findPlaceholders(c.nodes),baseline:{ok:!conflicts.length,conflicts,diff}};
};

// 把映射后的正式人员写回候选快照，得到晋升版本内容
export const applyMapping=(nodes:FlowNode[],placeholders:Placeholder[],mapping:Record<string,string>):FlowNode[]=>nodes.map(n=>{
 const p=placeholders.find(x=>x.nodeId===n.id);
 if(!p||!mapping[n.id]) return n;
 return {...n,data:{...n.data,config:{...n.data.config,[p.kind==='member'?'member':'role']:mapping[n.id]}}};
});

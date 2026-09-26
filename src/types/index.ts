export type WorkflowStatus='draft'|'published'|'archived';
export type NodeKind='start'|'form'|'approval'|'condition'|'automation'|'notify'|'end';
export type NodeState='unconfigured'|'configuring'|'valid'|'invalid';
export interface FormField {id:string;label:string;type:'text'|'number'|'amount'|'date'|'select'|'attachment';required:boolean;options?:string[];experimental?:boolean}
export interface FlowNode {id:string;type:NodeKind;position:{x:number;y:number};data:{label:string;state:NodeState;config:Record<string,any>}}
export interface FlowEdge {id:string;source:string;target:string;label?:string}
export interface MappingEntry {nodeId:string;placeholder:string;target:string}
export interface Version {version:number;createdAt:string;note:string;nodes:FlowNode[];edges:FlowEdge[];source?:string;mapping?:MappingEntry[];promotedAt?:string}
export interface Candidate {id:string;version:number;createdAt:string;note:string;hash:string;baselineHash:string;nodes:FlowNode[];edges:FlowEdge[]}
export interface Promotion {id:string;candidateVersion:number;toVersion:number;promotedAt:string;mapping:MappingEntry[];note:string}
export interface PromoteConflict {nodeId:string;nodeLabel:string;message:string}
export interface Workflow {id:string;name:string;domain:string;status:WorkflowStatus;version:number;editor:string;updatedAt:string;publishedAt?:string;abnormalCount:number;nodes:FlowNode[];edges:FlowEdge[];versions:Version[];candidates:Candidate[];promotions:Promotion[];prodVersion?:number}
export interface Instance {id:string;workflowId:string;applicant:string;domain:string;currentNode:string;status:'abnormal'|'timeout'|'running'|'completed';submittedAt:string;duration:string;risk:'high'|'medium'|'low';timeline:{title:string;time:string;status:string}[]}
export interface ValidationIssue {nodeId:string;level:'error'|'warning';message:string}

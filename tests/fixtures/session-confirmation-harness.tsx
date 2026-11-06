import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ClinicalAuthModal} from '../../src/components/Modals/ClinicalAuthModal';
export function mountSession(dual=false) {
  const host=document.createElement('div');document.body.replaceChildren(host);
  (window as any).sessionCalls=0;
  function Harness() {
    const [open,setOpen]=useState(true);
    const [request]=useState(()=>({actionType:'DISPATCH_FEFO' as const,title:'Confirm test',description:'Test operation',targetItem:'Batch test',legalBasis:'',requiredRoles:['pharmacist' as const],requiresDualWitness:dual,dualWitnessRoles:['doctor' as const],onConfirm:async (signer:any,_witness:any,method:any)=>{(window as any).sessionCalls++;(window as any).confirmedSigner=signer;(window as any).confirmedMethod=method;}}));
    const props:any={isOpen:open,request,currentUserRole:'pharmacist',onClose:()=>setOpen(false),isAudioMuted:true,authenticatedUsername:'server-pharmacist'};
    return <ClinicalAuthModal {...props}/>;
  }
  createRoot(host).render(<Harness/>);
}

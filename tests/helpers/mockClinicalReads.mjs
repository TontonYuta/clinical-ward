import { tsImport } from 'tsx/esm/api';
const { INITIAL_PRESCRIPTIONS } = await tsImport('../../src/data/mockCpoeData.ts', import.meta.url);
const { INITIAL_PATIENTS } = await tsImport('../../src/services/patientService.ts', import.meta.url);
const orders = INITIAL_PRESCRIPTIONS.slice(1, 3).map(o => ({...o, patientEmail:'fixture@example.invalid', patientPhone:'0910000000'}));
const patients = INITIAL_PATIENTS.filter(p => orders.some(o => o.patientId===p.id)).map(p => ({...p,email:'fixture@example.invalid',phone:'0910000000'}));
const cold = {id:1,current_temp:4.5,is_outage:false,is_quarantined:false,vvm_level:1,mkt_temp:4.8,outage_minutes:0,total_vaccine_doses:20,logs:['00:00','04:00','08:00','12:00','16:00','20:00'].map(timestamp=>({timestamp,temperature:4.5}))};
const batches = [{id:'fixture-vaccine',item_name:'Vắc xin nguồn thử nghiệm',batch_number:'FIXTURE-EXPIRED',category:'Vắc xin',expiry_date:'2000-01-01',days_left:-1,current_stock:20,min_threshold:5,max_threshold:40,unit:'Lọ',warehouse_location:'Kho lạnh thử nghiệm',is_near_expiry:false,is_low_stock:false,is_quarantined:false,cold_storage_required:true,cold_storage_link_verified:true,cold_chain_state_id:1,is_dispatchable:false,dispatch_hold_reason:'Lô đã hết hạn sử dụng'}];
// Authoritative read fixtures for visual tests; unrelated/failed endpoints retain their configured failures.
// Production must never recover these records when an API is empty or unavailable.
export async function mockClinicalReads(context, overrides={}) {
 for(const [path,json] of Object.entries({'/api/v1/cpoe':orders,'/api/v1/patients':patients,'/api/v1/inventory/batches':batches,'/api/v1/coldchain/status':cold,...overrides})) {
  await context.route(url=>url.pathname===path,route=>route.fulfill({json}));
 }
}

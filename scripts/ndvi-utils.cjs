'use strict';
// Exploratory normalized colour difference. Calibration of viewer colours is unverified.
const NODATA=-32768;
function ndviProxy(red,nir){
  if(!Number.isInteger(red)||!Number.isInteger(nir)||red<=0||nir<=0||red>=255||nir>=255||red+nir<20)return NODATA;
  return Math.round((nir-red)/(nir+red)*10000);
}
function quantile(values,q){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);const i=(sorted.length-1)*q,a=Math.floor(i),b=Math.ceil(i);return sorted[a]+(sorted[b]-sorted[a])*(i-a);}
module.exports={NODATA,ndviProxy,quantile};

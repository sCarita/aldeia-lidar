'use strict';
// Shared by the viewer and the filter regression checks.
(function(root){
  function validRange(min,max){return Number.isFinite(min)&&Number.isFinite(max)&&min>=-1&&max<=1&&min<=max;}
  function matches(value,min,max){return validRange(min,max)&&Number.isFinite(value)&&value>=min-1e-7&&value<=max+1e-7&&value>=-1;}
  function treeMatches(tree,stat,height,min,max){return tree.height>=height&&matches(stat?.median,min,max);}
  const api={validRange,matches,treeMatches};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.VegetationFilters=api;
})(typeof window!=='undefined'?window:this);

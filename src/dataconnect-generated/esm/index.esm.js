import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'curalina',
  location: 'us-central1'
};

export const createDesignProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateDesignProject', inputVars);
}
createDesignProjectRef.operationName = 'CreateDesignProject';

export function createDesignProject(dcOrVars, vars) {
  return executeMutation(createDesignProjectRef(dcOrVars, vars));
}

export const listProductsByCategoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListProductsByCategory', inputVars);
}
listProductsByCategoryRef.operationName = 'ListProductsByCategory';

export function listProductsByCategory(dcOrVars, vars) {
  return executeQuery(listProductsByCategoryRef(dcOrVars, vars));
}

export const saveAiDesignRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'SaveAIDesign', inputVars);
}
saveAiDesignRef.operationName = 'SaveAIDesign';

export function saveAiDesign(dcOrVars, vars) {
  return executeMutation(saveAiDesignRef(dcOrVars, vars));
}

export const listMyDesignProjectsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListMyDesignProjects', inputVars);
}
listMyDesignProjectsRef.operationName = 'ListMyDesignProjects';

export function listMyDesignProjects(dcOrVars, vars) {
  return executeQuery(listMyDesignProjectsRef(dcOrVars, vars));
}


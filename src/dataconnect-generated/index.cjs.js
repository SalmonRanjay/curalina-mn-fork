const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'curalina',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const createDesignProjectRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateDesignProject', inputVars);
}
createDesignProjectRef.operationName = 'CreateDesignProject';
exports.createDesignProjectRef = createDesignProjectRef;

exports.createDesignProject = function createDesignProject(dcOrVars, vars) {
  return executeMutation(createDesignProjectRef(dcOrVars, vars));
};

const listProductsByCategoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListProductsByCategory', inputVars);
}
listProductsByCategoryRef.operationName = 'ListProductsByCategory';
exports.listProductsByCategoryRef = listProductsByCategoryRef;

exports.listProductsByCategory = function listProductsByCategory(dcOrVars, vars) {
  return executeQuery(listProductsByCategoryRef(dcOrVars, vars));
};

const saveAiDesignRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'SaveAIDesign', inputVars);
}
saveAiDesignRef.operationName = 'SaveAIDesign';
exports.saveAiDesignRef = saveAiDesignRef;

exports.saveAiDesign = function saveAiDesign(dcOrVars, vars) {
  return executeMutation(saveAiDesignRef(dcOrVars, vars));
};

const listMyDesignProjectsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListMyDesignProjects', inputVars);
}
listMyDesignProjectsRef.operationName = 'ListMyDesignProjects';
exports.listMyDesignProjectsRef = listMyDesignProjectsRef;

exports.listMyDesignProjects = function listMyDesignProjects(dcOrVars, vars) {
  return executeQuery(listMyDesignProjectsRef(dcOrVars, vars));
};

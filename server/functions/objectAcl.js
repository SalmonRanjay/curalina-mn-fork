"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectPermission = exports.ObjectAccessGroupType = void 0;
exports.setObjectAclPolicy = setObjectAclPolicy;
exports.getObjectAclPolicy = getObjectAclPolicy;
exports.canAccessObject = canAccessObject;
const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";
var ObjectAccessGroupType;
(function (ObjectAccessGroupType) {
})(ObjectAccessGroupType || (exports.ObjectAccessGroupType = ObjectAccessGroupType = {}));
var ObjectPermission;
(function (ObjectPermission) {
    ObjectPermission["READ"] = "read";
    ObjectPermission["WRITE"] = "write";
})(ObjectPermission || (exports.ObjectPermission = ObjectPermission = {}));
function isPermissionAllowed(requested, granted) {
    if (requested === ObjectPermission.READ) {
        return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
    }
    return granted === ObjectPermission.WRITE;
}
class BaseObjectAccessGroup {
    constructor(type, id) {
        this.type = type;
        this.id = id;
    }
}
function createObjectAccessGroup(group) {
    switch (group.type) {
        default:
            throw new Error(`Unknown access group type: ${group.type}`);
    }
}
async function setObjectAclPolicy(objectFile, aclPolicy) {
    const [exists] = await objectFile.exists();
    if (!exists) {
        throw new Error(`Object not found: ${objectFile.name}`);
    }
    await objectFile.setMetadata({
        metadata: {
            [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
        },
    });
}
async function getObjectAclPolicy(objectFile) {
    var _a;
    const [metadata] = await objectFile.getMetadata();
    const aclPolicy = (_a = metadata === null || metadata === void 0 ? void 0 : metadata.metadata) === null || _a === void 0 ? void 0 : _a[ACL_POLICY_METADATA_KEY];
    if (!aclPolicy) {
        return null;
    }
    return JSON.parse(aclPolicy);
}
async function canAccessObject({ userId, objectFile, requestedPermission, }) {
    const aclPolicy = await getObjectAclPolicy(objectFile);
    if (!aclPolicy) {
        return false;
    }
    if (aclPolicy.visibility === "public" &&
        requestedPermission === ObjectPermission.READ) {
        return true;
    }
    if (!userId) {
        return false;
    }
    if (aclPolicy.owner === userId) {
        return true;
    }
    for (const rule of aclPolicy.aclRules || []) {
        const accessGroup = createObjectAccessGroup(rule.group);
        if ((await accessGroup.hasMember(userId)) &&
            isPermissionAllowed(requestedPermission, rule.permission)) {
            return true;
        }
    }
    return false;
}

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";
export var ObjectAccessGroupType;
(function (ObjectAccessGroupType) {
})(ObjectAccessGroupType || (ObjectAccessGroupType = {}));
export var ObjectPermission;
(function (ObjectPermission) {
    ObjectPermission["READ"] = "read";
    ObjectPermission["WRITE"] = "write";
})(ObjectPermission || (ObjectPermission = {}));
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
export async function setObjectAclPolicy(objectFile, aclPolicy) {
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
export async function getObjectAclPolicy(objectFile) {
    const [metadata] = await objectFile.getMetadata();
    const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
    if (!aclPolicy) {
        return null;
    }
    return JSON.parse(aclPolicy);
}
export async function canAccessObject({ userId, objectFile, requestedPermission, }) {
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
//# sourceMappingURL=objectAcl.js.map
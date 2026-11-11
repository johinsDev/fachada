/** R2 layout of the SITES bucket. */
export const versionPrefix = (tenantId: string, versionId: string) =>
  `sites/${tenantId}/${versionId}`;
export const sourceKey = (tenantId: string, versionId: string) =>
  `${versionPrefix(tenantId, versionId)}/src.tar`;
export const distKey = (tenantId: string, versionId: string, path: string) =>
  `${versionPrefix(tenantId, versionId)}/dist/${path.replace(/^\/+/, "")}`;
export const draftKey = (tenantId: string) => `sites/${tenantId}/draft/src.tar`;

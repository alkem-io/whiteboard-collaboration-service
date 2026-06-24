export enum WhiteboardIntegrationEventPattern {
  CONTRIBUTION = 'contribution',
  CONTENT_MODIFIED = 'contentModified',
  SAVE = 'save',
  // Inbound: server -> this service. Emitted after a direct content write (e.g.
  // the MCP edit_whiteboard_elements / update_whiteboard_content tools), carrying
  // an optional versioned element delta. Server.applyExternalContentUpdate()
  // MERGES it into the open room's live snapshot via the normal reconcile path
  // (not a DB reload) and broadcasts a SCENE_UPDATE.
  CONTENT_UPDATED_EXTERNALLY = 'contentUpdatedExternally',
}

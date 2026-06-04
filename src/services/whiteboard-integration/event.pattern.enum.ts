export enum WhiteboardIntegrationEventPattern {
  CONTRIBUTION = 'contribution',
  CONTENT_MODIFIED = 'contentModified',
  SAVE = 'save',
  // Inbound: server -> this service. Emitted after a direct content write (e.g.
  // via the MCP update_whiteboard_content tool) so an open room reloads from DB.
  CONTENT_UPDATED_EXTERNALLY = 'contentUpdatedExternally',
}

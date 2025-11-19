# Guest User Collaboration Feature

## Overview

This feature enables guest users (non-authenticated users) to collaborate on whiteboards by providing a guest name instead of using authentication credentials.

## Summary of Changes

### 1. User Information Model Enhancement

**File**: `src/services/whiteboard-integration/user.info.ts`

- Added optional `guestName` field to the `UserInfo` type
- Allows users to be identified either by authenticated credentials or by a guest name

### 2. Socket Connection Initialization

**File**: `src/excalidraw-backend/middlewares/init.user.data.middleware.ts`

- Updated socket data initialization to include `guestName` field
- Initializes with 'not-initialized' placeholder value alongside existing `id` and `email` fields

### 3. Authentication Input Handling

**File**: `src/services/whiteboard-integration/inputs/who.input.data.ts`

- Extended authentication input to accept `guestName` as an optional parameter
- Supports three authentication methods: cookie, authorization header, and guest name

**File**: `src/services/whiteboard-integration/inputs/info.input.data.ts`

- Added optional `guestName` parameter to room information requests
- Allows guest users to request room access permissions

### 4. User Info Retrieval Logic

**File**: `src/services/util/util.service.ts`

- Modified `getUserInfo()` method to handle guest authentication:
  1. Prioritizes authorization header if present
  2. Falls back to guest name if provided
  3. Falls back to cookie authentication
  4. Returns empty user info if none available

- Updated `getUserInfoForRoom()` to accept and pass through `guestName` parameter

### 5. Server-Level Integration

**File**: `src/excalidraw-backend/server.ts`

- Modified room authorization callback to accept `guestName` parameter
- Extracts `guestName` from WebSocket handshake authentication data (`socket.handshake.auth.guestName`)
- Passes guest name to user info retrieval service

### 6. Room Authorization Handler

**File**: `src/excalidraw-backend/utils/handlers.ts`

- Updated `authorizeWithRoomOrFailAndJoinHandler` signature to accept `guestName`
- Passes guest name from socket user data to room info retrieval

## Authentication Flow for Guest Users

1. Guest user connects via WebSocket with `guestName` in handshake auth
2. Server extracts guest name during connection establishment
3. Socket data is initialized with guest name
4. When joining a room, guest name is passed through authorization chain:
   - `authorizeWithRoomOrFailAndJoinHandler` receives guest name
   - Calls `getUserInfoForRoom` with guest name
   - Integration service validates guest access to whiteboard room
5. Guest user gains read/update permissions based on whiteboard settings

## Key Benefits

- **No Authentication Required**: Guest users can collaborate without creating accounts
- **User Identification**: Guests are identifiable by their chosen guest name
- **Backward Compatible**: Existing authentication methods (cookie, authorization header) continue to work
- **Flexible Access Control**: Room permissions can be configured for guest users

## Technical Notes

- Guest name is optional throughout the system to maintain backward compatibility
- Priority order for authentication: authorization header → guest name → cookie
- Guest users follow the same room authorization and permission checks as authenticated users

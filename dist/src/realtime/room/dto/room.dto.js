"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOM_PARTICIPANT_ROLES = void 0;
exports.mapAuthRoleToParticipantRole = mapAuthRoleToParticipantRole;
exports.parseRoomStatus = parseRoomStatus;
exports.parseParticipantRole = parseParticipantRole;
exports.assertNonEmptyString = assertNonEmptyString;
exports.optionalTrimmedString = optionalTrimmedString;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
exports.ROOM_PARTICIPANT_ROLES = ['HOST', 'MENTOR', 'LEARNER'];
function mapAuthRoleToParticipantRole(role) {
    if (role === 'MENTOR') {
        return 'MENTOR';
    }
    if (role === 'CREATOR') {
        return 'HOST';
    }
    return 'LEARNER';
}
function parseRoomStatus(value) {
    if (!value) {
        return undefined;
    }
    const status = value.toUpperCase();
    if (!Object.values(client_1.RoomStatus).includes(status)) {
        throw new common_1.BadRequestException('Invalid room status');
    }
    return status;
}
function parseParticipantRole(value) {
    if (!value) {
        return 'LEARNER';
    }
    const role = value.toUpperCase();
    if (!exports.ROOM_PARTICIPANT_ROLES.includes(role)) {
        throw new common_1.BadRequestException('Invalid participant role');
    }
    return role;
}
function assertNonEmptyString(value, fieldName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new common_1.BadRequestException(`${fieldName} is required`);
    }
    return value.trim();
}
function optionalTrimmedString(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new common_1.BadRequestException('Expected string value');
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
//# sourceMappingURL=room.dto.js.map
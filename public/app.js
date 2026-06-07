const state = {
  socket: null,
  token: localStorage.getItem('lucyRealtimeToken') || '',
  currentRoomId: '',
  currentRoomName: '',
  participants: [],
  serverUser: null,
};

const el = {
  lobbyView: document.querySelector('#lobbyView'),
  meetingView: document.querySelector('#meetingView'),
  tokenInput: document.querySelector('#tokenInput'),
  devNameInput: document.querySelector('#devNameInput'),
  devRoleInput: document.querySelector('#devRoleInput'),
  devUserIdInput: document.querySelector('#devUserIdInput'),
  saveTokenButton: document.querySelector('#saveTokenButton'),
  connectButton: document.querySelector('#connectButton'),
  connectionState: document.querySelector('#connectionState'),
  meetingStatus: document.querySelector('#meetingStatus'),
  authModeValue: document.querySelector('#authModeValue'),
  serverUserValue: document.querySelector('#serverUserValue'),
  serverRoleValue: document.querySelector('#serverRoleValue'),
  serverUserIdValue: document.querySelector('#serverUserIdValue'),
  roomStateValue: document.querySelector('#roomStateValue'),
  lobbyNotice: document.querySelector('#lobbyNotice'),
  meetingNotice: document.querySelector('#meetingNotice'),
  roomNameInput: document.querySelector('#roomNameInput'),
  roomLevelInput: document.querySelector('#roomLevelInput'),
  roomIdInput: document.querySelector('#roomIdInput'),
  createRoomButton: document.querySelector('#createRoomButton'),
  refreshRoomsButton: document.querySelector('#refreshRoomsButton'),
  joinButton: document.querySelector('#joinButton'),
  leaveButton: document.querySelector('#leaveButton'),
  raiseHandButton: document.querySelector('#raiseHandButton'),
  lowerHandButton: document.querySelector('#lowerHandButton'),
  muteButton: document.querySelector('#muteButton'),
  unmuteButton: document.querySelector('#unmuteButton'),
  endRoomButton: document.querySelector('#endRoomButton'),
  clearLogButton: document.querySelector('#clearLogButton'),
  currentRoomLabel: document.querySelector('#currentRoomLabel'),
  speakerAvatar: document.querySelector('#speakerAvatar'),
  speakerName: document.querySelector('#speakerName'),
  speakerMeta: document.querySelector('#speakerMeta'),
  participantCount: document.querySelector('#participantCount'),
  roomList: document.querySelector('#roomList'),
  participantList: document.querySelector('#participantList'),
  eventLog: document.querySelector('#eventLog'),
};

el.tokenInput.value = state.token;

function log(event, payload) {
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] ${event}\n${JSON.stringify(payload, null, 2)}\n\n`;
  el.eventLog.textContent = line + el.eventLog.textContent;
}

function getToken() {
  return el.tokenInput.value.trim();
}

function getAuthMode() {
  return getToken() ? 'JWT' : 'Dev';
}

function getDevUser() {
  return {
    devUserId: el.devUserIdInput.value.trim() || 'dev-learner-1',
    devRole: el.devRoleInput.value,
    devDisplayName: el.devNameInput.value.trim() || 'Demo Learner',
  };
}

function setConnection(online, text) {
  el.connectionState.textContent = online ? 'Online' : 'Offline';
  el.connectionState.classList.toggle('online', online);
  el.meetingStatus.textContent = text || (online ? 'Connected' : 'Offline');
  renderStatusCard();
}

function showNotice(message, tone = 'error') {
  const activeNotice = el.meetingView.classList.contains('hidden')
    ? el.lobbyNotice
    : el.meetingNotice;

  activeNotice.textContent = message;
  activeNotice.classList.remove('hidden', 'error', 'success');
  activeNotice.classList.add(tone);
}

function clearNotice() {
  for (const notice of [el.lobbyNotice, el.meetingNotice]) {
    notice.textContent = '';
    notice.classList.add('hidden');
    notice.classList.remove('error', 'success');
  }
}

function renderStatusCard() {
  el.authModeValue.textContent = getAuthMode();
  el.serverUserValue.textContent =
    state.serverUser?.displayName || 'Not connected';
  el.serverRoleValue.textContent = state.serverUser?.role || '-';
  el.serverUserIdValue.textContent = state.serverUser?.userId || '-';
  el.roomStateValue.textContent = state.currentRoomId
    ? `Joined ${state.currentRoomName || state.currentRoomId}`
    : 'Not joined';
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    const devUser = getDevUser();
    headers['x-dev-user-id'] = devUser.devUserId;
    headers['x-dev-role'] = devUser.devRole;
    headers['x-dev-display-name'] = devUser.devDisplayName;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message || response.statusText);
  }

  return body;
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    if (state.socket?.connected) {
      resolve(state.socket);
      return;
    }

    if (state.socket) {
      state.socket.disconnect();
    }

    const token = getToken();
    const devUser = getDevUser();
    const socket = io({
      auth: token
        ? { token }
        : {
            devUserId: devUser.devUserId,
            devRole: devUser.devRole,
            devDisplayName: devUser.devDisplayName,
          },
      transports: ['websocket', 'polling'],
    });

    state.socket = socket;

    socket.once('connect', () => {
      setConnection(true, `Connected as ${socket.id}`);
      showNotice(
        'Socket connected. You can create or join a room now.',
        'success',
      );
      log('socket:connect', { socketId: socket.id });
      resolve(socket);
    });

    socket.once('connect_error', (error) => {
      setConnection(false, error.message);
      showNotice(error.message || 'Socket connection failed');
      log('socket:connect_error', { message: error.message });
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      setConnection(false, reason);
      state.serverUser = null;
      renderStatusCard();
      showNotice(`Socket disconnected: ${reason}`);
      log('socket:disconnect', { reason });
    });

    socket.on('connected', (payload) => {
      state.serverUser = payload?.user || null;
      renderStatusCard();
      log('connected', payload);
    });
    socket.on('exception', (payload) => {
      const message =
        payload?.message || payload?.error || 'Realtime action failed';
      showNotice(message);
      log('exception', payload);
    });
    socket.on('participant_list_updated', (participants) => {
      state.participants = participants || [];
      renderParticipants();
      log('participant_list_updated', participants);
    });
    socket.on('user_joined', (payload) => log('user_joined', payload));
    socket.on('user_left', (payload) => log('user_left', payload));
    socket.on('hand_raised', (payload) => log('hand_raised', payload));
    socket.on('hand_lowered', (payload) => log('hand_lowered', payload));
    socket.on('mic_muted', (payload) => log('mic_muted', payload));
    socket.on('mic_unmuted', (payload) => log('mic_unmuted', payload));
    socket.on('speaker_approved', (payload) =>
      log('speaker_approved', payload),
    );
    socket.on('speaker_removed', (payload) => log('speaker_removed', payload));
    socket.on('agora_token_refreshed', (payload) =>
      log('agora_token_refreshed', payload),
    );
    socket.on('room_ended', (payload) => {
      log('room_ended', payload);
      showLobby();
    });
  });
}

async function emit(event, payload = {}) {
  try {
    await connectSocket();
  } catch {
    return;
  }

  return new Promise((resolve) => {
    state.socket.timeout(5000).emit(event, payload, (error, response) => {
      if (error) {
        showNotice(`No response for ${event}. Please try again.`);
        log(`${event}:timeout`, { message: error.message || 'timeout' });
        resolve(null);
        return;
      }

      log(`${event}:ack`, response);

      if (response?.error || response?.message === 'Forbidden') {
        showNotice(response.error || response.message || `${event} failed`);
        resolve(response);
        return;
      }

      if (event === 'join_room' && response?.success) {
        clearNotice();
        state.currentRoomId = response.room.id;
        state.currentRoomName = response.room.name || response.room.id;
        state.participants = response.participants || [];
        renderStatusCard();
        showMeeting();
        renderParticipants();
      } else if (event === 'leave_room' && response?.success) {
        clearNotice();
        state.currentRoomId = '';
        state.currentRoomName = '';
        state.participants = [];
        renderStatusCard();
        showLobby();
        renderParticipants();
      } else if (response?.success) {
        showNotice(`${event.replaceAll('_', ' ')} succeeded.`, 'success');
      }

      resolve(response);
    });
  });
}

async function refreshRooms() {
  try {
    const rooms = await api('/api/rooms');
    clearNotice();
    renderRooms(rooms);
    log('rooms:list', rooms);
  } catch (error) {
    showNotice(error.message);
    log('rooms:error', { message: error.message });
  }
}

function renderRooms(rooms) {
  el.roomList.innerHTML = '';

  if (!rooms.length) {
    el.roomList.innerHTML = '<div class="meta">No rooms yet</div>';
    return;
  }

  for (const room of rooms) {
    const item = document.createElement('div');
    item.className = 'room-item';
    item.innerHTML = `
      <strong>${escapeHtml(room.name)}</strong>
      <div class="meta">${escapeHtml(room.id)}</div>
      <div class="meta">${escapeHtml(room.status)}${room.level ? ` · ${escapeHtml(room.level)}` : ''}</div>
    `;
    item.addEventListener('click', () => {
      el.roomIdInput.value = room.id;
      state.currentRoomId = room.id;
      state.currentRoomName = room.name || room.id;
    });
    el.roomList.appendChild(item);
  }
}

function renderParticipants() {
  el.participantList.innerHTML = '';
  el.participantCount.textContent = String(state.participants.length);

  if (!state.participants.length) {
    setSpeaker(null);
    el.participantList.innerHTML =
      '<div class="meta">No participants in this room</div>';
    return;
  }

  const speaker =
    state.participants.find((participant) => participant.isSpeaker) ||
    state.participants[0];
  setSpeaker(speaker);

  for (const participant of state.participants) {
    const name = participant.displayName || participant.userId;
    const item = document.createElement('div');
    item.className = 'participant';
    item.innerHTML = `
      <div class="avatar">${initials(name)}</div>
      <div>
        <strong>${escapeHtml(name)}</strong>
        <div class="meta">${escapeHtml(participant.role)}</div>
        <div class="badges">
          ${participant.isSpeaker ? '<span class="badge speaker">Speaker</span>' : ''}
          ${participant.isHandRaised ? '<span class="badge hand">Hand raised</span>' : ''}
          <span class="badge ${participant.isMicOn ? 'mic' : 'muted'}">${participant.isMicOn ? 'Mic on' : 'Muted'}</span>
        </div>
      </div>
      <div class="participant-actions">
        <button type="button" data-action="approve">Approve</button>
        <button type="button" data-action="remove">Remove</button>
        <button type="button" data-action="mute">Mute</button>
      </div>
    `;

    item
      .querySelector('[data-action="approve"]')
      .addEventListener('click', () =>
        emit('approve_speaker', { targetUserId: participant.userId }),
      );
    item
      .querySelector('[data-action="remove"]')
      .addEventListener('click', () =>
        emit('remove_speaker', { targetUserId: participant.userId }),
      );
    item
      .querySelector('[data-action="mute"]')
      .addEventListener('click', () =>
        emit('mute_mic', { targetUserId: participant.userId }),
      );

    el.participantList.appendChild(item);
  }
}

function setSpeaker(participant) {
  if (!participant) {
    el.speakerAvatar.textContent = 'L';
    el.speakerName.textContent = 'Waiting for participants';
    el.speakerMeta.textContent = 'Join a room to start the session';
    return;
  }

  const name = participant.displayName || participant.userId;
  el.speakerAvatar.textContent = initials(name);
  el.speakerName.textContent = name;
  el.speakerMeta.textContent = participant.isSpeaker
    ? 'Speaking now'
    : 'In the room';
}

function showMeeting() {
  el.lobbyView.classList.add('hidden');
  el.meetingView.classList.remove('hidden');
  el.currentRoomLabel.textContent =
    state.currentRoomName || state.currentRoomId;
  renderStatusCard();
  clearNotice();
}

function showLobby() {
  el.meetingView.classList.add('hidden');
  el.lobbyView.classList.remove('hidden');
  renderStatusCard();
  refreshRooms();
}

function initials(value) {
  const words = String(value || 'L')
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase()).join('') || 'L';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[char];
  });
}

el.saveTokenButton.addEventListener('click', () => {
  state.token = getToken();
  localStorage.setItem('lucyRealtimeToken', state.token);
  renderStatusCard();
  showNotice('Token saved locally for this browser.', 'success');
  log('token:saved', { hasToken: Boolean(state.token) });
});

el.connectButton.addEventListener('click', () => {
  connectSocket().catch(() => undefined);
});

el.devRoleInput.addEventListener('change', () => {
  const role = el.devRoleInput.value;
  if (role === 'LUCY') {
    el.devNameInput.value = 'Demo Learner';
    el.devUserIdInput.value = 'dev-learner-1';
  } else if (role === 'LUCY_PRO') {
    el.devNameInput.value = 'Demo Mentor';
    el.devUserIdInput.value = 'dev-mentor-1';
  } else {
    el.devNameInput.value = 'Demo Creator';
    el.devUserIdInput.value = 'dev-creator-1';
  }
});

el.refreshRoomsButton.addEventListener('click', refreshRooms);
el.clearLogButton.addEventListener('click', () => {
  el.eventLog.textContent = '';
});

el.createRoomButton.addEventListener('click', async () => {
  try {
    const room = await api('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({
        name: el.roomNameInput.value.trim() || 'LUCY Practice Room',
        level: el.roomLevelInput.value.trim() || undefined,
      }),
    });
    el.roomIdInput.value = room.id;
    state.currentRoomId = room.id;
    state.currentRoomName = room.name || room.id;
    showNotice('Room created successfully. You can join it now.', 'success');
    log('room:created', room);
    await refreshRooms();
  } catch (error) {
    showNotice(error.message);
    log('room:create_error', { message: error.message });
  }
});

el.joinButton.addEventListener('click', () => {
  const roomId = el.roomIdInput.value.trim();
  if (!roomId) {
    showNotice('Please choose a room before joining.');
    return;
  }

  emit('join_room', {
    roomId,
    isAnonymous: true,
  });
});

el.leaveButton.addEventListener('click', () => emit('leave_room'));
el.raiseHandButton.addEventListener('click', () => emit('raise_hand'));
el.lowerHandButton.addEventListener('click', () => emit('lower_hand'));
el.muteButton.addEventListener('click', () => emit('mute_mic'));
el.unmuteButton.addEventListener('click', () => emit('unmute_mic'));
el.endRoomButton.addEventListener('click', () => emit('end_room'));

renderParticipants();
renderStatusCard();
refreshRooms();

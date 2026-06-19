import { useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { io } from 'socket.io-client';
import {
  API_BASE_URL,
  buildAgoraChannelName,
  createAgoraClients,
  fetchAgoraToken,
  getJoinMediaType,
  resolveAgoraIdentity,
} from './agoraClient';

const pathname = window.location.pathname;
const recorderMatch = pathname.match(/^\/recorder\/session\/([^/]+)$/);
const recorderSessionId = recorderMatch
  ? decodeURIComponent(recorderMatch[1])
  : '';
const recorderParams = new URLSearchParams(window.location.search);
const isRecorderRoute = Boolean(recorderMatch);

const initialForm = {
  sessionId: recorderSessionId || 'session-alpha',
  anonymousUserId: recorderParams.get('anonymousUserId') || 'SUPER-001',
  displayName: recorderParams.get('displayName') || 'Recorder View',
  role: recorderParams.get('role') || 'SUPER',
};

const initialSession = {
  sessionId: '',
  participants: [],
  handRaiseQueue: [],
  activeSpeakerIds: [],
  recordingStatus: 'IDLE',
  onlineCount: 0,
};

const initialAgoraState = {
  status: 'idle',
  joined: false,
  publishRole: 'audience',
  channelName: '',
  appId: '',
  warning: '',
};

const eventNames = [
  'presence.updated',
  'hand.raise',
  'hand.queue.updated',
  'speaker.approved',
  'media.status.changed',
  'screen.share.started',
  'screen.share.stopped',
  'recording.status.changed',
];

function VideoSurface({ track, label, hint, tall = false }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;

    if (!track) {
      return undefined;
    }

    const mediaStreamTrack =
      typeof track.getMediaStreamTrack === 'function'
        ? track.getMediaStreamTrack()
        : null;

    if (video && mediaStreamTrack) {
      const stream = new MediaStream([mediaStreamTrack]);
      video.srcObject = stream;
      const playPromise = video.play();
      if (playPromise?.catch) {
        playPromise.catch(() => undefined);
      }

      return () => {
        if (video.srcObject) {
          video.pause();
          video.srcObject = null;
        }
      };
    }

    if (!container) {
      return undefined;
    }

    track.play(container);
    return () => {
      track.stop();
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [track]);

  return (
    <div className={`video-surface ${tall ? 'tall' : ''}`}>
      <div ref={containerRef} className="video-canvas">
        <video ref={videoRef} autoPlay muted playsInline />
      </div>
      {!track ? (
        <div className="video-empty">
          <strong>{label}</strong>
          <span>{hint}</span>
        </div>
      ) : (
        <div className="video-caption">
          <strong>{label}</strong>
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [socketState, setSocketState] = useState('connecting');
  const [joined, setJoined] = useState(false);
  const [session, setSession] = useState(initialSession);
  const [handQueue, setHandQueue] = useState([]);
  const [eventLog, setEventLog] = useState([]);
  const [notice, setNotice] = useState('');
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraPublished, setCameraPublished] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('IDLE');
  const [agoraState, setAgoraState] = useState(initialAgoraState);
  const [localCameraTrack, setLocalCameraTrack] = useState(null);
  const [localScreenTrack, setLocalScreenTrack] = useState(null);
  const [remoteMedia, setRemoteMedia] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [playbackSession, setPlaybackSession] = useState(null);

  const socketRef = useRef(null);
  const formRef = useRef(form);
  const sessionRef = useRef(session);
  const agoraStateRef = useRef(agoraState);
  const agoraRef = useRef({
    mainClient: null,
    screenClient: null,
    microphoneTrack: null,
    cameraTrack: null,
    screenTrack: null,
  });

  const canApprove = form.role === 'SUPER' || form.role === 'HOST';
  const canPublishMedia =
    form.role !== 'STUDENT' ||
    session.activeSpeakerIds.includes(form.anonymousUserId);
  const isSuper = form.role === 'SUPER';
  const isCameraPreviewOnly = cameraEnabled && !cameraPublished;
  const channelName = useMemo(
    () => (form.sessionId ? buildAgoraChannelName(form.sessionId) : ''),
    [form.sessionId],
  );

  const remoteScreen = remoteMedia.find((item) => item.isScreen);
  const remoteVideos = remoteMedia.filter((item) => !item.isScreen);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    agoraStateRef.current = agoraState;
  }, [agoraState]);

  useEffect(() => {
    if (
      isRecorderRoute &&
      socketState === 'connected' &&
      !joined &&
      formRef.current.sessionId
    ) {
      handleJoinSession();
    }
  }, [joined, socketState]);

  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    const { mainClient, screenClient } = createAgoraClients();
    agoraRef.current.mainClient = mainClient;
    agoraRef.current.screenClient = screenClient;

    const onUserPublished = async (user, mediaType) => {
      try {
        await mainClient.subscribe(user, mediaType);

        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
        }

        if (mediaType === 'video' && user.videoTrack) {
          const identity = resolveAgoraIdentity(
            formRef.current.sessionId,
            sessionRef.current.participants,
            Number(user.uid),
          );

          setRemoteMedia((current) => {
            const nextItem = {
              uid: Number(user.uid),
              videoTrack: user.videoTrack,
              anonymousUserId: identity.anonymousUserId,
              displayName: identity.displayName,
              role: identity.role,
              isScreen: identity.isScreen,
            };

            const next = current.filter((item) => item.uid !== nextItem.uid);
            next.push(nextItem);
            return next;
          });
        }
      } catch (error) {
        pushLog('agora.user_published.error', {
          message: error.message,
          uid: user.uid,
          mediaType,
        });
      }
    };

    const onUserUnpublished = (user, mediaType) => {
      pushLog('agora.user_unpublished', { uid: user.uid, mediaType });
      if (mediaType === 'video') {
        setRemoteMedia((current) =>
          current.filter((item) => item.uid !== Number(user.uid)),
        );
      }
    };

    const onUserLeft = (user) => {
      pushLog('agora.user_left', { uid: user.uid });
      setRemoteMedia((current) =>
        current.filter((item) => item.uid !== Number(user.uid)),
      );
    };

    mainClient.on('user-published', onUserPublished);
    mainClient.on('user-unpublished', onUserUnpublished);
    mainClient.on('user-left', onUserLeft);

    socket.on('connect', () => {
      setSocketState('connected');
      pushLog('socket.connect', { socketId: socket.id });
      setNotice('Socket connected. Session control is ready.');
    });

    socket.on('disconnect', async (reason) => {
      setSocketState('disconnected');
      pushLog('socket.disconnect', { reason });
      setNotice(`Socket disconnected: ${reason}`);
      setJoined(false);
      await leaveAgora();
    });

    socket.on('connect_error', (error) => {
      setSocketState('error');
      pushLog('socket.connect_error', { message: error.message });
      setNotice(error.message || 'Socket connection failed.');
    });

    for (const eventName of eventNames) {
      socket.on(eventName, (payload) => {
        handleRealtimeEvent(eventName, payload);
      });
    }

    return () => {
      for (const eventName of eventNames) {
        socket.off(eventName);
      }
      mainClient.off('user-published', onUserPublished);
      mainClient.off('user-unpublished', onUserUnpublished);
      mainClient.off('user-left', onUserLeft);
      leaveAgora().finally(() => {
        socket.disconnect();
      });
    };
  }, []);

  function pushLog(eventName, payload) {
    setEventLog((current) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        eventName,
        payload,
        at: new Date().toLocaleTimeString(),
      },
      ...current,
    ]);
  }

  function handleRealtimeEvent(eventName, payload) {
    pushLog(eventName, payload);

    if (eventName === 'presence.updated' && payload?.session) {
      setSession(payload.session);
      setRecordingStatus(payload.session.recordingStatus);
      return;
    }

    if (eventName === 'hand.queue.updated') {
      setHandQueue(payload?.queuedParticipants ?? []);
      return;
    }

    if (eventName === 'recording.status.changed') {
      setRecordingStatus(payload?.status ?? 'IDLE');
      if (formRef.current.sessionId) {
        fetchRecordings(formRef.current.sessionId);
      }
    }
  }

  async function fetchJson(path, options) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.message || 'Request failed.');
    }

    return data;
  }

  async function fetchRecordings(sessionId = formRef.current.sessionId) {
    if (!sessionId) {
      return;
    }

    try {
      const data = await fetchJson(
        `/api/sessions/${sessionId}/recordings?anonymousUserId=${encodeURIComponent(
          formRef.current.anonymousUserId,
        )}`,
      );
      setRecordings(data);
      pushLog('recordings.list', {
        sessionId,
        count: data.length,
      });
    } catch (error) {
      setNotice(error.message || 'Unable to load recordings.');
      pushLog('recordings.list.error', { message: error.message });
    }
  }

  async function emitWithAck(eventName, payload) {
    const socket = socketRef.current;
    if (!socket) {
      setNotice('Socket is not ready.');
      return null;
    }

    return new Promise((resolve) => {
      socket.timeout(5000).emit(eventName, payload, (error, response) => {
        if (error) {
          pushLog(`${eventName}.timeout`, { message: error.message });
          setNotice(`No response for ${eventName}.`);
          resolve(null);
          return;
        }

        pushLog(`${eventName}.ack`, response);
        if (!response?.success) {
          setNotice(response?.message || `${eventName} failed.`);
          resolve(response);
          return;
        }

        setNotice(`${eventName} succeeded.`);
        resolve(response);
      });
    });
  }

  async function joinAgora(joinSnapshot, forcePublishRole) {
    const mainClient = agoraRef.current.mainClient;
    if (!mainClient) {
      return;
    }

    const publishRole =
      forcePublishRole ??
      getJoinMediaType(
        formRef.current.role,
        canPublishForSnapshot(joinSnapshot),
      );
    const activeForm = formRef.current;
    const nextChannelName = buildAgoraChannelName(activeForm.sessionId);

    try {
      if (mainClient.connectionState !== 'DISCONNECTED') {
        await leaveAgoraMainClient();
      }

      setAgoraState((current) => ({
        ...current,
        status: 'connecting',
        warning: '',
      }));

      const tokenPayload = {
        sessionId: activeForm.sessionId,
        channelName: nextChannelName,
        anonymousUserId: activeForm.anonymousUserId,
        role: activeForm.role,
        mediaType: publishRole,
      };
      const tokenResponse = await fetchAgoraToken(tokenPayload);

      await mainClient.join(
        tokenResponse.appId,
        tokenResponse.channelName,
        tokenResponse.token,
        tokenResponse.uid,
      );
      await mainClient.setClientRole(
        publishRole === 'audience' ? 'audience' : 'host',
      );

      setAgoraState({
        status: 'connected',
        joined: true,
        publishRole,
        channelName: tokenResponse.channelName,
        appId: tokenResponse.appId,
        warning: '',
      });
      pushLog('agora.joined', {
        channelName: tokenResponse.channelName,
        uid: tokenResponse.uid,
        publishRole,
      });
    } catch (error) {
      setAgoraState({
        status: 'warning',
        joined: false,
        publishRole: 'audience',
        channelName: nextChannelName,
        appId: '',
        warning: error.message,
      });
      setNotice(error.message);
      pushLog('agora.join.failed', { message: error.message });
    }
  }

  async function leaveAgoraMainClient() {
    const mainClient = agoraRef.current.mainClient;
    if (!mainClient) {
      return;
    }

    await stopLocalMicrophone(false);
    await stopLocalCamera(false);
    if (mainClient.connectionState !== 'DISCONNECTED') {
      await mainClient.leave();
    }

    setRemoteMedia([]);
    setAgoraState((current) => ({
      ...current,
      joined: false,
      status: 'idle',
      publishRole: 'audience',
    }));
  }

  async function leaveAgora() {
    await stopScreenShare(false);
    await leaveAgoraMainClient();
    setLocalCameraTrack(null);
    setLocalScreenTrack(null);
  }

  async function ensurePublisherRole() {
    if (!canPublishMedia) {
      throw new Error('Student must be approved before publishing audio, video, or screen.');
    }

    const desiredRole = formRef.current.role === 'STUDENT' ? 'speaker' : 'host';
    if (
      agoraStateRef.current.joined &&
      agoraStateRef.current.publishRole === desiredRole
    ) {
      return;
    }

    const currentSession = sessionRef.current;
    await joinAgora(currentSession, desiredRole);

    if (agoraRef.current.mainClient?.connectionState !== 'CONNECTED') {
      throw new Error('Agora main client is not connected.');
    }
  }

  function canPublishForSnapshot(snapshot) {
    return (
      formRef.current.role !== 'STUDENT' ||
      snapshot.activeSpeakerIds.includes(formRef.current.anonymousUserId)
    );
  }

  async function handleJoinSession() {
    const response = await emitWithAck('session.join', form);
    if (!response?.success) {
      return;
    }

    setJoined(true);
    setSession(response.session);
    setRecordingStatus(response.session.recordingStatus);
    setHandQueue(queueFromSnapshot(response.session));
    await fetchRecordings(response.session.sessionId);
    await joinAgora(response.session);
  }

  async function handleLeaveSession() {
    const response = await emitWithAck('session.leave', {
      sessionId: form.sessionId,
    });
    if (!response?.success) {
      return;
    }

    await leaveAgora();
    setJoined(false);
    setSession(initialSession);
    setHandQueue([]);
    setMicEnabled(false);
    setCameraEnabled(false);
    setCameraPublished(false);
    setScreenSharing(false);
    setRecordings([]);
  }

  async function startLocalMicrophone() {
    if (agoraRef.current.microphoneTrack) {
      return agoraRef.current.microphoneTrack;
    }

    const track = await AgoraRTC.createMicrophoneAudioTrack();
    agoraRef.current.microphoneTrack = track;
    return track;
  }

  async function stopLocalMicrophone(syncStatus = true) {
    const mainClient = agoraRef.current.mainClient;
    const track = agoraRef.current.microphoneTrack;
    if (track && mainClient) {
      await mainClient.unpublish(track).catch(() => undefined);
      track.close();
    }
    agoraRef.current.microphoneTrack = null;
    setMicEnabled(false);

    if (syncStatus && joined) {
      await emitWithAck('media.status.changed', {
        sessionId: formRef.current.sessionId,
        micEnabled: false,
        cameraEnabled,
      });
    }
  }

  async function startLocalCamera() {
    if (agoraRef.current.cameraTrack) {
      return agoraRef.current.cameraTrack;
    }

    const track = await AgoraRTC.createCameraVideoTrack();
    agoraRef.current.cameraTrack = track;
    setLocalCameraTrack(track);
    return track;
  }

  async function stopLocalCamera(syncStatus = true) {
    const mainClient = agoraRef.current.mainClient;
    const track = agoraRef.current.cameraTrack;
    if (track && mainClient) {
      await mainClient.unpublish(track).catch(() => undefined);
      track.close();
    }
    agoraRef.current.cameraTrack = null;
    setLocalCameraTrack(null);
    setCameraEnabled(false);
    setCameraPublished(false);

    if (syncStatus && joined) {
      await emitWithAck('media.status.changed', {
        sessionId: formRef.current.sessionId,
        micEnabled,
        cameraEnabled: false,
      });
    }
  }

  async function handleToggleMic() {
    if (!joined) {
      setNotice('Join the session first.');
      return;
    }

    if (micEnabled) {
      await stopLocalMicrophone();
      return;
    }

    try {
      await ensurePublisherRole();
      const mainClient = agoraRef.current.mainClient;
      const track = await startLocalMicrophone();
      await mainClient.publish(track);
      setMicEnabled(true);
      await emitWithAck('media.status.changed', {
        sessionId: formRef.current.sessionId,
        micEnabled: true,
        cameraEnabled,
      });
    } catch (error) {
      setNotice(error.message || 'Unable to enable microphone.');
      pushLog('agora.mic.error', { message: error.message });
    }
  }

  async function handleToggleCamera() {
    if (!joined) {
      if (cameraEnabled) {
        await stopLocalCamera(false);
        setNotice('Local camera preview stopped.');
        return;
      }

      try {
        await startLocalCamera();
        setCameraEnabled(true);
        setCameraPublished(false);
        setNotice('Local camera preview is on. Join the session to publish it.');
      } catch (error) {
        setNotice(error.message || 'Unable to start local camera preview.');
        pushLog('agora.camera.preview.error', { message: error.message });
      }
      return;
    }

    if (cameraEnabled) {
      if (!cameraPublished) {
        try {
          await ensurePublisherRole();
          const mainClient = agoraRef.current.mainClient;
          const track = await startLocalCamera();
          await mainClient.publish(track);
          setCameraEnabled(true);
          setCameraPublished(true);
          await emitWithAck('media.status.changed', {
            sessionId: formRef.current.sessionId,
            micEnabled,
            cameraEnabled: true,
          });
        } catch (error) {
          setNotice(error.message || 'Unable to publish camera.');
          pushLog('agora.camera.publish.error', { message: error.message });
        }
        return;
      }

      await stopLocalCamera();
      return;
    }

    try {
      await ensurePublisherRole();
      const mainClient = agoraRef.current.mainClient;
      const track = await startLocalCamera();
      await mainClient.publish(track);
      setCameraEnabled(true);
      setCameraPublished(true);
      await emitWithAck('media.status.changed', {
        sessionId: formRef.current.sessionId,
        micEnabled,
        cameraEnabled: true,
      });
    } catch (error) {
      setNotice(error.message || 'Unable to enable camera.');
      pushLog('agora.camera.error', { message: error.message });
    }
  }

  async function handleShareScreen() {
    if (!joined) {
      setNotice('Join the session first.');
      return;
    }

    try {
      await ensurePublisherRole();
      const screenClient = agoraRef.current.screenClient;
      if (!screenClient) {
        return;
      }

      const tokenResponse = await fetchAgoraToken({
        sessionId: formRef.current.sessionId,
        channelName: buildAgoraChannelName(formRef.current.sessionId),
        anonymousUserId: formRef.current.anonymousUserId,
        role: formRef.current.role,
        mediaType: 'screen',
      });
      await screenClient.setClientRole('host');
      await screenClient.join(
        tokenResponse.appId,
        tokenResponse.channelName,
        tokenResponse.token,
        tokenResponse.uid,
      );

      const screenTrackResult = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: '1080p_1',
        optimizationMode: 'detail',
      });
      const screenTrack = Array.isArray(screenTrackResult)
        ? screenTrackResult[0]
        : screenTrackResult;

      screenTrack.on('track-ended', () => {
        handleStopScreenShare();
      });

      agoraRef.current.screenTrack = screenTrack;
      await screenClient.publish(screenTrack);
      setLocalScreenTrack(screenTrack);
      setScreenSharing(true);
      await emitWithAck('screen.share.started', {
        sessionId: formRef.current.sessionId,
      });
    } catch (error) {
      setNotice(error.message || 'Screen share failed.');
      pushLog('agora.screen.error', { message: error.message });
      await stopScreenShare(false);
    }
  }

  async function stopScreenShare(syncStatus = true) {
    const screenClient = agoraRef.current.screenClient;
    const screenTrack = agoraRef.current.screenTrack;

    if (screenTrack && screenClient) {
      await screenClient.unpublish(screenTrack).catch(() => undefined);
      screenTrack.close();
    }
    agoraRef.current.screenTrack = null;
    setLocalScreenTrack(null);

    if (screenClient && screenClient.connectionState !== 'DISCONNECTED') {
      await screenClient.leave().catch(() => undefined);
    }

    setScreenSharing(false);

    if (syncStatus && joined) {
      await emitWithAck('screen.share.stopped', {
        sessionId: formRef.current.sessionId,
      });
    }
  }

  async function handleStopScreenShare() {
    await stopScreenShare();
  }

  async function handleRaiseHand() {
    await emitWithAck('hand.raise', {
      sessionId: formRef.current.sessionId,
    });
  }

  async function handleApproveSpeaker(targetAnonymousUserId) {
    await emitWithAck('speaker.approve', {
      sessionId: formRef.current.sessionId,
      targetAnonymousUserId,
    });
  }

  async function handleStartRecording() {
    try {
      const recording = await fetchJson(
        `/api/sessions/${formRef.current.sessionId}/recordings/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            anonymousUserId: formRef.current.anonymousUserId,
          }),
        },
      );
      setNotice('Recording started.');
      pushLog('recordings.start', {
        recordingId: recording.recordingId,
        status: recording.status,
      });
      await fetchRecordings();
    } catch (error) {
      setNotice(error.message || 'Unable to start recording.');
      pushLog('recordings.start.error', { message: error.message });
    }
  }

  async function handleStopRecording() {
    const activeRecording = recordings.find(
      (item) => item.status === 'RECORDING',
    );
    if (!activeRecording) {
      setNotice('No active recording to stop.');
      return;
    }

    try {
      const result = await fetchJson(
        `/api/recordings/${activeRecording.recordingId}/stop`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            anonymousUserId: formRef.current.anonymousUserId,
          }),
        },
      );
      setNotice('Recording stopped and moved to READY.');
      pushLog('recordings.stop', {
        recordingId: activeRecording.recordingId,
        status: result.ready?.status,
        cloudflareVideoUid: result.ready?.cloudflareVideoUid,
      });
      await fetchRecordings();
    } catch (error) {
      setNotice(error.message || 'Unable to stop recording.');
      pushLog('recordings.stop.error', { message: error.message });
    }
  }

  async function handlePlayback(recordingId) {
    try {
      const result = await fetchJson(
        `/api/recordings/${recordingId}/playback-url?anonymousUserId=${encodeURIComponent(
          formRef.current.anonymousUserId,
        )}`,
      );
      setNotice('Playback URL granted.');
      setPlaybackSession(result);
      pushLog('recordings.playback.allowed', result);
    } catch (error) {
      setNotice(error.message || 'Playback denied.');
      setPlaybackSession(null);
      pushLog('recordings.playback.denied', {
        recordingId,
        message: error.message,
      });
    }
  }

  async function handleAttachCloudflareVideo(recordingId) {
    const videoUid = window.prompt('Cloudflare video UID');
    if (!videoUid) {
      return;
    }

    try {
      await fetchJson(`/api/recordings/${recordingId}/cloudflare-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          anonymousUserId: formRef.current.anonymousUserId,
          videoUid,
        }),
      });
      setNotice('Cloudflare video UID attached.');
      pushLog('recordings.cloudflare_video.attached', {
        recordingId,
        videoUid,
      });
      await fetchRecordings();
    } catch (error) {
      setNotice(error.message || 'Unable to attach Cloudflare video UID.');
      pushLog('recordings.cloudflare_video.error', {
        recordingId,
        message: error.message,
      });
    }
  }

  function queueFromSnapshot(snapshot) {
    return snapshot.handRaiseQueue
      .map((participantId) =>
        snapshot.participants.find(
          (participant) => participant.anonymousUserId === participantId,
        ),
      )
      .filter(Boolean);
  }

  const onlineCount = session.onlineCount ?? 0;
  const selfParticipant = session.participants.find(
    (participant) => participant.anonymousUserId === form.anonymousUserId,
  );
  const activeSpeakerParticipant =
    session.participants.find(
      (participant) =>
        participant.isActiveSpeaker &&
        participant.anonymousUserId !== form.anonymousUserId,
    ) ??
    session.participants.find((participant) => participant.isActiveSpeaker) ??
    null;
  const primaryRemoteVideo =
    remoteVideos.find(
      (item) =>
        item.anonymousUserId === activeSpeakerParticipant?.anonymousUserId,
    ) ?? remoteVideos[0] ?? null;
  const primaryStageTrack =
    localScreenTrack ||
    remoteScreen?.videoTrack ||
    primaryRemoteVideo?.videoTrack ||
    localCameraTrack ||
    null;
  const stageMode = localScreenTrack || remoteScreen ? 'screen' : 'speaker';
  const stageLabel =
    stageMode === 'screen'
      ? localScreenTrack
        ? `${form.displayName} screen share`
        : remoteScreen
          ? `${remoteScreen.displayName} screen share`
          : 'Screen share stage'
      : primaryRemoteVideo
        ? primaryRemoteVideo.displayName
        : localCameraTrack
          ? form.displayName
          : activeSpeakerParticipant?.displayName ?? 'Main classroom stage';
  const stageHint =
    stageMode === 'screen'
      ? localScreenTrack
        ? 'Screen share is pinned for the room'
        : 'Remote screen share is pinned for the room'
      : primaryRemoteVideo
        ? `${primaryRemoteVideo.role} camera is on stage`
        : localCameraTrack
          ? isCameraPreviewOnly
            ? 'Local camera preview is ready'
            : 'Your camera is on stage'
          : 'Join with camera or approve a speaker to populate the stage';
  const participantStrip = session.participants.map((participant) => {
    const remoteVideo = remoteVideos.find(
      (item) => item.anonymousUserId === participant.anonymousUserId,
    );

    return {
      ...participant,
      videoTrack:
        participant.anonymousUserId === form.anonymousUserId
          ? localCameraTrack
          : remoteVideo?.videoTrack ?? null,
    };
  });
  const recorderRole = `${form.role}${joined ? '' : ' · waiting'}`;
  const sessionTitle = session.sessionId || form.sessionId || 'session-alpha';

  return (
    <div className={`page-shell ${isRecorderRoute ? 'recorder-page' : ''}`}>
      {isRecorderRoute ? null : (
        <aside className="control-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">LUCY Phase 8</p>
              <h1>Classroom Console</h1>
            </div>
            <span className={`socket-state ${socketState}`}>{socketState}</span>
          </div>

          <div className="notice">
            {agoraState.warning ||
              notice ||
              'Join the session first, then the client will request Agora and classroom state.'}
          </div>

          <section className="panel-card">
            <h2>Identity</h2>
            <label>
              Session ID
              <input
                value={form.sessionId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sessionId: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Anonymous User ID
              <input
                value={form.anonymousUserId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    anonymousUserId: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Display Name
              <input
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Role
              <select
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
              >
                <option value="SUPER">SUPER</option>
                <option value="HOST">HOST</option>
                <option value="STUDENT">STUDENT</option>
              </select>
            </label>
            <div className="button-row">
              <button className="primary" onClick={handleJoinSession}>
                Join Session
              </button>
              <button onClick={handleLeaveSession}>Leave Session</button>
            </div>
          </section>

          <section className="panel-card">
            <h2>Access</h2>
            <dl className="status-grid compact">
              <div>
                <dt>Channel</dt>
                <dd>{agoraState.channelName || channelName || '-'}</dd>
              </div>
              <div>
                <dt>RTC</dt>
                <dd>{agoraState.status}</dd>
              </div>
              <div>
                <dt>Publish Role</dt>
                <dd>{agoraState.publishRole}</dd>
              </div>
              <div>
                <dt>Approval</dt>
                <dd>{canPublishMedia ? 'Allowed' : 'Waiting'}</dd>
              </div>
            </dl>
            {!agoraState.joined && agoraState.warning ? (
              <p className="inline-note">
                Agora token endpoint is not ready yet or access was denied.
              </p>
            ) : null}
          </section>

          <section className="panel-card">
            <h2>Room Status</h2>
            <dl className="status-grid">
              <div>
                <dt>Joined</dt>
                <dd>{joined ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt>Online</dt>
                <dd>{onlineCount}</dd>
              </div>
              <div>
                <dt>Recording</dt>
                <dd>{recordingStatus}</dd>
              </div>
              <div>
                <dt>Main Focus</dt>
                <dd>{stageMode === 'screen' ? 'Screen' : 'Speaker'}</dd>
              </div>
            </dl>
          </section>
        </aside>
      )}

      <main className={`classroom-shell ${isRecorderRoute ? 'recorder-shell' : ''}`}>
        <section className="classroom-topbar">
          <div className="topbar-title">
            <p className="eyebrow">
              {isRecorderRoute ? 'Recorder Route' : 'Online Classroom Demo'}
            </p>
            <h1>{sessionTitle}</h1>
          </div>
          <div className="topbar-meta">
            <span className={`socket-state ${socketState}`}>{socketState}</span>
            <span className="meta-pill">{recorderRole}</span>
            <span className={`meta-pill ${recordingStatus === 'RECORDING' ? 'danger' : ''}`}>
              {recordingStatus}
            </span>
          </div>
        </section>

        <section className={`classroom-stage-grid ${playbackSession?.playerUrl ? 'with-playback' : ''}`}>
          <div className="main-stage-card">
            <div className="stage-header">
              <div>
                <p className="eyebrow">
                  {stageMode === 'screen' ? 'Screen Share' : 'Main Stage'}
                </p>
                <h2>{stageLabel}</h2>
              </div>
              <div className="stage-badges">
                <span className="meta-pill">{stageMode === 'screen' ? 'Pinned' : 'Speaker'}</span>
                <span className="meta-pill">{onlineCount} online</span>
              </div>
            </div>
            <div className="stage-viewport">
              <VideoSurface
                track={primaryStageTrack}
                label={stageLabel}
                hint={stageHint}
                tall
              />
              {isRecorderRoute ? (
                <div className="stage-watermark">
                  <strong>LUCY Classroom Recorder</strong>
                  <span>
                    {sessionTitle} · {recordingStatus}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="classroom-side-panel">
            <article className="side-card">
              <div className="card-header">
                <h2>Participants</h2>
                <span>{onlineCount}</span>
              </div>
              <div className="participant-list compact-list">
                {session.participants.length === 0 ? (
                  <p className="empty-state">No participants in this session yet.</p>
                ) : (
                  session.participants.map((participant) => (
                    <div className="participant-item" key={participant.anonymousUserId}>
                      <div>
                        <strong>
                          {participant.displayName}
                          {participant.anonymousUserId === form.anonymousUserId
                            ? ' · You'
                            : ''}
                        </strong>
                        <p>{participant.anonymousUserId}</p>
                      </div>
                      <div className="participant-badges">
                        <span>{participant.role}</span>
                        {participant.isActiveSpeaker ? <span>Speaker</span> : null}
                        {participant.screenSharing ? <span>Screen</span> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="side-card">
              <div className="card-header">
                <h2>Raised Hands</h2>
                <span>{handQueue.length}</span>
              </div>
              <div className="queue-list compact-list">
                {handQueue.length === 0 ? (
                  <p className="empty-state">No raised hands.</p>
                ) : (
                  handQueue.map((participant) => (
                    <div className="queue-item" key={participant.anonymousUserId}>
                      <div>
                        <strong>{participant.displayName}</strong>
                        <p>{participant.role}</p>
                      </div>
                      {!isRecorderRoute && canApprove ? (
                        <button
                          className="primary"
                          onClick={() =>
                            handleApproveSpeaker(participant.anonymousUserId)
                          }
                        >
                          Approve
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="side-card">
              <div className="card-header">
                <h2>Media Status</h2>
                <span>{selfParticipant?.displayName || form.displayName}</span>
              </div>
              <dl className="status-grid compact">
                <div>
                  <dt>Mic</dt>
                  <dd>{micEnabled ? 'On' : 'Off'}</dd>
                </div>
                <div>
                  <dt>Camera</dt>
                  <dd>
                    {cameraEnabled
                      ? cameraPublished
                        ? 'Live'
                        : 'Preview'
                      : 'Off'}
                  </dd>
                </div>
                <div>
                  <dt>Screen</dt>
                  <dd>{screenSharing ? 'On' : 'Off'}</dd>
                </div>
                <div>
                  <dt>Approval</dt>
                  <dd>{canPublishMedia ? 'Live' : 'Audience'}</dd>
                </div>
              </dl>
            </article>
          </aside>
        </section>

        <section className="participant-strip-card">
          <div className="card-header">
            <h2>{isRecorderRoute ? 'Participant Strip' : 'Live Cameras'}</h2>
            <span>{participantStrip.length}</span>
          </div>
          <div className="participant-strip">
            {participantStrip.length === 0 ? (
              <p className="empty-state">Participant cameras will appear here.</p>
            ) : (
              participantStrip.map((participant) => (
                <div className="participant-tile" key={participant.anonymousUserId}>
                  <VideoSurface
                    track={participant.videoTrack}
                    label={participant.displayName}
                    hint={`${participant.role}${participant.isActiveSpeaker ? ' · speaker' : ''}`}
                  />
                </div>
              ))
            )}
          </div>
        </section>

        {playbackSession?.playerUrl && !isRecorderRoute ? (
          <section className="hero-stage playback-stage">
            <div className="card-header">
              <div>
                <p className="eyebrow">Playback</p>
                <h2>{playbackSession.cloudflareVideoUid}</h2>
              </div>
              <span>{playbackSession.expiresIn}s</span>
            </div>
            <div className="player-frame-shell">
              <iframe
                src={playbackSession.playerUrl}
                title="Cloudflare Stream Playback"
                className="player-frame"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
              />
            </div>
          </section>
        ) : null}

        {!isRecorderRoute ? (
          <section className="classroom-bottom-grid">
            <article className="content-card">
              <div className="card-header">
                <h2>Recordings</h2>
                <span>{recordings.length} items</span>
              </div>
              <div className="queue-list">
                {recordings.length === 0 ? (
                  <p className="empty-state">No recordings for this session yet.</p>
                ) : (
                  recordings.map((recording) => (
                    <div className="queue-item" key={recording.recordingId}>
                      <div>
                        <strong>{recording.title || recording.recordingId}</strong>
                        <p>
                          {recording.status} · {recording.provider}
                        </p>
                      </div>
                      <div className="participant-badges">
                        <span>{recording.createdBySuperId}</span>
                        {recording.durationSeconds ? (
                          <span>{recording.durationSeconds}s</span>
                        ) : null}
                        {recording.cloudflareVideoUid ? (
                          <span>{recording.cloudflareVideoUid}</span>
                        ) : null}
                      </div>
                      <div className="button-grid">
                        <button
                          onClick={() => handlePlayback(recording.recordingId)}
                        >
                          Playback
                        </button>
                        {isSuper ? (
                          <button
                            onClick={() =>
                              handleAttachCloudflareVideo(recording.recordingId)
                            }
                          >
                            Attach Video UID
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="content-card log-card">
              <div className="card-header">
                <h2>Event Log</h2>
                <span>{eventLog.length} events</span>
              </div>
              <div className="log-list">
                {eventLog.length === 0 ? (
                  <p className="empty-state">Realtime and Agora events will appear here.</p>
                ) : (
                  eventLog.map((entry) => (
                    <div className="log-item" key={entry.id}>
                      <div className="log-header">
                        <strong>{entry.eventName}</strong>
                        <span>{entry.at}</span>
                      </div>
                      <pre>{JSON.stringify(entry.payload, null, 2)}</pre>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        ) : null}

        {isRecorderRoute ? null : (
          <section className="bottom-control-bar">
            <button onClick={handleToggleMic}>
              {micEnabled ? 'Mic Off' : 'Mic On'}
            </button>
            <button onClick={handleToggleCamera}>
              {cameraEnabled
                ? cameraPublished
                  ? 'Camera Off'
                  : joined
                    ? 'Publish Camera'
                    : 'Stop Preview'
                : joined
                  ? 'Camera On'
                  : 'Preview Camera'}
            </button>
            <button onClick={handleShareScreen}>Share Screen</button>
            <button onClick={handleRaiseHand}>Raise Hand</button>
            {isSuper ? (
              <button
                className={recordingStatus === 'RECORDING' ? '' : 'primary'}
                onClick={
                  recordingStatus === 'RECORDING'
                    ? handleStopRecording
                    : handleStartRecording
                }
              >
                {recordingStatus === 'RECORDING'
                  ? 'Stop Recording'
                  : 'Start Recording'}
              </button>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}

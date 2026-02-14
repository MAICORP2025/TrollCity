interface PreflightState {
  stream: MediaStream | null;
  token: string | null;
  roomName: string | null;
  url: string | null;
}

const state: PreflightState = {
  stream: null,
  token: null,
  roomName: null,
  url: null,
};

export const PreflightStore = {
  setStream(stream: MediaStream | null) {
    state.stream = stream;
  },

  getStream() {
    return state.stream;
  },

  setToken(token: string | null, roomName: string | null, url: string | null) {
    state.token = token;
    state.roomName = roomName;
    state.url = url;
  },

  getToken() {
    return { token: state.token, roomName: state.roomName, url: state.url };
  },

  clear() {
    state.stream = null;
    state.token = null;
    state.roomName = null;
    state.url = null;
  }
};

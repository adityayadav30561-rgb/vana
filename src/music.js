// Background music: a flute recording streamed through YouTube's official
// IFrame Player API, controlled by the sound toggle in the nav.
//
// Browsers only allow audible autoplay after the visitor has interacted with
// the page, so playback is attempted as soon as the forest has loaded and,
// if the browser holds it back, begins on the first click, tap or key press.
// A visitor who pauses the music keeps it paused on later visits.

const VIDEO_ID = 'yRrU0zCUVJg'; // "Enchanting Flute", Krishna Aur Kans
const STORE_KEY = 'vana:music';
const TIME_KEY = 'vana:music-at'; // where the song was, so the next page carries on from there
const VOLUME = 42;
const PLAYING = 1, BUFFERING = 3;

function readPref() {
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }
}
function writePref(v) {
  try { localStorage.setItem(STORE_KEY, v); } catch { /* storage unavailable: preference lasts this visit */ }
}

function readTime() {
  try { return Math.floor(parseFloat(sessionStorage.getItem(TIME_KEY)) || 0); } catch { return 0; }
}

function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function initMusic(button) {
  const label = button.querySelector('.sound__label');
  let player = null;
  let ready = false;
  let wanted = readPref() !== 'off'; // play unless the visitor switched it off before
  let begun = false; // page is ready for music (loader finished)
  let fadeTimer = 0;
  let resumeOnReturn = false;
  let level = 1; // multiplies VOLUME; raised as Krishna comes into view
  let fading = false;

  function setState(state) {
    button.dataset.state = state;
    const on = state === 'playing';
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
    label.textContent = state === 'blocked' ? 'Tap for sound' : on ? 'Sound on' : 'Sound off';
  }

  function fadeTo(target, done) {
    clearInterval(fadeTimer);
    fading = true;
    let v = player.getVolume?.() ?? 0;
    const step = (target - v) / 30;
    fadeTimer = setInterval(() => {
      v += step;
      const finished = step >= 0 ? v >= target : v <= target;
      player.setVolume(Math.round(finished ? target : v));
      if (finished) { clearInterval(fadeTimer); fading = false; done?.(); }
    }, 50);
  }

  function play() {
    if (!ready) return;
    player.setVolume(0);
    player.playVideo();
    fadeTo(Math.round(VOLUME * level));
    // if the browser declined to start audio, wait for the visitor's first gesture
    setTimeout(() => {
      const s = player.getPlayerState();
      if (wanted && s !== PLAYING && s !== BUFFERING) {
        setState('blocked');
        armGesture();
      }
    }, 1500);
  }

  function pause() {
    if (!ready) return;
    fadeTo(0, () => player.pauseVideo());
  }

  const GESTURES = ['pointerdown', 'keydown', 'touchend'];
  let armed = false;
  function onGesture(e) {
    if (button.contains(e.target)) return; // the toggle handles its own click
    disarmGesture();
    if (wanted) play();
  }
  function armGesture() {
    if (armed) return;
    armed = true;
    GESTURES.forEach((ev) => window.addEventListener(ev, onGesture, true));
  }
  function disarmGesture() {
    armed = false;
    GESTURES.forEach((ev) => window.removeEventListener(ev, onGesture, true));
  }

  button.addEventListener('click', () => {
    const on = button.dataset.state === 'playing';
    wanted = !on;
    writePref(wanted ? 'on' : 'off');
    if (wanted) play();
    else { disarmGesture(); pause(); setState('paused'); }
  });

  // don't keep playing in a background tab; pick up again on return
  document.addEventListener('visibilitychange', () => {
    if (!ready) return;
    if (document.hidden) {
      resumeOnReturn = player.getPlayerState() === PLAYING;
      if (resumeOnReturn) player.pauseVideo();
    } else if (resumeOnReturn && wanted) {
      player.playVideo();
    }
  });

  // moving to another page of the site: remember the place in the song
  addEventListener('pagehide', () => {
    if (!ready) return;
    try { sessionStorage.setItem(TIME_KEY, String(player.getCurrentTime?.() || 0)); } catch { /* storage unavailable */ }
  });

  setState('loading');
  button.hidden = false;

  const host = document.createElement('div');
  host.className = 'music-host';
  host.setAttribute('aria-hidden', 'true');
  const mount = document.createElement('div');
  host.appendChild(mount);
  document.body.appendChild(host);

  loadApi()
    .then((YT) => {
      player = new YT.Player(mount, {
        videoId: VIDEO_ID,
        width: 1,
        height: 1,
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
          loop: 1, playlist: VIDEO_ID, playsinline: 1, rel: 0, start: readTime(),
        },
        events: {
          onReady: () => {
            ready = true;
            player.setVolume(0);
            setState(wanted ? 'loading' : 'paused');
            if (wanted && begun) play();
          },
          onStateChange: (e) => {
            if (e.data === PLAYING) { setState('playing'); disarmGesture(); }
            else if (e.data === window.YT.PlayerState.PAUSED && !document.hidden && button.dataset.state === 'playing') setState('paused');
          },
          onError: () => {
            button.hidden = true;
            host.remove();
          },
        },
      });
    })
    .catch(() => { button.hidden = true; });

  return {
    /** Scales the music's volume (1 = normal). */
    setLevel(k) {
      if (Math.abs(k - level) < 0.02) return;
      level = k;
      if (ready && !fading && button.dataset.state === 'playing') player.setVolume(Math.min(100, Math.round(VOLUME * level)));
    },
    /** Called once the page has finished loading. */
    begin() {
      begun = true;
      if (ready && wanted) play();
    },
  };
}

let messageSentOnPageLoad = false;
let lastTrackInfo = null;
let authOk = null;
let isAuthPageOpening = false;

function getTrackInfo() {
  let songName;
  const songNameBlock = document.querySelector('.track__name .track__name-innerwrap')
  if (songNameBlock) {
    songName = songNameBlock.textContent.trim()
  } else console.log("song name is empty :(")
  const artistDirtyBlock = document.querySelector('.track')
  let artist;
  if (artistDirtyBlock) {
    artist = artistDirtyBlock.textContent.trim().replaceAll(songName, "")
  } else console.log("artist name is empty :(")

  return {
    track: [songName],
    artist: [artist],
    timestamp: Math.floor(Date.now() / 1000),
  };
}

function sendTrackInfoToBackground() {
  const trackInfo = getTrackInfo();
  try {
    chrome.runtime.sendMessage({type: 'TRACK_INFO', data: trackInfo},
      (response) => {
        if (response && response.status === 'success') {
          console.log('Track scrobbled successfully!');
        } else {
          console.error('Failed to scrobble track:', response?.message);
        }
      });
    lastTrackInfo = trackInfo;
  } catch (error) {
    console.error("Error sending track info:", error);
  }
}

let previousText = '';

const checkForChanges = () => {
  const targetNode = document.querySelector('.track__name .track__name-innerwrap');
  if (targetNode && targetNode.textContent !== previousText) {
    previousText = targetNode.textContent;
    sendTrackInfoToBackground()
  }
};

// Check for changes every 500ms
setInterval(checkForChanges, 500);

//auth zone
checkAuth(() => {
  checkAndHandleAuth();

  if (!messageSentOnPageLoad) {
    setSessionKey();
    sendTrackInfoToBackground();
    messageSentOnPageLoad = true;
  }
});

function checkAndHandleAuth() {
  if (!authOk && !isAuthPageOpening) {
    isAuthPageOpening = true;
    setTimeout(() => (isAuthPageOpening = false), 10000);
    chrome.runtime.sendMessage({
      type: 'OPEN_AUTH'
    });
    checkAuth(() => {
      checkAndHandleAuth();
    });
  }
}

function checkAuth(callback) {
  chrome.storage.local
    .get(['authOk'],
      (result) => {
        if (chrome.runtime.lastError) {
          console.error("Error retrieving data from storage:", chrome.runtime.lastError);
        } else if (result.authOk) {
          authOk = result.authOk;
        }
        callback();
      }
    );
}

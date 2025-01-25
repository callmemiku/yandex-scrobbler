let authTabId = null;
let authTabIdFinal = null;
let SESSION_KEY = null;
const API_KEY = 'YOUR_API_KEY';
const API_SECRET = 'YOUR_API_SECRET';
import {MD5} from './lib/crypto-min.js';

async function scrobbleToLastFM(trackInfo) {
  const apiUrl = 'https://ws.audioscrobbler.com/2.0/';
  const signature = `api_key${API_KEY}artist${trackInfo.artist}methodtrack.scrobblesk${SESSION_KEY}timestamp${trackInfo.timestamp}track${trackInfo.track}${API_SECRET}`;
  const signatureMD5 = String(MD5(signature));
  const params = {
      'method': 'track.scrobble',
      'api_key': API_KEY,
      'format': 'json',
      'artist': trackInfo.artist,
      'track': trackInfo.track,
      'timestamp': trackInfo.timestamp,
      'api_sig': signatureMD5,
      'sk': SESSION_KEY,
    };
  const response = await fetch(
    apiUrl,
    {
      method: 'POST',
      body: new URLSearchParams(params),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  if (response.ok) {
    console.log('Track scrobbled successfully!', await response.text());
  } else {
    console.error('Failed to scrobble track:', await response.text());
  }
}

function getFromLocalStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        console.error(`Error retrieving ${key} from storage:`, chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[key]);
      }
    });
  });
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'SET_SESSION_KEY') {
    try {
      const sessionKey = await getFromLocalStorage('sessionKey');
      if (sessionKey) {
        SESSION_KEY = sessionKey;
        sendResponse({status: 'success', sessionKey: SESSION_KEY});
      } else {
        sendResponse({status: 'error', message: 'Session key not found.'});
      }
    } catch (error) {
      sendResponse({status: 'error', message: error.message});
    }
    return true;
  }

  if (message.type === 'TRACK_INFO') {
    if (!SESSION_KEY) {
      console.error('Session key is not set. Cannot scrobble.');
      sendResponse({status: 'error', message: 'Session key is not set.'});
      return;
    }

    try {
      await scrobbleToLastFM(message.data);
      sendResponse({status: 'success'});
    } catch (error) {
      console.error('Failed to scrobble track:', error);
      sendResponse({status: 'error', message: error.message});
    }
    return true; // Required for async sendResponse
  }

  if (message.type === 'OPEN_AUTH') {
    const url = `https://www.last.fm/api/auth/?api_key=${API_KEY}&cb=https://example.com/`;
    chrome.tabs.create({url: url}, (tab) => {
      authTabId = tab.id;
      console.log('Authorization page opened:', tab);
      sendResponse({success: true});
    });
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === authTabId && changeInfo.url) {
    const redirectUrl = new URL(changeInfo.url);
    console.log(redirectUrl);
    if (redirectUrl.hostname === 'example.com' && redirectUrl.searchParams.has('token')) {
      const token = redirectUrl.searchParams.get('token');
      chrome.storage.local.set({token: token}, () => {
        console.log('Token received');
      });
      // Optionally, close the auth tab
      chrome.tabs.remove(tabId, () => {
        console.log('Auth tab closed after token retrieval.');
      });
      authTabId = null;
      secondAuthorization(token);
    }
  }
});

function secondAuthorization(token) {
  const url = `https://www.last.fm/api/auth/?api_key=${API_KEY}&token=${token}`;
  chrome.tabs.create({url: url}, (tab) => {
    authTabIdFinal = tab.id;
    console.log('Authorization page opened:', tab);
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === authTabIdFinal) {
    obtainSession();
    authTabIdFinal = null;
  }
});

function obtainSession() {
  chrome.storage.local.get(['token'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error retrieving token:', chrome.runtime.lastError);
      return;
    }

    if (result.token) {
      const sig = `api_key${API_KEY}methodauth.getSessiontoken${result.token}${API_SECRET}`;
      const md5 = String(MD5(sig));
      const url = `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${API_KEY}&token=${result.token}&api_sig=${md5}&format=json`;
      fetch(
        url,
        {
          method: 'POST',
        }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then((data) => {
          if (data.session && data.session.key) {
            SESSION_KEY = data.session.key;
            console.log(SESSION_KEY);
            chrome.storage.local.set(
              {
                authOk: true,
                sessionKey: data.session.key,
              },
              () => {
                console.log('Authorization is successful. Session key stored');
              }
            );
          } else {
            console.error('Failed to obtain session key:', data);
          }
        })
        .catch((error) => {
          console.error('Error during session key retrieval:', error);
        });
    } else {
      console.error('Token not found in storage.');
    }
  });
}

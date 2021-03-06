/*
 * Lucas Fialho Zawacki
 * Paulo Renato Lanzarin
 * (C) Copyright 2017 Bigbluebutton
 *
 */

"use strict";

const BigBlueButtonGW = require('../bbb/pubsub/bbb-gw');
const Stream = require('./stream');
const BaseManager = require('../base/BaseManager');
const C = require('../bbb/messages/Constants');
const Logger = require('../utils/Logger');
const errors = require('../base/errors');

const Messaging = require('../bbb/messages/Messaging');

const OAuth2 = require('../oauth2/server');

module.exports = class StreamManager extends BaseManager {
  constructor (connectionChannel, additionalChannels, logPrefix) {
    super(connectionChannel, additionalChannels, logPrefix);
    this.sfuApp = C.STREAM_APP;
    this._meetings = {};
    this._trackMeetingTermination();
    this.messageFactory(this._onMessage);
  }

  _getOAuth2Url(meetingId, userId, callback) {
    let id = meetingId + userId;
    OAuth2.getTokenUrl(id, (client, url) => {

      callback(url);

      OAuth2.onToken(meetingId, userId, client, (auth) => {
        OAuth2.getStreamKey(auth, (err, key, videoId) => {
          Logger.info(this._logPrefix, 'Sharing oauth data for ', userId, key, videoId);

          if (err) {
            Logger.info(this._logPrefix, 'Stream API failed with err: ', err, ' userId: ', userId);
          }

          this._bbbGW.publish(
            Messaging.generateStreamOAuth2DataMessage(meetingId, userId, key, videoId, err), C.TO_HTML5);
        });
      });
    });
  };

  _trackMeetingTermination () {
    switch (C.COMMON_MESSAGE_VERSION) {
      case "1.x":
        this._bbbGW.on(C.DICONNECT_ALL_USERS, (payload) => {
          let meetingId = payload[C.MEETING_ID];


        });
        break;
      default:
        this._bbbGW.on(C.DICONNECT_ALL_USERS_2x, (payload) => {
          let meetingId = payload[C.MEETING_ID_2x];

        });
    }
  }

  _onStart(meetingId, streamUrl, streamType) {
    return () => {
      Logger.info(this._logPrefix, 'Stream is starting for', meetingId);
      this._bbbGW.publish(
      Messaging.generateStreamEventMessage(meetingId, C.STREAM_STARTED, streamUrl, streamType)
    , C.TO_HTML5);
    };
  }

  _onStop(meetingId) {
    return (reason) => {
      Logger.info(this._logPrefix, 'Stream is stopping for', meetingId);
      Logger.info(Messaging.generateStreamEventMessage(meetingId, C.STREAM_STOPPED));
      this._bbbGW.publish(
        Messaging.generateStreamEventMessage(meetingId, C.STREAM_STOPPED)
        , C.TO_HTML5);
      delete this._sessions[meetingId];
      delete this._meetings[meetingId];
    };
  }

  _onMessage(message) {
    let session, meetingId, userId, name, streamUrl, streamType, confname;

    if (message.core && message.core.header) {
      meetingId = message.core.header.meetingId;
      userId = message.core.header.userId;
      name = message.core.header.name;
    }

    if (message.core && message.core.body) {
      streamUrl = message.core.body.streamUrl;
      streamType = message.core.body.streamType;
      confname = message.core.body.confname;
    }

    session = this._sessions[meetingId];

    Logger.debug(this._logPrefix, 'Received message [' + name + '] from connection', meetingId);
    switch (name) {
      case 'StartStream':

        if (!session) {
          session = new Stream(this._bbbGW, meetingId, confname, streamUrl);
        } else {
          Logger.warn(this._logPrefix, "Not starting stream again for ", meetingId);
          return;
        }

        this._meetings[meetingId] = meetingId;
        this._sessions[meetingId] = session;

        session.start((error) => {
          Logger.info(this._logPrefix, "Started stream ", meetingId);

          if (error) {
            const errorMessage = this._handleError(this._logPrefix, meetingId, error);
            return this._bbbGW.publish(JSON.stringify({
              ...errorMessage
            }), C.FROM_STREAM);
          }

          session.onStart(this._onStart(meetingId, streamUrl, streamType));

          session.onStop(this._onStop(meetingId));

          Logger.info(this._logPrefix, "Sending startResponse to meeting ", meetingId, "for connection", session._id);
        });
        break;

      case 'StopStream':
        Logger.info(this._logPrefix, 'Received stop mey10yssage for session', meetingId);

        try {
          if (session) {
            session.stop();
          } else {
            Logger.warn(this._logPrefix, "There was no stream session on stop for", meetingId);
          }

          this._onStop(meetingId)();
        } catch (err) {
          Logger.error(this._logPrefix, "Error stopping session for ", meetingId, err);
        }
        break;

      case 'StreamKeepAlive':
        Logger.info(this._logPrefix, 'Received ping  for session', meetingId);

        try {
          if (session) {
            session.ping();
          } else {
            Logger.warn(this._logPrefix, 'Could not find session for pinging', meetingId);
          }
        } catch (err) {
          Logger.error(this._logPrefix, "Error pinging session for ", meetingId, err);
        }
        break;

      case 'GetOAuth2Url':
        Logger.info(this._logPrefix, 'Received request for OAuth2 auth URL');

        try {
          this._getOAuth2Url(meetingId, userId, (url) => {
            Logger.info(this._logPrefix, 'Sharing oauth url for ', meetingId, ' url is ', url);
            this._bbbGW.publish(
              Messaging.generateStreamOAuth2UrlMessage(meetingId, userId, url), C.TO_HTML5);
          });
        } catch (err) {
          Logger.error(this._logPrefix, "Error oauth2 in session ", meetingId, err);
        }
        break;

      default:
        const errorMessage = this._handleError(this._logPrefix, meetingId, null, null, errors.SFU_INVALID_REQUEST);
        this._bbbGW.publish(JSON.stringify({
          ...errorMessage,
        }), C.FROM_STREAM);
        break;
    }
  }
};

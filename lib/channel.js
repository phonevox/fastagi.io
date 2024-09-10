// https://wiki.asterisk.org/wiki/display/AST/Asterisk+16+AGI+Commands

const channelActions = {

  on(action, callback) {
    this.channelData.on(action, callback);
  },
  answer() {
    return this.command('ANSWER');
  },
  close() {
    this.channelData.close();
  },
  status() {
    return this.command(`CHANNEL STATUS`);
  },
  hangup() {
    return this.command('HANGUP');
  },
  sayAlpha(text, escapeDigits = "") {
    return this.command(`SAY ALPHA "${text}" "${escapeDigits}"`);
  },
  sayDate(time, escapeDigits = "") {
    return this.command(`SAY DATE "${time}" "${escapeDigits}"`);
  },
  sayDateTime(time, escapeDigits, format = "ABdYIMp", timeZone = "") {
    return this.command(`SAY DATETIME "${time}" "${escapeDigits}" "${format}" "${timeZone}"`);
  },
  sayDigits(number, escapeDigits = "") {
    return this.command(`SAY DIGITS "${number}" "${escapeDigits}"`);
  },
  sayNumber(number, escapeDigits = "", gender = "") {
    return this.command(`SAY NUMBER "${number}" "${escapeDigits}" "${gender}"`);
  },
  sayTime(time, escapeDigits = "") {
    return this.command(`SAY TIME "${time}" "${escapeDigits}"`);
  },
  getData(prompt, timeout, maxDigits) {
    return this.command(`GET DATA "${prompt}" "${timeout * 1000}" "${maxDigits}"`);
  },
  playFile(prompt, escapeDigits = "") {
    return this.command(`STREAM FILE "${prompt}" "${escapeDigits}"`);
  },
  setVariable(name, value) {
    return this.command(`SET VARIABLE "${name}" "${value}"`);
  },
  getVariable(name) {
    return this.command(`GET VARIABLE "${name}"`);
  },
  exec(application, options) {
    return this.command(`EXEC "${application}" "${options}"`);
  },
  verbose(message, level = 3) {
    return this.command(`VERBOSE "${message}" "${level}"`);
  },
  waitDigit(timeout) {
    return this.command(`WAIT FOR DIGIT "${timeout * 1000}"`);
  },

  // phonevox/fastagi.io  edits
  async system(command, debug = false) {
    await this.exec('System', command)

    // validating system cmd return
    let rs = await this.getVariable('SYSTEMSTATUS');
    if (debug) { console.log(`SYSTEMSTATUS: ${JSON.stringify(rs)}`) }
    if (rs && rs.data === 'SUCCESS') { return true };
    return false;
  },
  async playbackFromFAGI(audio) {
    let AUDIO_FORMAT = '.wav'
    let LOCAL_PATH = 'vdialer'
    let DIALER_AUDIO_PATH = `/var/lib/asterisk/sounds/${LOCAL_PATH}`
    let AUDIO_SERVER_PORT = 3987
    let AUDIO_SERVER_HOST = `http://interno.falevox.com.br:${AUDIO_SERVER_PORT}`
    let AUDIO_SERVER_BASEPATH = '/audio'

    // first, we need to guarantee that the dir that keeps the audio exists locally.
    if (!await this.system(`test -e ${DIALER_AUDIO_PATH}`)) {
      // dir that keeps audiofile doesnt exist locally, try creating it
      await this.system(`mkdir -p ${DIALER_AUDIO_PATH}`)

      // checking if it created
      if (!await this.system(`test -e ${DIALER_AUDIO_PATH}`)) {
        console.log(DIALER_AUDIO_PATH + ' was NOT created.')
        throw new Error(DIALER_AUDIO_PATH + ' was NOT created.')
      } else {
        console.log(DIALER_AUDIO_PATH + ' was created.')
      }
    } else {
      console.log(DIALER_AUDIO_PATH + ' already exists.')
    }
    // from here on, we assume DIALER_AUDIO_PATH exists and has adequate permissions (755, asterisk:asterisk)

    // secondly, we guarantee that the audio exists, downloading it if needed.
    // this step requires that the audio is being served by a host, and it has the same name, just in case it needs to be downloaded (doesnt exists locally)
    if (!await this.system(`test -e ${DIALER_AUDIO_PATH}/${audio}${AUDIO_FORMAT}`)) {

      // audio file does not exist, so we need to download it
      // curl because posix
      let AUDIO_SOURCE = `${AUDIO_SERVER_HOST}${AUDIO_SERVER_BASEPATH}/${audio}${AUDIO_FORMAT}`
      
      if (!await this.system(`curl -o ${DIALER_AUDIO_PATH}/${audio}${AUDIO_FORMAT} ${AUDIO_SOURCE}`)) {
        console.log(`"${audio}${AUDIO_FORMAT}": Could not download audio from "${AUDIO_SOURCE}"`)
        throw new Error('placeholder')
      } else {
        console.log(`"${audio}${AUDIO_FORMAT}" was downloaded successfully`)
      }

    }
    // from here on, we assume our audio is downloaded locally

    // play the audio
    this.exec('Playback', `${LOCAL_PATH}/${audio}`)

    // @CHORE:
    // after playback, delete the audio
    // but, if theres another call that uses the same audio, it can't
    // delete the audio, if that happens, it might truncate
    // the audio from the channel
    // make a way to work around that logic, or think about something else
  },

  command(command) {
    const promise = new Promise((resolve, reject) => {
      this.channelData.command(command, (code, result, data) => {
        if (code === 200) {
          return resolve({ code, result, data });
        }
        reject(code);
      });
    });
    return promise;
  }

};

const createChannel = function (channelData, params) {

  // Create new channel using channelActions as prototype (same functions)
  const channel = Object.create(channelActions);
  channel.channelData = channelData;
  channel.params = params;

  return channel;
};


module.exports = createChannel;;;;;;
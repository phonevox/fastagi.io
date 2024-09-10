// https://wiki.asterisk.org/wiki/display/AST/Asterisk+16+AGI+Commands
const colors = require('colors');
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
    if (debug) { console.log(`Executing ${command}`) }
    if (debug) { console.log(`SYSTEMSTATUS: ${JSON.stringify(rs)}`) }
    if (rs && rs.data === 'SUCCESS') { return true };
    return false;
  },
  async downloadAudioFAGI(audio) {
    console.log(` > "${audio}" : Checking if we can download from FAGI`)

    // Audio must be formatted in as .wav, 8Khz, mono.
    let LOCAL_PATH = 'vdialer'
    let AUDIO_FORMAT = '.wav'
    let DIALER_AUDIO_PATH = `/var/lib/asterisk/sounds/${LOCAL_PATH}`
    let AUDIO_SERVER_PORT = 3987
    let AUDIO_SERVER_HOST = `http://interno.falevox.com.br:${AUDIO_SERVER_PORT}`
    let AUDIO_SERVER_BASEPATH = '/audio'

    // first, we need to guarantee that the dir that keeps the audio exists locally.
    if (!await this.system(`test -e ${DIALER_AUDIO_PATH}`)) {
      console.log(colors.yellow(` > "${audio}" : Could not find AUDIO PATH "${DIALER_AUDIO_PATH}", we are going to create it`))
      // dir that keeps audiofile doesnt exist locally, try creating it
      await this.system(`mkdir -p ${DIALER_AUDIO_PATH}`)

      // checking if it created
      if (!await this.system(`test -e ${DIALER_AUDIO_PATH}`)) {
        console.log(colors.red(` > "${audio}" : FAIL! Could not create AUDIO PATH "${DIALER_AUDIO_PATH}"`))
        throw new Error('failed to create audio path')
      } else {
        console.log(colors.green(` > "${audio}" : SUCCESS! Created AUDIO PATH "${DIALER_AUDIO_PATH}"`))
      }
    } else {
      console.log(` > "${audio}" : Dialer audio folder already exists.`)
    }
    // from here on, we assume DIALER_AUDIO_PATH exists and has adequate permissions (755, asterisk:asterisk)

    // secondly, we guarantee that the audio exists, downloading it if needed.
    // this step requires that the audio is being served by a host, and it has the same name, just in case it needs to be downloaded (doesnt exists locally)
    if (!await this.system(`test -e ${DIALER_AUDIO_PATH}/${audio}${AUDIO_FORMAT}`)) {
      console.log(colors.yellow(` > "${audio}" : Audio is not in our system. Trying to donwload...`))
      // audio file does not exist, so we need to download it
      // curl because posix
      let AUDIO_SOURCE = `${AUDIO_SERVER_HOST}${AUDIO_SERVER_BASEPATH}/${audio}${AUDIO_FORMAT}`
      
      if (!await this.system(`curl -o ${DIALER_AUDIO_PATH}/${audio}${AUDIO_FORMAT} ${AUDIO_SOURCE}`)) {
        console.log(colors.red(` > "${audio}" : Could not download audio from "${AUDIO_SOURCE}".`))
        throw new Error('placeholder')
      } else {
        console.log(colors.green(` > "${audio}" : Audio was downloaded successfully.`))
      }

    } else {
      console.log(colors.blue(` > "${audio}" : Audio is already downloaded.`))
    }
  },
  async playbackFromFAGI(audio) {
    let LOCAL_PATH = 'vdialer'
    await this.downloadAudioFAGI(audio) // download audio to local

    // play the audio
    console.log(colors.cyan(` --> Playing "${audio}"`))
    await this.exec('Playback', `${LOCAL_PATH}/${audio}`)
    console.log(` --- Done "${audio}"`)

    // @CHORE:
    // after playback, delete the audio
    // but, if theres another call that uses the same audio, it can't
    // delete the audio, if that happens, it might truncate the audio 
    // from the channel...
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


module.exports = createChannel;
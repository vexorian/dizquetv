const XMLWriter = require('xml-writer');
const fs        = require('fs');

module.exports = { WriteXMLTV, shutdown };

let isShutdown = false;
let isWorking  = false;

// ────────────────────────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────────────────────────
// Anything shorter than this is considered a bump / filler for merge purposes.
const FILLER_MAX_MS = 1 * 60 * 1000;   // 1 minute – tweak in UI later if desired
const FILLER_MS   = 90 * 1000;        // ignore clips < 1½ min
const CONTIG_MS   = 2  * 1000;        // consider ≤2‑second gaps continuous

// ────────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────────────────
async function WriteXMLTV(json, xmlSettings, throttle, cacheImageService) {
  if (isShutdown) return;
  if (isWorking) {
    console.log('Concurrent xmltv write attempt detected, skipping');
    return;
  }
  isWorking = true;
  try {
    await writePromise(json, xmlSettings, throttle, cacheImageService);
  } catch (err) {
    console.error('Error writing xmltv', err);
  } finally {
    isWorking = false;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
function writePromise(json, xmlSettings, throttle, cacheImageService) {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(xmlSettings.file);
    const xw = new XMLWriter(true, (str, enc) => ws.write(str, enc));

    ws.on('finish', resolve);
    ws.on('error', reject);

    _writeDocStart(xw);

    (async () => {
      const channelNumbers = Object.keys(json);
      const channels       = channelNumbers.map(n => json[n].channel);
      _writeChannels(xw, channels);

      for (const number of channelNumbers) {
        const merged = _smartMerge(json[number].programs);
        await _writePrograms(xw, json[number].channel, merged, throttle, xmlSettings, cacheImageService);
      }
    })()
      .then(() => _writeDocEnd(xw, ws))
      .catch(err => console.error('Error', err))
      .finally(() => ws.end());
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// MERGE LOGIC – episode fragments → single block, ignore short fillers
// ────────────────────────────────────────────────────────────────────────────────
function _smartMerge(programs) {
  if (!Array.isArray(programs) || programs.length === 0) return [];

  // Helper functions
  function isFiller(p)           { return Number(p.duration) < FILLER_MS; }
  function ms(t)                 { return Date.parse(t); }
  function gap(a, b)             { return ms(b.start) - ms(a.stop); }

  // Chronological order & only items with valid ISO
  const sorted = programs
    .filter(p => typeof p.start === 'string' && !isNaN(Date.parse(p.start)))
    .sort((a, b) => ms(a.start) - ms(b.start));

  const out = [];
  let cur = null;

  for (const p of sorted) {
    if (isFiller(p)) {                // bump: just extend current block's stop
      if (cur) cur.stop = p.stop;
      continue;
    }
    if ( cur &&
         cur.ratingKey === p.ratingKey &&
         gap(cur, p) <= CONTIG_MS ) { // same ep, continuous ⇒ extend
      cur.stop = p.stop;
    } else {                          // new block
      cur = { 
        start: p.start, 
        stop: p.stop,
        ratingKey: p.ratingKey, 
        title: p.title,
        sub: p.sub, 
        icon: p.icon, 
        summary: p.summary, 
        rating: p.rating 
      };
      out.push(cur);
    }
  }
  
  return out;
}

// ────────────────────────────────────────────────────────────────────────────────
// XML WRITING HELPERS (unchanged below)
// ────────────────────────────────────────────────────────────────────────────────
function _writeDocStart(xw) {
  xw.startDocument();
  xw.startElement('tv');
  xw.writeAttribute('generator-info-name', 'dizquetv');
}

function _writeDocEnd(xw, ws) {
  xw.endElement();
  xw.endDocument();
}

function _writeChannels(xw, channels) {
  for (const ch of channels) {
    xw.startElement('channel');
    xw.writeAttribute('id', ch.number);
    xw.startElement('display-name');
    xw.writeAttribute('lang', 'en');
    xw.text(ch.name);
    xw.endElement();
    if (ch.icon) {
      xw.startElement('icon');
      xw.writeAttribute('src', ch.icon);
      xw.endElement();
    }
    xw.endElement();
  }
}

async function _writePrograms(xw, channel, programs, throttle, xmlSettings, cacheImageService) {
  for (const prog of programs) {
    if (!isShutdown) await throttle();
    await _writeProgramme(channel, prog, xw, xmlSettings, cacheImageService);
  }
}

async function _writeProgramme(channel, prog, xw, xmlSettings, cacheImageService) {
  xw.startElement('programme');
  xw.writeAttribute('start', _xmltvDate(prog.start));
  xw.writeAttribute('stop',  _xmltvDate(prog.stop));
  xw.writeAttribute('channel', channel.number);

  xw.startElement('title');
  xw.writeAttribute('lang', 'en');
  xw.text(prog.title);
  xw.endElement();
  xw.writeRaw('\n        <previously-shown/>');

  if (prog.sub) {
    xw.startElement('sub-title');
    xw.writeAttribute('lang', 'en');
    xw.text(prog.sub.title);
    xw.endElement();

    xw.startElement('episode-num');
    xw.writeAttribute('system', 'onscreen');
    xw.text(`S${prog.sub.season} E${prog.sub.episode}`);
    xw.endElement();

    xw.startElement('episode-num');
    xw.writeAttribute('system', 'xmltv_ns');
    xw.text(`${prog.sub.season - 1}.${prog.sub.episode - 1}.0/1`);
    xw.endElement();
  }

  if (prog.icon) {
    xw.startElement('icon');
    let icon = prog.icon;
    if (xmlSettings.enableImageCache) {
      icon = `{{host}}/cache/images/${cacheImageService.registerImageOnDatabase(icon)}`;
    }
    xw.writeAttribute('src', icon);
    xw.endElement();
  }

  xw.startElement('desc');
  xw.writeAttribute('lang', 'en');
  xw.text(prog.summary && prog.summary.length > 0 ? prog.summary : channel.name);
  xw.endElement();

  if (prog.rating) {
    xw.startElement('rating');
    xw.writeAttribute('system', 'MPAA');
    xw.writeElement('value', prog.rating);
    xw.endElement();
  }

  xw.endElement();
}

function _xmltvDate(iso) {
  return iso.substring(0, 19).replace(/[-T:]/g, '') + ' +0000';
}

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

async function shutdown() {
  isShutdown = true;
  console.log('Shutting down xmltv writer.');
  while (isWorking) {
    console.log('Waiting for xmltv writer to finish…');
    await wait(100);
  }
  console.log('xmltv writer idle.');
}
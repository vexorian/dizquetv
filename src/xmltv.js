const XMLWriter = require('xml-writer');
const fs        = require('fs');
const constants = require('./constants');

module.exports = { WriteXMLTV, shutdown };

let isShutdown = false;
let isWorking  = false;

// ────────────────────────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────────────────────────
// Anything shorter than this is considered a bump / filler for merge purposes.
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
      // Debug logging to see what's happening
      console.log('XMLTV Debug: Writing XMLTV file');
      console.log('XMLTV Debug: Channel numbers:', Object.keys(json));
      
      const channelNumbers = Object.keys(json);
      const channels = channelNumbers.map(n => json[n].channel);
      _writeChannels(xw, channels);

      for (const number of channelNumbers) {
        console.log(`XMLTV Debug: Processing channel ${number}`);
        console.log(`XMLTV Debug: Programs before merge: ${json[number].programs.length}`);
        
        // Check if the programs array exists and has items
        if (!Array.isArray(json[number].programs) || json[number].programs.length === 0) {
          console.error(`XMLTV Debug: ERROR - No programs array or empty array for channel ${number}`);
          continue;
        }
        
        // Check the first few programs
        console.log('XMLTV Debug: Sample programs before merge:');
        json[number].programs.slice(0, 3).forEach((prog, idx) => {
          console.log(`  ${idx+1}. ${prog.title || 'No title'}, start: ${prog.start || 'No start'}, stop: ${prog.stop || 'No stop'}`);
        });
        
        const merged = _smartMerge(json[number].programs);
        console.log(`XMLTV Debug: Programs after merge: ${merged.length}`);
        
        if (merged.length > 0) {
          console.log('XMLTV Debug: Sample programs after merge:');
          merged.slice(0, 3).forEach((prog, idx) => {
            console.log(`  ${idx+1}. ${prog.title || 'No title'}, start: ${prog.start || 'No start'}, stop: ${prog.stop || 'No stop'}`);
          });
        } else {
          console.error('XMLTV Debug: ERROR - No programs after merge');
        }
        
        await _writePrograms(xw, json[number].channel, merged, throttle, xmlSettings, cacheImageService);
      }
    })()
      .then(() => _writeDocEnd(xw, ws))
      .catch(err => console.error('Error', err))
      .finally(() => ws.end());
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// MERGE LOGIC – completely eliminate placeholders
// ────────────────────────────────────────────────────────────────────────────────
function _smartMerge(programs) {
  if (!Array.isArray(programs) || programs.length === 0) {
    return [];
  }

  // Debug log for input
  console.log(`_smartMerge received ${programs.length} programs`);

  // Helper functions
  function ms(t) { 
    try {
      return Date.parse(t); 
    } catch (e) {
      console.error('Error parsing date:', t, e);
      return 0;
    }
  }
  
  function gap(a, b) { 
    try {
      return ms(b.start) - ms(a.stop); 
    } catch (e) {
      console.error('Error calculating gap:', e);
      return 999999; // Large gap to prevent merging on error
    }
  }
  
  function getChannelStealthDuration(channel) {
    if (channel && typeof(channel.guideMinimumDurationSeconds) !== 'undefined' 
        && !isNaN(channel.guideMinimumDurationSeconds)) {
      return channel.guideMinimumDurationSeconds * 1000;
    }
    return constants.DEFAULT_GUIDE_STEALTH_DURATION;
  }
  
  function isProgramFlex(program, channel) {
    const stealthDuration = getChannelStealthDuration(channel);
    return program.isOffline || 
           (program.duration && program.duration <= stealthDuration);
  }
  
  function isSameShow(a, b) {
    // Check if two programs are the same show (can be different episodes)
    if (!a || !b) return false;
    
    // If we have ratingKeys, use those as a definitive check
    if (a.ratingKey && b.ratingKey) {
      // For exact same episode
      if (a.ratingKey === b.ratingKey) return true;
    }
    
    // Check if it's the same show
    if (a.showTitle && b.showTitle && a.showTitle === b.showTitle) {
      // Same show, check if sequential episodes
      if (a.type === 'episode' && b.type === 'episode') {
        if (a.season === b.season) {
          // Same season, check if episodes are sequential
          if (Math.abs((a.episode || 0) - (b.episode || 0)) <= 1) {
            return true;
          }
        }
      }
      // Same movie or generic content
      return a.type === b.type && a.type !== 'episode';
    }
    
    return false;
  }
  
  // New helper function to detect exact duplicates
  function isExactDuplicate(a, b) {
    if (!a || !b) return false;
    
    // Check for identical content
    return a.title === b.title && 
           ((a.sub && b.sub && a.sub.season === b.sub.season && a.sub.episode === b.sub.episode) || 
            (!a.sub && !b.sub)) &&
           a.summary === b.summary &&
           a.rating === b.rating &&
           (a.ratingKey === b.ratingKey || (!a.ratingKey && !b.ratingKey));
  }

  // Get channel from first program if available
  const channel = programs.length > 0 && programs[0].channel ? programs[0].channel : {
    guideMinimumDurationSeconds: constants.DEFAULT_GUIDE_STEALTH_DURATION / 1000,
    name: "dizqueTV"
  };
  
  const flexTitle = channel.guideFlexPlaceholder || channel.name;
  
  // Threshold for considering programs adjacent
  const ADJACENT_THRESHOLD = 30 * 1000; // 30 seconds
  
  // Maximum gap for merging shows of the same title
  const SAME_SHOW_MAX_GAP = 10 * 60 * 1000; // 10 minutes

  // Ensure all programs have the required fields and valid start/stop times
  let validPrograms = programs.filter(p => {
    if (!p.start || !p.stop) {
      return false;
    }
    
    // Ensure title exists
    if (!p.title) {
      p.title = p.showTitle || 'Unknown';
    }
    if (!p.summary) {
      p.summary = '';
    }
    
    // Validate that start is before stop
    const startTime = ms(p.start);
    const stopTime = ms(p.stop);
    return startTime < stopTime;
  });

  // Sort by start time
  validPrograms.sort((a, b) => ms(a.start) - ms(b.start));

  // Step 1: Identify and merge blocks of content that belong together
  const firstPass = [];
  
  for (let i = 0; i < validPrograms.length; i++) {
    const prog = validPrograms[i];
    
    // Skip flex/placeholder programs entirely
    if (isProgramFlex(prog, channel)) {
      continue;
    }
    
    if (firstPass.length === 0) {
      // First program in the list
      firstPass.push(prog);
      continue;
    }
    
    const lastProg = firstPass[firstPass.length - 1];
    const gapDuration = gap(lastProg, prog);
    
    // Handle overlapping or adjacent programs
    if (gapDuration <= ADJACENT_THRESHOLD) {
      // Very small gap or overlap
      if (isSameShow(lastProg, prog) || 
          (lastProg.title === prog.title && lastProg.type === prog.type)) {
        // Merge same content
        lastProg.stop = prog.stop;
      } else {
        // Different regular content - add as separate
        firstPass.push(prog);
      }
    } else if (gapDuration <= SAME_SHOW_MAX_GAP && isSameShow(lastProg, prog)) {
      // Small gap between segments of the same show - merge and include the gap
      lastProg.stop = prog.stop;
    } else {
      // Significant gap or different content - add as separate
      firstPass.push(prog);
    }
  }
  
  // Step 2: Connect all programs to ensure no gaps
  const finalResult = [];
  
  for (let i = 0; i < firstPass.length; i++) {
    const prog = firstPass[i];
    
    if (i === 0) {
      // First program - add as is
      finalResult.push(prog);
      continue;
    }
    
    const lastProg = finalResult[finalResult.length - 1];
    const gapDuration = gap(lastProg, prog);
    
    if (gapDuration > 0) {
      // There's a gap - extend the previous program to close it
      lastProg.stop = prog.start;
    }
    
    // Add the current program
    finalResult.push(prog);
  }
  
  // Step 3: Handle very long segments by splitting if needed
  const splitResult = [];
  
  for (let i = 0; i < finalResult.length; i++) {
    const prog = finalResult[i];
    const duration = ms(prog.stop) - ms(prog.start);
    
    if (duration > constants.TVGUIDE_MAXIMUM_FLEX_DURATION) {
      // Split long content into segments
      let currentStart = new Date(prog.start);
      const endTime = new Date(prog.stop);
      
      while (currentStart < endTime) {
        const segmentEnd = new Date(Math.min(
          currentStart.getTime() + constants.TVGUIDE_MAXIMUM_FLEX_DURATION,
          endTime.getTime()
        ));
        
        splitResult.push({
          ...prog,
          start: currentStart.toISOString(),
          stop: segmentEnd.toISOString()
        });
        
        currentStart = segmentEnd;
      }
    } else {
      // Not too long - add as is
      splitResult.push(prog);
    }
  }
  
  // Final verification to ensure no placeholder/flex content remains
  for (let i = 0; i < splitResult.length; i++) {
    const prog = splitResult[i];
    
    // If somehow a flex/placeholder program made it through, remove it
    if (prog.title === flexTitle || isProgramFlex(prog, channel)) {
      console.error(`ERROR: Flex content found after processing! This should not happen.`);
      
      // If it's not the only program, extend adjacent program(s) to cover this gap
      if (splitResult.length > 1) {
        if (i > 0) {
          // Extend previous program to cover this gap
          splitResult[i - 1].stop = prog.stop;
        } else if (i < splitResult.length - 1) {
          // Extend next program to cover this gap
          splitResult[i + 1].start = prog.start;
        }
        
        // Remove this flex program
        splitResult.splice(i, 1);
        i--; // Adjust index after removal
      }
    }
  }
  
  // Final verification to check for any gaps
  for (let i = 1; i < splitResult.length; i++) {
    const prevStop = ms(splitResult[i-1].stop);
    const currStart = ms(splitResult[i].start);
    
    if (currStart - prevStop > 1000) { // 1 second threshold
      console.error(`ERROR: Gap detected after final processing: ${new Date(prevStop).toISOString()} - ${new Date(currStart).toISOString()}`);
      
      // Fix the gap
      splitResult[i-1].stop = splitResult[i].start;
    }
  }
  
  // Step 4: Merge consecutive identical programs (final pass)
  console.log('XMLTV Debug: Starting final pass to merge identical consecutive programs');
  const deduplicatedResult = [];
  let currentGroup = null;
  let lastProgram = null;
  
  for (let i = 0; i < splitResult.length; i++) {
    const prog = splitResult[i];
    
    if (lastProgram === null) {
      // First program
      lastProgram = prog;
      deduplicatedResult.push(prog);
      continue;
    }
    
    // Check if this is an exact duplicate of the last program
    if (isExactDuplicate(lastProgram, prog) && 
        Math.abs(ms(lastProgram.stop) - ms(prog.start)) <= ADJACENT_THRESHOLD) {
      // Merge by extending the last program
      console.log(`XMLTV Debug: Merging duplicate program: ${prog.title}`);
      lastProgram.stop = prog.stop;
    } else {
      // Different program, add as new
      deduplicatedResult.push(prog);
      lastProgram = prog;
    }
  }
  
  console.log(`XMLTV Debug: Final pass reduced from ${splitResult.length} to ${deduplicatedResult.length} programs`);
  
  console.log(`_smartMerge returning ${deduplicatedResult.length} programs (from original ${programs.length})`);
  return deduplicatedResult;
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
  try {
    // Debug log to identify issues
    console.log(`Writing program: ${prog.title}, start: ${prog.start}, stop: ${prog.stop}`);
    
    // Validate that we have valid ISO date strings
    if (!prog.start || !prog.stop) {
      console.error('ERROR: Program missing start or stop time:', prog);
      return; // Skip this program
    }
    
    // Validate that the dates can be formatted
    try {
      const startDate = _xmltvDate(prog.start);
      const stopDate = _xmltvDate(prog.stop);
      console.log(`Formatted dates: start=${startDate}, stop=${stopDate}`);
    } catch (e) {
      console.error('ERROR: Failed to format dates:', e);
      return; // Skip this program
    }
    
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
  } catch (error) {
    console.error('Error writing program:', error, prog);
  }
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